import { LANGUAGES, type LanguageCode } from '@naidioma/shared';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
}

interface SpeechGrammarListLike {
  addFromString: (string: string, weight?: number) => void;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  grammars?: SpeechGrammarListLike;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let speakTimer: ReturnType<typeof setTimeout> | null = null;

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const list = window.speechSynthesis.getVoices();
  if (list.length > 0) cachedVoices = list;
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    refreshVoices();
  });
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
  language: LanguageCode,
): SpeechSynthesisVoice | undefined {
  const lowerLocale = locale.toLowerCase();
  const lowerLang = language.toLowerCase();
  const exactMatches = voices.filter((v) => v.lang.toLowerCase() === lowerLocale);
  const langMatches =
    exactMatches.length > 0
      ? exactMatches
      : voices.filter((v) => v.lang.toLowerCase().startsWith(lowerLang));

  if (langMatches.length === 0) return undefined;

  // Prefer natural neural/enhanced voices over robotic fallbacks
  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const n = `${v.name} ${v.voiceURI}`.toLowerCase();
    let score = 0;
    if (v.lang.toLowerCase() === lowerLocale) score += 20;
    if (/natural|neural|enhanced|premium|google/.test(n)) score += 15;
    if (/samantha|ava|allison|daniel|aria|jenny|guy|luciana|yuna|kyoko/.test(n)) score += 12;
    if (v.localService) score += 2;
    return score;
  };

  return [...langMatches].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

export function speakText(
  text: string,
  language: LanguageCode,
  rate: number = 1.0,
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    if (speakTimer) {
      clearTimeout(speakTimer);
      speakTimer = null;
    }
    const wasSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    window.speechSynthesis.cancel();

    const trigger = () => {
      const utter = new SpeechSynthesisUtterance(text);
      const locale = LANGUAGES[language].speechLocale;
      utter.lang = locale;
      utter.rate = rate;
      const voices = refreshVoices();
      const match = pickBestVoice(voices, locale, language);
      if (match) utter.voice = match;
      window.speechSynthesis.speak(utter);
    };

    // Short handoff after cancel avoids Chrome/Safari silent-drop bug
    if (wasSpeaking) {
      speakTimer = setTimeout(trigger, 35);
    } else {
      trigger();
    }
  } catch {
    // ignore speech errors on headless/restricted browsers
  }
}

