import { LANGUAGES, type LanguageCode } from '@naidioma/shared';

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

export function speakText(
  text: string,
  language: LanguageCode,
  rate: number = 1.0,
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const locale = LANGUAGES[language].speechLocale;
    utter.lang = locale;
    utter.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(language.toLowerCase()));
    if (match) utter.voice = match;

    window.speechSynthesis.speak(utter);
  } catch {
    // ignore speech errors on headless/restricted browsers
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechRecognizer(
  language: LanguageCode,
  callbacks: {
    onTranscript: (text: string, isFinal: boolean) => void;
    onError: (message: string) => void;
    onEnd: () => void;
  },
): { start: () => void; stop: () => void } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = LANGUAGES[language].speechLocale;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  rec.onresult = (event) => {
    let transcript = '';
    let isFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      const item = event.results[i];
      if (!item) continue;
      transcript += item[0]?.transcript ?? '';
      if (item.isFinal) isFinal = true;
    }
    callbacks.onTranscript(transcript.trim(), isFinal);
  };

  rec.onerror = (err) => {
    const map: Record<string, string> = {
      'not-allowed': 'Permissão do microfone negada. Libere o microfone no navegador/aparelho.',
      'no-speech': 'Nenhuma voz detectada. Fale um pouco mais perto do microfone.',
      network: 'Erro de rede ao transcrever voz. Você também pode digitar.',
    };
    callbacks.onError(map[err.error] ?? 'Não foi possível capturar o áudio agora.');
  };

  rec.onend = () => callbacks.onEnd();

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
  };
}
