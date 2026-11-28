import {
  CEFR_ORDER,
  LANGUAGE_LIST,
  LANGUAGES,
  computeCourseLevelProgress,
  getCourse,
  getLessonById,
  type CefrLevel,
  type LanguageCode,
} from '@naidioma/shared';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { sendTransactionalEmail } from './email.js';

export type ReportPeriodType = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface DateWindow {
  periodType: ReportPeriodType;
  start: Date;
  end: Date;
  labelPt: string;
}

export interface UserLanguageStanding {
  language: LanguageCode;
  languageNamePt: string;
  currentCefr: CefrLevel;
  highestPassedCefr: CefrLevel | null;
  levelProgressPct: number;
  completedLessons: number;
  masteredLessons: number;
  totalCourseLessons: number;
  averageAccuracy: number;
  studySeconds: number;
  examsPassed: number;
  fsrsReviews: number;
  isActive: boolean;
}

export interface DashboardUserRow {
  id: string;
  displayName: string;
  email: string;
  whatsapp: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  locationLabel: string;
  locationSource: string | null;
  activeLanguage: LanguageCode;
  activeLanguageNamePt: string;
  activeCefr: CefrLevel;
  activeLevelProgressPct: number;
  languagesStudied: UserLanguageStanding[];
  totalTimeSeconds: number;
  sessionsCount: number;
  avgSessionSeconds: number;
  lessonsCompleted: number;
  examsPassed: number;
  averageAccuracy: number;
  fsrsReviewsCount: number;
  aiTurnsTotal: number;
  feedbacksCount: number;
  xpTotal: number;
  streakDays: number;
  longestStreak: number;
  dailyGoalMinutes: number;
  lastStudyDate: string | null;
  lastActiveAt: string | null;
  lastPlatform: string | null;
  lastDeviceType: string | null;
  lastOs: string | null;
  lastBrowser: string | null;
  pwaInstalled: boolean;
  calmModeEnabled: boolean;
  marketingOptIn: boolean;
  leadSource: string;
  utmCampaign: string | null;
  subscriptionTier: string;
  createdAt: string;
}

export interface ProductRecommendation {
  id: string;
  severity: 'high' | 'medium' | 'info';
  area: 'conversao' | 'pedagogico' | 'retencao' | 'tecnico' | 'crescimento';
  title: string;
  detail: string;
  metricBadge: string;
}

export function resolveDateWindow(
  rangeRaw?: string,
  fromRaw?: string,
  toRaw?: string,
): DateWindow {
  const now = new Date();
  if (rangeRaw === 'custom' && fromRaw) {
    const start = new Date(fromRaw);
    const end = toRaw ? new Date(toRaw) : now;
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      return {
        periodType: 'custom',
        start,
        end,
        labelPt: `${start.toISOString().slice(0, 10)} a ${end.toISOString().slice(0, 10)}`,
      };
    }
  }

  if (rangeRaw === '7d') {
    return {
      periodType: '7d',
      start: new Date(now.getTime() - 7 * 86_400_000),
      end: now,
      labelPt: 'Últimos 7 dias',
    };
  }
  if (rangeRaw === '90d') {
    return {
      periodType: '90d',
      start: new Date(now.getTime() - 90 * 86_400_000),
      end: now,
      labelPt: 'Últimos 90 dias',
    };
  }
  if (rangeRaw === 'all') {
    return {
      periodType: 'all',
      start: new Date('2025-01-01T00:00:00.000Z'),
      end: now,
      labelPt: 'Todo o histórico',
    };
  }

  return {
    periodType: '30d',
    start: new Date(now.getTime() - 30 * 86_400_000),
    end: now,
    labelPt: 'Últimos 30 dias',
  };
}

function formatLocationLabel(
  city?: string | null,
  region?: string | null,
  country?: string | null,
): string {
  const parts: string[] = [];
  if (city) parts.push(city);
  if (region && region !== city) parts.push(region);
  if (country && country !== 'BR') parts.push(country);
  if (parts.length === 0 && country) return country;
  return parts.length > 0 ? parts.join(' · ') : 'Não identificada';
}

function isValidLang(code: string): code is LanguageCode {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, code);
}

export function computeUserLanguageStandings(
  activeLanguageRaw: string,
  lessonRows: Array<{
    language: string;
    lessonId: string;
    bestAccuracy: number;
    completedCount: number;
    totalDurationSeconds: number;
  }>,
  fsrsRows: Array<{ language: string; reps: number }>,
  convRows: Array<{ language: string }>,
): UserLanguageStanding[] {
  const activeLang: LanguageCode = isValidLang(activeLanguageRaw) ? activeLanguageRaw : 'en';
  const langSet = new Set<LanguageCode>([activeLang]);
  for (const row of lessonRows) {
    if (isValidLang(row.language)) langSet.add(row.language);
  }
  for (const row of fsrsRows) {
    if (isValidLang(row.language)) langSet.add(row.language);
  }
  for (const row of convRows) {
    if (isValidLang(row.language)) langSet.add(row.language);
  }

  const standings: UserLanguageStanding[] = [];
  for (const lang of langSet) {
    const course = getCourse(lang);
    const langLessons = lessonRows.filter((r) => r.language === lang);
    const completedMap = Object.fromEntries(
      langLessons.map((r) => [
        r.lessonId,
        { bestAccuracy: r.bestAccuracy, completedCount: r.completedCount },
      ]),
    );
    const levels = computeCourseLevelProgress(course, completedMap);

    let currentLevel = levels[0];
    let highestPassedCefr: CefrLevel | null = null;
    let examsPassed = 0;

    for (const lvl of levels) {
      if (lvl.unlocked) {
        currentLevel = lvl;
      }
      if (lvl.examPassed) {
        highestPassedCefr = lvl.cefr;
        examsPassed += 1;
      }
    }

    const totalCourseLessons = course.units.reduce((acc, u) => acc + u.lessons.length, 0);
    const masteredLessons = levels.reduce((acc, l) => acc + l.masteredStudyLessons, 0);
    const avgAcc =
      langLessons.length > 0
        ? Math.round(langLessons.reduce((acc, r) => acc + r.bestAccuracy, 0) / langLessons.length)
        : 0;
    const studySeconds = langLessons.reduce((acc, r) => acc + r.totalDurationSeconds, 0);
    const fsrsReviews = fsrsRows
      .filter((f) => f.language === lang)
      .reduce((acc, f) => acc + f.reps, 0);

    const levelProgressPct =
      currentLevel && currentLevel.totalStudyLessons > 0
        ? Math.round((currentLevel.masteredStudyLessons / currentLevel.totalStudyLessons) * 100)
        : 0;

    standings.push({
      language: lang,
      languageNamePt: LANGUAGES[lang].namePt,
      currentCefr: currentLevel?.cefr ?? 'A1',
      highestPassedCefr,
      levelProgressPct,
      completedLessons: langLessons.length,
      masteredLessons,
      totalCourseLessons,
      averageAccuracy: avgAcc,
      studySeconds,
      examsPassed,
      fsrsReviews,
      isActive: lang === activeLang,
    });
  }

  standings.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (b.completedLessons !== a.completedLessons) return b.completedLessons - a.completedLessons;
    return b.studySeconds - a.studySeconds;
  });

  return standings;
}

