import { CEFR_META, CEFR_ORDER } from '../levels.js';
import type { Exercise, LanguageCourse, Unit } from '../types.js';

/**
 * Ensures every CEFR level present in a course ends with an Official Level Mastery Exam
 * (e.g. `ko-exam-a1`, `es-exam-a1`) so learners must prove mastery (>= 80%) before advancing.
 */
export function attachMissingLevelExams(course: LanguageCourse): LanguageCourse {
  const presentLevels = CEFR_ORDER.filter((lvl) =>
    course.units.some((u) => u.cefr === lvl),
  );

  const rebuiltUnits: Unit[] = [];

  for (let i = 0; i < presentLevels.length; i++) {
    const cefr = presentLevels[i]!;
    const nextCefr = presentLevels[i + 1];
    const levelUnits = course.units.filter((u) => u.cefr === cefr);
    rebuiltUnits.push(...levelUnits);

    const alreadyHasExam = levelUnits.some(
      (u) => u.isExamUnit || u.lessons.some((l) => l.isLevelExam),
    );
    if (alreadyHasExam) continue;

    // Gather varied real exercises across all study stages of this CEFR level
    const pool = levelUnits
      .flatMap((u) => u.lessons)
      .flatMap((l) => l.exercises)
      .filter((e) => e.type !== 'match_pairs');

    const picked: Exercise[] = [];
    const seenTargets = new Set<string>();
    const preferredOrder: Array<Exercise['type']> = [
      'picture_choice',
      'context_choice',
      'trap_buster',
      'dialogue_complete',
      'listen_build',
      'speak_pronounce',
      'script_lab',
    ];

    // First pick at least one of each skill type for a balanced exam
    for (const kind of preferredOrder) {
      for (const ex of pool) {
        if (picked.length >= 6) break;
        if (ex.type !== kind) continue;
        const key = ex.targetText.toLowerCase();
        if (seenTargets.has(key)) continue;
        seenTargets.add(key);
        picked.push(ex);
        break;
      }
    }

    // Fill up to 6 diverse exam exercises (preferring distinct targets first)
    for (const ex of pool) {
      if (picked.length >= 6) break;
      const key = ex.targetText.toLowerCase();
      if (seenTargets.has(key)) continue;
      seenTargets.add(key);
      picked.push(ex);
    }

    // If a level has >= 3 exercises across different skills sharing a target phrase,
    // allow distinct exercise IDs so NO CEFR level ever ships without an Official Exam
    if (picked.length < 3) {
      const pickedIds = new Set(picked.map((e) => e.id));
      for (const ex of pool) {
        if (picked.length >= 3) break;
        if (pickedIds.has(ex.id)) continue;
        pickedIds.add(ex.id);
        picked.push(ex);
      }
    }

    if (picked.length < 3) continue;

    const code = course.meta.code;
    const examUnitId = `${code}-${cefr.toLowerCase()}-exam-unit`;
    const examLessonId = `${code}-exam-${cefr.toLowerCase()}`;
    const meta = CEFR_META[cefr];
    const examExercises: Exercise[] = picked.map((ex, idx) => ({
      ...ex,
      id: `${examLessonId}-e${idx + 1}`,
      promptPt: `[Prova ${cefr}] ${ex.promptPt}`,
    }));

    rebuiltUnits.push({
      id: examUnitId,
      language: code,
      order: 99,
      cefr,
      isExamUnit: true,
      titlePt: nextCefr
        ? `🎓 Prova Oficial de Passagem — Nível ${cefr} → ${nextCefr}`
        : `👑 Exame Final de Domínio — Nível ${cefr}`,
      descriptionPt: nextCefr
        ? `Prove que você dominou todas as etapas do Nível ${cefr} em ${course.meta.namePt}! Acerte ≥ ${meta.passingAccuracy}% para desbloquear o Nível ${nextCefr}.`
        : `Prove seu domínio completo do Nível ${cefr} em ${course.meta.namePt} (mínimo ${meta.passingAccuracy}%)!`,
      culturalNotePt: `Concluir esta prova com ≥ ${meta.passingAccuracy}% confirma que você realmente memorizou o conteúdo do Nível ${cefr}.`,
      grammarFocusPt: `Revisão Completa do Nível ${cefr} · Audição · Leitura · Fala`,
      lessons: [
        {
          id: examLessonId,
          unitId: examUnitId,
          order: 1,
          titlePt: nextCefr
            ? `Exame de Passagem ${cefr} → ${nextCefr}`
            : `Exame de Domínio ${cefr}`,
          subtitlePt: `${examExercises.length} desafios avaliativos reais (mínimo ${meta.passingAccuracy}%)`,
          durationMinutes: 7,
          xpReward: 150,
          cefr,
          focusSkill: 'speaking',
          isLevelExam: true,
          passingAccuracy: meta.passingAccuracy,
          unlocksCefr: nextCefr,
          exercises: examExercises,
        },
      ],
    });
  }

  return {
    ...course,
    units: rebuiltUnits.map((u, idx) => ({ ...u, order: idx + 1 })),
  };
}
