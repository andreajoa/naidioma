import {
  getLessonById,
  getScenarioById,
  type BillingPlan,
  type CoachFeedback,
  type FeedbackCategory,
  type FlashcardSeed,
  type FsrsCardState,
  type FsrsRating,
  type LanguageCode,
  type LanguageCourse,
  type LanguageMeta,
} from '@naidioma/shared';
import { getPlatform, readSecurePref, removeSecurePref, saveSecurePref } from './native';
import {
  applyOfflineFsrsReview,
  buildOfflineCourseDetail,
  buildOfflineReviewDeck,
  cacheCourseProgress,
  cacheReviewDeckFromServer,
  cacheUserProfile,
  enqueueOfflineJob,
  readCachedUserProfile,
  readOfflineQueue,
  replaceOfflineQueue,
  saveOfflineLessonProgress,
} from './offline';

const TOKEN_KEY = 'naidioma_auth_token';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  whatsapp: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  role: string;
  activeLanguage: LanguageCode;
  dailyGoalMinutes: number;
  xpTotal: number;
  streakDays: number;
  longestStreak: number;
  lastStudyDate: string | null;
  marketingOptIn: boolean;
  leadSource: string;
  subscriptionTier: string;
  subscriptionPlanKey: string | null;
  subscriptionExpiresAt: string | null;
}