function parseScreensMap(raw: string): Record<string, number> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function buildEnrichedUsers(): Promise<DashboardUserRow[]> {
  const [users, lessons, fsrs, conversations, aiDaily, feedbacks] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.lessonProgress.findMany({
      select: {
        userId: true,
        language: true,
        lessonId: true,
        bestAccuracy: true,
        completedCount: true,
        totalDurationSeconds: true,
      },
    }),
    prisma.fsrsCard.findMany({
      select: { userId: true, language: true, reps: true },
    }),
    prisma.conversationSession.findMany({
      select: { userId: true, language: true },
    }),
    prisma.aiUsageDaily.findMany({
      select: { userId: true, turnsUsed: true },
    }),
    prisma.betaFeedback.findMany({
      where: { userId: { not: null } },
      select: { userId: true },
    }),
  ]);

  const lessonsByUser = new Map<string, typeof lessons>();
  for (const row of lessons) {
    const arr = lessonsByUser.get(row.userId) ?? [];
    arr.push(row);
    lessonsByUser.set(row.userId, arr);
  }

  const fsrsByUser = new Map<string, typeof fsrs>();
  for (const row of fsrs) {
    const arr = fsrsByUser.get(row.userId) ?? [];
    arr.push(row);
    fsrsByUser.set(row.userId, arr);
  }

  const convByUser = new Map<string, typeof conversations>();
  for (const row of conversations) {
    const arr = convByUser.get(row.userId) ?? [];
    arr.push(row);
    convByUser.set(row.userId, arr);
  }

  const aiTurnsByUser = new Map<string, number>();
  for (const row of aiDaily) {
    aiTurnsByUser.set(row.userId, (aiTurnsByUser.get(row.userId) ?? 0) + row.turnsUsed);
  }

  const feedbacksByUser = new Map<string, number>();
  for (const row of feedbacks) {
    if (row.userId) {
      feedbacksByUser.set(row.userId, (feedbacksByUser.get(row.userId) ?? 0) + 1);
    }
  }

  return users.map((u) => {
    const uLessons = lessonsByUser.get(u.id) ?? [];
    const uFsrs = fsrsByUser.get(u.id) ?? [];
    const uConv = convByUser.get(u.id) ?? [];
    const standings = computeUserLanguageStandings(u.activeLanguage, uLessons, uFsrs, uConv);
    const activeStanding = standings[0];
    const activeLang: LanguageCode = isValidLang(u.activeLanguage) ? u.activeLanguage : 'en';
    const lessonTimeFallback = uLessons.reduce((acc, r) => acc + r.totalDurationSeconds, 0);
    const effectiveTotalSeconds = Math.max(u.totalTimeSeconds, lessonTimeFallback);
    const sessionsCount = Math.max(u.sessionsCount, uLessons.length > 0 ? 1 : 0);
    const avgSessionSeconds =
      sessionsCount > 0 ? Math.round(effectiveTotalSeconds / sessionsCount) : 0;
    const avgAccuracy =
      uLessons.length > 0
        ? Math.round(uLessons.reduce((acc, r) => acc + r.bestAccuracy, 0) / uLessons.length)
        : 0;
    const examsPassed = standings.reduce((acc, s) => acc + s.examsPassed, 0);
    const fsrsReviewsCount = uFsrs.reduce((acc, f) => acc + f.reps, 0);

    return {
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      whatsapp: u.whatsapp,
      city: u.city,
      region: u.region,
      country: u.country,
      locationLabel: formatLocationLabel(u.city, u.region, u.country),
      locationSource: u.locationSource,
      activeLanguage: activeLang,
      activeLanguageNamePt: LANGUAGES[activeLang].namePt,
      activeCefr: activeStanding?.currentCefr ?? 'A1',
      activeLevelProgressPct: activeStanding?.levelProgressPct ?? 0,
      languagesStudied: standings,
      totalTimeSeconds: effectiveTotalSeconds,
      sessionsCount,
      avgSessionSeconds,
      lessonsCompleted: uLessons.length,
      examsPassed,
      averageAccuracy: avgAccuracy,
      fsrsReviewsCount,
      aiTurnsTotal: aiTurnsByUser.get(u.id) ?? 0,
      feedbacksCount: feedbacksByUser.get(u.id) ?? 0,
      xpTotal: u.xpTotal,
      streakDays: u.streakDays,
      longestStreak: u.longestStreak,
      dailyGoalMinutes: u.dailyGoalMinutes,
      lastStudyDate: u.lastStudyDate,
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
      lastPlatform: u.lastPlatform,
      lastDeviceType: u.lastDeviceType,
      lastOs: u.lastOs,
      lastBrowser: u.lastBrowser,
      pwaInstalled: u.pwaInstalled,
      calmModeEnabled: u.calmModeEnabled,
      marketingOptIn: u.marketingOptIn,
      leadSource: u.leadSource,
      utmCampaign: u.utmCampaign,
      subscriptionTier: u.subscriptionTier,
      createdAt: u.createdAt.toISOString(),
    };
  });
}

