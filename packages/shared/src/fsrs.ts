/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler) implementation.
 * Outperforms legacy SM-2 by modeling memory Stability (S), Difficulty (D),
 * and power-law Retrievability (R) to schedule reviews right before forgetting.
 */

export type FsrsRating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface FsrsCardState {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  dueAt: string; // ISO date
  lastReviewAt: string | null;
}

export interface FsrsReviewResult {
  nextCard: FsrsCardState;
  intervalDays: number;
  retrievability: number;
}

// FSRS-4.5 default calibrated weights (w0..w18)
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
  0.6567,
] as const;

const REQUEST_RETENTION = 0.9;
const MAXIMUM_INTERVAL_DAYS = 365;
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // 19/81

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createInitialFsrsCard(now: Date = new Date()): FsrsCardState {
  return {
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    dueAt: now.toISOString(),
    lastReviewAt: null,
  };
}

export function computeRetrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

function initialStability(rating: FsrsRating): number {
  return Math.max(0.1, W[rating - 1] ?? 0.4);
}

function initialDifficulty(rating: FsrsRating): number {
  return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(difficulty: number, rating: FsrsRating): number {
  const delta = -W[6] * (rating - 3);
  const damped = difficulty + delta * ((10 - difficulty) / 9);
  const meanReverted = W[7] * initialDifficulty(4) + (1 - W[7]) * damped;
  return clamp(meanReverted, 1, 10);
}

function nextRecallStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: FsrsRating,
): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  const growth =
    Math.exp(W[8]) *
    (11 - difficulty) *
    Math.pow(stability, -W[9]) *
    (Math.exp((1 - retrievability) * W[10]) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(0.1, stability * (1 + growth));
}

function nextForgetStability(
  difficulty: number,
  stability: number,
  retrievability: number,
): number {
  return Math.max(
    0.1,
    W[11] *
      Math.pow(difficulty, -W[12]) *
      (Math.pow(stability + 1, W[13]) - 1) *
      Math.exp((1 - retrievability) * W[14]),
  );
}

function nextIntervalDays(stability: number): number {
  const raw = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, MAXIMUM_INTERVAL_DAYS);
}

export function scheduleFsrsReview(
  card: FsrsCardState,
  rating: FsrsRating,
  now: Date = new Date(),
): FsrsReviewResult {
  const lastMs = card.lastReviewAt ? new Date(card.lastReviewAt).getTime() : now.getTime();
  const elapsedDays = Math.max(0, (now.getTime() - lastMs) / 86_400_000);

  let stability: number;
  let difficulty: number;
  let state: CardState;
  let lapses = card.lapses;
  let intervalDays: number;
  let retrievability: number;

  if (card.state === 'new' || card.reps === 0) {
    stability = initialStability(rating);
    difficulty = initialDifficulty(rating);
    retrievability = 1;

    if (rating === 1) {
      state = 'learning';
      intervalDays = 0; // review again in 10 minutes
    } else if (rating === 2) {
      state = 'learning';
      intervalDays = 1;
    } else if (rating === 3) {
      state = 'review';
      intervalDays = Math.max(1, nextIntervalDays(stability));
    } else {
      state = 'review';
      intervalDays = Math.max(4, nextIntervalDays(stability));
    }
  } else {
    retrievability = computeRetrievability(elapsedDays, card.stability);
    difficulty = nextDifficulty(card.difficulty, rating);

    if (rating === 1) {
      lapses += 1;
      stability = nextForgetStability(difficulty, card.stability, retrievability);
      state = 'relearning';
      intervalDays = 0; // re-queue in 10 minutes
    } else {
      stability = nextRecallStability(difficulty, card.stability, retrievability, rating);
      state = 'review';
      intervalDays = nextIntervalDays(stability);
      if (rating === 2) {
        intervalDays = Math.max(1, Math.round(intervalDays * 0.8));
      } else if (rating === 4) {
        intervalDays = Math.min(MAXIMUM_INTERVAL_DAYS, Math.max(intervalDays + 1, Math.round(intervalDays * 1.25)));
      }
    }
  }

  const dueDate =
    intervalDays === 0
      ? new Date(now.getTime() + 10 * 60 * 1000)
      : new Date(now.getTime() + intervalDays * 86_400_000);

  return {
    nextCard: {
      stability: Number(stability.toFixed(4)),
      difficulty: Number(difficulty.toFixed(4)),
      elapsedDays: Number(elapsedDays.toFixed(2)),
      scheduledDays: intervalDays,
      reps: card.reps + 1,
      lapses,
      state,
      dueAt: dueDate.toISOString(),
      lastReviewAt: now.toISOString(),
    },
    intervalDays,
    retrievability: Number(retrievability.toFixed(4)),
  };
}

export function previewFsrsIntervals(
  card: FsrsCardState,
  now: Date = new Date(),
): Record<FsrsRating, string> {
  const formatDays = (days: number): string => {
    if (days <= 0) return '10 min';
    if (days === 1) return '1 dia';
    if (days < 30) return `${days} dias`;
    const months = Math.round(days / 30);
    return months === 1 ? '1 mês' : `${months} meses`;
  };

  return {
    1: formatDays(scheduleFsrsReview(card, 1, now).intervalDays),
    2: formatDays(scheduleFsrsReview(card, 2, now).intervalDays),
    3: formatDays(scheduleFsrsReview(card, 3, now).intervalDays),
    4: formatDays(scheduleFsrsReview(card, 4, now).intervalDays),
  };
}
