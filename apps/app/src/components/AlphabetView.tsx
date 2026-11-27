import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, GameController, SpeakerHigh, Sparkle } from '@phosphor-icons/react';
import { LANGUAGES, type LanguageCode } from '@naidioma/shared';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { playCorrectSound, playGentleRetrySound, playTapSound } from '../lib/sound';
import { speakText } from '../lib/speech';
import { ConfettiBurst, InteractiveCast, PuzzleMascot } from './Mascots';

interface AlphabetViewProps {
  language: LanguageCode;
}

interface CharTile {
  symbol: string;
  sound: string;
  hint: string;
  speak: string;
}

// Consoantes e Vogais básicas do Coreano (Hangul) — igual à aba "한" do Duolingo!
const HANGUL_VOWELS: Array<{ jamo: string; idx: number; sound: string; hint: string; speak: string }> = [
  { jamo: 'ㅏ', idx: 0, sound: 'a', hint: 'como em "água"', speak: '아' },
  { jamo: 'ㅑ', idx: 2, sound: 'ya', hint: 'como "iá"', speak: '야' },
  { jamo: 'ㅓ', idx: 4, sound: 'eo', hint: 'como "ó" aberto', speak: '어' },
  { jamo: 'ㅕ', idx: 6, sound: 'yeo', hint: 'como "ió"', speak: '여' },
  { jamo: 'ㅗ', idx: 8, sound: 'o', hint: 'como "ô"', speak: '오' },
  { jamo: 'ㅛ', idx: 12, sound: 'yo', hint: 'como "iô"', speak: '요' },
  { jamo: 'ㅜ', idx: 13, sound: 'u', hint: 'como "u" de uva', speak: '우' },
  { jamo: 'ㅠ', idx: 17, sound: 'yu', hint: 'como "iú"', speak: '유' },
  { jamo: 'ㅡ', idx: 18, sound: 'eu', hint: 'sorriso com "u"', speak: '으' },
  { jamo: 'ㅣ', idx: 20, sound: 'i', hint: 'como "i" de ilha', speak: '이' },
];

const HANGUL_CONSONANTS: Array<{ jamo: string; idx: number; sound: string; hint: string; speak: string }> = [
  { jamo: 'ㅇ', idx: 11, sound: 'mudo', hint: 'só segura a vogal', speak: '아' },
  { jamo: 'ㄱ', idx: 0, sound: 'g / k', hint: 'como "gato"', speak: '가' },
  { jamo: 'ㄴ', idx: 2, sound: 'n', hint: 'como "navio"', speak: '나' },
  { jamo: 'ㄷ', idx: 3, sound: 'd / t', hint: 'como "dado"', speak: '다' },
  { jamo: 'ㄹ', idx: 5, sound: 'r / l', hint: 'R leve de "cara"', speak: '라' },
  { jamo: 'ㅁ', idx: 6, sound: 'm', hint: 'parece uma boca!', speak: '마' },
  { jamo: 'ㅂ', idx: 7, sound: 'b / p', hint: 'como "bola"', speak: '바' },
  { jamo: 'ㅅ', idx: 9, sound: 's', hint: 'como "sapo"', speak: '사' },
  { jamo: 'ㅈ', idx: 12, sound: 'j / dj', hint: 'como "dia"', speak: '자' },
  { jamo: 'ㅎ', idx: 18, sound: 'h / r', hint: 'soprado "rá"', speak: '하' },
];

const HIRAGANA_TILES: CharTile[] = [
  { symbol: 'あ', sound: 'a', hint: 'como "água"', speak: 'あ' },
  { symbol: 'い', sound: 'i', hint: 'como "ilha"', speak: 'い' },
  { symbol: 'う', sound: 'u', hint: 'como "uva"', speak: 'う' },
  { symbol: 'え', sound: 'e', hint: 'como "ele"', speak: 'え' },
  { symbol: 'お', sound: 'o', hint: 'como "olho"', speak: 'お' },
  { symbol: 'か', sound: 'ka', hint: 'casa', speak: 'か' },
  { symbol: 'き', sound: 'ki', hint: 'kiwi', speak: 'き' },
  { symbol: 'く', sound: 'ku', hint: 'cubo', speak: 'く' },
  { symbol: 'け', sound: 'ke', hint: 'queijo', speak: 'け' },
  { symbol: 'こ', sound: 'ko', hint: 'coco', speak: 'こ' },
  { symbol: 'さ', sound: 'sa', hint: 'sapo', speak: 'さ' },
  { symbol: 'し', sound: 'shi', hint: 'xícara', speak: 'し' },
  { symbol: 'す', sound: 'su', hint: 'suco', speak: 'す' },
  { symbol: 'ね', sound: 'ne', hint: 'neko (gato)', speak: 'ね' },
  { symbol: 'み', sound: 'mi', hint: 'mizu (água)', speak: 'み' },
];

