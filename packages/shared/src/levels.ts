import type { CefrLevel, LanguageCourse, Lesson, Unit } from './types.js';

export const CEFR_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface CefrLevelMeta {
  code: CefrLevel;
  labelPt: string;
  badgePt: string;
  goalPt: string;
  passingAccuracy: number;
  accentBg: string;
  accentBorder: string;
  accentSoft: string;
  accentText: string;
}

export const CEFR_META: Record<CefrLevel, CefrLevelMeta> = {
  A1: {
    code: 'A1',
    labelPt: 'Iniciante',
    badgePt: 'Nível A1 · Base Sólida',
    goalPt: 'Dominar o dia a dia real: casa, cozinha, mercado, escola, trabalho, perguntas, horas e pronúncia inicial.',
    passingAccuracy: 80,
    accentBg: '#1496B0',
    accentBorder: '#0C6F84',
    accentSoft: '#E2F7FB',
    accentText: '#0C6F84',
  },
  A2: {
    code: 'A2',
    labelPt: 'Básico Sólido',
    badgePt: 'Nível A2 · Conversa do Cotidiano',
    goalPt: 'Falar no passado e futuro, resolver compras, saúde, médico, preposições e destruir armadilhas de brasileiros.',
    passingAccuracy: 80,
    accentBg: '#2CB65E',
    accentBorder: '#1D8A45',
    accentSoft: '#E2F9EB',
    accentText: '#1D8A45',
  },
  B1: {
    code: 'B1',
    labelPt: 'Intermediário',
    badgePt: 'Nível B1 · Independência Real',
    goalPt: 'Viajar sozinho, passar na imigração, fazer entrevistas, usar Present Perfect, modais e phrasal verbs com segurança.',
    passingAccuracy: 80,
    accentBg: '#E5A300',
    accentBorder: '#B37A00',
    accentSoft: '#FFF6D6',
    accentText: '#7A5200',
  },
  B2: {
    code: 'B2',
    labelPt: 'Intermediário Superior',
    badgePt: 'Nível B2 · Fluência Profissional',
    goalPt: 'Conduzir reuniões em dólar, entender fala rápida nativa (connected speech), negociar e usar expressões idiomáticas.',
    passingAccuracy: 80,
    accentBg: '#F26522',
    accentBorder: '#C4480E',
    accentSoft: '#FFF0E6',
    accentText: '#A83A08',
  },
  C1: {
    code: 'C1',
    labelPt: 'Avançado',
    badgePt: 'Nível C1 · Domínio Profundo',
    goalPt: 'Falar com precisão executiva, persuasão, inversões sofisticadas, nuances de tom e inglês global.',
    passingAccuracy: 80,
    accentBg: '#C12B5B',
    accentBorder: '#7A1436',
    accentSoft: '#FFE8F0',
    accentText: '#7A1436',
  },
  C2: {
    code: 'C2',
    labelPt: 'Maestria Nativa',
    badgePt: 'Nível C2 · Fluência de Nativo',
    goalPt: 'Pensar, argumentar, brincar e se expressar com a naturalidade, o ritmo e o subtexto cultural de um falante nativo.',
    passingAccuracy: 85,
    accentBg: '#8E1C43',
    accentBorder: '#570D27',
    accentSoft: '#FCE4EC',
    accentText: '#570D27',
  },
};

export interface LessonProgressRecord {
  bestAccuracy: number;
  completedCount: number;
}

export interface CefrLevelProgress {
  cefr: CefrLevel;
  meta: CefrLevelMeta;
  studyUnits: Unit[];
  examUnit: Unit | null;
  examLesson: Lesson | null;
  totalStudyLessons: number;
  completedStudyLessons: number;
  masteredStudyLessons: number;
  averageAccuracy: number;
  allStudyLessonsMastered: boolean;
  unlocked: boolean;
  examReady: boolean;
  examPassed: boolean;
  examBestAccuracy: number;
  nextCefr: CefrLevel | null;
}

export const LESSON_MASTERY_THRESHOLD = 70;

export function getNextCefrLevel(cefr: CefrLevel): CefrLevel | null {
  const idx = CEFR_ORDER.indexOf(cefr);
  if (idx < 0 || idx + 1 >= CEFR_ORDER.length) return null;
  return CEFR_ORDER[idx + 1] ?? null;
}

export function computeCourseLevelProgress(
  course: LanguageCourse,
  completedLessons: Record<string, LessonProgressRecord>,
): CefrLevelProgress[] {
  const presentLevels = CEFR_ORDER.filter((lvl) =>
    course.units.some((u) => u.cefr === lvl),
  );

  const result: CefrLevelProgress[] = [];

  for (let idx = 0; idx < presentLevels.length; idx++) {
    const cefr = presentLevels[idx]!;
    const meta = CEFR_META[cefr];
    const unitsInLevel = course.units.filter((u) => u.cefr === cefr);
    const examUnit =
      unitsInLevel.find((u) => u.isExamUnit || u.lessons.some((l) => l.isLevelExam)) ?? null;
    const studyUnits = unitsInLevel.filter((u) => u !== examUnit);
    const examLesson = examUnit?.lessons.find((l) => l.isLevelExam) ?? examUnit?.lessons[0] ?? null;

    const studyLessons = studyUnits.flatMap((u) => u.lessons);
    let completedCount = 0;
    let masteredCount = 0;
    let accSum = 0;

    for (const lesson of studyLessons) {
      const rec = completedLessons[lesson.id];
      if (rec) {
        completedCount++;
        accSum += rec.bestAccuracy;
        if (rec.bestAccuracy >= LESSON_MASTERY_THRESHOLD) {
          masteredCount++;
        }
      }
    }

    const examRec = examLesson ? completedLessons[examLesson.id] : undefined;
    const requiredPass = examLesson?.passingAccuracy ?? meta.passingAccuracy;
    const examBestAccuracy = examRec?.bestAccuracy ?? 0;
    const examPassed = Boolean(examLesson && examBestAccuracy >= requiredPass);

    const allStudyLessonsMastered =
      studyLessons.length > 0 && masteredCount === studyLessons.length;

    const prevLevel = result[idx - 1];
    // Nível 1 (A1) sempre aberto; próximos níveis liberam SOMENTE quando o aluno completa e domina
    // todas as etapas do nível anterior E passa na Prova Oficial de Passagem (≥ 80%).
    const unlocked =
      idx === 0 ||
      Boolean(prevLevel?.allStudyLessonsMastered && prevLevel?.examPassed);

    const nextCefr = presentLevels[idx + 1] ?? null;

    result.push({
      cefr,
      meta,
      studyUnits,
      examUnit,
      examLesson,
      totalStudyLessons: studyLessons.length,
      completedStudyLessons: completedCount,
      masteredStudyLessons: masteredCount,
      averageAccuracy: completedCount > 0 ? Math.round(accSum / completedCount) : 0,
      allStudyLessonsMastered,
      unlocked,
      examReady: unlocked && allStudyLessonsMastered,
      examPassed: unlocked && allStudyLessonsMastered && examPassed,
      examBestAccuracy,
      nextCefr,
    });
  }

  return result;
}
