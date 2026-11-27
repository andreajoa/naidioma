import type { LanguageCode } from './types.js';

export interface WordAlignment {
  word: string;
  matched: boolean;
  status: 'ok' | 'close' | 'missing' | 'substituted';
  heardWord?: string;
}

export interface PronunciationEvaluation {
  score: number; // 0..100
  passed: boolean;
  bestSpokenText: string;
  matchedWords: WordAlignment[];
  missingWords: string[];
  substitutedWords: Array<{ expected: string; heard: string }>;
  extraWords: string[];
  feedbackPt: string;
}

export interface SequenceDiffItem {
  kind: 'match' | 'missing' | 'wrong' | 'extra';
  expected?: string;
  actual?: string;
}

const CJK_LANGUAGES = new Set<LanguageCode>(['ja', 'zh', 'ko']);

const ENGLISH_CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi'm\b|\bim\b/g, 'i am'],
  [/\bi've\b/g, 'i have'],
  [/\bi'd\b/g, 'i would'],
  [/\bi'll\b/g, 'i will'],
  [/\byou're\b|\byoure\b/g, 'you are'],
  [/\byou've\b|\byouve\b/g, 'you have'],
  [/\byou'd\b|\byoud\b/g, 'you would'],
  [/\byou'll\b|\byoull\b/g, 'you will'],
  [/\bwe're\b/g, 'we are'],
  [/\bwe've\b|\bweve\b/g, 'we have'],
  [/\bwe'd\b/g, 'we would'],
  [/\bwe'll\b/g, 'we will'],
  [/\bthey're\b|\btheyre\b/g, 'they are'],
  [/\bthey've\b|\btheyve\b/g, 'they have'],
  [/\bthey'd\b|\btheyd\b/g, 'they would'],
  [/\bthey'll\b|\btheyll\b/g, 'they will'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b|\bthats\b/g, 'that is'],
  [/\bwhat's\b|\bwhats\b/g, 'what is'],
  [/\bwhere's\b|\bwheres\b/g, 'where is'],
  [/\bwho's\b/g, 'who is'],
  [/\bhow's\b|\bhows\b/g, 'how is'],
  [/\bthere's\b|\btheres\b/g, 'there is'],
  [/\bhere's\b|\bheres\b/g, 'here is'],
  [/\blet's\b|\blets\b/g, 'let us'],
  [/\bdon't\b|\bdont\b/g, 'do not'],
  [/\bdoesn't\b|\bdoesnt\b/g, 'does not'],
  [/\bdidn't\b|\bdidnt\b/g, 'did not'],
  [/\bcan't\b|\bcant\b|\bcannot\b/g, 'can not'],
  [/\bwon't\b|\bwont\b/g, 'will not'],
  [/\bisn't\b|\bisnt\b/g, 'is not'],
  [/\baren't\b|\barent\b/g, 'are not'],
  [/\bwasn't\b|\bwasnt\b/g, 'was not'],
  [/\bweren't\b|\bwerent\b/g, 'were not'],
  [/\bhaven't\b|\bhavent\b/g, 'have not'],
  [/\bhasn't\b|\bhasnt\b/g, 'has not'],
  [/\bhadn't\b|\bhadnt\b/g, 'had not'],
  [/\bwouldn't\b|\bwouldnt\b/g, 'would not'],
  [/\bcouldn't\b|\bcouldnt\b/g, 'could not'],
  [/\bshouldn't\b|\bshouldnt\b/g, 'should not'],
  [/\bgonna\b/g, 'going to'],
  [/\bwanna\b/g, 'want to'],
  [/\bgotta\b/g, 'got to'],
  [/\bkinda\b/g, 'kind of'],
  [/\bsorta\b/g, 'sort of'],
  [/\blemme\b/g, 'let me'],
  [/\bdunno\b/g, 'do not know'],
  [/\bo'clock\b|\boclock\b/g, 'o clock'],
];

const ONES_EN = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS_EN = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

const ORDINALS_EN: Record<string, string> = {
  '1st': 'first',
  '2nd': 'second',
  '3rd': 'third',
  '4th': 'fourth',
  '5th': 'fifth',
  '6th': 'sixth',
  '7th': 'seventh',
  '8th': 'eighth',
  '9th': 'ninth',
  '10th': 'tenth',
  '11th': 'eleventh',
  '12th': 'twelfth',
  '20th': 'twentieth',
  '21st': 'twenty first',
  '30th': 'thirtieth',
};

function intToEnglishWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 9999) return String(n);
  if (n < 20) return ONES_EN[n]!;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rem = n % 10;
    return rem === 0 ? TENS_EN[tens]! : `${TENS_EN[tens]} ${ONES_EN[rem]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    return rem === 0 ? `${ONES_EN[h]} hundred` : `${ONES_EN[h]} hundred ${intToEnglishWords(rem)}`;
  }
  // Years like 1995 or 2021 are usually spoken "nineteen ninety five" / "twenty twenty one"
  if (n >= 1900 && n <= 2099 && n % 100 !== 0) {
    const first = Math.floor(n / 100);
    const last = n % 100;
    if (last < 10) return `${intToEnglishWords(first)} oh ${ONES_EN[last]}`;
    return `${intToEnglishWords(first)} ${intToEnglishWords(last)}`;
  }
  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  return rem === 0 ? `${ONES_EN[th]} thousand` : `${ONES_EN[th]} thousand ${intToEnglishWords(rem)}`;
}

function expandEnglishToken(tok: string): string {
  if (ORDINALS_EN[tok]) return ORDINALS_EN[tok]!;
  // Time like 7:30 or 8:00
  const timeMatch = tok.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = Number(timeMatch[2]);
    if (m === 0) return `${intToEnglishWords(h)} o clock`;
    if (m < 10) return `${intToEnglishWords(h)} oh ${intToEnglishWords(m)}`;
    return `${intToEnglishWords(h)} ${intToEnglishWords(m)}`;
  }
  // Currency like $45
  const dollarMatch = tok.match(/^\$(\d+)$/);
  if (dollarMatch) {
    return `${intToEnglishWords(Number(dollarMatch[1]))} dollars`;
  }
  // Percent like 30%
  const pctMatch = tok.match(/^(\d+)%$/);
  if (pctMatch) {
    return `${intToEnglishWords(Number(pctMatch[1]))} percent`;
  }
  if (/^\d{1,4}$/.test(tok)) {
    return intToEnglishWords(Number(tok));
  }
  return tok;
}

const ENGLISH_HOMOPHONE_GROUPS: string[][] = [
  ['i', 'eye'],
  ['you', 'u'],
  ['are', 'r'],
  ['why', 'y'],
  ['to', 'too', 'two'],
  ['for', 'four'],
  ['their', 'there'],
  ['your', 'youre'],
  ['hear', 'here'],
  ['know', 'no'],
  ['write', 'right'],
  ['one', 'won'],
  ['buy', 'by', 'bye'],
  ['meet', 'meat'],
  ['our', 'hour'],
  ['see', 'sea', 'c'],
  ['sun', 'son'],
  ['ate', 'eight'],
  ['wait', 'weight'],
  ['wear', 'where'],
  ['peace', 'piece'],
  ['week', 'weak'],
  ['break', 'brake'],
  ['weather', 'whether'],
  ['passed', 'past'],
  ['through', 'threw'],
  ['new', 'knew'],
  ['red', 'read'],
  ['blue', 'blew'],
  ['wood', 'would'],
  ['be', 'bee', 'b'],
  ['not', 'knot'],
  ['mail', 'male'],
  ['check', 'cheque'],
  ['ok', 'okay'],
  ['hi', 'high'],
  ['aloud', 'allowed'],
  ['flour', 'flower'],
  ['whole', 'hole'],
  ['plain', 'plane'],
  ['which', 'witch'],
  ['in', 'inn'],
  ['color', 'colour'],
  ['favor', 'favour'],
  ['favorite', 'favourite'],
  ['center', 'centre'],
  ['theater', 'theatre'],
  ['traveled', 'travelled'],
  ['traveling', 'travelling'],
  ['canceled', 'cancelled'],
  ['organize', 'organise'],
  ['modernize', 'modernise'],
  ['finalize', 'finalise'],
  ['realize', 'realise'],
  ['program', 'programme'],
  ['gray', 'grey'],
  ['mom', 'mum'],
  ['wifi', 'wi-fi'],
  ['email', 'e-mail'],
];

const HOMOPHONE_CANONICAL = new Map<string, string>();
for (const group of ENGLISH_HOMOPHONE_GROUPS) {
  const canon = group[0]!;
  for (const w of group) {
    HOMOPHONE_CANONICAL.set(w, canon);
  }
}

// Common short-word ASR transcriptions when learners speak slowly word-by-word
const SHORT_WORD_PHONETIC_NEAR: Record<string, string[]> = {
  a: ['uh', 'ah', 'er', 'eh', 'an', 'the'],
  an: ['and', 'in', 'uh', 'a', 'en', 'n'],
  the: ['da', 'de', 'duh', 'thee', 'tha', 'a'],
  of: ['off', 'ov', 'have', 'uh'],
  to: ['do', 'ta', 'te', 'too', 'two'],
  in: ['on', 'an', 'n', 'en', 'inn'],
  is: ['its', 'as', 'his', 's', 'es'],
  it: ['at', 'eat', 'id'],
  and: ['an', 'end', 'n'],
  or: ['are', 'our', 'er'],
  at: ['it', 'ed', 'et'],
  on: ['in', 'an', 'own'],
  my: ['may', 'me', 'ma', 'by'],
  we: ['wi', 'oui', 'me'],
  he: ['hi', 'she', 'e'],
  am: ['m', 'um', 'em', 'im'],
  do: ['to', 'due', 'dew', 'du'],
  go: ['goal', 'so'],
  so: ['sew', 'sow'],
  this: ['dis', 'these', 'thus'],
  that: ['dat', 'dad', 'than'],
  with: ['wit', 'wid', 'will'],
  from: ['form', 'for', 'frum'],
};

const HESITATION_FILLERS = new Set(['uh', 'um', 'uhm', 'hmm', 'er', 'ah', 'eh']);

// Compound/hyphenated expressions ASR often joins or splits
const ENGLISH_COMPOUND_SPLITS: Array<[RegExp, string]> = [
  [/\beveryday\b/g, 'every day'],
  [/\balot\b/g, 'a lot'],
  [/\bgoodbye\b/g, 'good bye'],
  [/\bsupermarket\b/g, 'super market'],
  [/\bdowntown\b/g, 'down town'],
  [/\bairport\b/g, 'air port'],
  [/\bhomework\b/g, 'home work'],
  [/\bweekend\b/g, 'week end'],
  [/\bwebsite\b/g, 'web site'],
  [/\bonboarding\b/g, 'on boarding'],
  [/\bworldwide\b/g, 'world wide'],
  [/\boutdoors\b/g, 'out doors'],
  [/\bnobrainer\b/g, 'no brainer'],
  [/\bdropoff\b/g, 'drop off'],
  [/\bcheckin\b/g, 'check in'],
  [/\bfollowup\b/g, 'follow up'],
  [/\btakeaway\b/g, 'take away'],
  [/\bemail\b/g, 'e mail'],
  [/\bwifi\b/g, 'wi fi'],
];

function normalizeText(input: string, isCjk: boolean, language: LanguageCode): string {
  let text = input
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (language === 'en') {
    for (const [pattern, replacement] of ENGLISH_CONTRACTIONS) {
      text = text.replace(pattern, replacement);
    }
    // Expand time/currency/numbers BEFORE stripping punctuation like ":" and "$" and "%"
    text = text
      .split(/\s+/)
      .map((rawTok) => {
        const cleaned = rawTok.replace(/^[.,!?;:"()¿¡]+|[.,!?;:"()¿¡]+$/g, '');
        return expandEnglishToken(cleaned);
      })
      .join(' ');
  }

  text = text
    .replace(/[.,!?;:"()¿¡。、！？「」『』・\-–—/]/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isCjk) {
    return text.replace(/\s+/g, '');
  }

  if (language === 'en') {
    for (const [pattern, replacement] of ENGLISH_COMPOUND_SPLITS) {
      text = text.replace(pattern, replacement);
    }
    text = text
      .split(' ')
      .map((tok) => expandEnglishToken(tok))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return text;
}

function collapseSpeechStutters(
  tokens: string[],
  targetNormSet: Set<string>,
  targetConsecutiveRepeats: Set<string>,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    // Keep hesitation sounds like "uh"/"ah" if the target sentence contains "a"/"an"/"am",
    // because Web Speech often transcribes an isolated paused "a" as "uh"!
    if (
      HESITATION_FILLERS.has(tok) &&
      !targetNormSet.has('a') &&
      !targetNormSet.has('an') &&
      !targetNormSet.has('am')
    ) {
      continue;
    }
    // Collapse accidental Chrome Android duplicates UNLESS the target itself repeats this token consecutively (e.g. "twenty twenty one", "had had")
    if (out.length > 0 && out[out.length - 1] === tok && !targetConsecutiveRepeats.has(tok)) {
      continue;
    }
    out.push(tok);
  }
  return out;
}

function canonicalWord(word: string, language: LanguageCode): string {
  if (language === 'en') {
    return HOMOPHONE_CANONICAL.get(word) ?? word;
  }
  return word;
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

function wordSimilarity(targetNorm: string, spokenNorm: string, language: LanguageCode): number {
  const ct = canonicalWord(targetNorm, language);
  const cs = canonicalWord(spokenNorm, language);
  if (ct === cs) return 1;

  if (language === 'en') {
    const nearList = SHORT_WORD_PHONETIC_NEAR[ct];
    if (nearList && nearList.includes(cs)) {
      // Exact short-word ASR quirk when speaking paused/accented -> close match (never falsely matches unrelated long words!)
      return 0.82;
    }
    // Handle common -ed / -s / -ing trailing sound softening by ASR (e.g. "work" vs "worked" stays < 0.72 unless almost identical,
    // while "studyin" vs "studying" or "walkin" vs "walking" counts as close)
    if (ct.endsWith('ing') && cs === `${ct.slice(0, -1)}`) {
      return 0.92;
    }
  }

  return similarityRatio(ct, cs);
}

/**
 * Aligns spoken tokens onto display target words using Needleman-Wunsch DP
 * so every single expected word is accurately classified as ok / close / substituted / missing.
 */
function alignLatinWords(
  displayTargetWords: string[],
  spokenTokensRaw: string[],
  language: LanguageCode,
): { alignments: WordAlignment[]; wordScore: number; extraWords: string[] } {
  // Expand each display word into its normalized sub-tokens (e.g. "I'm" -> ["i", "am"], "28" -> ["twenty", "eight"])
  const expandedTargets: Array<{ displayIdx: number; norm: string }> = [];
  const targetNormSet = new Set<string>();
  displayTargetWords.forEach((w, displayIdx) => {
    const norm = normalizeText(w, false, language);
    const parts = norm.split(' ').filter(Boolean);
    if (parts.length === 0) {
      expandedTargets.push({ displayIdx, norm: '' });
    } else {
      for (const part of parts) {
        expandedTargets.push({ displayIdx, norm: part });
        targetNormSet.add(part);
      }
    }
  });

  const targetConsecutiveRepeats = new Set<string>();
  for (let k = 1; k < expandedTargets.length; k++) {
    if (expandedTargets[k]!.norm && expandedTargets[k]!.norm === expandedTargets[k - 1]!.norm) {
      targetConsecutiveRepeats.add(expandedTargets[k]!.norm);
    }
  }

  const spokenTokens = collapseSpeechStutters(
    spokenTokensRaw,
    targetNormSet,
    targetConsecutiveRepeats,
  );

  const m = expandedTargets.length;
  const n = spokenTokens.length;

  // DP cost table (lower is better)
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  const bt: Array<Array<'diag' | 'up' | 'left'>> = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill('diag'),
  );

  for (let i = 1; i <= m; i++) {
    dp[i]![0] = i;
    bt[i]![0] = 'up';
  }
  for (let j = 1; j <= n; j++) {
    const extraCost = HESITATION_FILLERS.has(spokenTokens[j - 1]!) ? 0.2 : 0.6;
    dp[0]![j] = dp[0]![j - 1]! + extraCost;
    bt[0]![j] = 'left';
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = wordSimilarity(expandedTargets[i - 1]!.norm, spokenTokens[j - 1]!, language);
      const subCost = sim >= 0.9 ? 0 : sim >= 0.72 ? 0.22 : 1.05 - sim * 0.3;
      const diag = dp[i - 1]![j - 1]! + subCost;
      const up = dp[i - 1]![j]! + 1.0; // missing target word
      const extraCost = HESITATION_FILLERS.has(spokenTokens[j - 1]!) ? 0.2 : 0.6;
      const left = dp[i]![j - 1]! + extraCost; // extra spoken word

      if (diag <= up && diag <= left) {
        dp[i]![j] = diag;
        bt[i]![j] = 'diag';
      } else if (up <= left) {
        dp[i]![j] = up;
        bt[i]![j] = 'up';
      } else {
        dp[i]![j] = left;
        bt[i]![j] = 'left';
      }
    }
  }

  // Backtrack alignment
  const perTargetSim: number[] = Array(m).fill(0);
  const perTargetHeard: Array<string | undefined> = Array(m).fill(undefined);
  const extraWords: string[] = [];

  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const move = bt[i]![j]!;
    if (i > 0 && j > 0 && move === 'diag') {
      const sim = wordSimilarity(expandedTargets[i - 1]!.norm, spokenTokens[j - 1]!, language);
      perTargetSim[i - 1] = sim;
      perTargetHeard[i - 1] = spokenTokens[j - 1];
      i--;
      j--;
    } else if (i > 0 && (j === 0 || move === 'up')) {
      perTargetSim[i - 1] = 0;
      perTargetHeard[i - 1] = undefined;
      i--;
    } else {
      const w = spokenTokens[j - 1]!;
      if (!HESITATION_FILLERS.has(w)) {
        extraWords.unshift(w);
      }
      j--;
    }
  }

  // Collapse sub-tokens back to each display word
  const alignments: WordAlignment[] = displayTargetWords.map((word, displayIdx) => {
    const subIndices = expandedTargets
      .map((item, idx) => (item.displayIdx === displayIdx ? idx : -1))
      .filter((idx) => idx >= 0);

    const sims = subIndices.map((idx) => perTargetSim[idx] ?? 0);
    const avgSim = sims.length > 0 ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;
    const heardParts = subIndices
      .map((idx) => perTargetHeard[idx])
      .filter((v): v is string => Boolean(v));
    const heardWord = heardParts.length > 0 ? heardParts.join(' ') : undefined;

    if (avgSim >= 0.88) {
      return { word, matched: true, status: 'ok', heardWord };
    }
    if (avgSim >= 0.7) {
      return { word, matched: true, status: 'close', heardWord };
    }
    if (heardWord) {
      return { word, matched: false, status: 'substituted', heardWord };
    }
    return { word, matched: false, status: 'missing' };
  });

  // Rescue slightly reordered/repeated paused words that appeared in extraWords
  const remainingExtras = [...extraWords];
  for (const al of alignments) {
    if (al.matched) continue;
    const normAl = normalizeText(al.word, false, language);
    const firstPart = normAl.split(' ')[0] ?? normAl;
    if (!firstPart) continue;
    const foundIdx = remainingExtras.findIndex(
      (tok) => wordSimilarity(firstPart, tok, language) >= 0.82,
    );
    if (foundIdx >= 0) {
      const rescued = remainingExtras.splice(foundIdx, 1)[0]!;
      al.matched = true;
      al.status = 'close';
      al.heardWord = rescued;
    }
  }

  const matchedWeight = alignments.reduce((acc, item) => {
    if (item.status === 'ok') return acc + 1;
    if (item.status === 'close') return acc + 0.88;
    if (item.status === 'substituted') return acc + 0.2;
    return acc;
  }, 0);

  const wordScore =
    alignments.length === 0 ? 0 : Math.round((matchedWeight / alignments.length) * 100);

  return { alignments, wordScore, extraWords: remainingExtras };
}

/**
 * Consensus rescue across multiple ASR hypotheses from the SAME utterance:
 * Web Speech often captures word X in alternative #2 or an interim snapshot and drops it
 * in the final string (especially short words like "a", "the", "to", "is" when paused).
 * If another hypothesis from the SAME attempt genuinely matched that word (status ok/close),
 * preserve that match without ever inventing words that were never heard!
 */
function mergeHypothesisConsensus(
  bestAlignments: WordAlignment[],
  allAlternativeAlignments: WordAlignment[][],
): WordAlignment[] {
  if (allAlternativeAlignments.length <= 1) return bestAlignments;

  return bestAlignments.map((base, idx) => {
    if (base.status === 'ok') return base;

    let upgraded: WordAlignment = base;
    for (const altAlign of allAlternativeAlignments) {
      const candidate = altAlign[idx];
      if (!candidate) continue;
      if (candidate.status === 'ok') {
        return candidate;
      }
      if (candidate.status === 'close' && !upgraded.matched) {
        upgraded = candidate;
      }
    }
    return upgraded;
  });
}

export function evaluatePronunciation(
  spokenRaw: string,
  targetRaw: string,
  language: LanguageCode,
  acceptedVariants: string[] = [],
  spokenAlternatives: string[] = [],
): PronunciationEvaluation {
  const isCjk = CJK_LANGUAGES.has(language);

  const spokenInputs = [spokenRaw, ...spokenAlternatives]
    .map((s) => s.trim())
    .filter(Boolean);

  const uniqueInputs = Array.from(new Set(spokenInputs));

  const displayTargetWords = isCjk
    ? Array.from(normalizeText(targetRaw, true, language))
    : targetRaw
        .replace(/[.,!?;:"()¿¡]/g, '')
        .split(/\s+/)
        .filter(Boolean);

  if (uniqueInputs.length === 0) {
    return {
      score: 0,
      passed: false,
      bestSpokenText: '',
      matchedWords: displayTargetWords.map((word) => ({
        word,
        matched: false,
        status: 'missing',
      })),
      missingWords: displayTargetWords,
      substitutedWords: [],
      extraWords: [],
      feedbackPt:
        'Não ouvimos sua voz. Toque no microfone, fale perto do aparelho e toque em "Parar" quando terminar.',
    };
  }

  const normalizedCandidates = [targetRaw, ...acceptedVariants].map((item) =>
    normalizeText(item, isCjk, language),
  );

  let bestScore = -1;
  let bestSpokenText = uniqueInputs[0]!;
  let bestAlignments: WordAlignment[] = [];
  let bestExtraWords: string[] = [];
  const allLatinAlignments: WordAlignment[][] = [];

  for (const inputText of uniqueInputs) {
    const normSpoken = normalizeText(inputText, isCjk, language);
    if (!normSpoken) continue;

    if (isCjk) {
      let charRatio = 0;
      for (const candidate of normalizedCandidates) {
        const r = similarityRatio(normSpoken, candidate);
        if (r > charRatio) charRatio = r;
      }
      const score = Math.round(charRatio * 100);
      if (score > bestScore) {
        bestScore = score;
        bestSpokenText = inputText;
        const spokenChars = Array.from(normSpoken);
        bestAlignments = displayTargetWords.map((word) => {
          const ok = spokenChars.includes(word);
          return {
            word,
            matched: ok,
            status: ok ? 'ok' : 'missing',
            heardWord: ok ? word : undefined,
          };
        });
        bestExtraWords = [];
      }
    } else {
      const spokenTokens = normSpoken.split(' ').filter(Boolean);
      const { alignments, wordScore, extraWords } = alignLatinWords(
        displayTargetWords,
        spokenTokens,
        language,
      );
      allLatinAlignments.push(alignments);

      let stringRatio = 0;
      const collapsedSpoken = spokenTokens.join(' ');
      for (const candidate of normalizedCandidates) {
        const r = similarityRatio(collapsedSpoken, candidate);
        if (r > stringRatio) stringRatio = r;
      }

      const combinedScore = Math.max(
        wordScore,
        Math.round(wordScore * 0.74 + stringRatio * 100 * 0.26),
      );

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestSpokenText = inputText;
        bestAlignments = alignments;
        bestExtraWords = extraWords;
      }
    }
  }

  if (!isCjk && allLatinAlignments.length > 1) {
    const consensus = mergeHypothesisConsensus(bestAlignments, allLatinAlignments);
    const consensusWeight = consensus.reduce((acc, item) => {
      if (item.status === 'ok') return acc + 1;
      if (item.status === 'close') return acc + 0.88;
      if (item.status === 'substituted') return acc + 0.2;
      return acc;
    }, 0);
    const consensusScore =
      consensus.length === 0 ? 0 : Math.round((consensusWeight / consensus.length) * 100);

    if (consensusScore >= bestScore) {
      bestAlignments = consensus;
      bestScore = consensusScore;
    }
  }

  const score = Math.max(0, Math.min(100, bestScore));
  const missingWords = bestAlignments
    .filter((w) => w.status === 'missing')
    .map((w) => w.word);
  const substitutedWords = bestAlignments
    .filter((w) => w.status === 'substituted' && w.heardWord)
    .map((w) => ({ expected: w.word, heard: w.heardWord! }));
  const failedWords = bestAlignments.filter((w) => !w.matched).map((w) => w.word);
  const passed = score >= 75 || (failedWords.length === 0 && score >= 70);

  let feedbackPt = 'Excelente pronúncia! Todas as palavras foram reconhecidas com clareza.';
  if (!passed) {
    const parts: string[] = [];
    if (missingWords.length > 0) {
      parts.push(`faltou captar: ${missingWords.slice(0, 4).map((w) => `"${w}"`).join(', ')}`);
    }
    if (substitutedWords.length > 0) {
      const subText = substitutedWords
        .slice(0, 3)
        .map((s) => `"${s.expected}" (ouviu "${s.heard}")`)
        .join(', ');
      parts.push(`trocou: ${subText}`);
    }
    feedbackPt =
      parts.length > 0
        ? `Veja exatamente o que ajustar — ${parts.join(' · ')}. Toque nas palavras em vermelho para ouvir devagar e tente de novo!`
        : 'Quase lá! Ouça no modo 🐢 Devagar e fale cada palavra com calma — você pode pausar entre as palavras.';
  } else if (failedWords.length > 0) {
    const preview = failedWords.slice(0, 3).map((w) => `"${w}"`).join(', ');
    feedbackPt = `Muito bom — passou! Só vale reforçar: ${preview} para soar ainda mais nítido.`;
  } else if (score < 92) {
    feedbackPt =
      'Muito bom! Todas as palavras foram captadas com clareza — cada repetição deixa seu ritmo mais nativo.';
  }

  return {
    score,
    passed,
    bestSpokenText,
    matchedWords: bestAlignments,
    missingWords: failedWords,
    substitutedWords,
    extraWords: bestExtraWords,
    feedbackPt,
  };
}

/**
 * Computes a position-aware word diff between a learner's answer and the expected answer
 * so mistakes in "Monte a Frase" and "Múltipla Escolha" highlight the EXACT missing/wrong words.
 */
export function diffTokenSequences(
  actualTokens: string[],
  expectedTokens: string[],
): SequenceDiffItem[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[.,!?;:"()¿¡]/g, '')
      .trim();

  const m = expectedTokens.length;
  const n = actualTokens.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  const bt: Array<Array<'diag' | 'up' | 'left'>> = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill('diag'),
  );

  for (let i = 1; i <= m; i++) {
    dp[i]![0] = i;
    bt[i]![0] = 'up';
  }
  for (let j = 1; j <= n; j++) {
    dp[0]![j] = j;
    bt[0]![j] = 'left';
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = norm(expectedTokens[i - 1]!) === norm(actualTokens[j - 1]!);
      const diag = dp[i - 1]![j - 1]! + (same ? 0 : 1.15);
      const up = dp[i - 1]![j]! + 1;
      const left = dp[i]![j - 1]! + 1;

      if (diag <= up && diag <= left) {
        dp[i]![j] = diag;
        bt[i]![j] = 'diag';
      } else if (up <= left) {
        dp[i]![j] = up;
        bt[i]![j] = 'up';
      } else {
        dp[i]![j] = left;
        bt[i]![j] = 'left';
      }
    }
  }

  const items: SequenceDiffItem[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const move = bt[i]![j]!;
    if (i > 0 && j > 0 && move === 'diag') {
      const exp = expectedTokens[i - 1]!;
      const act = actualTokens[j - 1]!;
      items.unshift(
        norm(exp) === norm(act)
          ? { kind: 'match', expected: exp, actual: act }
          : { kind: 'wrong', expected: exp, actual: act },
      );
      i--;
      j--;
    } else if (i > 0 && (j === 0 || move === 'up')) {
      items.unshift({ kind: 'missing', expected: expectedTokens[i - 1]! });
      i--;
    } else {
      items.unshift({ kind: 'extra', actual: actualTokens[j - 1]! });
      j--;
    }
  }

  return items;
}
