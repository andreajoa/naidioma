import { describe, expect, it } from 'vitest';
import {
  COURSES,
  ConversationScenarioSchema,
  FlashcardSeedSchema,
  LANGUAGE_LIST,
  NAIDIOMA_PLANS,
  UnitSchema,
  createInitialFsrsCard,
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

  it('validates every unit, lesson, exercise, scenario, and flashcard across all 8 languages', () => {
    for (const lang of LANGUAGE_LIST) {
      const course = COURSES[lang.code];
      expect(course.units.length).toBeGreaterThanOrEqual(1);
      expect(course.scenarios.length).toBeGreaterThanOrEqual(1);
      expect(course.flashcards.length).toBeGreaterThanOrEqual(2);

      for (const unit of course.units) {
        const parsed = UnitSchema.safeParse(unit);
        expect(parsed.success, `Unit ${unit.id} schema failed`).toBe(true);
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

  it('scores voice pronunciation across Latin and CJK scripts', () => {
    const enPass = evaluatePronunciation(
      'Nice to meet you what do you do',
      'Nice to meet you, what do you do?',
      'en',
    );
    expect(enPass.passed).toBe(true);
    expect(enPass.score).toBe(100);

    const jaPass = evaluatePronunciation('ブラジルから来ました', 'ブラジルから来ました。', 'ja');
    expect(jaPass.passed).toBe(true);

    const empty = evaluatePronunciation('', 'Hello world', 'en');
    expect(empty.passed).toBe(false);
    expect(empty.score).toBe(0);
  });
});
