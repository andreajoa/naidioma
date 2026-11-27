import { CEFR_ORDER } from '../levels.js';
import type {
  ConversationScenario,
  FlashcardSeed,
  LanguageCode,
  LanguageCourse,
  Lesson,
  Unit,
} from '../types.js';
import { ENGLISH_COURSE } from './en.js';
import {
  ENGLISH_A1_EXAM_UNIT,
  ENGLISH_A1_EXTRA_UNITS,
  ENGLISH_A2_EXAM_UNIT,
  ENGLISH_A2_EXTRA_UNITS,
} from './en-a1-a2.js';
import {
  ENGLISH_B1_EXAM_UNIT,
  ENGLISH_B1_EXTRA_UNITS,
  ENGLISH_B2_EXAM_UNIT,
  ENGLISH_B2_EXTRA_UNITS,
  ENGLISH_C1_EXAM_UNIT,
  ENGLISH_C1_UNITS,
  ENGLISH_C2_EXAM_UNIT,
  ENGLISH_C2_UNITS,
} from './en-b1-c2.js';
import {
  ENGLISH_A1_EXPANSION_UNITS,
  ENGLISH_A2_EXPANSION_UNITS,
  ENGLISH_B1_EXPANSION_UNITS,
  ENGLISH_B2_EXPANSION_UNITS,
  ENGLISH_C1_EXPANSION_UNITS,
  ENGLISH_C2_EXPANSION_UNITS,
  ENGLISH_EXTRA_SCENARIOS,
} from './en-mastery-expansion.js';
import {
  ENGLISH_A1_GIU_UNITS,
  ENGLISH_A2_GIU_UNITS,
  ENGLISH_B1_GIU_UNITS,
  ENGLISH_B2_GIU_UNITS,
  ENGLISH_C1_GIU_UNITS,
  ENGLISH_C2_GIU_UNITS,
} from './en-grammar-in-use.js';
import {
  FRENCH_COURSE,
  GERMAN_COURSE,
  ITALIAN_COURSE,
  SPANISH_COURSE,
} from './european.js';
import {
  FRENCH_MASTERY_UNITS,
  GERMAN_MASTERY_UNITS,
  ITALIAN_MASTERY_UNITS,
  SPANISH_MASTERY_UNITS,
} from './european-mastery.js';
import {
  CHINESE_COURSE,
  JAPANESE_COURSE,
  KOREAN_COURSE,
} from './asian.js';
import {
  CHINESE_MASTERY_UNITS,
  JAPANESE_MASTERY_UNITS,
  KOREAN_MASTERY_UNITS,
} from './asian-mastery.js';
import { buildDailyLifeUnits } from './daily-life.js';
import { attachMissingLevelExams } from './level-exams.js';

function buildFullEnglishCourse(): LanguageCourse {
  const daily = buildDailyLifeUnits('en');
  const baseById = new Map(ENGLISH_COURSE.units.map((u) => [u.id, u]));

  const a1First = baseById.get('en-u1');
  const a2Base = baseById.get('en-u2');
  const b1Base = baseById.get('en-u3');
  const b2Base = baseById.get('en-u4');

  const orderedUnits: Unit[] = [
    // NÍVEL A1 — 14 etapas completas (26 lições) + Prova Oficial A1 -> A2
    ...(a1First ? [a1First] : []),
    ...daily.units,
    ...ENGLISH_A1_EXTRA_UNITS,
    ...ENGLISH_A1_EXPANSION_UNITS,
    ...ENGLISH_A1_GIU_UNITS,
    ENGLISH_A1_EXAM_UNIT,

    // NÍVEL A2 — 13 etapas completas (20 lições) + Prova Oficial A2 -> B1
    ...(a2Base ? [a2Base] : []),
    ...ENGLISH_A2_EXTRA_UNITS,
    ...ENGLISH_A2_EXPANSION_UNITS,
    ...ENGLISH_A2_GIU_UNITS,
    ENGLISH_A2_EXAM_UNIT,

    // NÍVEL B1 — 12 etapas completas (18 lições) + Prova Oficial B1 -> B2
    ...(b1Base ? [b1Base] : []),
    ...ENGLISH_B1_EXTRA_UNITS,
    ...ENGLISH_B1_EXPANSION_UNITS,
    ...ENGLISH_B1_GIU_UNITS,
    ENGLISH_B1_EXAM_UNIT,

    // NÍVEL B2 — 10 etapas completas (14 lições) + Prova Oficial B2 -> C1
    ...(b2Base ? [b2Base] : []),
    ...ENGLISH_B2_EXTRA_UNITS,
    ...ENGLISH_B2_EXPANSION_UNITS,
    ...ENGLISH_B2_GIU_UNITS,
    ENGLISH_B2_EXAM_UNIT,

    // NÍVEL C1 — 8 etapas completas (11 lições) + Prova Oficial C1 -> C2
    ...ENGLISH_C1_UNITS,
    ...ENGLISH_C1_EXPANSION_UNITS,
    ...ENGLISH_C1_GIU_UNITS,
    ENGLISH_C1_EXAM_UNIT,

    // NÍVEL C2 — 7 etapas de Maestria Nativa (9 lições) + Exame Final C2
    ...ENGLISH_C2_UNITS,
    ...ENGLISH_C2_EXPANSION_UNITS,
    ...ENGLISH_C2_GIU_UNITS,
    ENGLISH_C2_EXAM_UNIT,
  ].map((unit, idx) => ({
    ...unit,
    order: idx + 1,
  }));

  return {
    ...ENGLISH_COURSE,
    units: orderedUnits,
    scenarios: [...daily.scenarios, ...ENGLISH_COURSE.scenarios, ...ENGLISH_EXTRA_SCENARIOS],
  };
}