export async function buildDashboardSummary(window: DateWindow) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

  const [enrichedUsers, sessionsInWindow, eventsInWindow, allLessonRows, pushActiveCount, openFeedbackCount] =
    await Promise.all([
      buildEnrichedUsers(),
      prisma.visitorSession.findMany({
        where: { startedAt: { gte: window.start, lte: window.end } },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: window.start, lte: window.end } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lessonProgress.findMany({
        select: {
          userId: true,
          language: true,
          lessonId: true,
          bestAccuracy: true,
          lastAccuracy: true,
          completedCount: true,
          totalDurationSeconds: true,
          completedAt: true,
        },
      }),
      prisma.pushSubscription.count({ where: { active: true } }),
      prisma.betaFeedback.count({ where: { status: { not: 'resolved' } } }),
    ]);

  const totalRegisteredUsers = enrichedUsers.length;
  const newUsersInPeriod = enrichedUsers.filter((u) => {
    const d = new Date(u.createdAt);
    return d >= window.start && d <= window.end;
  });

  const uniqueVisitorIds = new Set<string>(sessionsInWindow.map((s) => s.visitorId));
  for (const u of newUsersInPeriod) {
    uniqueVisitorIds.add(`user:${u.id}`);
  }
  const uniqueVisitors = uniqueVisitorIds.size;
  const totalSessions = sessionsInWindow.length;
  const anonymousVisitorsOnly = new Set(
    sessionsInWindow.filter((s) => !s.userId).map((s) => s.visitorId),
  ).size;

  const dau = enrichedUsers.filter(
    (u) => u.lastActiveAt && new Date(u.lastActiveAt) >= oneDayAgo,
  ).length;
  const wau = enrichedUsers.filter(
    (u) => u.lastActiveAt && new Date(u.lastActiveAt) >= sevenDaysAgo,
  ).length;
  const mau = enrichedUsers.filter(
    (u) => u.lastActiveAt && new Date(u.lastActiveAt) >= thirtyDaysAgo,
  ).length;

  const sessionTotalSeconds = sessionsInWindow.reduce((acc, s) => acc + s.durationSeconds, 0);
  const allUsersTotalSeconds = enrichedUsers.reduce((acc, u) => acc + u.totalTimeSeconds, 0);
  const effectivePeriodSeconds =
    window.periodType === 'all'
      ? Math.max(sessionTotalSeconds, allUsersTotalSeconds)
      : sessionTotalSeconds;
  const avgSessionSeconds =
    totalSessions > 0 ? Math.round(sessionTotalSeconds / totalSessions) : 0;
  const activeUsersWithTime = enrichedUsers.filter((u) => u.totalTimeSeconds > 0);
  const avgSecondsPerUser =
    activeUsersWithTime.length > 0
      ? Math.round(
          activeUsersWithTime.reduce((acc, u) => acc + u.totalTimeSeconds, 0) /
            activeUsersWithTime.length,
        )
      : 0;

  const lessonsInPeriod = allLessonRows.filter(
    (r) => r.completedAt >= window.start && r.completedAt <= window.end,
  );
  const totalLessonsCompletedAllTime = allLessonRows.length;
  const totalAiTurnsAllTime = enrichedUsers.reduce((acc, u) => acc + u.aiTurnsTotal, 0);
  const totalFsrsReviewsAllTime = enrichedUsers.reduce((acc, u) => acc + u.fsrsReviewsCount, 0);
  const pwaInstalledUsers = enrichedUsers.filter((u) => u.pwaInstalled).length;
  const calmModeUsers = enrichedUsers.filter((u) => u.calmModeEnabled).length;
  const optInUsers = enrichedUsers.filter((u) => u.marketingOptIn).length;

  const visitorToSignupRate =
    uniqueVisitors > 0 ? Math.min(100, Math.round((newUsersInPeriod.length / uniqueVisitors) * 1000) / 10) : 0;
  const activationRate =
    totalRegisteredUsers > 0
      ? Math.round(
          (enrichedUsers.filter((u) => u.lessonsCompleted >= 1).length / totalRegisteredUsers) * 1000,
        ) / 10
      : 0;
  const stickinessPct = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;

  // Conversion & Activation Funnel
  const startedOnboardingVisitors = new Set(
    eventsInWindow
      .filter((e) => e.eventType === 'onboarding_language_picked' || e.eventType === 'signup_started')
      .map((e) => e.visitorId),
  ).size;
  const usersWith1Lesson = enrichedUsers.filter((u) => u.lessonsCompleted >= 1).length;
  const usersWith3Lessons = enrichedUsers.filter((u) => u.lessonsCompleted >= 3).length;
  const usersWithAi = enrichedUsers.filter((u) => u.aiTurnsTotal >= 1).length;
  const usersReturnedMultiDay = enrichedUsers.filter((u) => u.longestStreak >= 2 || u.sessionsCount >= 2).length;

  const funnelBase = Math.max(uniqueVisitors, totalRegisteredUsers, 1);
  const funnel = [
    { step: 'Visitantes únicos', count: Math.max(uniqueVisitors, totalRegisteredUsers), pct: 100 },
    {
      step: 'Iniciaram escolha/cadastro',
      count: Math.max(startedOnboardingVisitors, totalRegisteredUsers),
      pct: Math.min(100, Math.round((Math.max(startedOnboardingVisitors, totalRegisteredUsers) / funnelBase) * 100)),
    },
    {
      step: 'Concluíram cadastro',
      count: totalRegisteredUsers,
      pct: Math.min(100, Math.round((totalRegisteredUsers / funnelBase) * 100)),
    },
    {
      step: 'Fizeram 1ª lição (Ativação)',
      count: usersWith1Lesson,
      pct: Math.min(100, Math.round((usersWith1Lesson / funnelBase) * 100)),
    },
    {
      step: 'Fizeram 3+ lições',
      count: usersWith3Lessons,
      pct: Math.min(100, Math.round((usersWith3Lessons / funnelBase) * 100)),
    },
    {
      step: 'Usaram Tutor IA / Voz',
      count: usersWithAi,
      pct: Math.min(100, Math.round((usersWithAi / funnelBase) * 100)),
    },
    {
      step: 'Retornaram (2+ sessões/dias)',
      count: usersReturnedMultiDay,
      pct: Math.min(100, Math.round((usersReturnedMultiDay / funnelBase) * 100)),
    },
  ];

  // Daily Timeline (capped to last 30 days for clean chart readability, or 90d)
  const timelineDays = window.periodType === '7d' ? 7 : window.periodType === '90d' ? 45 : 30;
  const timelineMap = new Map<
    string,
    { date: string; sessions: number; uniqueVisitors: Set<string>; signups: number; lessons: number; minutes: number }
  >();
  for (let i = timelineDays - 1; i >= 0; i--) {
    const d = new Date(window.end.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    timelineMap.set(key, {
      date: key,
      sessions: 0,
      uniqueVisitors: new Set<string>(),
      signups: 0,
      lessons: 0,
      minutes: 0,
    });
  }

  for (const s of sessionsInWindow) {
    const key = s.startedAt.toISOString().slice(0, 10);
    const slot = timelineMap.get(key);
    if (slot) {
      slot.sessions += 1;
      slot.uniqueVisitors.add(s.visitorId);
      slot.minutes += Math.round(s.durationSeconds / 60);
    }
  }
  for (const u of enrichedUsers) {
    const key = u.createdAt.slice(0, 10);
    const slot = timelineMap.get(key);
    if (slot) slot.signups += 1;
  }
  for (const l of lessonsInPeriod) {
    const key = l.completedAt.toISOString().slice(0, 10);
    const slot = timelineMap.get(key);
    if (slot) slot.lessons += 1;
  }

  const timeline = Array.from(timelineMap.values()).map((slot) => ({
    date: slot.date,
    sessions: slot.sessions,
    uniqueVisitors: slot.uniqueVisitors.size,
    signups: slot.signups,
    lessons: slot.lessons,
    minutes: slot.minutes,
  }));

  // Peak Hours (0..23 BRT UTC-3) & Weekday activity
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0, minutes: 0 }));
  const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const weekdayCounts = weekdayLabels.map((label, dayIndex) => ({
    dayIndex,
    label,
    sessions: 0,
    minutes: 0,
  }));

  for (const s of sessionsInWindow) {
    // Shift to America/Sao_Paulo (-3h) for Brazil-centric readability
    const brtDate = new Date(s.startedAt.getTime() - 3 * 3600 * 1000);
    const h = brtDate.getUTCHours();
    const wd = brtDate.getUTCDay();
    hourlyCounts[h]!.sessions += 1;
    hourlyCounts[h]!.minutes += Math.round(s.durationSeconds / 60);
    weekdayCounts[wd]!.sessions += 1;
    weekdayCounts[wd]!.minutes += Math.round(s.durationSeconds / 60);
  }

  // Languages Breakdown (active + studied + CEFR distribution per language)
  const languageBreakdown = LANGUAGE_LIST.map((meta) => {
    const activeUsersCount = enrichedUsers.filter((u) => u.activeLanguage === meta.code).length;
    const studyingStandings = enrichedUsers.flatMap((u) =>
      u.languagesStudied.filter((s) => s.language === meta.code),
    );
    const cefrCounts: Record<CefrLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    for (const s of studyingStandings) {
      cefrCounts[s.currentCefr] += 1;
    }
    const langLessonRows = allLessonRows.filter((r) => r.language === meta.code);
    const avgAccuracy =
      langLessonRows.length > 0
        ? Math.round(langLessonRows.reduce((acc, r) => acc + r.bestAccuracy, 0) / langLessonRows.length)
        : 0;
    const studyMinutes = Math.round(
      langLessonRows.reduce((acc, r) => acc + r.totalDurationSeconds, 0) / 60,
    );

    return {
      code: meta.code,
      namePt: meta.namePt,
      nativeName: meta.nativeName,
      accentHex: meta.accentHex,
      activeUsers: activeUsersCount,
      totalLearners: studyingStandings.length,
      lessonsCompleted: langLessonRows.length,
      avgAccuracy,
      studyMinutes,
      cefrCounts,
    };
  }).sort((a, b) => b.activeUsers - a.activeUsers || b.lessonsCompleted - a.lessonsCompleted);

  // Overall CEFR distribution (by user's active language)
  const cefrDistribution = CEFR_ORDER.map((cefr) => {
    const count = enrichedUsers.filter((u) => u.activeCefr === cefr).length;
    return {
      cefr,
      count,
      pct: totalRegisteredUsers > 0 ? Math.round((count / totalRegisteredUsers) * 1000) / 10 : 0,
    };
  });

  // Geographic Breakdown (Cities, Regions, Countries)
  const cityAgg = new Map<
    string,
    {
      city: string;
      region: string | null;
      country: string | null;
      sessions: number;
      visitors: Set<string>;
      users: Set<string>;
      totalSeconds: number;
    }
  >();

  for (const s of sessionsInWindow) {
    const cityName = s.city || 'Não identificada';
    const key = `${cityName}||${s.region ?? ''}||${s.country ?? ''}`;
    const entry = cityAgg.get(key) ?? {
      city: cityName,
      region: s.region,
      country: s.country,
      sessions: 0,
      visitors: new Set<string>(),
      users: new Set<string>(),
      totalSeconds: 0,
    };
    entry.sessions += 1;
    entry.visitors.add(s.visitorId);
    if (s.userId) entry.users.add(s.userId);
    entry.totalSeconds += s.durationSeconds;
    cityAgg.set(key, entry);
  }

  for (const u of enrichedUsers) {
    const cityName = u.city || 'Não identificada';
    const key = `${cityName}||${u.region ?? ''}||${u.country ?? ''}`;
    const entry = cityAgg.get(key) ?? {
      city: cityName,
      region: u.region,
      country: u.country,
      sessions: 0,
      visitors: new Set<string>(),
      users: new Set<string>(),
      totalSeconds: 0,
    };
    entry.users.add(u.id);
    if (entry.totalSeconds === 0 && u.totalTimeSeconds > 0) {
      entry.totalSeconds += u.totalTimeSeconds;
    }
    cityAgg.set(key, entry);
  }

  const topCities = Array.from(cityAgg.values())
    .map((c) => ({
      city: c.city,
      region: c.region,
      country: c.country,
      label: formatLocationLabel(c.city === 'Não identificada' ? null : c.city, c.region, c.country),
      sessions: c.sessions,
      uniqueVisitors: c.visitors.size,
      registeredUsers: c.users.size,
      totalMinutes: Math.round(c.totalSeconds / 60),
    }))
    .sort((a, b) => b.registeredUsers - a.registeredUsers || b.sessions - a.sessions)
    .slice(0, 30);

  const countryAgg = new Map<string, { country: string; sessions: number; users: Set<string> }>();
  for (const c of cityAgg.values()) {
    const code = c.country || 'N/I';
    const entry = countryAgg.get(code) ?? { country: code, sessions: 0, users: new Set<string>() };
    entry.sessions += c.sessions;
    for (const u of c.users) entry.users.add(u);
    countryAgg.set(code, entry);
  }
  const topCountries = Array.from(countryAgg.values())
    .map((c) => ({ country: c.country, sessions: c.sessions, registeredUsers: c.users.size }))
    .sort((a, b) => b.registeredUsers - a.registeredUsers || b.sessions - a.sessions);

  // Screen / Feature Time Breakdown
  const screenSeconds = new Map<string, number>();
  for (const s of sessionsInWindow) {
    const map = parseScreensMap(s.screensJson);
    for (const [screen, secs] of Object.entries(map)) {
      screenSeconds.set(screen, (screenSeconds.get(screen) ?? 0) + secs);
    }
  }
  const totalScreenSecs = Array.from(screenSeconds.values()).reduce((a, b) => a + b, 0) || 1;
  const screenLabels: Record<string, string> = {
    learn: 'Trilha de Estudos',
    lesson: 'Player de Lições',
    alphabet: 'Letras / Hangul',
    conversation: 'Chat Tutor IA',
    live_call: 'Chamada ao Vivo IA',
    review: 'Revisão FSRS',
    profile: 'Perfil & Config',
    auth: 'Tela Inicial / Cadastro',
  };
  const screenUsage = Array.from(screenSeconds.entries())
    .map(([screen, seconds]) => ({
      screen,
      label: screenLabels[screen] ?? screen,
      seconds,
      minutes: Math.round(seconds / 60),
      pct: Math.round((seconds / totalScreenSecs) * 1000) / 10,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  // Lesson Difficulty & Abandonment Diagnostics
  const lessonAgg = new Map<
    string,
    {
      lessonId: string;
      language: string;
      titlePt: string;
      cefr: string;
      isLevelExam: boolean;
      completions: number;
      attempts: number;
      accSum: number;
      durationSum: number;
      abandons: number;
    }
  >();

  for (const row of allLessonRows) {
    const meta = getLessonById(row.lessonId);
    const entry = lessonAgg.get(row.lessonId) ?? {
      lessonId: row.lessonId,
      language: row.language,
      titlePt: meta?.lesson.titlePt ?? row.lessonId,
      cefr: meta?.lesson.cefr ?? 'A1',
      isLevelExam: Boolean(meta?.lesson.isLevelExam),
      completions: 0,
      attempts: 0,
      accSum: 0,
      durationSum: 0,
      abandons: 0,
    };
    entry.completions += 1;
    entry.attempts += row.completedCount;
    entry.accSum += row.bestAccuracy;
    entry.durationSum += row.totalDurationSeconds;
    lessonAgg.set(row.lessonId, entry);
  }

  for (const ev of eventsInWindow) {
    if (ev.eventType === 'lesson_abandoned' && ev.lessonId) {
      const meta = getLessonById(ev.lessonId);
      const entry = lessonAgg.get(ev.lessonId) ?? {
        lessonId: ev.lessonId,
        language: ev.language ?? meta?.language ?? 'en',
        titlePt: meta?.lesson.titlePt ?? ev.lessonId,
        cefr: ev.cefr ?? meta?.lesson.cefr ?? 'A1',
        isLevelExam: Boolean(meta?.lesson.isLevelExam),
        completions: 0,
        attempts: 0,
        accSum: 0,
        durationSum: 0,
        abandons: 0,
      };
      entry.abandons += 1;
      lessonAgg.set(ev.lessonId, entry);
    }
  }

  const lessonDiagnostics = Array.from(lessonAgg.values()).map((l) => ({
    lessonId: l.lessonId,
    language: l.language,
    titlePt: l.titlePt,
    cefr: l.cefr,
    isLevelExam: l.isLevelExam,
    completions: l.completions,
    attempts: l.attempts,
    avgAccuracy: l.completions > 0 ? Math.round(l.accSum / l.completions) : 0,
    avgDurationSeconds: l.attempts > 0 ? Math.round(l.durationSum / l.attempts) : 0,
    abandons: l.abandons,
    retryRatio: l.completions > 0 ? Math.round((l.attempts / l.completions) * 10) / 10 : 0,
  }));

  const hardestLessons = [...lessonDiagnostics]
    .filter((l) => l.completions > 0 || l.abandons > 0)
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy || b.abandons - a.abandons)
    .slice(0, 12);

  const mostPopularLessons = [...lessonDiagnostics]
    .sort((a, b) => b.completions - a.completions || b.attempts - a.attempts)
    .slice(0, 10);

  // Exam stats
  const examPassedEvents = eventsInWindow.filter((e) => e.eventType === 'exam_passed').length;
  const examFailedEvents = eventsInWindow.filter((e) => e.eventType === 'exam_failed').length;

  // Devices, Platforms, Entry Pages, Sources
  const countBy = (items: Array<string | null | undefined>, fallback = 'Desconhecido') => {
    const map = new Map<string, number>();
    for (const item of items) {
      const k = item?.trim() || fallback;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  };

  const platformBreakdown = countBy(sessionsInWindow.map((s) => s.platform), 'web');
  const deviceBreakdown = countBy(sessionsInWindow.map((s) => s.deviceType), 'desktop');
  const osBreakdown = countBy(sessionsInWindow.map((s) => s.os), 'Desconhecido');
  const browserBreakdown = countBy(sessionsInWindow.map((s) => s.browser), 'Outro');
  const entryPages = countBy(sessionsInWindow.map((s) => s.entryPath), '/');
  const acquisitionSources = countBy(
    [
      ...sessionsInWindow.map((s) => s.utmSource || (s.referrer ? safeHostname(s.referrer) : 'direto')),
      ...enrichedUsers.map((u) => u.leadSource),
    ],
    'direto',
  );

  // Retention / Churn Watch & Power Users
  const churnRiskUsers = enrichedUsers
    .filter((u) => {
      const ref = u.lastActiveAt ? new Date(u.lastActiveAt) : new Date(u.createdAt);
      return ref < threeDaysAgo && ref >= fourteenDaysAgo;
    })
    .slice(0, 15)
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      locationLabel: u.locationLabel,
      activeLanguage: u.activeLanguage,
      activeCefr: u.activeCefr,
      lessonsCompleted: u.lessonsCompleted,
      totalTimeSeconds: u.totalTimeSeconds,
      lastActiveAt: u.lastActiveAt ?? u.createdAt,
    }));

  const powerUsers = [...enrichedUsers]
    .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds || b.xpTotal - a.xpTotal)
    .slice(0, 10)
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      locationLabel: u.locationLabel,
      activeLanguage: u.activeLanguage,
      activeCefr: u.activeCefr,
      lessonsCompleted: u.lessonsCompleted,
      totalTimeSeconds: u.totalTimeSeconds,
      xpTotal: u.xpTotal,
      streakDays: u.streakDays,
    }));

  // Automated Product Recommendations
  const recommendations: ProductRecommendation[] = [];

  if (uniqueVisitors >= 5 && visitorToSignupRate < 25) {
    recommendations.push({
      id: 'low-signup-conversion',
      severity: 'high',
      area: 'conversao',
      title: 'Conversão Visitante → Cadastro abaixo de 25%',
      detail:
        'Muitas pessoas estão acessando a tela inicial sem finalizar o perfil. Teste deixar uma mini-lição degustação de 30s ou reduzir campos visíveis no primeiro passo.',
      metricBadge: `${visitorToSignupRate}% de conversão`,
    });
  }

  if (totalRegisteredUsers >= 3 && activationRate < 50) {
    recommendations.push({
      id: 'low-first-lesson',
      severity: 'high',
      area: 'retencao',
      title: 'Menos da metade dos cadastrados concluiu a 1ª lição',
      detail:
        'Após criar conta, direcione automaticamente o aluno para o botão pulsante "Começar Lição 1" e dispare lembrete por e-mail/push 24h após o cadastro.',
      metricBadge: `${activationRate}% ativados`,
    });
  }

  const toughLesson = hardestLessons.find((l) => l.completions >= 2 && l.avgAccuracy < 75);
  if (toughLesson) {
    recommendations.push({
      id: `hard-lesson-${toughLesson.lessonId}`,
      severity: 'medium',
      area: 'pedagogico',
      title: `Lição com maior dificuldade: ${toughLesson.titlePt}`,
      detail: `Média de acerto em ${toughLesson.avgAccuracy}% (${toughLesson.language.toUpperCase()} · ${toughLesson.cefr}). Revise o cartão "Ver Regra" ou adicione um exemplo intermediário antes dos exercícios de fala.`,
      metricBadge: `${toughLesson.avgAccuracy}% precisão`,
    });
  }

  const mobileSessions = sessionsInWindow.filter((s) => s.deviceType === 'mobile').length;
  const pwaPct =
    totalRegisteredUsers > 0 ? Math.round((pwaInstalledUsers / totalRegisteredUsers) * 100) : 0;
  if (mobileSessions > 0 && pwaPct < 30) {
    recommendations.push({
      id: 'pwa-install-opportunity',
      severity: 'medium',
      area: 'tecnico',
      title: 'Oportunidade de aumentar instalações do App (PWA)',
      detail: `${Math.round((mobileSessions / Math.max(totalSessions, 1)) * 100)}% dos acessos vêm do celular, mas apenas ${pwaPct}% instalaram o app. Reforce o convite de instalação logo após a 1ª lição concluída (Pico Emocional).`,
      metricBadge: `${pwaPct}% instalados`,
    });
  }

  if (churnRiskUsers.length > 0) {
    recommendations.push({
      id: 'churn-risk-alert',
      severity: 'medium',
      area: 'retencao',
      title: `${churnRiskUsers.length} aluno(s) sem estudar há 3–14 dias`,
      detail:
        'Use a aba Mailing para disparar uma campanha de retomada via NovaMail destacando a Chamada ao Vivo com Tutor IA 24h.',
      metricBadge: `${churnRiskUsers.length} em risco`,
    });
  }

  const topRealCity = topCities.find((c) => c.city !== 'Não identificada');
  if (topRealCity) {
    recommendations.push({
      id: 'geo-hotspot',
      severity: 'info',
      area: 'crescimento',
      title: `Cidade líder em acessos: ${topRealCity.label}`,
      detail: `${topRealCity.registeredUsers} aluno(s) cadastrado(s) e ${topRealCity.sessions} sessão(ões) registradas. Bom foco para campanhas locais e parcerias escolares/clínicas.`,
      metricBadge: `${topRealCity.totalMinutes} min totais`,
    });
  }

  if (openFeedbackCount > 0) {
    recommendations.push({
      id: 'open-feedbacks',
      severity: 'info',
      area: 'pedagogico',
      title: `${openFeedbackCount} feedback(s) aguardando resposta`,
      detail: 'Revise a aba Mailing & Feedbacks para transformar sugestões reais dos usuários em melhorias rápidas.',
      metricBadge: `${openFeedbackCount} abertos`,
    });
  }

  return {
    generatedAt: now.toISOString(),
    period: {
      type: window.periodType,
      labelPt: window.labelPt,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    },
    kpis: {
      totalSessions,
      uniqueVisitors,
      anonymousVisitorsOnly,
      totalRegisteredUsers,
      newUsersInPeriod: newUsersInPeriod.length,
      visitorToSignupRate,
      activationRate,
      dau,
      wau,
      mau,
      stickinessPct,
      totalUsageSecondsPeriod: effectivePeriodSeconds,
      totalUsageSecondsAllTime: allUsersTotalSeconds,
      avgSessionSeconds,
      avgSecondsPerUser,
      lessonsCompletedInPeriod: lessonsInPeriod.length,
      totalLessonsCompletedAllTime,
      totalAiTurnsAllTime,
      totalFsrsReviewsAllTime,
      examPassedEvents,
      examFailedEvents,
      pwaInstalledUsers,
      calmModeUsers,
      pushActiveCount,
      optInUsers,
      openFeedbackCount,
    },
    funnel,
    timeline,
    hourlyActivity: hourlyCounts,
    weekdayActivity: weekdayCounts,
    languageBreakdown,
    cefrDistribution,
    topCities,
    topCountries,
    screenUsage,
    hardestLessons,
    mostPopularLessons,
    devices: {
      platforms: platformBreakdown,
      deviceTypes: deviceBreakdown,
      os: osBreakdown,
      browsers: browserBreakdown,
    },
    acquisition: {
      entryPages,
      sources: acquisitionSources,
    },
    churnRiskUsers,
    powerUsers,
    recommendations,
  };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

