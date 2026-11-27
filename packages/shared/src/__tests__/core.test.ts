import { describe, expect, it } from 'vitest';
import {
  CEFR_ORDER,
  COURSES,
  ConversationScenarioSchema,
  FlashcardSeedSchema,
  LANGUAGE_LIST,
  NAIDIOMA_PLANS,
  UnitSchema,
  computeCourseLevelProgress,
  createInitialFsrsCard,
  diffTokenSequences,
  evaluatePronunciation,
  formatBrl,
  getAllFlashcards,
  previewFsrsIntervals,
  scheduleFsrsReview,
} from '../index.js';

describe('NAidioma Shared Core', () => {
  it('defines all 8 target languages with English flagship first', () => {
    expect(LANGUAGE_LIST).toHaveLength(8);
    expect(LANGUAGE_LIST[0]?.code).toBe('en');
    expect(LANGUAGE_LIST[0]?.flagship).toBe(true);
    const codes = LANGUAGE_LIST.map((l) => l.code);
    expect(codes).toEqual(['en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko']);
  });

  it('defines compatible Brazilian billing plans ready for Stripe activation', () => {
    expect(NAIDIOMA_PLANS.length).toBeGreaterThanOrEqual(5);
    const plusYearly = NAIDIOMA_PLANS.find((p) => p.key === 'plus_yearly');
    expect(plusYearly?.priceCentsBrl).toBe(21480);
    expect(formatBrl(2990)).toContain('29,90');
  });

  it('validates every unit, lesson, exercise, scenario, flashcard, and unique IDs across all 8 languages (A1 -> C2)', () => {
    const seenUnitIds = new Set<string>();
    const seenLessonIds = new Set<string>();
    const seenExerciseIds = new Set<string>();

    for (const lang of LANGUAGE_LIST) {
      const course = COURSES[lang.code];
      expect(course.units.length).toBeGreaterThanOrEqual(6);
      expect(course.scenarios.length).toBeGreaterThanOrEqual(1);
      expect(course.flashcards.length).toBeGreaterThanOrEqual(2);

      // Every language now covers full CEFR A1 -> C2 with official mastery exams
      const levels = computeCourseLevelProgress(course, {});
      expect(levels.map((l) => l.cefr), `${lang.code} missing CEFR levels`).toEqual(CEFR_ORDER);
      for (const lvl of levels) {
        expect(lvl.studyUnits.length, `${lang.code} ${lvl.cefr} study units`).toBeGreaterThanOrEqual(1);
        expect(lvl.examLesson, `${lang.code} ${lvl.cefr} exam missing`).toBeTruthy();
      }

      for (const unit of course.units) {
        expect(seenUnitIds.has(unit.id), `Duplicate unit id ${unit.id}`).toBe(false);
        seenUnitIds.add(unit.id);

        const parsed = UnitSchema.safeParse(unit);
        expect(parsed.success, `Unit ${unit.id} schema failed`).toBe(true);

        for (const lesson of unit.lessons) {
          expect(seenLessonIds.has(lesson.id), `Duplicate lesson id ${lesson.id}`).toBe(false);
          seenLessonIds.add(lesson.id);

          for (const ex of lesson.exercises) {
            expect(seenExerciseIds.has(ex.id), `Duplicate exercise id ${ex.id}`).toBe(false);
            seenExerciseIds.add(ex.id);
          }
        }
      }

      for (const scenario of course.scenarios) {
        const parsed = ConversationScenarioSchema.safeParse(scenario);
        expect(parsed.success, `Scenario ${scenario.id} failed`).toBe(true);
      }

      for (const card of getAllFlashcards(lang.code)) {
        const parsed = FlashcardSeedSchema.safeParse(card);
        expect(parsed.success, `Flashcard ${card.id} failed`).toBe(true);
      }
    }

    // English flagship deep curriculum check (many serious stages per CEFR level + Grammar in Use pillars)
    const enLevels = computeCourseLevelProgress(COURSES.en, {});
    expect(enLevels.find((l) => l.cefr === 'A1')?.studyUnits.length).toBeGreaterThanOrEqual(14);
    expect(enLevels.find((l) => l.cefr === 'A2')?.studyUnits.length).toBeGreaterThanOrEqual(13);
    expect(enLevels.find((l) => l.cefr === 'B1')?.studyUnits.length).toBeGreaterThanOrEqual(12);
    expect(enLevels.find((l) => l.cefr === 'B2')?.studyUnits.length).toBeGreaterThanOrEqual(10);
    expect(enLevels.find((l) => l.cefr === 'C1')?.studyUnits.length).toBeGreaterThanOrEqual(8);
    expect(enLevels.find((l) => l.cefr === 'C2')?.studyUnits.length).toBeGreaterThanOrEqual(7);
  });

  it('enforces strict CEFR level mastery gating before unlocking official exam and next level', () => {
    const en = COURSES.en;
    const initial = computeCourseLevelProgress(en, {});
    const a1Initial = initial[0]!;
    const a2Initial = initial[1]!;

    expect(a1Initial.unlocked).toBe(true);
    expect(a1Initial.examReady).toBe(false);
    expect(a2Initial.unlocked).toBe(false);

    // Passing exam alone WITHOUT completing all A1 study lessons must NOT unlock A2
    const examOnly = computeCourseLevelProgress(en, {
      [a1Initial.examLesson!.id]: { bestAccuracy: 100, completedCount: 1 },
    });
    expect(examOnly[0]!.examReady).toBe(false);
    expect(examOnly[0]!.examPassed).toBe(false);
    expect(examOnly[1]!.unlocked).toBe(false);

    // Completing all A1 study lessons with >= 70% unlocks the A1 Official Exam, but A2 stays locked
    const allA1Lessons = a1Initial.studyUnits.flatMap((u) => u.lessons);
    const masteredMap: Record<string, { bestAccuracy: number; completedCount: number }> = {};
    for (const l of allA1Lessons) {
      masteredMap[l.id] = { bestAccuracy: 85, completedCount: 1 };
    }
    const readyForExam = computeCourseLevelProgress(en, masteredMap);
    expect(readyForExam[0]!.allStudyLessonsMastered).toBe(true);
    expect(readyForExam[0]!.examReady).toBe(true);
    expect(readyForExam[1]!.unlocked).toBe(false);

    // Failing exam (62% < 80%) keeps A2 locked
    const failedExam = computeCourseLevelProgress(en, {
      ...masteredMap,
      [a1Initial.examLesson!.id]: { bestAccuracy: 62, completedCount: 1 },
    });
    expect(failedExam[0]!.examPassed).toBe(false);
    expect(failedExam[1]!.unlocked).toBe(false);

    // Passing exam (>= 80%) unlocks A2 while B1 remains locked
    const passedExam = computeCourseLevelProgress(en, {
      ...masteredMap,
      [a1Initial.examLesson!.id]: { bestAccuracy: 88, completedCount: 1 },
    });
    expect(passedExam[0]!.examPassed).toBe(true);
    expect(passedExam[1]!.unlocked).toBe(true);
    expect(passedExam[2]!.unlocked).toBe(false);
  });

  it('schedules FSRS-4.5 intervals accurately across ratings', () => {
    const now = new Date('2026-11-27T12:00:00.000Z');
    const card = createInitialFsrsCard(now);

    const previews = previewFsrsIntervals(card, now);
    expect(previews[1]).toBe('10 min');

    const good = scheduleFsrsReview(card, 3, now);
    expect(good.intervalDays).toBeGreaterThanOrEqual(1);
    expect(good.nextCard.reps).toBe(1);
    expect(good.nextCard.state).toBe('review');

    const later = new Date(now.getTime() + good.intervalDays * 86_400_000);
    const secondGood = scheduleFsrsReview(good.nextCard, 3, later);
    expect(secondGood.intervalDays).toBeGreaterThan(good.intervalDays);

    const lapse = scheduleFsrsReview(secondGood.nextCard, 1, later);
    expect(lapse.nextCard.lapses).toBe(1);
    expect(lapse.intervalDays).toBe(0);
    expect(lapse.nextCard.state).toBe('relearning');
  });

  it('scores voice pronunciation accurately for normal, paused word-by-word, contractions, numbers, and consensus rescue', () => {
    const enPass = evaluatePronunciation(
      'Nice to meet you what do you do',
      'Nice to meet you, what do you do?',
      'en',
    );
    expect(enPass.passed).toBe(true);
    expect(enPass.score).toBe(100);

    // Paused word-by-word where Web Speech transcribes isolated "a" as "uh"
    const pausedA = evaluatePronunciation(
      'Can I get uh glass of water please',
      'Can I get a glass of water, please?',
      'en',
    );
    expect(pausedA.passed).toBe(true);
    expect(pausedA.missingWords).toEqual([]);

    // Spoken year "twenty twenty one" matching "2021."
    const yearMatch = evaluatePronunciation(
      'She has worked at that company since twenty twenty one',
      'She has worked at that company since 2021.',
      'en',
    );
    expect(yearMatch.passed).toBe(true);
    expect(yearMatch.score).toBe(100);

    // Multi-hypothesis consensus rescue (Web Speech dropped "a", Whisper/alt captured "a")
    const rescued = evaluatePronunciation(
      'I would like glass of water please',
      'I would like a glass of water, please.',
      'en',
      [],
      ['I would like a glass of water please'],
    );
    expect(rescued.passed).toBe(true);
    expect(rescued.missingWords).toEqual([]);

    // Honest mistake detection: missing words and substitutions MUST be clearly flagged
    const mistake = evaluatePronunciation(
      'I work home',
      'I was walking home when it started to rain.',
      'en',
    );
    expect(mistake.passed).toBe(false);
    expect(mistake.missingWords.length).toBeGreaterThanOrEqual(4);

    const jaPass = evaluatePronunciation('ブラジルから来ました', 'ブラジルから来ました。', 'ja');
    expect(jaPass.passed).toBe(true);

    const empty = evaluatePronunciation('', 'Hello world', 'en');
    expect(empty.passed).toBe(false);
    expect(empty.score).toBe(0);
  });

  it('produces exact position-aware token diffs for clear error feedback', () => {
    const diff = diffTokenSequences(['Where', 'you', 'live?'], ['Where', 'do', 'you', 'live?']);
    expect(diff).toEqual([
      { kind: 'match', expected: 'Where', actual: 'Where' },
      { kind: 'missing', expected: 'do' },
      { kind: 'match', expected: 'you', actual: 'you' },
      { kind: 'match', expected: 'live?', actual: 'live?' },
    ]);
  });
});
