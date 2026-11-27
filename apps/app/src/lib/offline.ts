import {
  getAllFlashcards,
  getCourse,
  previewFsrsIntervals,
  scheduleFsrsReview,
  createInitialFsrsCard,
  type FsrsCardState,
  type FsrsRating,
  type LanguageCode,
} from '@naidioma/shared';
import type { CourseDetailResponse, ReviewDeckItem, UserProfile } from './api';
import { readSecurePref, saveSecurePref } from './native';

const CACHE_USER_KEY = 'naidioma_cache_user';
const CACHE_PROGRESS_PREFIX = 'naidioma_cache_progress_';
const CACHE_FSRS_PREFIX = 'naidioma_cache_fsrs_';
const SYNC_QUEUE_KEY = 'naidioma_offline_sync_queue';

export type OfflineSyncJob =
  | {
      id: string;
      type: 'lesson_complete';
      lessonId: string;
      accuracy: number;
      durationSeconds: number;
      createdAt: string;
    }
  | {
      id: string;
      type: 'fsrs_review';
      cardId: string;
      language: LanguageCode;
      rating: FsrsRating;
      createdAt: string;
    };

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export async function cacheUserProfile(user: UserProfile): Promise<void> {
  await saveSecurePref(CACHE_USER_KEY, JSON.stringify(user));
}

export async function readCachedUserProfile(): Promise<UserProfile | null> {
  try {
    const raw = await readSecurePref(CACHE_USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export async function cacheCourseProgress(
  lang: LanguageCode,
  progress: CourseDetailResponse['progress'],
): Promise<void> {
  await saveSecurePref(`${CACHE_PROGRESS_PREFIX}${lang}`, JSON.stringify(progress));
}

export async function buildOfflineCourseDetail(lang: LanguageCode): Promise<CourseDetailResponse> {
  const course = getCourse(lang);
  try {
    const raw = await readSecurePref(`${CACHE_PROGRESS_PREFIX}${lang}`);
    if (raw) {
      const progress = JSON.parse(raw) as CourseDetailResponse['progress'];
      return { course, progress };
    }
  } catch {
    // fallback to clean initial state
  }

  return {
    course,
    progress: {
      completedLessons: {},
      skills: { speaking: 10, listening: 10, reading: 10, writing: 10, vocabulary: 10 },
      dueReviewsCount: course.flashcards.length,
    },
  };
}

export async function saveOfflineLessonProgress(
  lang: LanguageCode,
  lessonId: string,
  accuracy: number,
  xpReward: number,
): Promise<CourseDetailResponse['progress']> {
  const detail = await buildOfflineCourseDetail(lang);
  const existing = detail.progress.completedLessons[lessonId];
  const nextProgress: CourseDetailResponse['progress'] = {
    ...detail.progress,
    completedLessons: {
      ...detail.progress.completedLessons,
      [lessonId]: {
        bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
        completedCount: (existing?.completedCount ?? 0) + 1,
      },
    },
  };
  await cacheCourseProgress(lang, nextProgress);

  const cachedUser = await readCachedUserProfile();
  if (cachedUser) {
    const xpGained = Math.max(15, Math.round((xpReward * Math.max(50, accuracy)) / 100));
    await cacheUserProfile({
      ...cachedUser,
      xpTotal: cachedUser.xpTotal + xpGained,
      streakDays: Math.max(1, cachedUser.streakDays),
    });
  }
  return nextProgress;
}

export async function buildOfflineReviewDeck(
  lang: LanguageCode,
): Promise<{ dueCount: number; totalCount: number; cards: ReviewDeckItem[] }> {
  const seeds = getAllFlashcards(lang);
  let storedMap: Record<string, FsrsCardState> = {};
  try {
    const raw = await readSecurePref(`${CACHE_FSRS_PREFIX}${lang}`);
    if (raw) storedMap = JSON.parse(raw) as Record<string, FsrsCardState>;
  } catch {
    storedMap = {};
  }

  const now = new Date();
  const deck: ReviewDeckItem[] = seeds.map((seed) => {
    const state = storedMap[seed.id] ?? createInitialFsrsCard(now);
    return {
      ...seed,
      fsrs: state,
      isDue: new Date(state.dueAt).getTime() <= now.getTime(),
      intervalPreviews: previewFsrsIntervals(state, now),
    };
  });

  const due = deck.filter((c) => c.isDue);
  return {
    dueCount: due.length,
    totalCount: deck.length,
    cards: due.length > 0 ? due : deck.slice(0, 6),
  };
}

export async function cacheReviewDeckFromServer(
  lang: LanguageCode,
  cards: ReviewDeckItem[],
): Promise<void> {
  const map: Record<string, FsrsCardState> = {};
  for (const c of cards) {
    map[c.id] = c.fsrs;
  }
  await saveSecurePref(`${CACHE_FSRS_PREFIX}${lang}`, JSON.stringify(map));
}

export async function applyOfflineFsrsReview(
  lang: LanguageCode,
  cardId: string,
  rating: FsrsRating,
): Promise<{ cardId: string; intervalDays: number }> {
  let storedMap: Record<string, FsrsCardState> = {};
  try {
    const raw = await readSecurePref(`${CACHE_FSRS_PREFIX}${lang}`);
    if (raw) storedMap = JSON.parse(raw) as Record<string, FsrsCardState>;
  } catch {
    storedMap = {};
  }

  const now = new Date();
  const current = storedMap[cardId] ?? createInitialFsrsCard(now);
  const result = scheduleFsrsReview(current, rating, now);
  storedMap[cardId] = result.nextCard;
  await saveSecurePref(`${CACHE_FSRS_PREFIX}${lang}`, JSON.stringify(storedMap));

  return { cardId, intervalDays: result.intervalDays };
}

export async function enqueueOfflineJob(job: OfflineSyncJob): Promise<void> {
  const queue = await readOfflineQueue();
  queue.push(job);
  await saveSecurePref(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export async function readOfflineQueue(): Promise<OfflineSyncJob[]> {
  try {
    const raw = await readSecurePref(SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineSyncJob[]) : [];
  } catch {
    return [];
  }
}

export async function replaceOfflineQueue(jobs: OfflineSyncJob[]): Promise<void> {
  await saveSecurePref(SYNC_QUEUE_KEY, JSON.stringify(jobs));
}