export async function getDashboardUserDetail(userId: string) {
  const [enrichedUsers, sessions, lessons, skills, events, feedbacks, conversations] =
    await Promise.all([
      buildEnrichedUsers(),
      prisma.visitorSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 40,
      }),
      prisma.lessonProgress.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 80,
      }),
      prisma.skillScore.findMany({ where: { userId } }),
      prisma.analyticsEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      prisma.betaFeedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.conversationSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          language: true,
          scenarioId: true,
          turnsCount: true,
          avgNaturalness: true,
          createdAt: true,
        },
      }),
    ]);

  const profile = enrichedUsers.find((u) => u.id === userId);
  if (!profile) return null;

  const screenTotals = new Map<string, number>();
  for (const s of sessions) {
    const parsed = parseScreensMap(s.screensJson);
    for (const [k, v] of Object.entries(parsed)) {
      screenTotals.set(k, (screenTotals.get(k) ?? 0) + v);
    }
  }

  return {
    profile,
    skillsByLanguage: skills,
    screenTimeSeconds: Object.fromEntries(screenTotals.entries()),
    recentSessions: sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      durationSeconds: s.durationSeconds,
      entryPath: s.entryPath,
      platform: s.platform,
      deviceType: s.deviceType,
      os: s.os,
      browser: s.browser,
      locationLabel: formatLocationLabel(s.city, s.region, s.country),
      activeLanguage: s.activeLanguage,
      screens: parseScreensMap(s.screensJson),
    })),
    recentLessons: lessons.map((l) => {
      const meta = getLessonById(l.lessonId);
      return {
        lessonId: l.lessonId,
        titlePt: meta?.lesson.titlePt ?? l.lessonId,
        language: l.language,
        cefr: meta?.lesson.cefr ?? 'A1',
        bestAccuracy: l.bestAccuracy,
        lastAccuracy: l.lastAccuracy,
        completedCount: l.completedCount,
        totalDurationSeconds: l.totalDurationSeconds,
        completedAt: l.completedAt.toISOString(),
      };
    }),
    recentEvents: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      language: e.language,
      cefr: e.cefr,
      lessonId: e.lessonId,
      screen: e.screen,
      valueNum: e.valueNum,
      createdAt: e.createdAt.toISOString(),
    })),
    conversations,
    feedbacks,
  };
}

