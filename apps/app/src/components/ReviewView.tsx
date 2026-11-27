import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowsClockwise,
  Brain,
  CheckCircle,
  SpeakerHigh,
} from '@phosphor-icons/react';
import { LANGUAGES, type FsrsRating, type LanguageCode } from '@naidioma/shared';
import { api, type ReviewDeckItem } from '../lib/api';
import { hapticSuccess, hapticTap } from '../lib/native';
import { speakText } from '../lib/speech';

interface ReviewViewProps {
  language: LanguageCode;
  onXpUpdated: () => void;
}

const RATING_BUTTONS: Array<{
  rating: FsrsRating;
  label: string;
  toneClass: string;
}> = [
  { rating: 1, label: 'Errei', toneClass: 'border-[var(--na-error)] text-[var(--na-error)] bg-[var(--na-error-soft)]' },
  { rating: 2, label: 'Difícil', toneClass: 'border-[var(--na-gold)] text-[#7a5a2b] bg-[var(--na-sand)]' },
  { rating: 3, label: 'Bom', toneClass: 'border-[var(--na-teal)] text-[var(--na-teal)] bg-[var(--na-ivory)]' },
  { rating: 4, label: 'Fácil', toneClass: 'border-[var(--na-success)] text-[var(--na-success)] bg-[var(--na-success-soft)]' },
];

export function ReviewView({ language, onXpUpdated }: ReviewViewProps) {
  const langMeta = LANGUAGES[language];
  const [cards, setCards] = useState<ReviewDeckItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  async function loadDeck() {
    setLoading(true);
    setSessionDone(false);
    setIdx(0);
    setFlipped(false);
    try {
      const res = await api.getReviewDeck(language);
      setCards(res.cards);
      setDueCount(res.dueCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDeck();
  }, [language]);

  async function handleRate(rating: FsrsRating) {
    const current = cards[idx];
    if (!current || submitting) return;
    setSubmitting(true);
    void hapticTap();

    try {
      await api.submitReview(current.id, language, rating);
      onXpUpdated();
      if (idx + 1 < cards.length) {
        setIdx((i) => i + 1);
        setFlipped(false);
      } else {
        void hapticSuccess();
        setSessionDone(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-72 rounded-[18px] bg-[var(--na-sand)] animate-pulse" />;
  }

  const current = cards[idx];

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--na-teal)] inline-flex items-center gap-1.5">
            <Brain size={15} weight="duotone" />
            Memória Científica FSRS-4.5 · {langMeta.namePt}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-[var(--na-ink)] mt-1">
            Revise na hora exata antes de esquecer
          </h1>
        </div>
        <span className="font-mono-code text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--na-sand)] text-[var(--na-burgundy)] shrink-0">
          {dueCount} pendentes
        </span>
      </div>

      {sessionDone || !current ? (
        <div className="surface-card p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--na-success-soft)] text-[var(--na-success)] flex items-center justify-center">
            <CheckCircle size={30} weight="fill" />
          </div>
          <h2 className="font-display text-3xl text-[var(--na-ink)]">
            Memória blindada por hoje!
          </h2>
          <p className="text-sm text-[var(--na-muted)] max-w-md mx-auto">
            O algoritmo FSRS calculou o intervalo exato para cada expressão voltar quando você
            estiver prestes a esquecer.
          </p>
          <button
            type="button"
            onClick={() => void loadDeck()}
            className="btn-tactile-secondary px-6 inline-flex items-center gap-2 text-sm"
          >
            <ArrowsClockwise size={16} weight="bold" />
            Fazer rodada extra de revisão
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--na-muted)]">
            <span>
              Cartão {idx + 1} de {cards.length}
            </span>
            <span>Nível {current.cefr}</span>
          </div>

          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-6 sm:p-8 min-h-[290px] flex flex-col justify-between gap-6"
          >
            <div className="space-y-3 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-[var(--na-ink)] leading-tight pt-2">
                {current.front}
              </div>
              {current.reading && (
                <div className="font-mono-code text-sm text-[var(--na-teal)]">
                  {current.reading}
                </div>
              )}
              {current.ipaOrPhoneticBr && (
                <div className="font-mono-code text-xs text-[var(--na-burgundy)]">
                  Pronúncia BR: {current.ipaOrPhoneticBr}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    speakText(current.front, language, 1.0);
                  }}
                  className="min-h-[42px] px-4 rounded-full bg-[var(--na-teal)] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <SpeakerHigh size={16} weight="fill" /> Ouvir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    speakText(current.front, language, 0.72);
                  }}
                  className="min-h-[42px] px-4 rounded-full bg-[var(--na-sand)] text-[var(--na-ink)] text-xs font-semibold"
                >
                  0.75x
                </button>
              </div>
            </div>

            {flipped ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-5 border-t border-[var(--na-border)] space-y-3"
              >
                <div className="text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--na-muted)]">
                    Significado em português
                  </div>
                  <div className="text-xl font-bold text-[var(--na-burgundy)] mt-1">
                    {current.backPt}
                  </div>
                </div>

                <div className="p-3.5 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--na-ink)]">{current.exampleTarget}</span>
                    <button
                      type="button"
                      onClick={() => speakText(current.exampleTarget, language, 0.92)}
                      className="text-[var(--na-teal)] shrink-0"
                      aria-label="Ouvir frase exemplo"
                    >
                      <SpeakerHigh size={16} weight="fill" />
                    </button>
                  </div>
                  {current.exampleReading && (
                    <div className="font-mono-code text-xs text-[var(--na-teal)]">
                      {current.exampleReading}
                    </div>
                  )}
                  <div className="text-xs text-[var(--na-muted)]">{current.examplePt}</div>
                </div>

                <div className="text-xs text-[var(--na-muted)] bg-[var(--na-sand)]/60 p-3 rounded-[10px]">
                  <strong className="text-[var(--na-ink)]">Dica BR: </strong>
                  {current.brazilianTipPt}
                </div>
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  setFlipped(true);
                }}
                className="btn-tactile-primary w-full text-base"
              >
                Mostrar resposta
              </button>
            )}
          </motion.div>

          {flipped && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {RATING_BUTTONS.map((btn) => (
                <button
                  key={btn.rating}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleRate(btn.rating)}
                  className={`min-h-[58px] px-3 py-2 rounded-[14px] border-2 flex flex-col items-center justify-center transition-transform active:scale-[0.98] ${btn.toneClass}`}
                >
                  <span className="text-sm font-extrabold">{btn.label}</span>
                  <span className="font-mono-code text-[11px] opacity-80">
                    {current.intervalPreviews[btn.rating]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
