import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle,
  Eye,
  EyeSlash,
  Fire,
  Heart,
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
import {
  playCorrectSound,
  playFootstepsSound,
  playPetSadSound,
  playTapSound,
  playVictoryFanfare,
} from '../lib/sound';
import { createSpeechRecognizer, isSpeechRecognitionSupported, speakText } from '../lib/speech';
import { ConfettiBurst } from './Mascots';
import { PetSprite, type PetMood, type PetProfile } from './PetBuddy';

interface LessonPlayerProps {
  language: LanguageCode;
  lesson: Lesson;
  pet: PetProfile;
  onPetHappinessChange: (delta: number) => void;
  onExit: () => void;
  onCompleted: (summary: {
    lessonId: string;
    xpGained: number;
    streakDays: number;
    xpTotal: number;
  }) => void;
}

const HAPPY_PRAISES = [
  'Eba!! Você acertou e deixou seu bichinho super feliz! 🎉',
  'Mandou muito bem! Olha como ele ficou alegre! ⭐',
  'Perfeito! Ele tá pulando de alegria! 🧩',
  'Show de bola! Mais um passo juntos! 🚀',
];

export function LessonPlayer({
  language,
  lesson,
  pet,
  onPetHappinessChange,
  onExit,
  onCompleted,
}: LessonPlayerProps) {
  const langMeta = LANGUAGES[language];
  const [index, setIndex] = useState(0);
  const [petStepIndex, setPetStepIndex] = useState(0);
  const [isWalkingNext, setIsWalkingNext] = useState(false);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [builtTokens, setBuiltTokens] = useState<string[]>([]);
  const [spokenText, setSpokenText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showRomanization, setShowRomanization] = useState(true);

  const [selectedLeftPairId, setSelectedLeftPairId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [wrongPairFlash, setWrongPairFlash] = useState<string | null>(null);
  const [pairMistakeFlash, setPairMistakeFlash] = useState(false);

  const [combo, setCombo] = useState(0);
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
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exercise: Exercise | undefined = lesson.exercises[index];
  const totalSteps = lesson.exercises.length;
  const petTrackPercent =
    totalSteps <= 1 ? 50 : Math.min(100, Math.round((petStepIndex / totalSteps) * 100));

  const shuffledRightPairs = useMemo(() => {
    if (!exercise?.pairs) return [];
    return [...exercise.pairs].sort((a, b) => {
      const ha = a.right.charCodeAt(0) * 13 + a.id.charCodeAt(a.id.length - 1);
      const hb = b.right.charCodeAt(0) * 13 + b.id.charCodeAt(b.id.length - 1);
      return (ha % 11) - (hb % 11);
    });
  }, [exercise]);

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!exercise || isWalkingNext) return undefined;
    if (
      exercise.type === 'listen_build' ||
      exercise.type === 'picture_choice' ||
      exercise.type === 'script_lab'
    ) {
      const timer = setTimeout(() => {
        speakText(exercise.targetText, language, 0.9);
      }, 260);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [exercise, language, isWalkingNext]);

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
    setSelectedLeftPairId(null);
    setMatchedPairIds([]);
    setWrongPairFlash(null);
    setPairMistakeFlash(false);
    setChecked(null);
    setAiExplain(null);
    recognizerRef.current?.stop();
    setIsRecording(false);
  }

  function handleSpeakToggle() {
    if (!exercise) return;
    void hapticTap();
    playTapSound();

    if (isRecording) {
      recognizerRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setSpeechError('Microfone indisponível neste navegador — você pode digitar ou tocar em "Pular fala".');
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
      setSpeechError('Reconhecimento de voz indisponível aqui. Digite abaixo ou pule este passo.');
      return;
    }

    recognizerRef.current = rec;
    setIsRecording(true);
    rec.start();
  }

  function handlePairRightTap(pairId: string) {
    if (!exercise?.pairs || !selectedLeftPairId || checked || matchedPairIds.includes(pairId)) {
      return;
    }
    if (selectedLeftPairId === pairId) {
      const nextMatched = [...matchedPairIds, pairId];
      setMatchedPairIds(nextMatched);
      setSelectedLeftPairId(null);
      setPairMistakeFlash(false);
      void hapticSuccess();
      playCorrectSound(nextMatched.length);

      if (nextMatched.length === exercise.pairs.length) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setCorrectCount((prev) => prev + 1);
        onPetHappinessChange(8);
        setChecked({
          correct: true,
          messagePt: HAPPY_PRAISES[index % HAPPY_PRAISES.length]!,
        });
      }
    } else {
      void hapticError();
      playPetSadSound();
      onPetHappinessChange(-5);
      setWrongPairFlash(pairId);
      setPairMistakeFlash(true);
      setTimeout(() => {
        setWrongPairFlash(null);
        setSelectedLeftPairId(null);
      }, 520);
      setTimeout(() => setPairMistakeFlash(false), 1200);
    }
  }

  function handleSkipSpeaking() {
    if (!exercise || checked) return;
    void hapticTap();
    playTapSound();
    recognizerRef.current?.stop();
    setIsRecording(false);
    setCorrectCount((prev) => prev + 1);
    onPetHappinessChange(4);
    setChecked({
      correct: true,
      messagePt: `Sem problema! ${pet.name} segue feliz com você para a próxima! 🧩`,
    });
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
      exercise.type === 'script_lab' ||
      exercise.type === 'picture_choice'
    ) {
      isCorrect = selectedOption === exercise.correctOptionId;
      messagePt = isCorrect
        ? HAPPY_PRAISES[index % HAPPY_PRAISES.length]!
        : `${pet.name} ficou tristinho... a resposta certa é "${exercise.targetText}". Vamos animar ele na próxima!`;
    } else if (exercise.type === 'listen_build') {
      const expected = (exercise.correctTokens ?? []).join(' ').trim().toLowerCase();
      const userAnswer = builtTokens.join(' ').trim().toLowerCase();
      isCorrect = expected === userAnswer;
      messagePt = isCorrect
        ? `Frase montada perfeitamente! ${pet.name} amou! 🧩`
        : `${pet.name} ficou tristinho... a ordem certa é "${exercise.targetText}".`;
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
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      void hapticSuccess();
      playCorrectSound(nextCombo);
      setCorrectCount((prev) => prev + 1);
      onPetHappinessChange(10);
    } else {
      setCombo(0);
      void hapticError();
      playPetSadSound();
      onPetHappinessChange(-12);
    }

    setChecked({ correct: isCorrect, messagePt, score });
  }

  async function handleNext() {
    if (isWalkingNext) return;
    void hapticTap();

    if (index + 1 < lesson.exercises.length) {
      // MOSTRA O BICHINHO ANDANDO COM AS PERNINHAS MEXENDO ATÉ A PRÓXIMA ATIVIDADE!
      setIsWalkingNext(true);
      setPetStepIndex(index + 1);
      playFootstepsSound(4);

      walkTimerRef.current = setTimeout(() => {
        setIndex((i) => i + 1);
        resetQuestionState();
        setIsWalkingNext(false);
      }, 760);
      return;
    }

    // Anda até o troféu final antes de abrir a tela de vitória!
    setIsWalkingNext(true);
    setPetStepIndex(totalSteps);
    playFootstepsSound(5);

    const total = lesson.exercises.length;
    const accuracy = Math.round((correctCount / total) * 100);
    const durationSeconds = Math.max(15, Math.round((Date.now() - startedAtRef.current) / 1000));

    walkTimerRef.current = setTimeout(async () => {
      setIsWalkingNext(false);
      try {
        const res = await api.completeLesson(lesson.id, accuracy, durationSeconds);
        void hapticSuccess();
        playVictoryFanfare();
        onPetHappinessChange(15);
        setFinished({ accuracy, xpGained: res.xpGained, streakDays: res.streakDays });
        onCompleted({ ...res, lessonId: lesson.id });
      } catch {
        playVictoryFanfare();
        onPetHappinessChange(15);
        setFinished({ accuracy, xpGained: lesson.xpReward, streakDays: 1 });
        onCompleted({
          lessonId: lesson.id,
          xpGained: lesson.xpReward,
          streakDays: 1,
          xpTotal: lesson.xpReward,
        });
      }
    }, 760);
  }

  async function handleAskAiExplain() {
    if (!exercise) return;
    playTapSound();
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
      !isWalkingNext &&
      exercise.type !== 'match_pairs' &&
      ((exercise.type === 'listen_build' && builtTokens.length > 0) ||
        (exercise.type === 'speak_pronounce' && spokenText.trim().length > 0) ||
        selectedOption !== null),
  );

  // TELA DE VITÓRIA ÉPICA COM O SEU BICHINHO DANÇANDO!
  if (finished) {
    return (
      <div className="min-h-[82dvh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="duo-card max-w-md w-full p-7 text-center space-y-6 relative overflow-visible"
        >
          <ConfettiBurst active />
          <div className="flex justify-center">
            <PetSprite species={pet.species} mood="celebrate" size={162} />
          </div>

          <div>
            <div className="inline-block px-3.5 py-1 rounded-full bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-xs font-extrabold uppercase tracking-wider text-[#7a5200]">
              {pet.name} está radiante! 🏆
            </div>
            <h2 className="font-display text-3xl sm:text-4xl text-[var(--na-ink)] mt-2">
              Peça Encaixada! 🧩
            </h2>
            <p className="text-sm font-bold text-[var(--na-muted)] mt-1">
              Agora veja {pet.name} andando até a próxima atividade na trilha! 🐾
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)]">
              <div className="text-xs font-extrabold uppercase text-[#8a6010]">Peças 🧩</div>
              <div className="text-2xl font-extrabold text-[#7a5200] mt-0.5">
                +{finished.xpGained}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--na-success-soft)] border-2 border-[var(--na-success)]">
              <div className="text-xs font-extrabold uppercase text-[var(--na-success-dark)]">
                Acertos
              </div>
              <div className="text-2xl font-extrabold text-[var(--na-success-dark)] mt-0.5">
                {finished.accuracy}%
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--na-flame-soft)] border-2 border-[var(--na-flame)]">
              <div className="text-xs font-extrabold uppercase text-[var(--na-flame-dark)]">
                Alegria
              </div>
              <div className="text-2xl font-extrabold text-[var(--na-flame)] mt-0.5">
                💖 {pet.happiness}%
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playTapSound();
              onExit();
            }}
            className="duo-btn-emerald w-full text-base uppercase tracking-wide flex items-center justify-center gap-2"
          >
            ANDAR PARA A PRÓXIMA ATIVIDADE
            <ArrowRight size={20} weight="bold" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (!exercise) return null;

  // Humor ao vivo do bichinho conforme acerta, erra ou anda!
  const currentPetMood: PetMood = isWalkingNext
    ? 'walking'
    : pairMistakeFlash
      ? 'sad'
      : checked
        ? checked.correct
          ? combo >= 2
            ? 'super_happy'
            : 'happy'
          : 'sad'
        : pet.happiness < 45
          ? 'sad'
          : 'idle';

  const petMoodCaption = isWalkingNext
    ? `${pet.name} andando para o próximo desafio... 🐾`
    : currentPetMood === 'super_happy'
      ? `${pet.name} está SUPER FELIZ! 💖✨`
      : currentPetMood === 'happy'
        ? `${pet.name} ficou muito feliz! 😊`
        : currentPetMood === 'sad'
          ? `${pet.name} ficou tristinho 🥺 — acerta a próxima!`
          : `${pet.name} torcendo por você!`;

  const badgeText: Record<Exercise['type'], string> = {
    picture_choice: 'Escolha a Figura 🖼️',
    match_pairs: 'Ligue os Pares 🧩',
    listen_build: 'Monte a Frase 🎧',
    speak_pronounce: 'Hora de Falar 🎙️',
    script_lab: 'Leitura & Letras 🔤',
    context_choice: 'Qual é a certa? ⭐',
    dialogue_complete: 'Complete a Conversa 💬',
    trap_buster: 'Pegadinha BR ⚡',
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col min-h-[88dvh] justify-between pb-4">
      <div>
        {/* TOPO COM TRILHA DE PEDRINHAS + BICHINHO ANDANDO DE VERDADE A CADA PASSO! */}
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onExit();
            }}
            aria-label="Sair da atividade"
            className="w-11 h-11 rounded-2xl border-2 border-[var(--na-border)] border-b-4 bg-white flex items-center justify-center text-[var(--na-muted)] hover:text-[var(--na-ink)] shrink-0"
          >
            <X size={20} weight="bold" />
          </button>

          {/* Caminho animado das etapas da lição com o bichinho caminhando em cima! */}
          <div className="flex-1 pt-9 pb-1 relative">
            {/* Bichinho caminhando horizontalmente de pedrinha em pedrinha */}
            <motion.div
              className="absolute top-0 -translate-x-1/2 z-20 pointer-events-none"
              initial={false}
              animate={{ left: `${petTrackPercent}%` }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            >
              <PetSprite species={pet.species} mood={currentPetMood} size={46} />
            </motion.div>

            {/* Barra de chão + bolinhas de passo */}
            <div className="relative h-4 rounded-full bg-[var(--na-sand-dark)] flex items-center">
              <motion.div
                className="h-full bg-[var(--na-success)] rounded-full"
                initial={false}
                animate={{ width: `${Math.max(8, petTrackPercent)}%` }}
                transition={{ duration: 0.65, ease: 'easeInOut' }}
              />
              {/* Pedrinhas de cada exercício */}
              {Array.from({ length: totalSteps + 1 }).map((_, stepIdx) => {
                const pos = totalSteps === 0 ? 0 : (stepIdx / totalSteps) * 100;
                const reached = stepIdx <= petStepIndex;
                const isTrophy = stepIdx === totalSteps;
                return (
                  <span
                    key={stepIdx}
                    style={{ left: `${pos}%` }}
                    className={`absolute -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-extrabold ${
                      reached
                        ? 'bg-[var(--na-gold)] border-[var(--na-gold-dark)] text-[#4a2e00]'
                        : 'bg-white border-[var(--na-border)] text-[var(--na-muted)]'
                    }`}
                  >
                    {isTrophy ? <Trophy size={10} weight="fill" /> : stepIdx + 1}
                  </span>
                );
              })}
            </div>
          </div>

          {combo >= 2 ? (
            <span className="px-2.5 py-1 rounded-full bg-[var(--na-flame-soft)] border-2 border-[var(--na-flame)] text-xs font-extrabold text-[var(--na-flame)] inline-flex items-center gap-1 shrink-0">
              <Fire size={14} weight="fill" /> {combo}x
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-[var(--na-rose-soft)] text-xs font-extrabold text-[var(--na-burgundy)] inline-flex items-center gap-1 shrink-0">
              <Heart size={15} weight="fill" /> ∞
            </span>
          )}
        </div>

        {/* Etiqueta do desafio + Humor ao vivo do bichinho + Toggle Romanização */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[var(--na-teal-soft)] text-[var(--na-teal-dark)]">
              {badgeText[exercise.type]}
            </span>
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                currentPetMood === 'sad'
                  ? 'bg-[var(--na-error-soft)] text-[var(--na-error)]'
                  : currentPetMood === 'walking'
                    ? 'bg-[var(--na-gold-soft)] text-[#7a5200]'
                    : 'bg-[var(--na-success-soft)] text-[var(--na-success-dark)]'
              }`}
            >
              {petMoodCaption}
            </span>
          </div>

          {langMeta.script.hasNativeScript && (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setShowRomanization((v) => !v);
              }}
              className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-white border-2 border-[var(--na-border)] text-[var(--na-teal-dark)] inline-flex items-center gap-1.5"
            >
              {showRomanization ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}
              {langMeta.script.romanizationLabel}: {showRomanization ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* SEU BICHINHO + BALÃO DE PERGUNTA (Reage feliz, triste ou andando!) */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative shrink-0">
            <ConfettiBurst active={Boolean(checked?.correct)} />
            <PetSprite species={pet.species} mood={currentPetMood} size={94} />
          </div>
          <div className="flex-1 p-4 rounded-2xl bg-white border-2 border-[var(--na-border)] border-b-4 space-y-2.5">
            <h2 className="text-base sm:text-lg font-extrabold text-[var(--na-ink)] leading-snug">
              {isWalkingNext
                ? `${pet.name} está caminhando para a próxima atividade... 🐾`
                : exercise.promptPt}
            </h2>

            {!isWalkingNext && exercise.type !== 'match_pairs' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    speakText(exercise.targetText, language, 0.95);
                  }}
                  className="min-h-[42px] px-3.5 rounded-xl bg-[var(--na-teal)] text-white border-2 border-[var(--na-teal-dark)] border-b-4 text-xs font-extrabold inline-flex items-center gap-1.5 active:translate-y-[2px]"
                >
                  <SpeakerHigh size={17} weight="fill" />
                  Ouvir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    speakText(exercise.targetText, language, 0.65);
                  }}
                  className="min-h-[42px] px-3 rounded-xl bg-[var(--na-cream)] text-[var(--na-ink)] border-2 border-[var(--na-border)] border-b-4 text-xs font-extrabold inline-flex items-center gap-1 active:translate-y-[2px]"
                >
                  🐢 Devagar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENA DE TRANSIÇÃO COM O BICHINHO ANDANDO NA ESTRADINHA! */}
        {isWalkingNext ? (
          <div className="duo-card p-8 flex flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-white to-[var(--na-cream)]">
            <div className="relative w-full h-28 flex items-center overflow-hidden">
              <div className="absolute left-4 right-4 bottom-4 h-3 rounded-full bg-[var(--na-sand-dark)] border border-[var(--na-border)]" />
              <motion.div
                initial={{ x: '8%' }}
                animate={{ x: '72%' }}
                transition={{ duration: 0.72, ease: 'easeInOut' }}
                className="relative z-10"
              >
                <PetSprite species={pet.species} mood="walking" size={108} />
              </motion.div>
            </div>
            <div className="text-sm font-extrabold text-[var(--na-burgundy)]">
              🐾 {pet.name} indo para o desafio {Math.min(index + 2, totalSteps)} de {totalSteps}!
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. PICTURE CHOICE (Grade 2x2 de cartões grandes com figura e som) */}
            {exercise.type === 'picture_choice' && exercise.options && (
              <div className="grid grid-cols-2 gap-3">
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
                        playTapSound();
                        setSelectedOption(opt.id);
                        speakText(opt.text, language, 0.9);
                      }}
                      className={`p-4 rounded-3xl border-2 border-b-[6px] flex flex-col items-center justify-center gap-1.5 text-center transition-all active:translate-y-[2px] min-h-[148px] ${
                        isRight
                          ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                          : isWrongChosen
                            ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error)]'
                            : chosen
                              ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                              : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                      }`}
                    >
                      {opt.emoji && (
                        <span className="text-5xl leading-none mb-1" role="img" aria-hidden="true">
                          {opt.emoji}
                        </span>
                      )}
                      <div className="text-xl font-extrabold leading-tight">{opt.text}</div>
                      {showRomanization && opt.reading && (
                        <div className="font-mono-code text-xs font-bold text-[var(--na-teal-dark)]">
                          {opt.reading}
                        </div>
                      )}
                      {checked && opt.translationPt && (
                        <div className="text-xs font-bold opacity-80">{opt.translationPt}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. MATCH PAIRS */}
            {exercise.type === 'match_pairs' && exercise.pairs && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2.5">
                  {exercise.pairs.map((p) => {
                    const matched = matchedPairIds.includes(p.id);
                    const selected = selectedLeftPairId === p.id;
                    return (
                      <button
                        key={`l-${p.id}`}
                        type="button"
                        disabled={matched}
                        onClick={() => {
                          void hapticTap();
                          playTapSound();
                          setSelectedLeftPairId(p.id);
                          speakText(p.left, language, 0.9);
                        }}
                        className={`w-full min-h-[68px] px-3 py-2.5 rounded-2xl border-2 border-b-[5px] text-center transition-all active:translate-y-[2px] ${
                          matched
                            ? 'bg-[var(--na-success-soft)] border-[var(--na-success)]/40 text-[var(--na-success-dark)] opacity-55'
                            : selected
                              ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)] scale-[1.02]'
                              : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-teal)]'
                        }`}
                      >
                        <div className="text-lg font-extrabold leading-tight">{p.left}</div>
                        {showRomanization && p.leftReading && (
                          <div className="font-mono-code text-[11px] font-bold text-[var(--na-teal)] mt-0.5">
                            {p.leftReading}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  {shuffledRightPairs.map((p) => {
                    const matched = matchedPairIds.includes(p.id);
                    const flashingWrong = wrongPairFlash === p.id;
                    return (
                      <button
                        key={`r-${p.id}`}
                        type="button"
                        disabled={matched || !selectedLeftPairId}
                        onClick={() => handlePairRightTap(p.id)}
                        className={`w-full min-h-[68px] px-3 py-2.5 rounded-2xl border-2 border-b-[5px] text-center transition-all active:translate-y-[2px] flex items-center justify-center gap-2 ${
                          matched
                            ? 'bg-[var(--na-success-soft)] border-[var(--na-success)]/40 text-[var(--na-success-dark)] opacity-55'
                            : flashingWrong
                              ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error)]'
                              : selectedLeftPairId
                                ? 'bg-white border-[var(--na-gold)] text-[var(--na-ink)] hover:bg-[var(--na-gold-soft)]'
                                : 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
                        }`}
                      >
                        {p.emoji && <span className="text-xl">{p.emoji}</span>}
                        <span className="text-sm sm:text-base font-extrabold leading-tight">
                          {p.right}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. DIÁLOGO */}
            {exercise.type === 'dialogue_complete' && exercise.dialogueLines && (
              <div className="space-y-2.5">
                {exercise.dialogueLines.map((line, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border-2 ${
                      line.isBlank
                        ? 'bg-[var(--na-gold-soft)]/70 border-dashed border-[var(--na-gold-dark)]'
                        : 'bg-white border-[var(--na-border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)] mb-1">
                      <span>{line.speaker}</span>
                      {!line.isBlank && (
                        <button
                          type="button"
                          onClick={() => speakText(line.text, language, 0.9)}
                          className="text-[var(--na-teal)] inline-flex items-center gap-1"
                        >
                          <SpeakerHigh size={15} weight="fill" /> Ouvir
                        </button>
                      )}
                    </div>
                    <div className="text-base font-extrabold text-[var(--na-ink)]">
                      {line.isBlank ? 'Escolha a resposta abaixo 👇' : line.text}
                    </div>
                    {line.reading && showRomanization && (
                      <div className="font-mono-code text-xs font-bold text-[var(--na-teal)] mt-0.5">
                        {line.reading}
                      </div>
                    )}
                    <div className="text-xs font-semibold text-[var(--na-muted)] mt-0.5">
                      {line.translationPt}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. MÚLTIPLA ESCOLHA 3D */}
            {exercise.options && exercise.type !== 'picture_choice' && (
              <div className="space-y-2.5">
                {exercise.options.map((opt, optIdx) => {
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
                        playTapSound();
                        setSelectedOption(opt.id);
                        speakText(opt.text, language, 0.92);
                      }}
                      className={`w-full min-h-[62px] px-4 py-3 rounded-2xl border-2 border-b-[5px] text-left transition-all flex items-center gap-3 active:translate-y-[2px] ${
                        isRight
                          ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                          : isWrongChosen
                            ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error)]'
                            : chosen
                              ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                              : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-xs font-extrabold flex items-center justify-center shrink-0">
                        {optIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-extrabold leading-snug">{opt.text}</div>
                        {showRomanization && opt.reading && (
                          <div className="font-mono-code text-xs font-bold text-[var(--na-teal)] mt-0.5">
                            {opt.reading}
                          </div>
                        )}
                        {opt.translationPt && checked && (
                          <div className="text-xs font-bold opacity-80 mt-0.5">{opt.translationPt}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 5. LISTEN & BUILD */}
            {exercise.type === 'listen_build' && (
              <div className="space-y-4">
                <div className="min-h-[78px] p-4 rounded-2xl bg-white border-2 border-dashed border-[var(--na-teal)]/50 flex flex-wrap gap-2 items-center">
                  {builtTokens.length === 0 ? (
                    <span className="text-sm font-bold text-[var(--na-muted)]">
                      Toque nas pecinhas abaixo na ordem certa... 🧩
                    </span>
                  ) : (
                    builtTokens.map((tok, i) => (
                      <motion.button
                        key={`${tok}-${i}`}
                        initial={{ scale: 0.8, y: 6 }}
                        animate={{ scale: 1, y: 0 }}
                        type="button"
                        disabled={Boolean(checked)}
                        onClick={() => {
                          playTapSound();
                          setBuiltTokens((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                        className="min-h-[44px] px-4 rounded-2xl bg-[var(--na-burgundy)] text-white border-2 border-[var(--na-wine-deep)] border-b-4 text-base font-extrabold"
                      >
                        {tok}
                      </motion.button>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 justify-center">
                  {availableBank.map(({ token, idx, used }) => (
                    <button
                      key={`${token}-${idx}`}
                      type="button"
                      disabled={used || Boolean(checked)}
                      onClick={() => {
                        void hapticTap();
                        playTapSound();
                        speakText(token, language, 0.92);
                        setBuiltTokens((prev) => [...prev, token]);
                      }}
                      className={`min-h-[48px] px-4 rounded-2xl border-2 border-b-4 text-base font-extrabold transition-all active:translate-y-[2px] ${
                        used
                          ? 'opacity-25 bg-[var(--na-sand)] border-transparent text-transparent'
                          : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-teal)]'
                      }`}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. SPEAK & PRONOUNCE */}
            {exercise.type === 'speak_pronounce' && (
              <div className="duo-card p-5 space-y-4">
                <div className="p-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-center space-y-1">
                  <div className="text-2xl font-extrabold text-[var(--na-ink)]">
                    {exercise.targetText}
                  </div>
                  {showRomanization && exercise.reading && (
                    <div className="font-mono-code text-sm font-bold text-[var(--na-teal)]">
                      {exercise.reading}
                    </div>
                  )}
                  {exercise.ipaOrPhoneticBr && (
                    <div className="text-xs font-extrabold text-[var(--na-burgundy)]">
                      Como ler: {exercise.ipaOrPhoneticBr}
                    </div>
                  )}
                  <div className="text-xs font-bold text-[var(--na-muted)]">
                    "{exercise.translationPt}"
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    disabled={Boolean(checked)}
                    onClick={handleSpeakToggle}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all border-4 border-b-[8px] active:translate-y-[3px] ${
                      isRecording
                        ? 'bg-[var(--na-error)] border-[var(--na-error-dark)] text-white scale-105 animate-pulse'
                        : 'bg-[var(--na-teal)] border-[var(--na-teal-dark)] text-white'
                    }`}
                    aria-label={isRecording ? 'Parar gravação' : 'Falar agora'}
                  >
                    {isRecording ? (
                      <StopCircle size={40} weight="fill" />
                    ) : (
                      <Microphone size={40} weight="fill" />
                    )}
                  </button>
                  <span className="text-xs font-extrabold text-[var(--na-muted)]">
                    {isRecording
                      ? 'Ouvindo você falar... toque para parar'
                      : 'Toque no microfone e fale a frase!'}
                  </span>
                </div>

                {speechError && (
                  <div className="text-xs font-bold text-[var(--na-error)] bg-[var(--na-error-soft)] p-3 rounded-xl">
                    {speechError}
                  </div>
                )}

                <div>
                  <input
                    id="na-speech-input"
                    type="text"
                    disabled={Boolean(checked)}
                    value={spokenText}
                    onChange={(e) => setSpokenText(e.target.value)}
                    placeholder="Ou digite a frase aqui se preferir..."
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-sm font-semibold"
                  />
                </div>

                {!checked && (
                  <button
                    type="button"
                    onClick={handleSkipSpeaking}
                    className="w-full py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)] hover:text-[var(--na-teal)]"
                  >
                    Não posso falar agora (pular sem deixar {pet.name} triste)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RODAPÉ DESLIZANTE DE FEEDBACK */}
      <div className="mt-6 space-y-3 safe-bottom">
        {checked && !isWalkingNext && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-3xl border-2 space-y-2.5 ${
              checked.correct
                ? 'bg-[var(--na-success-soft)] border-[var(--na-success)]'
                : 'bg-[var(--na-error-soft)] border-[var(--na-error)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-extrabold text-base">
                {checked.correct ? (
                  <CheckCircle size={24} weight="fill" className="text-[var(--na-success)] shrink-0" />
                ) : (
                  <WarningCircle size={24} weight="fill" className="text-[var(--na-error)] shrink-0" />
                )}
                <span
                  className={
                    checked.correct ? 'text-[var(--na-success-dark)]' : 'text-[var(--na-error-dark)]'
                  }
                >
                  {checked.messagePt}
                  {typeof checked.score === 'number' ? ` (${checked.score}%)` : ''}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleAskAiExplain()}
                className="text-xs font-extrabold text-[var(--na-teal-dark)] bg-white px-2.5 py-1 rounded-full border border-[var(--na-teal)]/40 inline-flex items-center gap-1 shrink-0"
              >
                <Sparkle size={14} weight="fill" />
                Explicar IA
              </button>
            </div>

            <div className="text-xs font-bold text-[var(--na-ink)] leading-relaxed">
              💡 {exercise.brazilianTipPt}
            </div>

            {aiExplain && (
              <div className="p-3 rounded-2xl bg-white border-2 border-[var(--na-border)] text-xs font-semibold text-[var(--na-ink)] space-y-1">
                {aiExplain.loading ? (
                  <span>Consultando explicação da IA...</span>
                ) : (
                  <>
                    <div className="font-extrabold text-[var(--na-teal-dark)]">Coach IA:</div>
                    <div>{aiExplain.breakdownPt}</div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {!checked ? (
          exercise.type !== 'match_pairs' ? (
            <button
              type="button"
              disabled={!canCheck}
              onClick={handleCheck}
              className="duo-btn-emerald w-full text-base uppercase tracking-wide"
            >
              VERIFICAR
            </button>
          ) : (
            <div className="text-center text-xs font-extrabold text-[var(--na-muted)] py-2">
              Toque em uma palavra da esquerda e depois no par certo da direita! ({matchedPairIds.length}/
              {exercise.pairs?.length ?? 0})
            </div>
          )
        ) : (
          <button
            type="button"
            disabled={isWalkingNext}
            onClick={() => void handleNext()}
            className={`${
              checked.correct ? 'duo-btn-emerald' : 'duo-btn-coral'
            } w-full text-base uppercase tracking-wide flex items-center justify-center gap-2`}
          >
            {isWalkingNext
              ? `🐾 ${pet.name} andando...`
              : index + 1 < lesson.exercises.length
                ? 'CONTINUAR 🐾'
                : 'VER MINHA VITÓRIA! 🏆'}
            {!isWalkingNext && <ArrowRight size={20} weight="bold" />}
          </button>
        )}
      </div>
    </div>
  );
}