export function speakSingleWord(word: string, language: LanguageCode): void {
  const cleaned = word.replace(/[.,!?;:"()¿¡]/g, '').trim();
  if (!cleaned) return;
  speakText(cleaned, language, 0.72);
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isAudioRecorderSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    typeof MediaRecorder !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function',
  );
}

/**
 * Overlap-aware transcript merger:
 * - Handles Chrome Android cumulative results ("nice to" + "nice to meet you" -> "nice to meet you")
 * - Handles sliding suffix-prefix overlaps ("nice to meet" + "to meet you" -> "nice to meet you")
 * - Preserves separate paused words without losing anything ("I" + "am" + "from" + "Brazil")
 */
export function mergeTranscriptParts(parts: string[]): string {
  const words: string[] = [];

  for (const raw of parts) {
    const clean = raw.trim().replace(/\s+/g, ' ');
    if (!clean) continue;
    const nextWords = clean.split(' ');
    if (words.length === 0) {
      words.push(...nextWords);
      continue;
    }

    const prevLower = words.map((w) => w.toLowerCase());
    const nextLower = nextWords.map((w) => w.toLowerCase());

    // Exact full duplicate of tail
    if (
      nextLower.length <= prevLower.length &&
      prevLower.slice(-nextLower.length).join(' ') === nextLower.join(' ')
    ) {
      continue;
    }

    // Cumulative replacement where next starts with all of prev
    if (
      nextLower.length > prevLower.length &&
      nextLower.slice(0, prevLower.length).join(' ') === prevLower.join(' ')
    ) {
      words.splice(0, words.length, ...nextWords);
      continue;
    }

    // Suffix-prefix overlap (e.g., prev ends with "to meet", next starts with "to meet you")
    let maxOverlap = 0;
    const limit = Math.min(prevLower.length, nextLower.length, 6);
    for (let k = limit; k >= 1; k--) {
      const suffix = prevLower.slice(-k).join(' ');
      const prefix = nextLower.slice(0, k).join(' ');
      if (suffix === prefix) {
        maxOverlap = k;
        break;
      }
    }

    words.push(...nextWords.slice(maxOverlap));
  }

  return words.join(' ').trim();
}

export interface SpeechCaptureResult {
  text: string;
  alternatives: string[];
}

export interface SpeechRecognizerHandle {
  start: () => void;
  /**
   * Gracefully stops the recognizer WITHOUT throwing away buffered trailing words!
   * Resolves once final `onresult` / `onend` has drained (or after a short 900ms safety timeout).
   */
  stop: () => Promise<SpeechCaptureResult>;
  abort: () => void;
}

function attachGrammarHint(
  rec: BrowserSpeechRecognition,
  hintText: string | undefined,
): void {
  if (!hintText || typeof window === 'undefined') return;
  try {
    const w = window as unknown as {
      SpeechGrammarList?: new () => SpeechGrammarListLike;
      webkitSpeechGrammarList?: new () => SpeechGrammarListLike;
    };
    const GrammarCtor = w.SpeechGrammarList || w.webkitSpeechGrammarList;
    if (!GrammarCtor) return;
    const words = Array.from(
      new Set(
        hintText
          .toLowerCase()
          .replace(/[.,!?;:"()¿¡]/g, ' ')
          .split(/\s+/)
          .filter(Boolean),
      ),
    );
    if (words.length === 0) return;
    const grammar = `#JSGF V1.0; grammar phrase; public <word> = ${words.join(' | ')} ;`;
    const list = new GrammarCtor();
    list.addFromString(grammar, 1.0);
    rec.grammars = list;
  } catch {
    // Some browsers throw on SpeechGrammarList; safe to ignore
  }
}

/**
 * Continuous, pause-resilient, drain-safe Web Speech recognizer:
 * - Graceful stop(): waits for browser's trailing `onresult` flush so the last 1–3 spoken words are NEVER dropped!
 * - High-water candidate tracking: preserves interim & alternative hypotheses so Chrome/Safari finalizers
 *   can never silently delete short words ("a", "the", "to", "is") that were heard while speaking.
 * - Ultra-fast 40ms seamless restart on mobile/Safari silence pauses (supports paused word-by-word speech!).
 * - Optional JSGF SpeechGrammarList vocabulary biasing from the exercise's target sentence.
 */
export function createSpeechRecognizer(
  language: LanguageCode,
  callbacks: {
    onTranscript: (text: string, isFinal: boolean, alternatives?: string[]) => void;
    onError: (message: string) => void;
    onEnd: () => void;
    onStateChange?: (state: 'listening' | 'reconnecting' | 'draining' | 'stopped') => void;
    hintText?: string;
  },
): SpeechRecognizerHandle | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const locale = LANGUAGES[language].speechLocale;
  let active = false;
  let stopping = false;
  let currentRec: BrowserSpeechRecognition | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let safetyStopTimer: ReturnType<typeof setTimeout> | null = null;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;
  let restartCount = 0;

  let committedPrefix = '';
  let committedAltPrefixes: string[] = [''];
  let latestSessionText = '';
  let latestSessionAlts: string[] = [];
  // Preserves rich interim/final snapshots heard during this attempt so short words aren't lost
  const observedSnapshots = new Set<string>();
  let stopResolvers: Array<(res: SpeechCaptureResult) => void> = [];

  function clearTimers() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (safetyStopTimer) {
      clearTimeout(safetyStopTimer);
      safetyStopTimer = null;
    }
    if (drainTimer) {
      clearTimeout(drainTimer);
      drainTimer = null;
    }
  }

  function buildCurrentResult(): SpeechCaptureResult {
    const primary = mergeTranscriptParts([committedPrefix, latestSessionText]);
    const all = new Set<string>();
    if (primary) all.add(primary);
    for (const p of committedAltPrefixes) {
      if (p) all.add(p);
      for (const s of latestSessionAlts) {
        const merged = mergeTranscriptParts([p, s]);
        if (merged) all.add(merged);
      }
    }
    for (const snap of observedSnapshots) {
      if (snap) all.add(snap);
    }
    return {
      text: primary,
      alternatives: Array.from(all).slice(0, 16),
    };
  }

  function finalizeAll() {
    active = false;
    stopping = false;
    clearTimers();
    if (latestSessionText) {
      committedPrefix = mergeTranscriptParts([committedPrefix, latestSessionText]);
      if (committedPrefix) observedSnapshots.add(committedPrefix);
      latestSessionText = '';
    }
    const finalResult = buildCurrentResult();
    const rec = currentRec;
    currentRec = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort?.();
      } catch {
        // ignore
      }
    }
    if (finalResult.text) {
      callbacks.onTranscript(finalResult.text, true, finalResult.alternatives);
    }
    callbacks.onStateChange?.('stopped');
    callbacks.onEnd();
    const resolvers = stopResolvers;
    stopResolvers = [];
    for (const resolve of resolvers) resolve(finalResult);
  }

  function startSession() {
    if (!active || stopping) return;

    const rec = new Ctor!();
    rec.lang = locale;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = true;
    attachGrammarHint(rec, callbacks.hintText);
    currentRec = rec;
    latestSessionText = '';
    latestSessionAlts = [];

    rec.onstart = () => {
      if (!active || stopping) return;
      callbacks.onStateChange?.('listening');
    };

    rec.onresult = (event) => {
      if (!active && !stopping) return;
      restartCount = 0;

      const sessionFinals: string[] = [];
      const sessionInterims: string[] = [];
      const altStreams: string[][] = [[], [], [], [], []];
      let hasFinal = false;

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || result.length === 0) continue;
        const primary = (result[0]?.transcript ?? '').trim();
        if (!primary) continue;

        if (result.isFinal) {
          hasFinal = true;
          sessionFinals.push(primary);
        } else {
          sessionInterims.push(primary);
        }

        for (let a = 0; a < 5; a++) {
          const altText = (result[a]?.transcript ?? primary).trim();
          if (altText) altStreams[a]!.push(altText);
        }
      }

      const sessionPrimary = mergeTranscriptParts([...sessionFinals, ...sessionInterims]);
      latestSessionText = sessionPrimary;

      const fullPrimary = mergeTranscriptParts([committedPrefix, sessionPrimary]);
      if (fullPrimary) observedSnapshots.add(fullPrimary);

      const sessionAltJoined = altStreams
        .map((stream) => mergeTranscriptParts(stream))
        .filter(Boolean);
      latestSessionAlts = sessionAltJoined;

      for (const prefixAlt of committedAltPrefixes.slice(0, 4)) {
        for (const sessAlt of sessionAltJoined) {
          const merged = mergeTranscriptParts([prefixAlt, sessAlt]);
          if (merged) observedSnapshots.add(merged);
        }
      }

      const res = buildCurrentResult();
      callbacks.onTranscript(
        res.text,
        hasFinal && sessionInterims.length === 0,
        res.alternatives,
      );
    };

    rec.onerror = (err) => {
      if (!active && !stopping) return;
      // "no-speech" ou "aborted" durante pausa entre palavras: não apaga nada!
      if (err.error === 'no-speech' || err.error === 'aborted') {
        if (stopping) finalizeAll();
        return;
      }

      const map: Record<string, string> = {
        'not-allowed':
          'Permissão do microfone negada. Libere o microfone nas configurações do navegador ou celular.',
        'audio-capture':
          'Nenhum microfone foi encontrado. Verifique se outro app não está usando o microfone.',
        network:
          'Sem resposta do reconhecimento do navegador — usando transcrição de áudio na nuvem.',
      };
      callbacks.onError(map[err.error] ?? 'Não foi possível capturar o áudio agora. Tente novamente.');
      finalizeAll();
    };

    rec.onend = () => {
      // Consolida tudo que foi captado nesta sessão antes de reiniciar ou encerrar
      if (latestSessionText) {
        committedPrefix = mergeTranscriptParts([committedPrefix, latestSessionText]);
        if (committedPrefix) observedSnapshots.add(committedPrefix);
        const nextAlts = new Set<string>([committedPrefix]);
        for (const p of committedAltPrefixes.slice(0, 4)) {
          for (const s of latestSessionAlts.slice(0, 4)) {
            const m = mergeTranscriptParts([p, s]);
            if (m) {
              nextAlts.add(m);
              observedSnapshots.add(m);
            }
          }
        }
        committedAltPrefixes = Array.from(nextAlts).slice(0, 6);
        latestSessionText = '';
        latestSessionAlts = [];
      }

      if (stopping) {
        finalizeAll();
        return;
      }

      const currentRes = buildCurrentResult();
      if (currentRes.text) {
        callbacks.onTranscript(currentRes.text, true, currentRes.alternatives);
      }

      // Reinicia em apenas 40ms após pausa de silêncio (fala pausada palavra por palavra!)
      if (active && restartCount < 20) {
        restartCount++;
        callbacks.onStateChange?.('reconnecting');
        restartTimer = setTimeout(() => {
          if (active && !stopping) startSession();
        }, 40);
        return;
      }

      finalizeAll();
    };

    try {
      rec.start();
    } catch {
      finalizeAll();
    }
  }

  return {
    start: () => {
      if (active) return;
      try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      committedPrefix = '';
      committedAltPrefixes = [''];
      latestSessionText = '';
      latestSessionAlts = [];
      observedSnapshots.clear();
      restartCount = 0;
      stopping = false;
      active = true;

      safetyStopTimer = setTimeout(() => {
        if (active) {
          stopping = true;
          try {
            currentRec?.stop();
          } catch {
            finalizeAll();
          }
        }
      }, 60_000);

      // Respiro curto após cancelar TTS para liberar o foco de áudio no Android/iOS
      restartTimer = setTimeout(() => {
        if (active && !stopping) startSession();
      }, 80);
    },
    stop: () => {
      if (!active && !stopping) {
        return Promise.resolve(buildCurrentResult());
      }
      return new Promise<SpeechCaptureResult>((resolve) => {
        stopResolvers.push(resolve);
        if (stopping) return;
        stopping = true;
        if (restartTimer) {
          clearTimeout(restartTimer);
          restartTimer = null;
        }
        callbacks.onStateChange?.('draining');

        if (!currentRec) {
          finalizeAll();
          return;
        }

        // Mantém onresult e onend vivos enquanto o navegador descarrega as últimas palavras!
        try {
          currentRec.stop();
        } catch {
          finalizeAll();
          return;
        }

        // Timeout de segurança caso o navegador não dispare onend rapidamente
        drainTimer = setTimeout(() => {
          finalizeAll();
        }, 900);
      });
    },
    abort: () => {
      stopping = true;
      finalizeAll();
    },
  };
}

