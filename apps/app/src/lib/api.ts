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
  options: RequestInit & { adminKey?: string } = {},
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
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

  login: async (payload: { email: string; password: string }) => {
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

  getAdminOverview: (adminKey: string) =>
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
    }>('/api/admin/overview', { adminKey }),

  getAdminMailing: (adminKey: string) =>
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
    }>('/api/admin/mailing', { adminKey }),

  downloadMailingCsv: async (adminKey: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/admin/mailing.csv`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Falha ao baixar mailing CSV.');
    return res.text();
  },

  updateAdminFeedback: (adminKey: string, id: string, status: 'new' | 'in_progress' | 'resolved') =>
    request<{ feedback: unknown }>(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      adminKey,
      body: JSON.stringify({ status }),
    }),

  saveAdminRuntimeConfig: (adminKey: string, payload: Record<string, unknown>) =>
    request<{
      saved: boolean;
      ollamaStatus: { reachable: boolean; error?: string; availableModels: string[] };
    }>('/api/admin/ai-config', {
      method: 'POST',
      adminKey,
      body: JSON.stringify(payload),
    }),
};