const CHINESE_TONES: CharTile[] = [
  { symbol: 'mā 妈', sound: '1º Tom →', hint: 'Alto e retinho (Mamãe)', speak: '妈' },
  { symbol: 'má 麻', sound: '2º Tom ↗', hint: 'Sobe perguntando', speak: '麻' },
  { symbol: 'mǎ 马', sound: '3º Tom ↘↗', hint: 'Desce e sobe (Cavalo)', speak: '马' },
  { symbol: 'mà 骂', sound: '4º Tom ↘', hint: 'Desce rapidinho', speak: '骂' },
  { symbol: '你好', sound: 'Nǐ hǎo', hint: 'Olá! 👋', speak: '你好' },
  { symbol: '猫', sound: 'Māo', hint: 'Gato 🐱', speak: '猫' },
  { symbol: '水', sound: 'Shuǐ', hint: 'Água 💧', speak: '水' },
  { symbol: '谢谢', sound: 'Xièxie', hint: 'Obrigado 🙏', speak: '谢谢' },
];

const SOUND_LAB_BY_LANG: Partial<Record<LanguageCode, CharTile[]>> = {
  en: [
    { symbol: 'TH', sound: 'Three (3)', hint: 'Língua entre os dentes', speak: 'Three' },
    { symbol: 'R', sound: 'Red', hint: 'R dobradinho ("porta")', speak: 'Red' },
    { symbol: 'CAT', sound: 'Két', hint: 'Gato 🐱', speak: 'Cat' },
    { symbol: 'DOG', sound: 'Dóg', hint: 'Cachorro 🐶', speak: 'Dog' },
    { symbol: 'WATER', sound: 'Uó-rer', hint: 'Água 💧', speak: 'Water' },
    { symbol: 'HELLO', sound: 'Re-lôu', hint: 'Olá 👋', speak: 'Hello' },
    { symbol: 'APPLE', sound: 'É-pol', hint: 'Maçã 🍎', speak: 'Apple' },
    { symbol: 'THANK YOU', sound: 'Thênk iu', hint: 'Obrigado 🙏', speak: 'Thank you' },
  ],
  es: [
    { symbol: 'RR', sound: 'Perro', hint: 'R vibrando forte 🐶', speak: 'Perro' },
    { symbol: 'Ñ', sound: 'Niño', hint: 'Som de NH', speak: 'Niño' },
    { symbol: 'H', sound: 'Hola', hint: 'H é mudo! 👋', speak: 'Hola' },
    { symbol: 'J', sound: 'Jugo', hint: 'Som de RR (suco)', speak: 'Jugo' },
    { symbol: 'LL', sound: 'Lluvia', hint: 'Chuva 🌧️', speak: 'Lluvia' },
    { symbol: 'AGUA', sound: 'Á-gua', hint: 'Água 💧', speak: 'Agua' },
  ],
  fr: [
    { symbol: 'EAU', sound: 'Ô', hint: 'Água 💧', speak: 'Eau' },
    { symbol: 'OI', sound: 'Uá', hint: 'Moi = Muá', speak: 'Moi' },
    { symbol: 'CH', sound: 'Chat (Shá)', hint: 'Gato 🐱', speak: 'Chat' },
    { symbol: 'OU', sound: 'Bonjour', hint: 'Bom dia 👋', speak: 'Bonjour' },
    { symbol: 'MERCI', sound: 'Mér-sí', hint: 'Obrigado 🙏', speak: 'Merci' },
    { symbol: 'PAIN', sound: 'Pãn', hint: 'Pão 🍞', speak: 'Pain' },
  ],
  de: [
    { symbol: 'W', sound: 'Wasser', hint: 'W tem som de V 💧', speak: 'Wasser' },
    { symbol: 'EI', sound: 'Eins (Áins)', hint: 'EI = som de AI', speak: 'Eins' },
    { symbol: 'SCH', sound: 'Schule', hint: 'SH de chuva 🏫', speak: 'Schule' },
    { symbol: 'HALLO', sound: 'Rá-lô', hint: 'Olá 👋', speak: 'Hallo' },
    { symbol: 'KATZE', sound: 'Ká-tse', hint: 'Gato 🐱', speak: 'Katze' },
    { symbol: 'DANKE', sound: 'Dân-ke', hint: 'Obrigado 🙏', speak: 'Danke' },
  ],
  it: [
    { symbol: 'CI', sound: 'Ciao (Tcháo)', hint: 'Oi / Tchau 👋', speak: 'Ciao' },
    { symbol: 'CHI', sound: 'Chiamo (Kiá)', hint: 'CHI tem som de KI', speak: 'Mi chiamo' },
    { symbol: 'ZZ', sound: 'Pizza', hint: 'Pizza 🍕', speak: 'Pizza' },
    { symbol: 'ACQUA', sound: 'Á-kua', hint: 'Água 💧', speak: 'Acqua' },
    { symbol: 'GATTO', sound: 'Gá-tto', hint: 'Gato 🐱', speak: 'Gatto' },
    { symbol: 'GRAZIE', sound: 'Grá-tsie', hint: 'Obrigado 🙏', speak: 'Grazie' },
  ],
};

