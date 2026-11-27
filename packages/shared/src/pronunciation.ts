import type { LanguageCode } from './types.js';

export interface PronunciationEvaluation {
  score: number; // 0..100
  passed: boolean;
  matchedWords: Array<{ word: string; matched: boolean }>;
  feedbackPt: string;
}

const CJK_LANGUAGES = new Set<LanguageCode>(['ja', 'zh', 'ko']);

function normalizeText(input: string, isCjk: boolean): string {
  const lowered = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:"'()¿¡。、！？「」『』・\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (isCjk) {
    return lowered.replace(/\s+/g, '');
  }
  return lowered;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export function evaluatePronunciation(
  spokenRaw: string,
  targetRaw: string,
  language: LanguageCode,
  acceptedVariants: string[] = [],
): PronunciationEvaluation {
  const isCjk = CJK_LANGUAGES.has(language);
  const spoken = normalizeText(spokenRaw, isCjk);
  const candidates = [targetRaw, ...acceptedVariants].map((item) =>
    normalizeText(item, isCjk),
  );

  if (!spoken) {
    return {
      score: 0,
      passed: false,
      matchedWords: targetRaw
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({ word, matched: false })),
      feedbackPt: 'Não ouvimos sua voz. Toque no microfone e fale com calma perto do aparelho.',
    };
  }

  let bestScore = 0;
  for (const candidate of candidates) {
    const ratio = similarityRatio(spoken, candidate);
    if (ratio > bestScore) bestScore = ratio;
  }

  const score = Math.round(bestScore * 100);
  const targetTokens = isCjk
    ? Array.from(normalizeText(targetRaw, true))
    : targetRaw
        .replace(/[.,!?;:"'()¿¡]/g, '')
        .split(/\s+/)
        .filter(Boolean);

  const spokenTokens = isCjk ? Array.from(spoken) : spoken.split(' ');
  const matchedWords = targetTokens.map((word) => {
    const normWord = normalizeText(word, isCjk);
    const matched = spokenTokens.some(
      (token) => similarityRatio(token, normWord) >= 0.72,
    );
    return { word, matched };
  });

  const passed = score >= 70;
  let feedbackPt = 'Excelente pronúncia! Ritmo claro e natural.';
  if (score < 70) {
    feedbackPt = 'Quase lá! Ouça o áudio em velocidade lenta (0.75x) e tente novamente destacando as palavras em destaque.';
  } else if (score < 88) {
    feedbackPt = 'Muito bom! Já dá para entender perfeitamente — repita mais uma vez para deixar a entonação ainda mais natural.';
  }

  return {
    score,
    passed,
    matchedWords,
    feedbackPt,
  };
}