export async function generateAndSaveReport(params: {
  title?: string;
  periodType: ReportPeriodType;
  from?: string;
  to?: string;
  notes?: string;
  sendEmailTo?: string;
}) {
  const window = resolveDateWindow(params.periodType, params.from, params.to);
  const summary = await buildDashboardSummary(window);
  const title =
    params.title?.trim() ||
    `Relatório NAidioma · ${window.labelPt} (${new Date().toISOString().slice(0, 10)})`;

  let saved = await prisma.savedReport.create({
    data: {
      title,
      periodType: window.periodType,
      periodStart: window.start,
      periodEnd: window.end,
      summaryJson: JSON.stringify(summary),
      notes: params.notes?.trim() || null,
    },
  });

  let emailResult: { sent: boolean; provider: string; error?: string } | null = null;
  if (params.sendEmailTo?.trim()) {
    emailResult = await emailSavedReport(saved.id, params.sendEmailTo.trim());
    const refreshed = await prisma.savedReport.findUnique({ where: { id: saved.id } });
    if (refreshed) saved = refreshed;
  }

  return { report: saved, summary, emailResult };
}

function formatDurationPt(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export async function emailSavedReport(
  reportId: string,
  toEmail: string,
): Promise<{ sent: boolean; provider: string; error?: string }> {
  const report = await prisma.savedReport.findUnique({ where: { id: reportId } });
  if (!report) {
    return { sent: false, provider: 'none', error: 'Relatório não encontrado.' };
  }

  const summary = JSON.parse(report.summaryJson) as Awaited<ReturnType<typeof buildDashboardSummary>>;
  const k = summary.kpis;
  const topLangs = summary.languageBreakdown
    .filter((l) => l.activeUsers > 0 || l.lessonsCompleted > 0)
    .slice(0, 5)
    .map((l) => `<li><strong>${l.namePt}</strong>: ${l.activeUsers} ativos · ${l.lessonsCompleted} lições · precisão média ${l.avgAccuracy}%</li>`)
    .join('');

  const topCitiesHtml = summary.topCities
    .slice(0, 6)
    .map((c) => `<li><strong>${c.label}</strong>: ${c.registeredUsers} cadastrados · ${c.sessions} acessos · ${c.totalMinutes} min</li>`)
    .join('');

  const recsHtml = summary.recommendations
    .slice(0, 5)
    .map((r) => `<li><strong>[${r.metricBadge}] ${r.title}</strong> — ${r.detail}</li>`)
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F7F1E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E1A1D;">
  <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:2px solid #E5D8C8;border-radius:14px;overflow:hidden;">
    <div style="background:#9A1B45;color:#FFFFFF;padding:24px 28px;">
      <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#FFE27A;font-weight:800;">NAIDIOMA · RELATÓRIO EXECUTIVO ADMIN</div>
      <h1 style="margin:8px 0 4px;font-size:22px;">${report.title}</h1>
      <div style="font-size:13px;color:#FFDCE8;">Período: ${summary.period.labelPt}</div>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.6;">
      <table width="100%" cellspacing="0" cellpadding="8" style="border-collapse:collapse;margin-bottom:18px;">
        <tr>
          <td style="border:1px solid #E5D8C8;background:#FFFBF5;"><strong>Acessos / Visitantes</strong><br/>${k.totalSessions} sessões · ${k.uniqueVisitors} únicos</td>
          <td style="border:1px solid #E5D8C8;background:#FFFBF5;"><strong>Cadastros</strong><br/>${k.totalRegisteredUsers} totais (+${k.newUsersInPeriod} no período)</td>
        </tr>
        <tr>
          <td style="border:1px solid #E5D8C8;background:#FFFBF5;"><strong>Tempo de Uso</strong><br/>${formatDurationPt(k.totalUsageSecondsPeriod)} (média ${formatDurationPt(k.avgSessionSeconds)}/sessão)</td>
          <td style="border:1px solid #E5D8C8;background:#FFFBF5;"><strong>Engajamento</strong><br/>DAU ${k.dau} · WAU ${k.wau} · MAU ${k.mau} · ${k.lessonsCompletedInPeriod} lições</td>
        </tr>
      </table>
      <h2 style="font-size:16px;color:#9A1B45;margin:16px 0 8px;">Idiomas Mais Estudados</h2>
      <ul style="padding-left:18px;margin:0 0 16px;">${topLangs || '<li>Sem dados no período</li>'}</ul>
      <h2 style="font-size:16px;color:#1496B0;margin:16px 0 8px;">Principais Cidades</h2>
      <ul style="padding-left:18px;margin:0 0 16px;">${topCitiesHtml || '<li>Sem dados de localização no período</li>'}</ul>
      <h2 style="font-size:16px;color:#1E1A1D;margin:16px 0 8px;">Recomendações de Melhoria</h2>
      <ul style="padding-left:18px;margin:0 0 18px;">${recsHtml || '<li>Tudo saudável no período analisado.</li>'}</ul>
      <a href="${config.appPublicUrl}/dashboard" style="display:inline-block;background:#9A1B45;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:800;">Abrir /dashboard Completo</a>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `NAidioma — ${report.title}`,
    `Período: ${summary.period.labelPt}`,
    `Acessos: ${k.totalSessions} sessões (${k.uniqueVisitors} visitantes únicos)`,
    `Cadastros: ${k.totalRegisteredUsers} totais (+${k.newUsersInPeriod} no período, conversão ${k.visitorToSignupRate}%)`,
    `Tempo de uso: ${formatDurationPt(k.totalUsageSecondsPeriod)} | Média/sessão: ${formatDurationPt(k.avgSessionSeconds)}`,
    `DAU: ${k.dau} | WAU: ${k.wau} | MAU: ${k.mau} | Lições no período: ${k.lessonsCompletedInPeriod}`,
    '',
    `Abrir painel: ${config.appPublicUrl}/dashboard`,
  ].join('\n');

  const res = await sendTransactionalEmail({
    to: toEmail,
    subject: `[NAidioma Dashboard] ${report.title}`,
    html,
    text,
    category: 'admin_report',
  });

  if (res.sent) {
    await prisma.savedReport.update({
      where: { id: reportId },
      data: { emailedTo: toEmail, emailedAt: new Date() },
    });
  }

  return res;
}

export function csvEscape(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function pruneOldTelemetryEvents(retentionDays = 180): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const res = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return res.count;
}