function composeHangul(consonantIdx: number, vowelIdx: number): string {
  return String.fromCharCode(0xac00 + consonantIdx * 588 + vowelIdx * 28);
}

export function AlphabetView({ language }: AlphabetViewProps) {
  const langMeta = LANGUAGES[language];
  const [selectedConsonant, setSelectedConsonant] = useState(HANGUL_CONSONANTS[5]!); // ㅁ
  const [selectedVowel, setSelectedVowel] = useState(HANGUL_VOWELS[0]!); // ㅏ
  const [practicedMap, setPracticedMap] = useState<Record<string, number>>({});
  const [quizActive, setQuizActive] = useState(false);
  const [quizRound, setQuizRound] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<'right' | 'wrong' | null>(null);
  const [quizDone, setQuizDone] = useState(false);

  const quizPool: CharTile[] = useMemo(() => {
    if (language === 'ko') {
      return [
        ...HANGUL_VOWELS.slice(0, 6).map((v) => ({
          symbol: v.speak,
          sound: v.sound,
          hint: v.hint,
          speak: v.speak,
        })),
        ...HANGUL_CONSONANTS.slice(1, 6).map((c) => ({
          symbol: c.speak,
          sound: `${c.sound.split(' ')[0]}a`,
          hint: c.hint,
          speak: c.speak,
        })),
      ];
    }
    if (language === 'ja') return HIRAGANA_TILES.slice(0, 10);
    if (language === 'zh') return CHINESE_TONES;
    return SOUND_LAB_BY_LANG[language] ?? SOUND_LAB_BY_LANG.en!;
  }, [language]);

  const currentQuizTarget = quizPool[quizRound % quizPool.length]!;
  const currentQuizOptions = useMemo(() => {
    const others = quizPool.filter((x) => x.symbol !== currentQuizTarget.symbol).slice(0, 3);
    const list = [currentQuizTarget, ...others];
    // deterministic shuffle by round
    return list.sort((a, b) => ((a.symbol.charCodeAt(0) + quizRound) % 7) - ((b.symbol.charCodeAt(0) + quizRound) % 7));
  }, [quizPool, currentQuizTarget, quizRound]);

  function markPracticed(key: string, speakWord: string) {
    void hapticTap();
    playTapSound();
    speakText(speakWord, language, 0.85);
    setPracticedMap((prev) => ({ ...prev, [key]: Math.min(3, (prev[key] ?? 0) + 1) }));
  }

  function startQuiz() {
    void hapticTap();
    playCorrectSound(1);
    setQuizActive(true);
    setQuizRound(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizDone(false);
    speakText(quizPool[0]!.speak, language, 0.85);
  }

  function answerQuiz(opt: CharTile) {
    if (quizFeedback) return;
    if (opt.symbol === currentQuizTarget.symbol) {
      void hapticSuccess();
      playCorrectSound(quizScore + 1);
      setQuizScore((s) => s + 1);
      setQuizFeedback('right');
    } else {
      void hapticError();
      playGentleRetrySound();
      setQuizFeedback('wrong');
    }

    setTimeout(() => {
      setQuizFeedback(null);
      if (quizRound + 1 >= 5) {
        setQuizDone(true);
      } else {
        const nextRound = quizRound + 1;
        setQuizRound(nextRound);
        speakText(quizPool[nextRound % quizPool.length]!.speak, language, 0.85);
      }
    }, 850);
  }

  const combinedHangul = composeHangul(selectedConsonant.idx, selectedVowel.idx);
  const combinedSound =
    selectedConsonant.jamo === 'ㅇ'
      ? selectedVowel.sound
      : `${selectedConsonant.sound.split(' ')[0]}${selectedVowel.sound}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Cabeçalho divertido com o Mochi */}
      <section className="rounded-[24px] bg-[var(--na-teal)] text-white p-5 border-2 border-[var(--na-teal-dark)] border-b-[6px] flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wider">
            <Sparkle size={14} weight="fill" />
            {language === 'ko'
              ? 'Aba Hangul (한) · Peças de Som 🧩'
              : language === 'ja'
                ? 'Aba Hiragana (あ) · Peças de Som 🧩'
                : language === 'zh'
                  ? 'Aba 4 Tons & Pinyin (拼) · Peças de Som 🧩'
                  : `Laboratório de Sons · ${langMeta.namePt}`}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight">
            {language === 'ko'
              ? 'Aprenda a ler Coreano brincando!'
              : 'Toque nas peças e ouça cada som!'}
          </h1>
          <p className="text-xs sm:text-sm text-white/90 font-semibold">
            {language === 'ko'
              ? 'Toque nas letras abaixo para ouvir e junte peças na Fábrica de Sílabas!'
              : 'Toque em cada cartão para ouvir o áudio nativo e jogue o mini-desafio.'}
          </p>
        </div>
        <InteractiveCast character="mochi" size={86} customPhrase={language === 'ko' ? '안녕! Vamos ler Hangul!' : 'Vamos ouvir os sons! 🐾'} />
      </section>

      {/* Mini-Jogo Rápido (estilo Lição de Letras do Duolingo) */}
      <section className="duo-card p-5 space-y-4 relative overflow-hidden">
        <ConfettiBurst active={quizDone || quizFeedback === 'right'} />
        {!quizActive ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-[#8c6000] flex items-center justify-center shrink-0">
                <GameController size={26} weight="fill" />
              </div>
              <div>
                <div className="font-extrabold text-base text-[var(--na-ink)]">
                  Mini-Jogo: Ouça e Ache o Som!
                </div>
                <div className="text-xs font-semibold text-[var(--na-muted)]">
                  5 rodadas rapidinhas com estrelas e confete.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={startQuiz}
              className="duo-btn-emerald px-5 text-sm uppercase tracking-wide shrink-0"
            >
              JOGAR AGORA
            </button>
          </div>
        ) : quizDone ? (
          <div className="text-center py-4 space-y-3">
            <PuzzleMascot mood="celebrate" size={104} />
            <div className="font-display text-2xl text-[var(--na-ink)]">
              Parabéns! Você acertou {quizScore} de 5! 🎉
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={startQuiz}
                className="duo-btn-emerald px-6 text-sm uppercase"
              >
                Jogar de novo
              </button>
              <button
                type="button"
                onClick={() => setQuizActive(false)}
                className="duo-btn-white px-5 text-sm"
              >
                Voltar às letras
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-teal)]">
                Rodada {quizRound + 1} de 5
              </span>
              <button
                type="button"
                onClick={() => setQuizActive(false)}
                className="text-xs font-bold text-[var(--na-muted)]"
              >
                Sair do jogo
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 py-2">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  speakText(currentQuizTarget.speak, language, 0.8);
                }}
                className="duo-btn-teal px-6 text-base flex items-center gap-2"
              >
                <SpeakerHigh size={22} weight="fill" />
                Ouvir som ({currentQuizTarget.sound})
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {currentQuizOptions.map((opt) => {
                const isTarget = opt.symbol === currentQuizTarget.symbol;
                return (
                  <button
                    key={opt.symbol}
                    type="button"
                    onClick={() => answerQuiz(opt)}
                    className={`min-h-[76px] rounded-2xl border-2 border-b-[5px] text-2xl font-extrabold transition-all active:translate-y-[2px] ${
                      quizFeedback === 'right' && isTarget
                        ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                        : quizFeedback === 'wrong' && isTarget
                          ? 'bg-[var(--na-gold-soft)] border-[var(--na-gold)] text-[#7a5200]'
                          : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-teal)]'
                    }`}
                  >
                    {opt.symbol}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* COREANO: FÁBRICA DE SÍLABAS HANGUL + TABELA INTERATIVA */}
      {language === 'ko' ? (
        <>
          <section className="duo-card p-5 space-y-4 bg-gradient-to-b from-white to-[var(--na-gold-soft)]/35">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl text-[var(--na-ink)]">
                  🧩 Fábrica de Sílabas Hangul
                </h2>
                <p className="text-xs font-semibold text-[var(--na-muted)]">
                  Misture 1 consoante + 1 vogal e veja a peça se juntar na hora!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  playCorrectSound(1);
                  speakText(combinedHangul, 'ko', 0.8);
                }}
                className="duo-btn-wine px-4 min-h-[44px] text-xs inline-flex items-center gap-1.5 shrink-0"
              >
                <SpeakerHigh size={18} weight="fill" /> Ouvir
              </button>
            </div>

            {/* Resultado gigante animado */}
            <motion.button
              key={combinedHangul}
              type="button"
              initial={{ scale: 0.85, rotate: -3 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 18 }}
              onClick={() => {
                playTapSound();
                speakText(combinedHangul, 'ko', 0.8);
              }}
              className="w-full py-5 rounded-3xl bg-white border-2 border-[var(--na-burgundy)] border-b-[6px] flex items-center justify-center gap-5"
            >
              <span className="text-2xl font-extrabold text-[var(--na-teal)] bg-[var(--na-teal-soft)] w-12 h-12 rounded-2xl flex items-center justify-center">
                {selectedConsonant.jamo}
              </span>
              <span className="text-xl font-extrabold text-[var(--na-muted)]">+</span>
              <span className="text-2xl font-extrabold text-[var(--na-burgundy)] bg-[var(--na-rose-soft)] w-12 h-12 rounded-2xl flex items-center justify-center">
                {selectedVowel.jamo}
              </span>
              <span className="text-xl font-extrabold text-[var(--na-muted)]">=</span>
              <div className="text-center">
                <div className="text-5xl font-extrabold text-[var(--na-ink)] leading-none">
                  {combinedHangul}
                </div>
                <div className="text-sm font-extrabold text-[var(--na-burgundy)] mt-1">
                  "{combinedSound}"
                </div>
              </div>
            </motion.button>

            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-teal)]">
                1. Escolha a consoante:
              </div>
              <div className="grid grid-cols-5 gap-2">
                {HANGUL_CONSONANTS.map((c) => {
                  const active = selectedConsonant.jamo === c.jamo;
                  return (
                    <button
                      key={c.jamo}
                      type="button"
                      onClick={() => {
                        setSelectedConsonant(c);
                        const nextSyl = composeHangul(c.idx, selectedVowel.idx);
                        playTapSound();
                        speakText(nextSyl, 'ko', 0.82);
                      }}
                      className={`py-2.5 rounded-2xl border-2 border-b-4 text-center transition-all active:translate-y-[2px] ${
                        active
                          ? 'bg-[var(--na-teal)] text-white border-[var(--na-teal-dark)]'
                          : 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
                      }`}
                    >
                      <div className="text-xl font-extrabold leading-none">{c.jamo}</div>
                      <div className="text-[10px] font-bold opacity-85 mt-1">{c.sound}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
                2. Escolha a vogal:
              </div>
              <div className="grid grid-cols-5 gap-2">
                {HANGUL_VOWELS.map((v) => {
                  const active = selectedVowel.jamo === v.jamo;
                  return (
                    <button
                      key={v.jamo}
                      type="button"
                      onClick={() => {
                        setSelectedVowel(v);
                        const nextSyl = composeHangul(selectedConsonant.idx, v.idx);
                        playTapSound();
                        speakText(nextSyl, 'ko', 0.82);
                      }}
                      className={`py-2.5 rounded-2xl border-2 border-b-4 text-center transition-all active:translate-y-[2px] ${
                        active
                          ? 'bg-[var(--na-burgundy)] text-white border-[var(--na-wine-deep)]'
                          : 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
                      }`}
                    >
                      <div className="text-xl font-extrabold leading-none">{v.jamo}</div>
                      <div className="text-[10px] font-bold opacity-85 mt-1">{v.sound}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Grade de Vogais Coreanas */}
          <section className="space-y-3">
            <h2 className="font-display text-xl text-[var(--na-ink)]">
              Vogais do Coreano (toque para ouvir!)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {HANGUL_VOWELS.map((v) => {
                const count = practicedMap[v.speak] ?? 0;
                return (
                  <button
                    key={v.jamo}
                    type="button"
                    onClick={() => markPracticed(v.speak, v.speak)}
                    className="duo-btn-white p-3 flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-3xl font-extrabold text-[var(--na-ink)]">{v.speak}</span>
                    <span className="text-sm font-extrabold text-[var(--na-burgundy)]">
                      {v.sound}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--na-muted)]">
                      {v.hint}
                    </span>
                    <div className="w-full h-2 rounded-full bg-[var(--na-sand)] overflow-hidden mt-1">
                      <div
                        className="h-full bg-[var(--na-gold)] transition-all"
                        style={{ width: `${(count / 3) * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Grade de Consoantes Coreanas */}
          <section className="space-y-3">
            <h2 className="font-display text-xl text-[var(--na-ink)]">
              Consoantes do Coreano
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {HANGUL_CONSONANTS.map((c) => {
                const count = practicedMap[c.jamo] ?? 0;
                return (
                  <button
                    key={c.jamo}
                    type="button"
                    onClick={() => markPracticed(c.jamo, c.speak)}
                    className="duo-btn-white p-3 flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-3xl font-extrabold text-[var(--na-ink)]">{c.jamo}</span>
                    <span className="text-sm font-extrabold text-[var(--na-teal)]">{c.sound}</span>
                    <span className="text-[10px] font-semibold text-[var(--na-muted)]">
                      {c.hint}
                    </span>
                    <div className="w-full h-2 rounded-full bg-[var(--na-sand)] overflow-hidden mt-1">
                      <div
                        className="h-full bg-[var(--na-success)] transition-all"
                        style={{ width: `${(count / 3) * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        /* JAPONÊS, CHINÊS E DEMAIS IDIOMAS */
        <section className="space-y-3">
          <h2 className="font-display text-xl text-[var(--na-ink)]">
            {language === 'ja'
              ? 'Tabela Interativa de Hiragana'
              : language === 'zh'
                ? 'Os 4 Tons + Palavras Mágicas'
                : `Sons Principais de ${langMeta.namePt}`}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(language === 'ja'
              ? HIRAGANA_TILES
              : language === 'zh'
                ? CHINESE_TONES
                : SOUND_LAB_BY_LANG[language] ?? SOUND_LAB_BY_LANG.en!
            ).map((tile) => {
              const count = practicedMap[tile.symbol] ?? 0;
              return (
                <button
                  key={tile.symbol}
                  type="button"
                  onClick={() => markPracticed(tile.symbol, tile.speak)}
                  className="duo-btn-white p-4 flex flex-col items-center justify-center gap-1 text-center"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-extrabold text-[var(--na-ink)]">
                      {tile.symbol}
                    </span>
                    {count >= 2 && (
                      <CheckCircle size={16} weight="fill" className="text-[var(--na-success)]" />
                    )}
                  </div>
                  <span className="text-sm font-extrabold text-[var(--na-burgundy)]">
                    {tile.sound}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--na-muted)]">
                    {tile.hint}
                  </span>
                  <div className="w-full h-2 rounded-full bg-[var(--na-sand)] overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-[var(--na-gold)] transition-all"
                      style={{ width: `${(count / 3) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
