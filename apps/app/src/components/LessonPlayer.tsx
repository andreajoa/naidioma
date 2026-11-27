import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle,
  Eye,
  EyeSlash,
  Info,
  Microphone,
  SpeakerHigh,
  Sparkle,
  StopCircle,
  Trophy,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  LANGUAGES,
  evaluatePronunciation,
  type Exercise,
  type LanguageCode,
  type Lesson,
} from '@naidioma/shared';
import { api } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { createSpeechRecognizer, isSpeechRecognitionSupported, speakText } from '../lib/speech';

interface LessonPlayerProps {
  language: LanguageCode;
  lesson: Lesson;
  onExit: () => void;
  onCompleted: (summary: { xpGained: number; streakDays: number; xpTotal: number }) => void;
}

export function LessonPlayer({ language, lesson, onExit, onCompleted }: LessonPlayerProps) {
  const langMeta = LANGUAGES[language];
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [builtTokens, setBuiltTokens] = useState<string[]>([]);
  const [spokenText, setSpokenText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showRomanization, setShowRomanization] = useState(true);
  const [checked, setChecked] = useState<null | {
    correct: boolean;
    messagePt: string;
    score?: number;
  }>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [aiExplain, setAiExplain] = useState<null | {
    loading: boolean;
    breakdownPt?: string;
    brazilianPitfallPt?: string;
  }>(null);
  const [finished, setFinished] = useState<null | {
    accuracy: number;
    xpGained: number;
    streakDays: number;
  }>(null);

  const startedAtRef = useRef(Date.now());
  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const exercise: Exercise | undefined = lesson.exercises[index];
  const progressPct = Math.round(((index + (checked ? 1 : 0)) / lesson.exercises.length) * 100);

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  const availableBank = useMemo(() => {
    if (!exercise?.wordBank) return [];
    const usedCounts = new Map<string, number>();
    for (const tok of builtTokens) {
      usedCounts.set(tok, (usedCounts.get(tok) ?? 0) + 1);
    }
    return exercise.wordBank.map((token, idx) => {
      const remaining = usedCounts.get(token) ?? 0;
      const used = remaining > 0;
      if (used) usedCounts.set(token, remaining - 1);
      return { token, idx, used };
    });
  }, [exercise, builtTokens]);

  function resetQuestionState() {
    setSelectedOption(null);
    setBuiltTokens([]);
    setSpokenText('');
    setSpeechError(null);
    setChecked(null);
    setAiExplain(null);
    recognizerRef.current?.stop();
    setIsRecording(false);
  }

  function handleSpeakToggle() {
    if (!exercise) return;
    void hapticTap();

    if (isRecording) {
      recognizerRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setSpeechError('Seu navegador não suporta reconhecimento de voz. Digite a frase abaixo para testar!');
      return;
    }

    setSpeechError(null);
    const rec = createSpeechRecognizer(language, {
      onTranscript: (text) => setSpokenText(text),
      onError: (msg) => {
        setSpeechError(msg);
        setIsRecording(false);
      },
      onEnd: () => setIsRecording(false),
    });

    if (!rec) {
      setSpeechError('Reconhecimento de voz indisponível aqui. Digite a frase abaixo.');
      return;
    }

    recognizerRef.current = rec;
    setIsRecording(true);
    rec.start();
  }

  function handleCheck() {
    if (!exercise || checked) return;

    let isCorrect = false;
    let messagePt = '';
    let score: number | undefined;

    if (
      exercise.type === 'context_choice' ||
      exercise.type === 'trap_buster' ||
      exercise.type === 'dialogue_complete' ||
      exercise.type === 'script_lab'
    ) {
      isCorrect = selectedOption === exercise.correctOptionId;
      messagePt = isCorrect
        ? 'Acertou em cheio! Resposta natural.'
        : `Quase lá! A resposta mais natural é: "${exercise.targetText}".`;
    } else if (exercise.type === 'listen_build') {
      const expected = (exercise.correctTokens ?? []).join(' ').trim().toLowerCase();
      const userAnswer = builtTokens.join(' ').trim().toLowerCase();
      isCorrect = expected === userAnswer;
      messagePt = isCorrect
        ? 'Frase montada perfeitamente!'
        : `Ordem natural: "${exercise.targetText}".`;
    } else if (exercise.type === 'speak_pronounce') {
      const evaluation = evaluatePronunciation(
        spokenText,
        exercise.targetText,
        language,
        exercise.acceptedSpeechVariants ?? [],
      );
      isCorrect = evaluation.passed;
      score = evaluation.score;
      messagePt = evaluation.feedbackPt;
    }

    if (isCorrect) {
      void hapticSuccess();
      setCorrectCount((prev) => prev + 1);
    } else {
      void hapticError();
    }

    setChecked({ correct: isCorrect, messagePt, score });
  }

  async function handleNext() {
    void hapticTap();
    if (index + 1 < lesson.exercises.length) {
      setIndex((i) => i + 1);
      resetQuestionState();
      return;
    }

    const total = lesson.exercises.length;
    const accuracy = Math.round((correctCount / total) * 100);
    const durationSeconds = Math.max(15, Math.round((Date.now() - startedAtRef.current) / 1000));

    try {
      const res = await api.completeLesson(lesson.id, accuracy, durationSeconds);
      void hapticSuccess();
      setFinished({ accuracy, xpGained: res.xpGained, streakDays: res.streakDays });
      onCompleted(res);
    } catch {
      setFinished({ accuracy, xpGained: lesson.xpReward, streakDays: 1 });
    }
  }

  async function handleAskAiExplain() {
    if (!exercise) return;
    setAiExplain({ loading: true });
    try {
      const res = await api.explainPhrase(language, exercise.targetText);
      setAiExplain({
        loading: false,
        breakdownPt: res.breakdownPt,
        brazilianPitfallPt: res.brazilianPitfallPt,
      });
    } catch {
      setAiExplain({
        loading: false,
        breakdownPt: exercise.brazilianTipPt,
      });
    }
  }

  const canCheck = Boolean(
    exercise &&
      !checked &&
      ((exercise.type === 'listen_build' && builtTokens.length > 0) ||
        (exercise.type === 'speak_pronounce' && spokenText.trim().length > 0) ||
        selectedOption !== null),
  );

  if (finished) {
    return (
      <div className="min-h-[75dvh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="surface-card max-w-md w-full p-7 text-center space-y-5"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--na-wine)] text-[var(--na-gold)] flex items-center justify-center">
            <Trophy size={34} weight="fill" />
          </div>
          <div>
            <h2 className="font-display text-4xl text-[var(--na-ink)]">Lição concluída!</h2>
            <p className="text-sm text-[var(--na-muted)] mt-1">{lesson.titlePt}</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="surface-sand p-3">
              <div className="text-xl font-extrabold text-[var(--na-burgundy)]">
                +{finished.xpGained}
              </div>
              <div className="text-[11px] text-[var(--na-muted)]">XP ganho</div>
            </div>
            <div className="surface-sand p-3">
              <div className="text-xl font-extrabold text-[var(--na-success)]">
                {finished.accuracy}%
              </div>
              <div className="text-[11px] text-[var(--na-muted)]">Precisão</div>
            </div>
            <div className="surface-sand p-3">
              <div className="text-xl font-extrabold text-[var(--na-teal)]">
                {finished.streakDays}d
              </div>
              <div className="text-[11px] text-[var(--na-muted)]">Ofensiva</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="btn-tactile-primary w-full text-base flex items-center justify-center gap-2"
          >
            Voltar para a trilha
            <ArrowRight size={18} weight="bold" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (!exercise) return null;

  return (
    <div className="max-w-2xl mx-auto flex flex-col min-h-[82dvh] justify-between pb-6">
      {/* Top progress header */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={onExit}
            aria-label="Sair da lição"
            className="w-11 h-11 rounded-[12px] border border-[var(--na-border)] bg-[var(--na-ivory)] flex items-center justify-center text-[var(--na-ink)] shrink-0"
          >
            <X size={20} weight="bold" />
          </button>
          <div className="flex-1 h-3 rounded-full bg-[var(--na-sand-dark)] overflow-hidden">
            <div
              className="h-full bg-[var(--na-burgundy)] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(8, progressPct)}%` }}
            />
          </div>
          <span className="font-mono-code text-xs font-bold text-[var(--na-muted)] shrink-0">
            {index + 1}/{lesson.exercises.length}
          </span>
        </div>

        {/* Exercise type pill + Asian script toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
              exercise.type === 'trap_buster'
                ? 'bg-[var(--na-error-soft)] text-[var(--na-error)]'
                : 'bg-[var(--na-sand)] text-[var(--na-burgundy)]'
            }`}
          >
            {exercise.type === 'trap_buster' && 'Armadilha para Brasileiros'}
            {exercise.type === 'context_choice' && 'Situação Real'}
            {exercise.type === 'listen_build' && 'Escuta & Construção'}
            {exercise.type === 'speak_pronounce' && 'Treino de Voz & Pronúncia'}
            {exercise.type === 'dialogue_complete' && 'Diálogo Vivo'}
            {exercise.type === 'script_lab' && 'Laboratório de Escrita & Tons'}
          </span>

          {langMeta.script.hasNativeScript && (
            <button
              type="button"
              onClick={() => setShowRomanization((v) => !v)}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--na-ivory)] border border-[var(--na-border)] text-[var(--na-teal)] inline-flex items-center gap-1.5"
            >
              {showRomanization ? <Eye size={14} /> : <EyeSlash size={14} />}
              {langMeta.script.romanizationLabel}: {showRomanization ? 'Ligado' : 'Oculto'}
            </button>
          )}
        </div>

        {/* Prompt card */}
        <div className="surface-card p-5 sm:p-6 space-y-4">
          {exercise.contextSituationPt && (
            <div className="text-xs font-semibold text-[var(--na-teal)]">
              Contexto: {exercise.contextSituationPt}
            </div>
          )}

          <h2 className="text-lg sm:text-xl font-bold text-[var(--na-ink)] leading-snug">
            {exercise.promptPt}
          </h2>

          {/* Audio controls for listening / speaking / script */}
          {(exercise.type === 'listen_build' ||
            exercise.type === 'speak_pronounce' ||
            exercise.type === 'script_lab') && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  speakText(exercise.targetText, language, 1.0);
                }}
                className="min-h-[46px] px-4 rounded-[12px] bg-[var(--na-teal)] text-white font-bold text-sm inline-flex items-center gap-2"
              >
                <SpeakerHigh size={18} weight="fill" />
                Ouvir nativo
              </button>
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  speakText(exercise.targetText, language, 0.72);
                }}
                className="min-h-[46px] px-4 rounded-[12px] bg-[var(--na-sand)] text-[var(--na-ink)] font-semibold text-sm"
              >
                Devagar (0.75x)
              </button>
            </div>
          )}

          {/* Dialogue view */}
          {exercise.type === 'dialogue_complete' && exercise.dialogueLines && (
            <div className="space-y-2.5 pt-1">
              {exercise.dialogueLines.map((line, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-[14px] border ${
                    line.isBlank
                      ? 'bg-[var(--na-sand)]/70 border-dashed border-[var(--na-burgundy)]'
                      : 'bg-[var(--na-cream)] border-[var(--na-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--na-muted)] mb-1">
                    <span>{line.speaker}</span>
                    {!line.isBlank && (
                      <button
                        type="button"
                        onClick={() => speakText(line.text, language, 0.95)}
                        className="text-[var(--na-teal)] inline-flex items-center gap-1"
                      >
                        <SpeakerHigh size={14} weight="fill" /> Ouvir
                      </button>
                    )}
                  </div>
                  <div className="text-base font-bold text-[var(--na-ink)]">
                    {line.isBlank ? 'Escolha a resposta mais natural abaixo...' : line.text}
                  </div>
                  <div className="text-xs text-[var(--na-muted)] mt-0.5">{line.translationPt}</div>
                </div>
              ))}
            </div>
          )}

          {/* Multiple choice options */}
          {exercise.options && (
            <div className="space-y-2.5 pt-2">
              {exercise.options.map((opt) => {
                const chosen = selectedOption === opt.id;
                const isRight = checked && opt.id === exercise.correctOptionId;
                const isWrongChosen = checked && chosen && !isRight;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(checked)}
                    onClick={() => {
                      void hapticTap();
                      setSelectedOption(opt.id);
                    }}
                    className={`w-full min-h-[54px] px-4 py-3 rounded-[14px] border text-left transition-all flex items-center justify-between gap-3 ${
                      isRight
                        ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success)] font-bold'
                        : isWrongChosen
                          ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error)]'
                          : chosen
                            ? 'bg-[var(--na-sand)] border-[var(--na-burgundy)] text-[var(--na-wine-deep)] font-bold'
                            : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                    }`}
                  >
                    <div>
                      <div className="text-[15px] leading-snug">{opt.text}</div>
                      {showRomanization && opt.reading && (
                        <div className="font-mono-code text-xs text-[var(--na-teal)] mt-0.5">
                          {opt.reading}
                        </div>
                      )}
                      {opt.translationPt && checked && (
                        <div className="text-xs opacity-80 mt-0.5">{opt.translationPt}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Listen & Build tactile tiles */}
          {exercise.type === 'listen_build' && (
            <div className="space-y-4 pt-2">
              <div className="min-h-[68px] p-3.5 rounded-[14px] bg-[var(--na-cream)] border-2 border-dashed border-[var(--na-border)] flex flex-wrap gap-2 items-center">
                {builtTokens.length === 0 ? (
                  <span className="text-sm text-[var(--na-muted)]">
                    Toque nas palavras abaixo na ordem correta...
                  </span>
                ) : (
                  builtTokens.map((tok, i) => (
                    <button
                      key={`${tok}-${i}`}
                      type="button"
                      disabled={Boolean(checked)}
                      onClick={() =>
                        setBuiltTokens((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="min-h-[40px] px-3.5 rounded-[10px] bg-[var(--na-wine)] text-[var(--na-ivory)] text-sm font-bold"
                    >
                      {tok}
                    </button>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {availableBank.map(({ token, idx, used }) => (
                  <button
                    key={`${token}-${idx}`}
                    type="button"
                    disabled={used || Boolean(checked)}
                    onClick={() => {
                      void hapticTap();
                      setBuiltTokens((prev) => [...prev, token]);
                    }}
                    className={`min-h-[44px] px-3.5 rounded-[12px] border text-sm font-semibold transition-all ${
                      used
                        ? 'opacity-30 bg-[var(--na-sand)] border-transparent'
                        : 'bg-[var(--na-ivory)] border-[var(--na-border)] border-b-2 text-[var(--na-ink)] hover:border-[var(--na-burgundy)]'
                    }`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Speak & Pronounce real microphone drill */}
          {exercise.type === 'speak_pronounce' && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-[14px] bg-[var(--na-sand)]/70 border border-[var(--na-border)] space-y-1">
                <div className="text-xl font-bold text-[var(--na-ink)]">{exercise.targetText}</div>
                {showRomanization && exercise.reading && (
                  <div className="font-mono-code text-sm text-[var(--na-teal)]">
                    {exercise.reading}
                  </div>
                )}
                {exercise.ipaOrPhoneticBr && (
                  <div className="font-mono-code text-xs text-[var(--na-burgundy)]">
                    Pronúncia BR: {exercise.ipaOrPhoneticBr}
                  </div>
                )}
                <div className="text-xs text-[var(--na-muted)]">{exercise.translationPt}</div>
              </div>

              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  type="button"
                  disabled={Boolean(checked)}
                  onClick={handleSpeakToggle}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isRecording
                      ? 'bg-[var(--na-error)] text-white scale-105 animate-pulse'
                      : 'bg-[var(--na-burgundy)] text-[var(--na-ivory)] hover:bg-[var(--na-wine)]'
                  }`}
                  aria-label={isRecording ? 'Parar gravação' : 'Falar agora'}
                >
                  {isRecording ? (
                    <StopCircle size={34} weight="fill" />
                  ) : (
                    <Microphone size={34} weight="fill" />
                  )}
                </button>
                <span className="text-xs font-semibold text-[var(--na-muted)]">
                  {isRecording
                    ? 'Ouvindo você falar... toque para parar'
                    : 'Toque no microfone e fale a frase acima'}
                </span>
              </div>

              {speechError && (
                <div className="text-xs text-[var(--na-error)] bg-[var(--na-error-soft)] p-3 rounded-[10px]">
                  {speechError}
                </div>
              )}

              {/* Accessible keyboard fallback for quiet rooms */}
              <div>
                <label
                  htmlFor="na-speech-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[var(--na-muted)] mb-1"
                >
                  Transcrição captada (ou digite se estiver em ambiente silencioso):
                </label>
                <input
                  id="na-speech-input"
                  type="text"
                  disabled={Boolean(checked)}
                  value={spokenText}
                  onChange={(e) => setSpokenText(e.target.value)}
                  placeholder="Sua fala aparecerá aqui..."
                  className="w-full min-h-[46px] px-3.5 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Thumb-Zone Action & Feedback Panel */}
      <div className="mt-6 space-y-3 safe-bottom">
        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-[16px] border space-y-2 ${
              checked.correct
                ? 'bg-[var(--na-success-soft)] border-[var(--na-success)]/40'
                : 'bg-[var(--na-error-soft)] border-[var(--na-error)]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                {checked.correct ? (
                  <CheckCircle size={20} weight="fill" className="text-[var(--na-success)]" />
                ) : (
                  <WarningCircle size={20} weight="fill" className="text-[var(--na-error)]" />
                )}
                <span
                  className={
                    checked.correct ? 'text-[var(--na-success)]' : 'text-[var(--na-error)]'
                  }
                >
                  {checked.messagePt}
                  {typeof checked.score === 'number' ? ` (${checked.score}%)` : ''}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAskAiExplain}
                className="text-xs font-bold text-[var(--na-teal)] inline-flex items-center gap-1 shrink-0"
              >
                <Sparkle size={14} weight="fill" />
                Explicar com IA
              </button>
            </div>

            <div className="text-xs text-[var(--na-ink)] leading-relaxed flex items-start gap-2">
              <Info size={16} className="text-[var(--na-burgundy)] shrink-0 mt-0.5" />
              <span>
                <strong>Dica NAidioma: </strong>
                {exercise.brazilianTipPt}
              </span>
            </div>

            {aiExplain && (
              <div className="p-3 rounded-[10px] bg-[var(--na-ivory)] border border-[var(--na-border)] text-xs text-[var(--na-ink)] space-y-1">
                {aiExplain.loading ? (
                  <span>Consultando explicação personalizada...</span>
                ) : (
                  <>
                    <div className="font-semibold text-[var(--na-teal)]">Coach IA:</div>
                    <div>{aiExplain.breakdownPt}</div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {!checked ? (
          <button
            type="button"
            disabled={!canCheck}
            onClick={handleCheck}
            className="btn-tactile-primary w-full text-base"
          >
            Verificar resposta
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="btn-tactile-primary w-full text-base flex items-center justify-center gap-2"
          >
            {index + 1 < lesson.exercises.length ? 'Próximo desafio' : 'Concluir lição'}
            <ArrowRight size={18} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