function enrichCourseWithMastery(base: LanguageCourse, masteryUnits: Unit[] = []): LanguageCourse {
  const daily = buildDailyLifeUnits(base.meta.code);
  const firstUnit = base.units[0];
  const remainingUnits = base.units.slice(1);
  // Coloca Casa/Cozinha/Mercado e Escola/Criança/Trabalho logo após a Etapa 1 inicial e adiciona toda a trilha A1 -> C2!
  const merged = [
    ...(firstUnit ? [firstUnit] : []),
    ...daily.units,
    ...remainingUnits,
    ...masteryUnits,
  ];

  // Mantém a ordem crescente de nível CEFR (A1 -> A2 -> B1 -> B2 -> C1 -> C2)
  const byCefr = CEFR_ORDER.flatMap((lvl) => merged.filter((u) => u.cefr === lvl)).map(
    (unit, idx) => ({
      ...unit,
      order: idx + 1,
    }),
  );

  return attachMissingLevelExams({
    ...base,
    units: byCefr,
    scenarios: [...daily.scenarios, ...base.scenarios],
  });
}

export const COURSES: Record<LanguageCode, LanguageCourse> = {
  en: buildFullEnglishCourse(),
  es: enrichCourseWithMastery(SPANISH_COURSE, SPANISH_MASTERY_UNITS),
  fr: enrichCourseWithMastery(FRENCH_COURSE, FRENCH_MASTERY_UNITS),
  de: enrichCourseWithMastery(GERMAN_COURSE, GERMAN_MASTERY_UNITS),
  it: enrichCourseWithMastery(ITALIAN_COURSE, ITALIAN_MASTERY_UNITS),
  ja: enrichCourseWithMastery(JAPANESE_COURSE, JAPANESE_MASTERY_UNITS),
  zh: enrichCourseWithMastery(CHINESE_COURSE, CHINESE_MASTERY_UNITS),
  ko: enrichCourseWithMastery(KOREAN_COURSE, KOREAN_MASTERY_UNITS),
};

export function getCourse(language: LanguageCode): LanguageCourse {
  return COURSES[language];
}

export function getLessonById(lessonId: string): {
  language: LanguageCode;
  unitId: string;
  lesson: Lesson;
} | null {
  for (const course of Object.values(COURSES)) {
    for (const unit of course.units) {
      const lesson = unit.lessons.find((item) => item.id === lessonId);
      if (lesson) {
        return {
          language: course.meta.code,
          unitId: unit.id,
          lesson,
        };
      }
    }
  }
  return null;
}

export function getScenarioById(scenarioId: string): ConversationScenario | null {
  for (const course of Object.values(COURSES)) {
    const scenario = course.scenarios.find((item) => item.id === scenarioId);
    if (scenario) return scenario;
  }
  return null;
}

export function getAllFlashcards(language: LanguageCode): FlashcardSeed[] {
  const course = COURSES[language];
  const derived: FlashcardSeed[] = [...course.flashcards];
  const seen = new Set(derived.map((c) => c.front.toLowerCase()));

  for (const unit of course.units) {
    if (unit.isExamUnit) continue;
    for (const lesson of unit.lessons) {
      if (lesson.isLevelExam) continue;
      for (const ex of lesson.exercises) {
        if (seen.has(ex.targetText.toLowerCase())) continue;
        seen.add(ex.targetText.toLowerCase());
        derived.push({
          id: `auto-${ex.id}`,
          language,
          front: ex.targetText,
          reading: ex.reading,
          ipaOrPhoneticBr: ex.ipaOrPhoneticBr,
          backPt: ex.translationPt,
          exampleTarget: ex.targetText,
          exampleReading: ex.reading,
          examplePt: ex.translationPt,
          brazilianTipPt: ex.brazilianTipPt,
          cefr: lesson.cefr,
        });
      }
    }
  }

  return derived;
}
