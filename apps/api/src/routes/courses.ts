import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  LANGUAGE_LIST,
  LESSON_MASTERY_THRESHOLD,
  LanguageCodeSchema,
  computeCourseLevelProgress,
  createInitialFsrsCard,
  getAllFlashcards,
  getCourse,
  getLessonById,
  previewFsrsIntervals,
  scheduleFsrsReview,
  type FsrsCardState,
  type FsrsRating,
} from '@naidioma/shared';
import { prisma } from '../lib/prisma.js';
import { requireUser } from './auth.js';

const CompleteLessonSchema = z.object({
  accuracy: z.number().int().min(0).max(100),
  durationSeconds: z.number().int().min(5).max(3600).optional(),
  speakingScore: z.number().int().min(0).max(100).optional(),
});

const ReviewSubmitSchema = z.object({
  language: LanguageCodeSchema,
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDateKey(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export async function registerCourseRoutes(app: FastifyInstance) {
  app.get('/api/courses', async (req) => {
    const user = await requireUser(req);
    const completedMap = new Map<string, number>();

    if (user) {
      const progress = await prisma.lessonProgress.findMany({
        where: { userId: user.id },
        select: { language: true, lessonId: true },
      });
      for (const row of progress) {
        completedMap.set(row.language, (completedMap.get(row.language) ?? 0) + 1);
      }
    }

    return {
      languages: LANGUAGE_LIST.map((lang) => {
        const course = getCourse(lang.code);
        const totalLessons = course.units.reduce((acc, u) => acc + u.lessons.length, 0);
        return {
          ...lang,
          totalUnits: course.units.length,
          totalLessons,
          totalScenarios: course.scenarios.length,
          completedLessons: completedMap.get(lang.code) ?? 0,
        };
      }),
    };
  });

  app.get('/api/courses/:lang', async (req, reply) => {
    const params = z.object({ lang: LanguageCodeSchema }).safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Idioma não suportado.' });
    }

    const lang = params.data.lang;
    const course = getCourse(lang);
    const user = await requireUser(req);

    let completedLessons: Record<string, { bestAccuracy: number; completedCount: number }> = {};
    let skills = { speaking: 10, listening: 10, reading: 10, writing: 10, vocabulary: 10 };
    let dueReviewsCount = course.flashcards.length;

    if (user) {
      const [progressRows, skillRow, savedCards] = await Promise.all([
        prisma.lessonProgress.findMany({
          where: { userId: user.id, language: lang },
        }),
        prisma.skillScore.findUnique({
          where: { userId_language: { userId: user.id, language: lang } },
        }),
        prisma.fsrsCard.findMany({
          where: { userId: user.id, language: lang },
        }),
      ]);

      completedLessons = Object.fromEntries(
        progressRows.map((p) => [
          p.lessonId,
          { bestAccuracy: p.bestAccuracy, completedCount: p.completedCount },
        ]),
      );

      if (skillRow) {
        skills = {
          speaking: skillRow.speaking,
          listening: skillRow.listening,
          reading: skillRow.reading,
          writing: skillRow.writing,
          vocabulary: skillRow.vocabulary,
        };
      }

      const now = Date.now();
      const allCards = getAllFlashcards(lang);
      const cardById = new Map(savedCards.map((c) => [c.cardId, c]));
      dueReviewsCount = allCards.filter((seed) => {
        const stored = cardById.get(seed.id);
        return !stored || stored.dueAt.getTime() <= now;
      }).length;
    }

    return {
      course,
      progress: {
        completedLessons,
        skills,
        dueReviewsCount,
      },
    };
  });

  app.post('/api/lessons/:lessonId/complete', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Faça login ou entre no modo beta.' });

    const { lessonId } = req.params as { lessonId: string };
    const found = getLessonById(lessonId);
    if (!found) return reply.status(404).send({ error: 'Lição não encontrada.' });

    const parsed = CompleteLessonSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Payload de conclusão inválido.' });
    }

    const { accuracy, durationSeconds } = parsed.data;
    const safeDuration = Math.max(0, durationSeconds ?? 0);
    const { language, lesson } = found;
    const course = getCourse(language);

    // Exige domínio real de TODAS as etapas do nível antes de aceitar a Prova Oficial de Passagem!
    if (lesson.isLevelExam) {
      const progressRows = await prisma.lessonProgress.findMany({
        where: { userId: user.id, language },
      });
      const completedMap = Object.fromEntries(
        progressRows.map((p) => [
          p.lessonId,
          { bestAccuracy: p.bestAccuracy, completedCount: p.completedCount },
        ]),
      );
      const levels = computeCourseLevelProgress(course, completedMap);
      const targetLevel = levels.find((l) => l.cefr === lesson.cefr);
      if (targetLevel && !targetLevel.examReady) {
        const remaining = targetLevel.totalStudyLessons - targetLevel.masteredStudyLessons;
        return reply.status(403).send({
          error: `Conclua e domine todas as etapas do Nível ${lesson.cefr} (≥ ${LESSON_MASTERY_THRESHOLD}%) antes da Prova Oficial. Faltam ${remaining} atividade(s).`,
        });
      }
    }

    const passingAccuracy = lesson.passingAccuracy ?? 80;
    const passedExam = !lesson.isLevelExam || accuracy >= passingAccuracy;
    const xpGained = Math.max(15, Math.round((lesson.xpReward * Math.max(50, accuracy)) / 100));

    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
    });

    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: {
        userId: user.id,
        language,
        lessonId,
        bestAccuracy: accuracy,
        lastAccuracy: accuracy,
        xpEarned: xpGained,
        completedCount: 1,
        totalDurationSeconds: safeDuration,
        lastDurationSeconds: safeDuration,
      },
      update: {
        bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
        lastAccuracy: accuracy,
        xpEarned: (existing?.xpEarned ?? 0) + xpGained,
        completedCount: { increment: 1 },
        totalDurationSeconds: { increment: safeDuration },
        lastDurationSeconds: safeDuration,
        completedAt: new Date(),
      },
    });

    // Update streak & activity timestamp
    const today = todayDateKey();
    const yesterday = yesterdayDateKey();
    let streakDays = user.streakDays;
    if (user.lastStudyDate !== today) {
      streakDays = user.lastStudyDate === yesterday ? user.streakDays + 1 : 1;
    }
    const longestStreak = Math.max(user.longestStreak, streakDays);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        xpTotal: { increment: xpGained },
        streakDays,
        longestStreak,
        lastStudyDate: today,
        lastActiveAt: new Date(),
      },
    });

    void prisma.analyticsEvent
      .create({
        data: {
          visitorId: user.visitorId || `user:${user.id}`,
          userId: user.id,
          eventType: lesson.isLevelExam
            ? passedExam
              ? 'exam_passed'
              : 'exam_failed'
            : 'lesson_completed',
          language,
          cefr: lesson.cefr,
          lessonId,
          screen: 'lesson',
          valueNum: accuracy,
          city: user.city,
          country: user.country,
          platform: user.lastPlatform ?? 'web',
        },
      })
      .catch(() => {});

    // Update 5-dimension skill scores
    const currentSkill = await prisma.skillScore.findUnique({
      where: { userId_language: { userId: user.id, language } },
    });
    const bump = accuracy >= 80 ? 8 : 5;
    const nextSkill = {
      speaking: Math.min(100, (currentSkill?.speaking ?? 10) + (lesson.focusSkill === 'speaking' ? bump : 3)),
      listening: Math.min(100, (currentSkill?.listening ?? 10) + (lesson.focusSkill === 'listening' ? bump : 3)),
      reading: Math.min(100, (currentSkill?.reading ?? 10) + (lesson.focusSkill === 'reading' ? bump : 2)),
      writing: Math.min(100, (currentSkill?.writing ?? 10) + (lesson.focusSkill === 'writing' ? bump : 2)),
      vocabulary: Math.min(100, (currentSkill?.vocabulary ?? 10) + (lesson.focusSkill === 'vocabulary' ? bump : 4)),
    };

    await prisma.skillScore.upsert({
      where: { userId_language: { userId: user.id, language } },
      create: { userId: user.id, language, ...nextSkill },
      update: nextSkill,
    });

    return {
      xpGained,
      streakDays: updatedUser.streakDays,
      xpTotal: updatedUser.xpTotal,
      skills: nextSkill,
      levelExam: lesson.isLevelExam
        ? {
            cefr: lesson.cefr,
            passed: passedExam,
            passingAccuracy,
            unlockedNextCefr: passedExam ? lesson.unlocksCefr ?? null : null,
          }
        : null,
    };
  });

  app.get('/api/review/:lang', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão necessária.' });

    const params = z.object({ lang: LanguageCodeSchema }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Idioma inválido.' });

    const lang = params.data.lang;
    const seeds = getAllFlashcards(lang);
    const stored = await prisma.fsrsCard.findMany({
      where: { userId: user.id, language: lang },
    });
    const byId = new Map(stored.map((c) => [c.cardId, c]));
    const now = new Date();

    const deck = seeds.map((seed) => {
      const row = byId.get(seed.id);
      const cardState: FsrsCardState = row
        ? {
            stability: row.stability,
            difficulty: row.difficulty,
            elapsedDays: row.elapsedDays,
            scheduledDays: row.scheduledDays,
            reps: row.reps,
            lapses: row.lapses,
            state: row.state as FsrsCardState['state'],
            dueAt: row.dueAt.toISOString(),
            lastReviewAt: row.lastReviewAt ? row.lastReviewAt.toISOString() : null,
          }
        : createInitialFsrsCard(now);

      return {
        ...seed,
        fsrs: cardState,
        isDue: new Date(cardState.dueAt).getTime() <= now.getTime(),
        intervalPreviews: previewFsrsIntervals(cardState, now),
      };
    });

    const dueCards = deck.filter((c) => c.isDue);
    return {
      dueCount: dueCards.length,
      totalCount: deck.length,
      cards: dueCards.length > 0 ? dueCards : deck.slice(0, 6),
    };
  });

  app.post('/api/review/:cardId', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão necessária.' });

    const { cardId } = req.params as { cardId: string };
    const parsed = ReviewSubmitSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Avaliação FSRS inválida.' });

    const now = new Date();
    const existing = await prisma.fsrsCard.findUnique({
      where: { userId_cardId: { userId: user.id, cardId } },
    });

    const currentState: FsrsCardState = existing
      ? {
          stability: existing.stability,
          difficulty: existing.difficulty,
          elapsedDays: existing.elapsedDays,
          scheduledDays: existing.scheduledDays,
          reps: existing.reps,
          lapses: existing.lapses,
          state: existing.state as FsrsCardState['state'],
          dueAt: existing.dueAt.toISOString(),
          lastReviewAt: existing.lastReviewAt ? existing.lastReviewAt.toISOString() : null,
        }
      : createInitialFsrsCard(now);

    const scheduled = scheduleFsrsReview(currentState, parsed.data.rating as FsrsRating, now);

    await prisma.fsrsCard.upsert({
      where: { userId_cardId: { userId: user.id, cardId } },
      create: {
        userId: user.id,
        language: parsed.data.language,
        cardId,
        stability: scheduled.nextCard.stability,
        difficulty: scheduled.nextCard.difficulty,
        elapsedDays: scheduled.nextCard.elapsedDays,
        scheduledDays: scheduled.nextCard.scheduledDays,
        reps: scheduled.nextCard.reps,
        lapses: scheduled.nextCard.lapses,
        state: scheduled.nextCard.state,
        dueAt: new Date(scheduled.nextCard.dueAt),
        lastReviewAt: now,
      },
      update: {
        stability: scheduled.nextCard.stability,
        difficulty: scheduled.nextCard.difficulty,
        elapsedDays: scheduled.nextCard.elapsedDays,
        scheduledDays: scheduled.nextCard.scheduledDays,
        reps: scheduled.nextCard.reps,
        lapses: scheduled.nextCard.lapses,
        state: scheduled.nextCard.state,
        dueAt: new Date(scheduled.nextCard.dueAt),
        lastReviewAt: now,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { xpTotal: { increment: 5 }, lastActiveAt: now },
    });

    void prisma.analyticsEvent
      .create({
        data: {
          visitorId: user.visitorId || `user:${user.id}`,
          userId: user.id,
          eventType: 'review_completed',
          language: parsed.data.language,
          screen: 'review',
          valueNum: parsed.data.rating,
          city: user.city,
          country: user.country,
          platform: user.lastPlatform ?? 'web',
        },
      })
      .catch(() => {});

    return {
      cardId,
      nextCard: scheduled.nextCard,
      intervalDays: scheduled.intervalDays,
      retrievability: scheduled.retrievability,
    };
  });
}