export interface AdminUserLanguageStanding {
  language: LanguageCode;
  languageNamePt: string;
  currentCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  highestPassedCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;
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

export interface AdminDashboardUserRow {
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
  activeCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  activeLevelProgressPct: number;
  languagesStudied: AdminUserLanguageStanding[];
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

export interface AdminDashboardSummary {
  generatedAt: string;
  period: {
    type: '7d' | '30d' | '90d' | 'all' | 'custom';
    labelPt: string;
    start: string;
    end: string;
  };
  kpis: {
    totalSessions: number;
    uniqueVisitors: number;
    anonymousVisitorsOnly: number;
    totalRegisteredUsers: number;
    newUsersInPeriod: number;
    visitorToSignupRate: number;
    activationRate: number;
    dau: number;
    wau: number;
    mau: number;
    stickinessPct: number;
    totalUsageSecondsPeriod: number;
    totalUsageSecondsAllTime: number;
    avgSessionSeconds: number;
    avgSecondsPerUser: number;
    lessonsCompletedInPeriod: number;
    totalLessonsCompletedAllTime: number;
    totalAiTurnsAllTime: number;
    totalFsrsReviewsAllTime: number;
    examPassedEvents: number;
    examFailedEvents: number;
    pwaInstalledUsers: number;
    calmModeUsers: number;
    pushActiveCount: number;
    optInUsers: number;
    openFeedbackCount: number;
  };
  funnel: Array<{ step: string; count: number; pct: number }>;
  timeline: Array<{
    date: string;
    sessions: number;
    uniqueVisitors: number;
    signups: number;
    lessons: number;
    minutes: number;
  }>;
  hourlyActivity: Array<{ hour: number; sessions: number; minutes: number }>;
  weekdayActivity: Array<{ dayIndex: number; label: string; sessions: number; minutes: number }>;
  languageBreakdown: Array<{
    code: LanguageCode;
    namePt: string;
    nativeName: string;
    accentHex: string;
    activeUsers: number;
    totalLearners: number;
    lessonsCompleted: number;
    avgAccuracy: number;
    studyMinutes: number;
    cefrCounts: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', number>;
  }>;
  cefrDistribution: Array<{ cefr: string; count: number; pct: number }>;
  topCities: Array<{
    city: string;
    region: string | null;
    country: string | null;
    label: string;
    sessions: number;
    uniqueVisitors: number;
    registeredUsers: number;
    totalMinutes: number;
  }>;
  topCountries: Array<{ country: string; sessions: number; registeredUsers: number }>;
  screenUsage: Array<{
    screen: string;
    label: string;
    seconds: number;
    minutes: number;
    pct: number;
  }>;
  hardestLessons: Array<{
    lessonId: string;
    language: string;
    titlePt: string;
    cefr: string;
    isLevelExam: boolean;
    completions: number;
    attempts: number;
    avgAccuracy: number;
    avgDurationSeconds: number;
    abandons: number;
    retryRatio: number;
  }>;
  mostPopularLessons: Array<{
    lessonId: string;
    language: string;
    titlePt: string;
    cefr: string;
    isLevelExam: boolean;
    completions: number;
    attempts: number;
    avgAccuracy: number;
    avgDurationSeconds: number;
    abandons: number;
    retryRatio: number;
  }>;
  devices: {
    platforms: Array<{ name: string; count: number }>;
    deviceTypes: Array<{ name: string; count: number }>;
    os: Array<{ name: string; count: number }>;
    browsers: Array<{ name: string; count: number }>;
  };
  acquisition: {
    entryPages: Array<{ name: string; count: number }>;
    sources: Array<{ name: string; count: number }>;
  };
  churnRiskUsers: Array<{
    id: string;
    displayName: string;
    email: string;
    locationLabel: string;
    activeLanguage: LanguageCode;
    activeCefr: string;
    lessonsCompleted: number;
    totalTimeSeconds: number;
    lastActiveAt: string;
  }>;
  powerUsers: Array<{
    id: string;
    displayName: string;
    email: string;
    locationLabel: string;
    activeLanguage: LanguageCode;
    activeCefr: string;
    lessonsCompleted: number;
    totalTimeSeconds: number;
    xpTotal: number;
    streakDays: number;
  }>;
  recommendations: Array<{
    id: string;
    severity: 'high' | 'medium' | 'info';
    area: string;
    title: string;
    detail: string;
    metricBadge: string;
  }>;
}

export interface AdminUserDetailResponse {
  profile: AdminDashboardUserRow;
  skillsByLanguage: Array<{
    language: string;
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
    vocabulary: number;
  }>;
  screenTimeSeconds: Record<string, number>;
  recentSessions: Array<{
    id: string;
    startedAt: string;
    lastSeenAt: string;
    durationSeconds: number;
    entryPath: string;
    platform: string;
    deviceType: string;
    os: string | null;
    browser: string | null;
    locationLabel: string;
    activeLanguage: string | null;
    screens: Record<string, number>;
  }>;
  recentLessons: Array<{
    lessonId: string;
    titlePt: string;
    language: string;
    cefr: string;
    bestAccuracy: number;
    lastAccuracy: number;
    completedCount: number;
    totalDurationSeconds: number;
    completedAt: string;
  }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    language: string | null;
    cefr: string | null;
    lessonId: string | null;
    screen: string | null;
    valueNum: number | null;
    createdAt: string;
  }>;
  conversations: Array<{
    id: string;
    language: string;
    scenarioId: string;
    turnsCount: number;
    avgNaturalness: number;
    createdAt: string;
  }>;
  feedbacks: Array<{
    id: string;
    category: string;
    message: string;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminVisitorSessionRow {
  id: string;
  visitorId: string;
  userId: string | null;
  user: {
    id: string;
    displayName: string;
    email: string;
    activeLanguage: string;
  } | null;
  startedAt: string;
  lastSeenAt: string;
  durationSeconds: number;
  entryPath: string;
  lastPath: string;
  referrer: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  platform: string;
  deviceType: string;
  os: string | null;
  browser: string | null;
  pwaInstalled: boolean;
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  activeLanguage: string | null;
  eventsCount: number;
  convertedToSignup: boolean;
}

export interface AdminSavedReportListItem {
  id: string;
  title: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  emailedTo: string | null;
  emailedAt: string | null;
  createdAt: string;
  kpis: Record<string, number>;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  city: string | null;
  country: string | null;
  ipHash: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
}

export interface CourseOverviewItem extends LanguageMeta {
  totalUnits: number;
  totalLessons: number;
  totalScenarios: number;
  completedLessons: number;
}

export interface CourseDetailResponse {
  course: LanguageCourse;
  progress: {
    completedLessons: Record<string, { bestAccuracy: number; completedCount: number }>;
    skills: {
      speaking: number;
      listening: number;
      reading: number;
      writing: number;
      vocabulary: number;
    };
    dueReviewsCount: number;
  };
}

export interface ReviewDeckItem extends FlashcardSeed {
  fsrs: FsrsCardState;
  isDue: boolean;
  intervalPreviews: Record<FsrsRating, string>;
}

export interface BillingStatusResponse {
  billingVisible: boolean;
  freeBetaMode: boolean;
  stripeConfigured: boolean;
  currentTier: string;
  currentPlanKey: string;
  subscriptionExpiresAt: string | null;
  plans: Array<BillingPlan & { stripePriceConfigured: boolean }>;
}

export interface AppVersionResponse {
  appName: string;
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotesPt: string;
  androidStoreUrl: string;
  iosStoreUrl: string;
  freeBetaMode: boolean;
  billingUiEnabled: boolean;
}

export interface AiTurnApiResponse {
  replyText: string;
  replyReading?: string;
  replyTranslationPt: string;
  coach: CoachFeedback;
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  dailyQuotaRemaining: number;
}

let cachedToken: string | null = null;

export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await readSecurePref(TOKEN_KEY);
  return cachedToken;
}

export async function setAuthToken(token: string): Promise<void> {
  cachedToken = token;
  await saveSecurePref(TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  cachedToken = null;
  await removeSecurePref(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit & { adminKey?: string; adminToken?: string } = {},
): Promise<T> {
  const token = options.adminToken ? null : await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.adminToken) {
    headers['Authorization'] = `Bearer ${options.adminToken}`;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.adminKey) headers['x-admin-key'] = options.adminKey;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Erro HTTP ${res.status}`);
  }
  return data as T;
}

export async function syncOfflineQueueNow(): Promise<number> {
  const queue = await readOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining = [];
  let synced = 0;

  for (const job of queue) {
    try {
      if (job.type === 'lesson_complete') {
        await request(`/api/lessons/${job.lessonId}/complete`, {
          method: 'POST',
          body: JSON.stringify({
            accuracy: job.accuracy,
            durationSeconds: job.durationSeconds,
          }),
        });
      } else if (job.type === 'fsrs_review') {
        await request(`/api/review/${job.cardId}`, {
          method: 'POST',
          body: JSON.stringify({
            language: job.language,
            rating: job.rating,
          }),
        });
      }
      synced += 1;
    } catch {
      remaining.push(job);
    }
  }

  await replaceOfflineQueue(remaining);
  return synced;
}

export const api = {
  getVersion: () => request<AppVersionResponse>('/api/app/version'),

  register: async (payload: {
    email: string;
    password: string;
    displayName: string;
    whatsapp?: string;
    city?: string;
    region?: string;
    timezone?: string;
    visitorId?: string;
    platform?: 'web' | 'pwa' | 'android' | 'ios';
    activeLanguage: LanguageCode;
    dailyGoalMinutes: number;
    marketingOptIn: boolean;
    leadSource?: string;
    utmCampaign?: string;
  }) => {
    const res = await request<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await setAuthToken(res.token);
    await cacheUserProfile(res.user);
    return res.user;
  },

  login: async (payload: {
    email: string;
    password: string;
    visitorId?: string;
    timezone?: string;
    platform?: 'web' | 'pwa' | 'android' | 'ios';
  }) => {
    const res = await request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await setAuthToken(res.token);
    await cacheUserProfile(res.user);
    return res.user;
  },

  getMe: async () => {
    try {
      const res = await request<{ user: UserProfile }>('/api/me');
      await cacheUserProfile(res.user);
      return res;
    } catch (err) {
      const cached = await readCachedUserProfile();
      if (cached && !navigator.onLine) {
        return { user: cached };
      }
      throw err;
    }
  },

  updatePreferences: async (patch: {
    displayName?: string;
    whatsapp?: string | null;
    city?: string | null;
    region?: string | null;
    activeLanguage?: LanguageCode;
    dailyGoalMinutes?: number;
    marketingOptIn?: boolean;
  }) => {
    try {
      const res = await request<{ user: UserProfile }>('/api/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await cacheUserProfile(res.user);
      return res;
    } catch (err) {
      const cached = await readCachedUserProfile();
      if (cached && !navigator.onLine) {
        const merged: UserProfile = {
          ...cached,
          ...patch,
          whatsapp: patch.whatsapp === undefined ? cached.whatsapp : patch.whatsapp,
          city: patch.city === undefined ? cached.city : patch.city,
          region: patch.region === undefined ? cached.region : patch.region,
        };
        await cacheUserProfile(merged);
        return { user: merged };
      }
      throw err;
    }
  },

  listCourses: () => request<{ languages: CourseOverviewItem[] }>('/api/courses'),

  getCourseDetail: async (lang: LanguageCode): Promise<CourseDetailResponse> => {
    try {
      const res = await request<CourseDetailResponse>(`/api/courses/${lang}`);
      await cacheCourseProgress(lang, res.progress);
      return res;
    } catch {
      return buildOfflineCourseDetail(lang);
    }
  },

  completeLesson: async (lessonId: string, accuracy: number, durationSeconds: number) => {
    try {
      return await request<{
        xpGained: number;
        streakDays: number;
        xpTotal: number;
        skills: CourseDetailResponse['progress']['skills'];
      }>(`/api/lessons/${lessonId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ accuracy, durationSeconds }),
      });
    } catch {
      const found = getLessonById(lessonId);
      const lang: LanguageCode = found?.language ?? 'en';
      const xpReward = found?.lesson.xpReward ?? 40;
      const progress = await saveOfflineLessonProgress(lang, lessonId, accuracy, xpReward);
      await enqueueOfflineJob({
        id: `job-${Date.now()}`,
        type: 'lesson_complete',
        lessonId,
        accuracy,
        durationSeconds,
        createdAt: new Date().toISOString(),
      });
      const cached = await readCachedUserProfile();
      return {
        xpGained: Math.max(15, Math.round((xpReward * Math.max(50, accuracy)) / 100)),
        streakDays: cached?.streakDays ?? 1,
        xpTotal: cached?.xpTotal ?? xpReward,
        skills: progress.skills,
      };
    }
  },

  getReviewDeck: async (lang: LanguageCode) => {
    try {
      const res = await request<{ dueCount: number; totalCount: number; cards: ReviewDeckItem[] }>(
        `/api/review/${lang}`,
      );
      await cacheReviewDeckFromServer(lang, res.cards);
      return res;
    } catch {
      return buildOfflineReviewDeck(lang);
    }
  },

  submitReview: async (cardId: string, language: LanguageCode, rating: FsrsRating) => {
    try {
      const res = await request<{ cardId: string; intervalDays: number }>(`/api/review/${cardId}`, {
        method: 'POST',
        body: JSON.stringify({ language, rating }),
      });
      await applyOfflineFsrsReview(language, cardId, rating);
      return res;
    } catch {
      const local = await applyOfflineFsrsReview(language, cardId, rating);
      await enqueueOfflineJob({
        id: `fsrs-${Date.now()}`,
        type: 'fsrs_review',
        cardId,
        language,
        rating,
        createdAt: new Date().toISOString(),
      });
      return local;
    }
  },

  sendConversationTurn: async (
    scenarioId: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }>,
  ): Promise<AiTurnApiResponse> => {
    try {
      return await request<AiTurnApiResponse>('/api/ai/conversation', {
        method: 'POST',
        body: JSON.stringify({ scenarioId, userMessage, history }),
      });
    } catch {
      const sc = getScenarioById(scenarioId);
      const hint = sc?.starterHints[0];
      return {
        replyText: sc?.openingLine ?? 'Great job! Let us keep practicing as soon as you reconnect.',
        replyReading: sc?.openingReading,
        replyTranslationPt:
          'Você está no Modo Offline — continue praticando sua fala e assim que a internet voltar o tutor IA da nuvem assume ao vivo!',
        coach: {
          naturalnessScore: 82,
          correctedVersion: userMessage,
          nativeAlternative: hint?.text ?? userMessage,
          explanationPt:
            'Modo Offline ativo: sua frase foi registrada localmente. Repita em voz alta para treinar ritmo e confiança.',
          suggestedReplies: sc?.starterHints ?? [],
        },
        providerUsed: 'offline-device',
        modelUsed: 'naidioma-offline-v1',
        latencyMs: 5,
        dailyQuotaRemaining: 60,
      };
    }
  },

  explainPhrase: async (language: LanguageCode, phrase: string) => {
    try {
      return await request<{
        breakdownPt: string;
        literalVsNaturalPt: string;
        brazilianPitfallPt: string;
        examples: Array<{ target: string; reading?: string; translationPt: string }>;
        providerUsed: string;
      }>('/api/ai/explain', {
        method: 'POST',
        body: JSON.stringify({ language, phrase }),
      });
    } catch {
      return {
        breakdownPt: `"${phrase}" — você está offline, então estamos exibindo o guia rápido local. Ouça o áudio e pratique em blocos.`,
        literalVsNaturalPt: 'Foque no sentido completo da expressão em vez da tradução literal.',
        brazilianPitfallPt: 'Ao reconectar à internet, o Coach IA dará exemplos extras personalizados.',
        examples: [],
        providerUsed: 'offline-device',
      };
    }
  },

  getAiStatus: async () => {
    try {
      return await request<{
        aiOnline: boolean;
        primaryProvider: string;
        primaryModel: string;
        sttAvailable: boolean;
      }>('/api/ai/status');
    } catch {
      return {
        aiOnline: false,
        primaryProvider: 'offline',
        primaryModel: 'local',
        sttAvailable: false,
      };
    }
  },

  transcribeAudio: async (language: LanguageCode, audioBase64: string, mimeType?: string) => {
    try {
      return await request<{
        available: boolean;
        transcript: string;
        provider: string;
        model?: string;
        latencyMs: number;
      }>('/api/ai/transcribe', {
        method: 'POST',
        body: JSON.stringify({ language, audioBase64, mimeType }),
      });
    } catch {
      return {
        available: false,
        transcript: '',
        provider: 'offline',
        latencyMs: 0,
      };
    }
  },

  sendFeedback: (payload: {
    category: FeedbackCategory;
    language?: LanguageCode;
    route?: string;
    lessonId?: string;
    message: string;
  }) =>
    request<{ id: string; message: string }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ ...payload, platform: getPlatform() }),
    }),

  getBillingStatus: () => request<BillingStatusResponse>('/api/billing/status'),

  createCheckout: (planKey: 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly') =>
    request<{ checkoutUrl: string; sessionId: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planKey }),
    }),

  openBillingPortal: () =>
    request<{ portalUrl: string }>('/api/billing/portal', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  adminLogin: (password: string) =>
    request<{
      authenticated: boolean;
      token: string;
      expiresAt: string;
      mustConfigurePassword: boolean;
      authSource: string;
    }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  adminGetSession: (adminToken: string) =>
    request<{
      authenticated: boolean;
      auth: {
        source: string;
        mustConfigurePassword: boolean;
        sessionVersion: number;
        passwordUpdatedAt: string | null;
      };
      recentAudits: AdminAuditEntry[];
    }>('/api/admin/auth/session', { adminToken }),

  adminChangePassword: (adminToken: string, currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; token: string; expiresAt: string; message: string }>(
      '/api/admin/auth/change-password',
      {
        method: 'POST',
        adminToken,
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    ),

  adminGetDashboardSummary: (
    adminToken: string,
    params?: { range?: string; from?: string; to?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.range) qs.set('range', params.range);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<AdminDashboardSummary>(`/api/admin/dashboard/summary${suffix}`, { adminToken });
  },

  adminGetDashboardUsers: (
    adminToken: string,
    params?: {
      search?: string;
      language?: string;
      cefr?: string;
      city?: string;
      status?: string;
      sort?: string;
      page?: number;
      limit?: number;
    },
  ) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.language) qs.set('language', params.language);
    if (params?.cefr) qs.set('cefr', params.cefr);
    if (params?.city) qs.set('city', params.city);
    if (params?.status) qs.set('status', params.status);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{
      total: number;
      page: number;
      limit: number;
      items: AdminDashboardUserRow[];
    }>(`/api/admin/dashboard/users${suffix}`, { adminToken });
  },

  adminGetDashboardUserDetail: (adminToken: string, userId: string) =>
    request<AdminUserDetailResponse>(`/api/admin/dashboard/users/${encodeURIComponent(userId)}`, {
      adminToken,
    }),

  adminGetDashboardVisitors: (
    adminToken: string,
    params?: { range?: string; onlyAnonymous?: boolean; city?: string; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.range) qs.set('range', params.range);
    if (params?.onlyAnonymous) qs.set('onlyAnonymous', 'true');
    if (params?.city) qs.set('city', params.city);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ total: number; sessions: AdminVisitorSessionRow[] }>(
      `/api/admin/dashboard/visitors${suffix}`,
      { adminToken },
    );
  },

  adminListReports: (adminToken: string) =>
    request<{ reports: AdminSavedReportListItem[] }>('/api/admin/dashboard/reports', { adminToken }),

  adminCreateReport: (
    adminToken: string,
    payload: {
      title?: string;
      periodType: '7d' | '30d' | '90d' | 'all' | 'custom';
      from?: string;
      to?: string;
      notes?: string;
      sendEmailTo?: string;
    },
  ) =>
    request<{
      report: Omit<AdminSavedReportListItem, 'kpis'>;
      summary: AdminDashboardSummary;
      emailResult: { sent: boolean; provider: string; error?: string } | null;
    }>('/api/admin/dashboard/reports', {
      method: 'POST',
      adminToken,
      body: JSON.stringify(payload),
    }),

  adminGetReport: (adminToken: string, id: string) =>
    request<{
      report: Omit<AdminSavedReportListItem, 'kpis'>;
      summary: AdminDashboardSummary;
    }>(`/api/admin/dashboard/reports/${encodeURIComponent(id)}`, { adminToken }),

  adminUpdateReportNotes: (adminToken: string, id: string, notes: string) =>
    request<{ ok: boolean; notes: string }>(`/api/admin/dashboard/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      adminToken,
      body: JSON.stringify({ notes }),
    }),

  adminDeleteReport: (adminToken: string, id: string) =>
    request<{ ok: boolean }>(`/api/admin/dashboard/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      adminToken,
      body: JSON.stringify({}),
    }),

  adminEmailReport: (adminToken: string, id: string, toEmail: string) =>
    request<{ sent: boolean; provider: string; error?: string }>(
      `/api/admin/dashboard/reports/${encodeURIComponent(id)}/email`,
      {
        method: 'POST',
        adminToken,
        body: JSON.stringify({ toEmail }),
      },
    ),

  adminDownloadDashboardCsv: async (
    adminToken: string,
    type: 'users' | 'visitors' | 'lessons',
    range = '30d',
  ): Promise<string> => {
    const res = await fetch(
      `${API_BASE}/api/admin/dashboard/export.csv?type=${encodeURIComponent(type)}&range=${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    if (!res.ok) throw new Error('Falha ao exportar relatório CSV.');
    return res.text();
  },

  adminDownloadDashboardJson: async (adminToken: string, range = '30d'): Promise<string> => {
    const res = await fetch(
      `${API_BASE}/api/admin/dashboard/export.json?range=${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    if (!res.ok) throw new Error('Falha ao exportar relatório JSON.');
    return res.text();
  },

  getAdminOverview: (adminToken: string) =>
    request<{
      metrics: {
        totalUsers: number;
        optInUsers: number;
        totalLessonsCompleted: number;
        openFeedbackCount: number;
      };
      runtime: {
        ollamaBaseUrl: string;
        ollamaHasApiKey: boolean;
        ollamaModel: string;
        openaiBaseUrl: string;
        openaiModel: string;
        geminiConfigured: boolean;
        stripeConfigured: boolean;
        emailConfigured: boolean;
        emailProvider?: string;
        novamailAudienceConfigured?: boolean;
        freeBetaMode: boolean;
        billingUiEnabled: boolean;
        dailyFreeAiTurns: number;
        latestAppVersion: string;
        minSupportedVersion: string;
        releaseNotesPt: string;
        androidStoreUrl: string;
        iosStoreUrl: string;
      };
      ollamaStatus: {
        configured: boolean;
        reachable: boolean;
        url: string;
        model: string;
        availableModels: string[];
        error?: string;
      };
      feedbacks: Array<{
        id: string;
        platform: string;
        category: string;
        language: string | null;
        route: string | null;
        message: string;
        status: string;
        createdAt: string;
        user: { displayName: string; email: string } | null;
      }>;
    }>('/api/admin/overview', { adminToken }),

  getAdminMailing: (adminToken: string) =>
    request<{
      total: number;
      contacts: Array<{
        id: string;
        displayName: string;
        email: string;
        whatsapp: string | null;
        activeLanguage: string;
        leadSource: string;
        utmCampaign: string | null;
        marketingOptIn: boolean;
        xpTotal: number;
        streakDays: number;
        subscriptionTier: string;
        createdAt: string;
      }>;
    }>('/api/admin/mailing', { adminToken }),

  downloadMailingCsv: async (adminToken: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/admin/mailing.csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error('Falha ao baixar mailing CSV.');
    return res.text();
  },

  syncMailingToNovaMail: (adminToken: string) =>
    request<{ ok: boolean; synced: number; totalUsers: number; error?: string }>(
      '/api/admin/mailing/sync-novamail',
      {
        method: 'POST',
        adminToken,
        body: JSON.stringify({}),
      },
    ),

  sendAdminEmailCampaign: (
    adminToken: string,
    payload: {
      subject: string;
      headline: string;
      bodyText: string;
      ctaLabel?: string;
      ctaUrl?: string;
      testEmail?: string;
      language?: LanguageCode;
    },
  ) =>
    request<{
      sentCount: number;
      failedCount: number;
      provider: string;
      broadcastId?: string;
      error?: string;
    }>('/api/admin/email-campaign', {
      method: 'POST',
      adminToken,
      body: JSON.stringify(payload),
    }),

  updateAdminFeedback: (adminToken: string, id: string, status: 'new' | 'in_progress' | 'resolved') =>
    request<{ feedback: unknown }>(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      adminToken,
      body: JSON.stringify({ status }),
    }),

  saveAdminRuntimeConfig: (adminToken: string, payload: Record<string, unknown>) =>
    request<{
      saved: boolean;
      ollamaStatus: { reachable: boolean; error?: string; availableModels: string[] };
    }>('/api/admin/ai-config', {
      method: 'POST',
      adminToken,
      body: JSON.stringify(payload),
    }),

  getPushStatus: () =>
    request<{
      vapidPublicKey: string;
      enabled: boolean;
      devicesCount: number;
      reminderHour: number;
      petName: string;
    }>('/api/push/status'),

  subscribePush: (payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    reminderHour: number;
    timezoneOffset: number;
    petName: string;
  }) =>
    request<{ ok: boolean; id: string; reminderHour: number }>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  unsubscribePush: (endpoint?: string) =>
    request<{ ok: boolean }>('/api/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    }),

  sendTestPush: () =>
    request<{ ok: boolean; delivered: number }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
