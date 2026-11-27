import type {
  ConversationScenario,
  FlashcardSeed,
  LanguageCode,
  LanguageCourse,
  Lesson,
} from '../types.js';
import { ENGLISH_COURSE } from './en.js';
import {
  FRENCH_COURSE,
  GERMAN_COURSE,
  ITALIAN_COURSE,
  SPANISH_COURSE,
} from './european.js';
import {
  CHINESE_COURSE,
  JAPANESE_COURSE,
  KOREAN_COURSE,
} from './asian.js';
import { buildDailyLifeUnits } from './daily-life.js';

function enrichCourseWithDailyLife(base: LanguageCourse): LanguageCourse {
  const daily = buildDailyLifeUnits(base.meta.code);
  const firstUnit = base.units[0];
  const remainingUnits = base.units.slice(1);
  // Coloca Casa/Cozinha/Mercado e Escola/Criança/Trabalho logo após a Etapa 1 inicial!
  const mergedUnits = [
    ...(firstUnit ? [firstUnit] : []),
    ...daily.units,
    ...remainingUnits,
  ].map((unit, idx) => ({
    ...unit,
    order: idx + 1,
  }));

  return {
    ...base,
    units: mergedUnits,
    scenarios: [...daily.scenarios, ...base.scenarios],
  };
}

export const COURSES: Record<LanguageCode, LanguageCourse> = {
  en: enrichCourseWithDailyLife(ENGLISH_COURSE),
  es: enrichCourseWithDailyLife(SPANISH_COURSE),
  fr: enrichCourseWithDailyLife(FRENCH_COURSE),
  de: enrichCourseWithDailyLife(GERMAN_COURSE),
  it: enrichCourseWithDailyLife(ITALIAN_COURSE),
  ja: enrichCourseWithDailyLife(JAPANESE_COURSE),
  zh: enrichCourseWithDailyLife(CHINESE_COURSE),
  ko: enrichCourseWithDailyLife(KOREAN_COURSE),
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
    for (const lesson of unit.lessons) {
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