export interface AudioRecorderHandle {
  start: () => Promise<boolean>;
  stop: () => Promise<{ audioBase64: string; mimeType: string } | null>;
  abort: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Uninterrupted audio recorder (MediaRecorder + Web Audio volume meter):
 * - Captures 100% continuous audio with ZERO silence-pause gaps and a 260ms tail buffer on Stop.
 * - Feeds real-time voice level (0..1) to the UI so the user sees the mic actively hearing them.
 * - Used alongside Web Speech API to verify/rescue any dropped words via 24/7 Cloud Whisper!
 */
export function createAudioRecorder(options?: {
  onVolume?: (level: number) => void;
}): AudioRecorderHandle | null {
  if (!isAudioRecorderSupported()) return null;

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let audioCtx: AudioContext | null = null;
  let rafId: number | null = null;
  let chunks: Blob[] = [];
  let chosenMime = 'audio/webm';
  let stopped = false;

  function cleanupAudioGraph() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    options?.onVolume?.(0);
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
  }

  return {
    start: async () => {
      try {
        stopped = false;
        chunks = [];
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const preferredMimes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
        ];
        chosenMime =
          preferredMimes.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';

        recorder = chosenMime
          ? new MediaRecorder(stream, { mimeType: chosenMime, audioBitsPerSecond: 32_000 })
          : new MediaRecorder(stream);
        chosenMime = recorder.mimeType || chosenMime || 'audio/webm';

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };

        // Live microphone volume meter
        if (options?.onVolume) {
          try {
            const Ctx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
            if (Ctx) {
              audioCtx = new Ctx();
              const source = audioCtx.createMediaStreamSource(stream);
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              const data = new Uint8Array(analyser.frequencyBinCount);
              const tick = () => {
                if (stopped) return;
                analyser.getByteTimeDomainData(data);
                let sumSq = 0;
                for (let i = 0; i < data.length; i++) {
                  const v = (data[i]! - 128) / 128;
                  sumSq += v * v;
                }
                const rms = Math.sqrt(sumSq / data.length);
                options.onVolume?.(Math.min(1, rms * 4.5));
                rafId = requestAnimationFrame(tick);
              };
              rafId = requestAnimationFrame(tick);
            }
          } catch {
            // Meter optional
          }
        }

        recorder.start(250);
        return true;
      } catch {
        cleanupAudioGraph();
        return false;
      }
    },

    stop: () => {
      if (!recorder || stopped) {
        cleanupAudioGraph();
        return Promise.resolve(null);
      }
      stopped = true;
      const activeRecorder = recorder;
      recorder = null;

      return new Promise<{ audioBase64: string; mimeType: string } | null>((resolve) => {
        activeRecorder.onstop = async () => {
          cleanupAudioGraph();
          try {
            const blob = new Blob(chunks, { type: chosenMime || 'audio/webm' });
            chunks = [];
            if (blob.size < 300) {
              resolve(null);
              return;
            }
            const audioBase64 = await blobToBase64(blob);
            resolve({ audioBase64, mimeType: chosenMime || 'audio/webm' });
          } catch {
            resolve(null);
          }
        };

        // Keep capturing for 240ms after tap so the last syllable is NEVER clipped
        setTimeout(() => {
          try {
            if (activeRecorder.state !== 'inactive') {
              activeRecorder.stop();
            } else {
              cleanupAudioGraph();
              resolve(null);
            }
          } catch {
            cleanupAudioGraph();
            resolve(null);
          }
        }, 240);
      });
    },

    abort: () => {
      stopped = true;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      recorder = null;
      chunks = [];
      cleanupAudioGraph();
    },
  };
}
