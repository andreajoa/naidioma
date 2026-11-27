import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowCounterClockwise,
  ArrowRight,
  BookOpenText,
  CheckCircle,
  Eye,
  EyeSlash,
  Fire,
  GraduationCap,
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
  diffTokenSequences,
  evaluatePronunciation,
  type Exercise,
  type LanguageCode,
  type Lesson,
  type PronunciationEvaluation,
  type SequenceDiffItem,
  type Unit,
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
import {
  createAudioRecorder,
  createSpeechRecognizer,
  isAudioRecorderSupported,
  isSpeechRecognitionSupported,
  speakSingleWord,
  speakText,
  type AudioRecorderHandle,
  type SpeechRecognizerHandle,
} from '../lib/speech';
import { ConfettiBurst } from './Mascots';
import { PetSprite, type PetMood, type PetProfile } from './PetBuddy';

interface LessonPlayerProps {
  language: LanguageCode;
  lesson: Lesson;
  unit?: Unit;
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

interface BuildTokenDiff {
  token: string;
  ok: boolean;
}

interface CheckedResult {
  correct: boolean;
  messagePt: string;
  score?: number;
  kind: 'choice' | 'build' | 'speak' | 'pairs';
  chosenLabel?: string;
  chosenTranslationPt?: string;
  expectedLabel?: string;
  choiceDiff?: SequenceDiffItem[];
  buildUserDiff?: BuildTokenDiff[];
  buildSequenceDiff?: SequenceDiffItem[];
  buildExpectedTokens?: string[];
  buildMissing?: string[];
  buildExtra?: string[];
  pronunciation?: PronunciationEvaluation;
  usedCloudWhisper?: boolean;
}

interface MissedExamItem {
  exerciseId: string;
  promptPt: string;
  userAnswer: string;
  correctAnswer: string;
  tipPt: string;
}

const HAPPY_PRAISES = [
  'Eba!! Você acertou e deixou seu bichinho super feliz! 🎉',
  'Mandou muito bem! Olha como ele ficou alegre! ⭐',
  'Perfeito! Ele tá pulando de alegria! 🧩',
  'Show de bola! Mais um passo juntos! 🚀',
];

function normToken(t: string): string {
  return t
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,!?;:"()¿¡]/g, '')
    .trim();
}

export function LessonPlayer({
  language,
  lesson,
  unit,
  pet,
  onPetHappinessChange,
  onExit,
  onCompleted,
}: LessonPlayerProps) {
  const langMeta = LANGUAGES[language];
  const isExam = Boolean(lesson.isLevelExam);
  const passingAccuracy = lesson.passingAccuracy ?? 80;
  const [showGrammarSheet, setShowGrammarSheet] = useState(false);

  const [index, setIndex] = useState(0);
  const [petStepIndex, setPetStepIndex] = useState(0);
  const [isWalkingNext, setIsWalkingNext] = useState(false);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [builtTokens, setBuiltTokens] = useState<string[]>([]);
  const [spokenText, setSpokenText] = useState('');
  const [spokenAlternatives, setSpokenAlternatives] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'reconnecting' | 'draining' | 'whisper'>('idle');
  const [micVolume, setMicVolume] = useState(0);
  const [cloudSttReady, setCloudSttReady] = useState(true);
  const [usedCloudWhisper, setUsedCloudWhisper] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showRomanization, setShowRomanization] = useState(true);

  const [selectedLeftPairId, setSelectedLeftPairId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [wrongPairFlash, setWrongPairFlash] = useState<string | null>(null);
  const [pairMistakeFlash, setPairMistakeFlash] = useState(false);
  const [lastPairWrongDetail, setLastPairWrongDetail] = useState<{
    left: string;
    wrongRight: string;
  } | null>(null);

  const [combo, setCombo] = useState(0);
  const [checked, setChecked] = useState<CheckedResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missedItems, setMissedItems] = useState<MissedExamItem[]>([]);
  const [aiExplain, setAiExplain] = useState<null | {
    loading: boolean;
    breakdownPt?: string;
    brazilianPitfallPt?: string;
  }>(null);
  const [finished, setFinished] = useState<null | {
    accuracy: number;
    xpGained: number;
    streakDays: number;
    passedExam: boolean;
  }>(null);

  const startedAtRef = useRef(Date.now());
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
  const audioRecorderRef = useRef<AudioRecorderHandle | null>(null);
  const latestSpokenRef = useRef<{ text: string; alternatives: string[] }>({ text: '', alternatives: [] });
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void api.getAiStatus().then((st) => setCloudSttReady(st.sttAvailable));
  }, []);

  useEffect(() => {
    if (checked && !isWalkingNext) {
      setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  }, [checked, isWalkingNext]);

  const exercise: Exercise | undefined = lesson.exercises[index];
  const totalSteps = lesson.exercises.length;
  const petTrackPercent =
    totalSteps <= 1 ? 50 : Math.min(100, Math.round((petStepIndex / totalSteps) * 100));

  // Avaliação AO VIVO palavra por palavra enquanto o usuário fala no microfone!
  const liveSpeechEval = useMemo<PronunciationEvaluation | null>(() => {
    if (!exercise || exercise.type !== 'speak_pronounce') return null;
    if (!spokenText.trim() && spokenAlternatives.length === 0) return null;
    return evaluatePronunciation(
      spokenText,
      exercise.targetText,
      language,
      exercise.acceptedSpeechVariants ?? [],
      spokenAlternatives,
    );
  }, [exercise, language, spokenText, spokenAlternatives]);

  const targetDisplayWords = useMemo(() => {
    if (!exercise || exercise.type !== 'speak_pronounce') return [];
    const isCjk = language === 'ja' || language === 'zh' || language === 'ko';
    if (isCjk) {
      return Array.from(exercise.targetText.replace(/[.,!?;:"()¿¡。、！？\s]/g, ''));
    }
    return exercise.targetText
      .replace(/[.,!?;:"()¿¡]/g, '')
      .split(/\s+/)
      .filter(Boolean);
  }, [exercise, language]);

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
      recognizerRef.current?.abort();
      audioRecorderRef.current?.abort();
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
    setSpokenAlternatives([]);
    latestSpokenRef.current = { text: '', alternatives: [] };
    setSpeechError(null);
    setMicState('idle');
    setMicVolume(0);
    setUsedCloudWhisper(false);
    setSelectedLeftPairId(null);
    setMatchedPairIds([]);
    setWrongPairFlash(null);
    setPairMistakeFlash(false);
    setLastPairWrongDetail(null);
    setChecked(null);
    setAiExplain(null);
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    audioRecorderRef.current?.abort();
    audioRecorderRef.current = null;
    setIsRecording(false);
  }

  function handleRetrySpeaking() {
    if (!exercise || isExam) return;
    playTapSound();
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    audioRecorderRef.current?.abort();
    audioRecorderRef.current = null;
    setIsRecording(false);
    setMicState('idle');
    setMicVolume(0);
    setUsedCloudWhisper(false);
    setSpokenText('');
    setSpokenAlternatives([]);
    latestSpokenRef.current = { text: '', alternatives: [] };
    setSpeechError(null);
    // Remove registro anterior de erro desta mesma questão para não duplicar nem sujar o resumo!
    setMissedItems((prev) => prev.filter((item) => item.exerciseId !== exercise.id));
    setChecked(null);
  }

  async function stopAndFinalizeSpeech(): Promise<{
    text: string;
    alternatives: string[];
    whisperUsed: boolean;
  }> {
    setIsRecording(false);
    setMicVolume(0);
    setMicState('draining');

    const [speechRes, clip] = await Promise.all([
      recognizerRef.current
        ? recognizerRef.current.stop()
        : Promise.resolve(latestSpokenRef.current),
      audioRecorderRef.current ? audioRecorderRef.current.stop() : Promise.resolve(null),
    ]);
    recognizerRef.current = null;
    audioRecorderRef.current = null;

    let mergedText = speechRes.text.trim() || latestSpokenRef.current.text.trim();
    const altSet = new Set<string>([
      ...latestSpokenRef.current.alternatives,
      ...speechRes.alternatives,
    ]);
    if (mergedText) altSet.add(mergedText);

    let whisperUsed = false;

    // Verifica se o Web Speech perdeu alguma palavra (ou não captou nada):
    // se perdeu, usa Whisper IA 24/7 na nuvem no áudio contínuo gravado sem cortes!
    if (exercise && clip && cloudSttReady) {
      const preliminary = evaluatePronunciation(
        mergedText,
        exercise.targetText,
        language,
        exercise.acceptedSpeechVariants ?? [],
        Array.from(altSet),
      );
      if (!mergedText || preliminary.missingWords.length > 0 || preliminary.score < 95) {
        setMicState('whisper');
        const cloud = await api.transcribeAudio(language, clip.audioBase64, clip.mimeType);
        if (cloud.available && cloud.transcript.trim()) {
          whisperUsed = true;
          const whisperText = cloud.transcript.trim();
          altSet.add(whisperText);

          // Compara se o Whisper captou melhor que o Web Speech e usa o mais preciso como texto principal
          const withWhisper = evaluatePronunciation(
            whisperText,
            exercise.targetText,
            language,
            exercise.acceptedSpeechVariants ?? [],
            [whisperText],
          );
          if (!mergedText || withWhisper.score >= preliminary.score) {
            mergedText = whisperText;
          }
        }
      }
    }

    const finalAlts = Array.from(altSet).filter(Boolean);
    latestSpokenRef.current = { text: mergedText, alternatives: finalAlts };
    setSpokenText(mergedText);
    setSpokenAlternatives(finalAlts);
    setUsedCloudWhisper(whisperUsed);
    setMicState('idle');

    return { text: mergedText, alternatives: finalAlts, whisperUsed };
  }

  async function handleSpeakToggle() {
    if (!exercise) return;
    void hapticTap();
    playTapSound();

    if (isRecording) {
      await stopAndFinalizeSpeech();
      return;
    }

    const canWebSpeech = isSpeechRecognitionSupported();
    const canRecorder = isAudioRecorderSupported();

    if (!canWebSpeech && !canRecorder) {
      setSpeechError(
        'Microfone indisponível neste navegador — você pode digitar a frase no campo abaixo.',
      );
      return;
    }

    setSpeechError(null);
    setSpokenText('');
    setSpokenAlternatives([]);
    setUsedCloudWhisper(false);
    latestSpokenRef.current = { text: '', alternatives: [] };

    if (canWebSpeech) {
      const rec = createSpeechRecognizer(language, {
        hintText: exercise.targetText,
        onTranscript: (text, _isFinal, alternatives) => {
          const alts = alternatives && alternatives.length > 0 ? alternatives : text ? [text] : [];
          latestSpokenRef.current = { text, alternatives: alts };
          setSpokenText(text);
          if (alts.length > 0) setSpokenAlternatives(alts);
        },
        onStateChange: (state) => {
          if (state === 'listening') setMicState('listening');
          else if (state === 'reconnecting') setMicState('reconnecting');
          else if (state === 'draining') setMicState('draining');
          else setMicState('idle');
        },
        onError: (msg) => {
          // Se o MediaRecorder + Whisper está ativo, não trava o aluno por erro do Web Speech!
          if (!canRecorder || !cloudSttReady) {
            setSpeechError(msg);
          }
        },
        onEnd: () => {
          // Só encerra se o MediaRecorder também não estiver gravando
          if (!audioRecorderRef.current) {
            setIsRecording(false);
            setMicState('idle');
          }
        },
      });

      if (rec) {
        recognizerRef.current = rec;
        rec.start();
      }
    }

    if (canRecorder) {
      const recorder = createAudioRecorder({
        onVolume: (lvl) => setMicVolume(lvl),
      });
      if (recorder) {
        audioRecorderRef.current = recorder;
        const ok = await recorder.start();
        if (!ok && !recognizerRef.current) {
          audioRecorderRef.current = null;
          setSpeechError(
            'Não conseguimos acessar o microfone. Libere a permissão nas configurações do navegador ou celular.',
          );
          return;
        }
      }
    }

    setIsRecording(true);
    setMicState('listening');
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
      setLastPairWrongDetail(null);
      void hapticSuccess();
      playCorrectSound(nextMatched.length);

      if (nextMatched.length === exercise.pairs.length) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setCorrectCount((prev) => prev + 1);
        onPetHappinessChange(8);
        setChecked({
          correct: true,
          kind: 'pairs',
          messagePt: HAPPY_PRAISES[index % HAPPY_PRAISES.length]!,
        });
      }
    } else {
      const leftItem = exercise.pairs.find((p) => p.id === selectedLeftPairId);
      const wrongRightItem = exercise.pairs.find((p) => p.id === pairId);
      void hapticError();
      playPetSadSound();
      onPetHappinessChange(-5);
      setWrongPairFlash(pairId);
      setPairMistakeFlash(true);
      if (leftItem && wrongRightItem) {
        setLastPairWrongDetail({ left: leftItem.left, wrongRight: wrongRightItem.right });
      }
      setTimeout(() => {
        setWrongPairFlash(null);
        setSelectedLeftPairId(null);
      }, 650);
      setTimeout(() => setPairMistakeFlash(false), 1800);
    }
  }

  function handleSkipSpeaking() {
    if (!exercise || checked || isExam) return;
    void hapticTap();
    playTapSound();
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    audioRecorderRef.current?.abort();
    audioRecorderRef.current = null;
    setIsRecording(false);
    setMicState('idle');
    setMicVolume(0);
    setCorrectCount((prev) => prev + 1);
    onPetHappinessChange(4);
    setChecked({
      correct: true,
      kind: 'speak',
      messagePt: `Sem problema! ${pet.name} segue feliz com você para a próxima! 🧩`,
    });
  }

  async function handleCheck() {
    if (!exercise || checked || micState === 'draining' || micState === 'whisper') return;

    let finalSpoken = spokenText;
    let finalAlts = spokenAlternatives;
    let whisperFlag = usedCloudWhisper;

    // Aguarda finalizar captura e drenar as últimas palavras + Whisper HD antes de avaliar!
    if (isRecording) {
      const drained = await stopAndFinalizeSpeech();
      finalSpoken = drained.text;
      finalAlts = drained.alternatives;
      whisperFlag = drained.whisperUsed;
    }

    let result: CheckedResult;
    let userSummaryForLog = '';
    let expectedSummaryForLog = exercise.targetText;

    if (
      exercise.type === 'context_choice' ||
      exercise.type === 'trap_buster' ||
      exercise.type === 'dialogue_complete' ||
      exercise.type === 'script_lab' ||
      exercise.type === 'picture_choice'
    ) {
      const isCorrect = selectedOption === exercise.correctOptionId;
      const chosenOpt = exercise.options?.find((o) => o.id === selectedOption);
      const rightOpt = exercise.options?.find((o) => o.id === exercise.correctOptionId);
      const chosenLabel = chosenOpt?.text ?? '';
      const expectedLabel = rightOpt?.text ?? exercise.targetText;
      userSummaryForLog = chosenLabel;
      expectedSummaryForLog = expectedLabel;

      const chosenTokens = chosenLabel.split(/\s+/).filter(Boolean);
      const expectedTokens = expectedLabel.split(/\s+/).filter(Boolean);
      const choiceDiff =
        !isCorrect && chosenTokens.length >= 2 && expectedTokens.length >= 2
          ? diffTokenSequences(chosenTokens, expectedTokens)
          : undefined;

      result = {
        correct: isCorrect,
        kind: 'choice',
        chosenLabel,
        chosenTranslationPt: chosenOpt?.translationPt,
        expectedLabel,
        choiceDiff,
        messagePt: isCorrect
          ? HAPPY_PRAISES[index % HAPPY_PRAISES.length]!
          : 'Não foi dessa vez — veja exatamente o que você errou abaixo:',
      };
    } else if (exercise.type === 'listen_build') {
      const expectedTokens = exercise.correctTokens ?? [];
      const expectedNorm = expectedTokens.map(normToken);
      const userNorm = builtTokens.map(normToken);
      const isCorrect =
        expectedNorm.length === userNorm.length &&
        expectedNorm.every((tok, idx) => tok === userNorm[idx]);

      const buildUserDiff: BuildTokenDiff[] = builtTokens.map((tok, idx) => ({
        token: tok,
        ok: normToken(tok) === expectedNorm[idx],
      }));
      const buildSequenceDiff = diffTokenSequences(builtTokens, expectedTokens);

      // Quais palavras faltaram e quais sobraram (comparação por contagem)
      const userPool = [...userNorm];
      const buildMissing: string[] = [];
      for (const expTok of expectedTokens) {
        const idx = userPool.indexOf(normToken(expTok));
        if (idx >= 0) userPool.splice(idx, 1);
        else buildMissing.push(expTok);
      }

      const expPool = [...expectedNorm];
      const buildExtra: string[] = [];
      for (const usrTok of builtTokens) {
        const idx = expPool.indexOf(normToken(usrTok));
        if (idx >= 0) expPool.splice(idx, 1);
        else buildExtra.push(usrTok);
      }

      userSummaryForLog = builtTokens.join(' ');
      expectedSummaryForLog = exercise.targetText;

      result = {
        correct: isCorrect,
        kind: 'build',
        buildUserDiff,
        buildSequenceDiff,
        buildExpectedTokens: expectedTokens,
        buildMissing,
        buildExtra,
        expectedLabel: exercise.targetText,
        messagePt: isCorrect
          ? `Frase montada perfeitamente! ${pet.name} amou! 🧩`
          : 'A ordem ou alguma palavra ficou diferente — veja o comparativo nítido abaixo:',
      };
    } else {
      const evaluation = evaluatePronunciation(
        finalSpoken,
        exercise.targetText,
        language,
        exercise.acceptedSpeechVariants ?? [],
        finalAlts,
      );
      userSummaryForLog = evaluation.bestSpokenText || '(sem voz captada)';
      expectedSummaryForLog = exercise.targetText;

      result = {
        correct: evaluation.passed,
        kind: 'speak',
        score: evaluation.score,
        pronunciation: evaluation,
        usedCloudWhisper: whisperFlag,
        chosenLabel: evaluation.bestSpokenText,
        expectedLabel: exercise.targetText,
        messagePt: evaluation.feedbackPt,
      };
    }

    if (result.correct) {
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
      setMissedItems((prev) => [
        ...prev.filter((m) => m.exerciseId !== exercise.id),
        {
          exerciseId: exercise.id,
          promptPt: exercise.promptPt,
          userAnswer: userSummaryForLog,
          correctAnswer: expectedSummaryForLog,
          tipPt: exercise.brazilianTipPt,
        },
      ]);
    }

    setChecked(result);
  }

  async function handleNext() {
    if (isWalkingNext) return;
    void hapticTap();

    if (index + 1 < lesson.exercises.length) {
      setIsWalkingNext(true);
      setPetStepIndex(index + 1);
      playFootstepsSound(4);

      walkTimerRef.current = setTimeout(() => {
        setIndex((i) => i + 1);
        resetQuestionState();
        setIsWalkingNext(false);
      }, 740);
      return;
    }

    setIsWalkingNext(true);
    setPetStepIndex(totalSteps);
    playFootstepsSound(5);

    const total = lesson.exercises.length;
    const accuracy = Math.round((correctCount / total) * 100);
    const passedExam = !isExam || accuracy >= passingAccuracy;
    const durationSeconds = Math.max(15, Math.round((Date.now() - startedAtRef.current) / 1000));

    walkTimerRef.current = setTimeout(async () => {
      setIsWalkingNext(false);
      try {
        const res = await api.completeLesson(lesson.id, accuracy, durationSeconds);
        if (passedExam) {
          void hapticSuccess();
          playVictoryFanfare();
          onPetHappinessChange(15);
        } else {
          void hapticError();
          playPetSadSound();
        }
        setFinished({ accuracy, xpGained: res.xpGained, streakDays: res.streakDays, passedExam });
        onCompleted({ ...res, lessonId: lesson.id });
      } catch {
        if (passedExam) {
          playVictoryFanfare();
          onPetHappinessChange(15);
        }
        setFinished({ accuracy, xpGained: lesson.xpReward, streakDays: 1, passedExam });
        onCompleted({
          lessonId: lesson.id,
          xpGained: lesson.xpReward,
          streakDays: 1,
          xpTotal: lesson.xpReward,
        });
      }
    }, 740);
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
      micState !== 'draining' &&
      micState !== 'whisper' &&
      exercise.type !== 'match_pairs' &&
      ((exercise.type === 'listen_build' && builtTokens.length > 0) ||
        (exercise.type === 'speak_pronounce' &&
          (spokenText.trim().length > 0 || isRecording)) ||
        selectedOption !== null),
  );

  function handleRestartWholeLesson() {
    playTapSound();
    setIndex(0);
    setPetStepIndex(0);
    setCombo(0);
    setCorrectCount(0);
    setMissedItems([]);
    setFinished(null);
    startedAtRef.current = Date.now();
    resetQuestionState();
  }

  // TELA DE RESULTADO FINAL (Lição comum OU Prova Oficial de Passagem de Nível!)
  if (finished) {
    const failedExam = isExam && !finished.passedExam;
    return (
      <div className="min-h-[82dvh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="duo-card max-w-lg w-full p-6 sm:p-7 text-center space-y-5 relative overflow-visible"
        >
          {!failedExam && <ConfettiBurst active />}
          <div className="flex justify-center">
            <PetSprite
              species={pet.species}
              mood={failedExam ? 'sad' : 'celebrate'}
              size={148}
            />
          </div>

          <div>
            {isExam ? (
              <>
                <div
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border-2 text-xs font-extrabold uppercase tracking-wider ${
                    failedExam
                      ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error-dark)]'
                      : 'bg-[var(--na-gold-soft)] border-[var(--na-gold)] text-[#7a5200]'
                  }`}
                >
                  <GraduationCap size={16} weight="fill" />
                  {failedExam
                    ? `Nota ${finished.accuracy}% — Mínimo para passar: ${passingAccuracy}%`
                    : lesson.unlocksCefr
                      ? `Nível ${lesson.cefr} Aprovado! · Nível ${lesson.unlocksCefr} Liberado! 🏆`
                      : `👑 Maestria Nativa ${lesson.cefr} Conquistada!`}
                </div>
                <h2 className="font-display text-3xl sm:text-4xl text-[var(--na-ink)] mt-2">
                  {failedExam
                    ? 'Quase lá — vamos reforçar!'
                    : lesson.unlocksCefr
                      ? `Você subiu para o Nível ${lesson.unlocksCefr}! 🎉`
                      : 'Fluência Nativa C2 Conquistada! 👑'}
                </h2>
                <p className="text-sm font-bold text-[var(--na-muted)] mt-1">
                  {failedExam
                    ? `Você acertou ${correctCount} de ${totalSteps} questões (${finished.accuracy}%). Revise os erros nítidos abaixo e tente a prova de novo!`
                    : lesson.unlocksCefr
                      ? `Você provou que domina o Nível ${lesson.cefr} (${finished.accuracy}%) e destravou todas as etapas do Nível ${lesson.unlocksCefr}!`
                      : `Parabéns! Você venceu o exame final com ${finished.accuracy}% de acerto!`}
                </p>
              </>
            ) : (
              <>
                <div className="inline-block px-3.5 py-1 rounded-full bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-xs font-extrabold uppercase tracking-wider text-[#7a5200]">
                  {pet.name} está radiante! 🏆
                </div>
                <h2 className="font-display text-3xl sm:text-4xl text-[var(--na-ink)] mt-2">
                  Peça Encaixada! 🧩
                </h2>
                <p className="text-sm font-bold text-[var(--na-muted)] mt-1">
                  {finished.accuracy >= 70
                    ? `Etapa dominada (${finished.accuracy}%)! Veja ${pet.name} andando até a próxima atividade! 🐾`
                    : `Você fez ${finished.accuracy}%. Refaça quando quiser para atingir ≥ 70% e dominar 100% esta etapa!`}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)]">
              <div className="text-xs font-extrabold uppercase text-[#8a6010]">Peças 🧩</div>
              <div className="text-2xl font-extrabold text-[#7a5200] mt-0.5">
                +{finished.xpGained}
              </div>
            </div>
            <div
              className={`p-3 rounded-2xl border-2 ${
                failedExam
                  ? 'bg-[var(--na-error-soft)] border-[var(--na-error)]'
                  : 'bg-[var(--na-success-soft)] border-[var(--na-success)]'
              }`}
            >
              <div
                className={`text-xs font-extrabold uppercase ${
                  failedExam ? 'text-[var(--na-error-dark)]' : 'text-[var(--na-success-dark)]'
                }`}
              >
                Acertos
              </div>
              <div
                className={`text-2xl font-extrabold mt-0.5 ${
                  failedExam ? 'text-[var(--na-error)]' : 'text-[var(--na-success-dark)]'
                }`}
              >
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

          {/* RESUMO NÍTIDO DOS ERROS DA ATIVIDADE / PROVA */}
          {missedItems.length > 0 && (
            <div className="text-left rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] p-4 space-y-2.5 max-h-64 overflow-y-auto">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-error-dark)]">
                🔍 O que revisar ({missedItems.length}{' '}
                {missedItems.length === 1 ? 'erro' : 'erros'}):
              </div>
              {missedItems.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white border border-[var(--na-border)] text-xs space-y-1.5"
                >
                  <div className="font-extrabold text-[var(--na-ink)]">{m.promptPt}</div>
                  <div className="text-[var(--na-error-dark)] font-bold">
                    ❌ Você respondeu: <span className="line-through">{m.userAnswer}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[var(--na-success-dark)] font-extrabold">
                    <span>✅ Forma certa: {m.correctAnswer}</span>
                    <button
                      type="button"
                      onClick={() => speakText(m.correctAnswer, language, 0.85)}
                      className="px-2 py-0.5 rounded-lg bg-[var(--na-success)] text-white text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0"
                    >
                      <SpeakerHigh size={12} weight="fill" /> Ouvir
                    </button>
                  </div>
                  <div className="text-[var(--na-muted)] font-semibold">💡 {m.tipPt}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            {(failedExam || (!isExam && finished.accuracy < 70)) && (
              <button
                type="button"
                onClick={handleRestartWholeLesson}
                className="duo-btn-teal w-full text-sm uppercase tracking-wide flex items-center justify-center gap-2"
              >
                <ArrowCounterClockwise size={18} weight="bold" />
                {failedExam ? 'REFAZER PROVA AGORA' : 'REFAZER AGORA PARA DOMINAR (≥ 70%)'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                playTapSound();
                onExit();
              }}
              className={`${
                failedExam ? 'duo-btn-coral' : 'duo-btn-emerald'
              } w-full text-base uppercase tracking-wide flex items-center justify-center gap-2`}
            >
              {failedExam
                ? 'VOLTAR E REVISAR AS ETAPAS'
                : isExam && lesson.unlocksCefr
                  ? `IR PARA O NÍVEL ${lesson.unlocksCefr} 🚀`
                  : 'ANDAR PARA A PRÓXIMA ATIVIDADE'}
              <ArrowRight size={20} weight="bold" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!exercise) return null;

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
          ? `${pet.name} ficou tristinho 🥺 — veja o erro abaixo!`
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
        {/* FAIXA DE PROVA OFICIAL DE NÍVEL */}
        {isExam && (
          <div className="mb-3 px-4 py-2.5 rounded-2xl bg-[var(--na-burgundy)] text-white border-2 border-[var(--na-wine-deep)] flex items-center justify-between gap-2 text-xs font-extrabold">
            <span className="inline-flex items-center gap-1.5 uppercase tracking-wider">
              <GraduationCap size={18} weight="fill" />
              Prova Oficial {lesson.cefr}
              {lesson.unlocksCefr ? ` → ${lesson.unlocksCefr}` : ' · Maestria'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/20">
              Mínimo {passingAccuracy}% · {index + 1}/{totalSteps}
            </span>
          </div>
        )}

        {/* TOPO COM TRILHA DE PEDRINHAS + BICHINHO ANDANDO */}
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

          <div className="flex-1 pt-9 pb-1 relative">
            <motion.div
              className="absolute top-0 -translate-x-1/2 z-20 pointer-events-none"
              initial={false}
              animate={{ left: `${petTrackPercent}%` }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            >
              <PetSprite species={pet.species} mood={currentPetMood} size={46} />
            </motion.div>

            <div className="relative h-4 rounded-full bg-[var(--na-sand-dark)] flex items-center">
              <motion.div
                className="h-full bg-[var(--na-success)] rounded-full"
                initial={false}
                animate={{ width: `${Math.max(8, petTrackPercent)}%` }}
                transition={{ duration: 0.65, ease: 'easeInOut' }}
              />
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

        {/* Etiqueta do desafio + Humor ao vivo + Toggle Romanização */}
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

          <div className="flex items-center gap-2">
            {!isExam && unit && (unit.grammarFocusPt || unit.culturalNotePt) && (
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowGrammarSheet((v) => !v);
                }}
                className={`text-xs font-extrabold px-3 py-1.5 rounded-full border-2 inline-flex items-center gap-1.5 ${
                  showGrammarSheet
                    ? 'bg-[var(--na-gold)] border-[var(--na-gold-dark)] text-[#4a2e00]'
                    : 'bg-white border-[var(--na-border)] text-[var(--na-burgundy)]'
                }`}
              >
                <BookOpenText size={14} weight="fill" />
                {showGrammarSheet ? 'Fechar Regra' : 'Ver Regra'}
              </button>
            )}

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
        </div>

        {/* CARTÃO DE REGRA GRAMATICAL RÁPIDA (Estilo página esquerda "Grammar in Use" — oculto na prova!) */}
        {!isExam && showGrammarSheet && unit && (
          <div className="mb-4 p-4 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] space-y-2 text-xs text-[#4a2e00]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold uppercase tracking-wider text-[11px] text-[#7a5200]">
                📖 Regra da Etapa · Nível {unit.cefr} — {unit.titlePt}
              </span>
              <button
                type="button"
                onClick={() => setShowGrammarSheet(false)}
                className="text-[11px] font-extrabold underline"
              >
                Ocultar
              </button>
            </div>
            {unit.grammarFocusPt && (
              <div className="p-2.5 rounded-xl bg-white/90 border border-[var(--na-gold)] font-extrabold text-[var(--na-teal-dark)]">
                🧩 Fórmula / Foco: {unit.grammarFocusPt}
              </div>
            )}
            <div className="font-semibold leading-relaxed">{unit.descriptionPt}</div>
            <div className="p-2.5 rounded-xl bg-white/85 border border-[var(--na-border)] font-bold text-[var(--na-ink)]">
              💡 <strong>Dica de ouro para brasileiros:</strong> {unit.culturalNotePt}
            </div>
          </div>
        )}

        {/* BICHINHO + BALÃO DE PERGUNTA */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative shrink-0">
            <ConfettiBurst active={Boolean(checked?.correct)} />
            <PetSprite species={pet.species} mood={currentPetMood} size={90} />
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
                  className="min-h-[40px] px-3.5 rounded-xl bg-[var(--na-teal)] text-white border-2 border-[var(--na-teal-dark)] border-b-4 text-xs font-extrabold inline-flex items-center gap-1.5 active:translate-y-[2px]"
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
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--na-cream)] text-[var(--na-ink)] border-2 border-[var(--na-border)] border-b-4 text-xs font-extrabold inline-flex items-center gap-1 active:translate-y-[2px]"
                >
                  🐢 Devagar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENA DE TRANSIÇÃO ANDANDO */}
        {isWalkingNext ? (
          <div className="duo-card p-8 flex flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-white to-[var(--na-cream)]">
            <div className="relative w-full h-28 flex items-center overflow-hidden">
              <div className="absolute left-4 right-4 bottom-4 h-3 rounded-full bg-[var(--na-sand-dark)] border border-[var(--na-border)]" />
              <motion.div
                initial={{ x: '8%' }}
                animate={{ x: '72%' }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
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
            {/* 1. PICTURE CHOICE */}
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
                      className={`p-4 rounded-3xl border-2 border-b-[6px] flex flex-col items-center justify-center gap-1.5 text-center transition-all active:translate-y-[2px] min-h-[148px] relative ${
                        isRight
                          ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)] ring-2 ring-[var(--na-success)]'
                          : isWrongChosen
                            ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error-dark)] ring-2 ring-[var(--na-error)]'
                            : chosen
                              ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                              : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                      }`}
                    >
                      {isRight && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[var(--na-success)] text-white text-[10px] font-extrabold">
                          ✅ CERTA
                        </span>
                      )}
                      {isWrongChosen && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[var(--na-error)] text-white text-[10px] font-extrabold">
                          ❌ VOCÊ MARCOU
                        </span>
                      )}
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
                        <div className="text-xs font-bold opacity-85">{opt.translationPt}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. MATCH PAIRS */}
            {exercise.type === 'match_pairs' && exercise.pairs && (
              <div className="space-y-2.5">
                {lastPairWrongDetail && (
                  <div className="p-3.5 rounded-2xl bg-[var(--na-error-soft)] border-2 border-[var(--na-error)] text-xs font-extrabold text-[var(--na-error-dark)] space-y-0.5">
                    <div>
                      ❌ Você ligou errado: <span className="underline">"{lastPairWrongDetail.left}"</span>{' '}
                      NÃO significa <span className="line-through">"{lastPairWrongDetail.wrongRight}"</span>!
                    </div>
                    <div className="text-[11px] font-bold opacity-85">
                      Toque novamente em "{lastPairWrongDetail.left}" para ouvir e escolher o par certo.
                    </div>
                  </div>
                )}
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

            {/* 4. MÚLTIPLA ESCOLHA 3D COM MARCAÇÃO NÍTIDA DE CERTA / ERRADA */}
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
                          ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)] ring-2 ring-[var(--na-success)]'
                          : isWrongChosen
                            ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error-dark)] ring-2 ring-[var(--na-error)]'
                            : chosen
                              ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                              : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          isRight
                            ? 'bg-[var(--na-success)] border-[var(--na-success-dark)] text-white'
                            : isWrongChosen
                              ? 'bg-[var(--na-error)] border-[var(--na-error-dark)] text-white'
                              : 'bg-[var(--na-cream)] border-[var(--na-border)]'
                        }`}
                      >
                        {isRight ? '✓' : isWrongChosen ? '✕' : optIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-base font-extrabold leading-snug ${isWrongChosen ? 'line-through' : ''}`}>
                          {opt.text}
                        </div>
                        {showRomanization && opt.reading && (
                          <div className="font-mono-code text-xs font-bold text-[var(--na-teal)] mt-0.5">
                            {opt.reading}
                          </div>
                        )}
                        {opt.translationPt && checked && (
                          <div className="text-xs font-bold opacity-85 mt-0.5">{opt.translationPt}</div>
                        )}
                      </div>
                      {isRight && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--na-success)] text-white text-[10px] font-extrabold shrink-0">
                          CERTA
                        </span>
                      )}
                      {isWrongChosen && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--na-error)] text-white text-[10px] font-extrabold shrink-0">
                          SUA ESCOLHA
                        </span>
                      )}
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
                    builtTokens.map((tok, i) => {
                      const diffItem = checked?.buildUserDiff?.[i];
                      const chipClass = checked
                        ? diffItem?.ok
                          ? 'bg-[var(--na-success)] border-[var(--na-success-dark)] text-white'
                          : 'bg-[var(--na-error)] border-[var(--na-error-dark)] text-white line-through'
                        : 'bg-[var(--na-burgundy)] border-[var(--na-wine-deep)] text-white';
                      return (
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
                          className={`min-h-[44px] px-4 rounded-2xl border-2 border-b-4 text-base font-extrabold ${chipClass}`}
                        >
                          {tok}
                        </motion.button>
                      );
                    })
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

            {/* 6. SPEAK & PRONOUNCE (CAPTURA CONTÍNUA + PALAVRA POR PALAVRA AO VIVO!) */}
            {exercise.type === 'speak_pronounce' && (
              <div className="duo-card p-5 space-y-4">
                <div className="p-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-center space-y-2">
                  {/* Palavras interativas: acendem VERDE AO VIVO conforme o microfone capta cada palavra! */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {targetDisplayWords.map((word, wIdx) => {
                      const aligned =
                        checked?.pronunciation?.matchedWords[wIdx] ??
                        liveSpeechEval?.matchedWords[wIdx];
                      const isMatched = Boolean(aligned?.matched);
                      const isFailedAfterCheck = Boolean(checked && aligned && !aligned.matched);

                      return (
                        <button
                          key={`${word}-${wIdx}`}
                          type="button"
                          onClick={() => speakSingleWord(word, language)}
                          title="Toque para ouvir só esta palavra"
                          className={`px-2.5 py-1 rounded-xl border-2 text-lg sm:text-xl font-extrabold transition-all active:scale-95 ${
                            isMatched
                              ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                              : isFailedAfterCheck
                                ? 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error-dark)]'
                                : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-teal)]'
                          }`}
                        >
                          <span>{word}</span>
                          {isMatched && <span className="ml-1 text-xs">✓</span>}
                          {isFailedAfterCheck && (
                            <span className="block text-[10px] font-bold text-[var(--na-error)] leading-tight">
                              {aligned?.heardWord ? `ouviu "${aligned.heardWord}"` : 'faltou'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] font-bold text-[var(--na-muted)]">
                    👆 Toque em qualquer palavra acima para ouvir a pronúncia dela devagar
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

                {/* MICROFONE HÍBRIDO CONTÍNUO + MEDIDOR DE VOZ AO VIVO + WHISPER IA 24/7 */}
                <div className="flex flex-col items-center gap-2.5">
                  <div className="relative flex items-center justify-center">
                    {isRecording && (
                      <span
                        className="absolute rounded-full bg-[var(--na-error)]/25 transition-transform duration-75 pointer-events-none"
                        style={{
                          width: '108px',
                          height: '108px',
                          transform: `scale(${1 + Math.min(0.45, micVolume * 0.55)})`,
                        }}
                      />
                    )}
                    <button
                      type="button"
                      disabled={Boolean(checked) || micState === 'draining' || micState === 'whisper'}
                      onClick={() => void handleSpeakToggle()}
                      className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all border-4 border-b-[8px] active:translate-y-[3px] ${
                        isRecording
                          ? 'bg-[var(--na-error)] border-[var(--na-error-dark)] text-white scale-105'
                          : micState === 'draining' || micState === 'whisper'
                            ? 'bg-[var(--na-gold)] border-[var(--na-gold-dark)] text-[#4a2e00] animate-pulse'
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
                  </div>

                  {/* Barra visual de volume da voz para confirmar que o microfone está ouvindo */}
                  {isRecording && (
                    <div className="w-44 h-2.5 rounded-full bg-[var(--na-sand)] overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-[var(--na-success)] transition-all duration-75"
                        style={{ width: `${Math.max(8, Math.round(micVolume * 100))}%` }}
                      />
                    </div>
                  )}

                  <span
                    className={`text-xs font-extrabold text-center max-w-sm ${
                      isRecording
                        ? 'text-[var(--na-error-dark)]'
                        : micState === 'whisper' || micState === 'draining'
                          ? 'text-[#7a5200]'
                          : 'text-[var(--na-muted)]'
                    }`}
                  >
                    {micState === 'whisper'
                      ? '✨ Conferindo todas as palavras com Whisper IA em alta precisão...'
                      : micState === 'draining'
                        ? '🎙️ Finalizando captura das últimas palavras...'
                        : isRecording
                          ? micState === 'reconnecting'
                            ? '🎙️ Mantendo 100% do que você já falou... continue ou toque em PARAR'
                            : '🎙️ Ouvindo sem cortes! Pode falar normal ou pausado palavra por palavra. Toque no botão vermelho ao terminar.'
                          : cloudSttReady
                            ? '🎙️ Escuta HD ativa (normal ou palavra por palavra). Toque no microfone, fale com calma e toque em PARAR.'
                            : 'Toque no microfone, fale com calma (normal ou palavra por palavra) e toque em PARAR ao acabar.'}
                  </span>

                  {/* Indicador ao vivo de quantas palavras já foram captadas */}
                  {spokenText.trim() && liveSpeechEval && !checked && (
                    <div className="w-full p-3 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] text-xs space-y-1">
                      <div className="flex items-center justify-between font-extrabold text-[var(--na-teal-dark)]">
                        <span>
                          {usedCloudWhisper ? '✨ Captado (Whisper HD):' : '🎙️ O microfone captou:'}
                        </span>
                        <span>
                          {liveSpeechEval.matchedWords.filter((w) => w.matched).length}/
                          {liveSpeechEval.matchedWords.length} palavras
                        </span>
                      </div>
                      <div className="font-bold text-[var(--na-ink)] text-sm">"{spokenText}"</div>
                    </div>
                  )}
                </div>

                {speechError && (
                  <div className="text-xs font-bold text-[var(--na-error-dark)] bg-[var(--na-error-soft)] border border-[var(--na-error)] p-3 rounded-xl">
                    {speechError}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    id="na-speech-input"
                    type="text"
                    disabled={Boolean(checked)}
                    value={spokenText}
                    onChange={(e) => {
                      setSpokenText(e.target.value);
                      setSpokenAlternatives([]);
                    }}
                    placeholder="O que você falar aparece aqui (ou digite se preferir)..."
                    className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-sm font-semibold"
                  />
                  {spokenText.trim() && !checked && (
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setSpokenText('');
                        setSpokenAlternatives([]);
                      }}
                      aria-label="Limpar fala"
                      className="px-3.5 rounded-2xl bg-white border-2 border-[var(--na-border)] text-xs font-extrabold text-[var(--na-muted)] hover:text-[var(--na-ink)] inline-flex items-center gap-1"
                    >
                      <ArrowCounterClockwise size={16} weight="bold" />
                      Limpar
                    </button>
                  )}
                </div>

                {!checked && !isExam && (
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

      {/* RODAPÉ DESLIZANTE DE FEEDBACK ULTRA-NÍTIDO (MOSTRA EXATAMENTE O QUE ERROU!) */}
      <div ref={feedbackRef} className="mt-6 space-y-3 safe-bottom">
        {checked && !isWalkingNext && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-3xl border-2 space-y-3 ${
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

            {/* QUADRO ULTRA-NÍTIDO DE COMPARAÇÃO QUANDO ERROU */}
            {!checked.correct && (
              <div className="p-3.5 rounded-2xl bg-white border-2 border-[var(--na-error)]/50 space-y-3 text-sm shadow-xs">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--na-error-dark)] flex items-center gap-1.5 pb-1.5 border-b border-[var(--na-border)]">
                  🔎 EXATAMENTE O QUE VOCÊ ERROU:
                </div>

                {/* 1) Erro em Múltipla Escolha / Diálogo / Armadilha / Figura */}
                {checked.kind === 'choice' && (
                  <>
                    <div className="p-3 rounded-xl bg-[var(--na-error-soft)]/80 border-2 border-[var(--na-error)]/40 space-y-1">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-error-dark)]">
                        ❌ O que você marcou (em vermelho a parte errada):
                      </div>
                      {checked.choiceDiff ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {checked.choiceDiff
                            .filter((d) => d.actual)
                            .map((d, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded-md text-sm font-extrabold ${
                                  d.kind === 'match'
                                    ? 'text-[var(--na-ink)] bg-white/80'
                                    : 'bg-[var(--na-error)] text-white line-through'
                                }`}
                              >
                                {d.actual}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <div className="font-extrabold text-[var(--na-error-dark)] line-through text-base">
                          {checked.chosenLabel}
                        </div>
                      )}
                      {checked.chosenTranslationPt && (
                        <div className="text-xs font-bold text-[var(--na-error-dark)]/85">
                          (Essa opção significa: "{checked.chosenTranslationPt}")
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--na-success-soft)]/85 border-2 border-[var(--na-success)]/50 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-success-dark)]">
                          ✅ Resposta certa (em verde a diferença):
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => speakText(exercise.targetText, language, 0.9)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--na-success)] text-white text-[11px] font-extrabold inline-flex items-center gap-1"
                          >
                            <SpeakerHigh size={13} weight="fill" /> Ouvir
                          </button>
                          <button
                            type="button"
                            onClick={() => speakText(exercise.targetText, language, 0.65)}
                            className="px-2 py-1 rounded-lg bg-white border border-[var(--na-success)] text-[var(--na-success-dark)] text-[11px] font-extrabold"
                          >
                            🐢
                          </button>
                        </div>
                      </div>
                      {checked.choiceDiff ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {checked.choiceDiff
                            .filter((d) => d.expected)
                            .map((d, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded-md text-sm font-extrabold ${
                                  d.kind === 'match'
                                    ? 'text-[var(--na-success-dark)] bg-white/80'
                                    : 'bg-[var(--na-success)] text-white'
                                }`}
                              >
                                {d.expected}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <div className="font-extrabold text-[var(--na-success-dark)] text-base">
                          {checked.expectedLabel}
                        </div>
                      )}
                      {exercise.ipaOrPhoneticBr && (
                        <div className="text-xs font-bold text-[var(--na-burgundy)]">
                          Como ler: {exercise.ipaOrPhoneticBr}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-[var(--na-muted)]">
                        Tradução: "{exercise.translationPt}"
                      </div>
                    </div>
                  </>
                )}

                {/* 2) Erro em Montar Frase (diff alinhado palavra por palavra com marca de onde faltou!) */}
                {checked.kind === 'build' && (
                  <>
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-error-dark)]">
                        ❌ Comparativo exato da sua frase (verde = certo · riscado = errado · tracejado = faltou ali):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(checked.buildSequenceDiff ?? []).map((item, i) => {
                          if (item.kind === 'match') {
                            return (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg text-xs font-extrabold border-2 bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]"
                              >
                                ✓ {item.actual}
                              </span>
                            );
                          }
                          if (item.kind === 'missing') {
                            return (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg text-xs font-extrabold border-2 border-dashed bg-[var(--na-gold-soft)] border-[var(--na-error)] text-[var(--na-error-dark)]"
                              >
                                + faltou "{item.expected}"
                              </span>
                            );
                          }
                          if (item.kind === 'wrong') {
                            return (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg text-xs font-extrabold border-2 bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error-dark)]"
                              >
                                <span className="line-through">{item.actual}</span> →{' '}
                                <span className="text-[var(--na-success-dark)] underline">{item.expected}</span>
                              </span>
                            );
                          }
                          return (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg text-xs font-extrabold border-2 bg-[var(--na-error)] border-[var(--na-error-dark)] text-white line-through"
                            >
                              ✕ {item.actual}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--na-success-soft)]/85 border-2 border-[var(--na-success)]/50 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-success-dark)]">
                          ✅ Frase completa na ordem certa:
                        </span>
                        <button
                          type="button"
                          onClick={() => speakText(exercise.targetText, language, 0.85)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--na-success)] text-white text-[11px] font-extrabold inline-flex items-center gap-1"
                        >
                          <SpeakerHigh size={13} weight="fill" /> Ouvir certa
                        </button>
                      </div>
                      <div className="font-extrabold text-[var(--na-success-dark)] text-base">
                        {exercise.targetText}
                      </div>
                      {checked.buildMissing && checked.buildMissing.length > 0 && (
                        <div className="text-xs font-bold text-[var(--na-error-dark)]">
                          • Faltou usar: <strong>{checked.buildMissing.join(', ')}</strong>
                        </div>
                      )}
                      {checked.buildExtra && checked.buildExtra.length > 0 && (
                        <div className="text-xs font-bold text-[var(--na-error-dark)]">
                          • Palavra que não entrava: <strong>{checked.buildExtra.join(', ')}</strong>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 3) Erro em Fala / Pronúncia (diff exato do que o microfone/Whisper captou!) */}
                {checked.kind === 'speak' && checked.pronunciation && (
                  <>
                    <div className="p-3 rounded-xl bg-[var(--na-cream)] border border-[var(--na-border)] space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                        <span>
                          {checked.usedCloudWhisper
                            ? '✨ O que a escuta Whisper IA entendeu:'
                            : '🎙️ O que o microfone entendeu:'}
                        </span>
                        <span className="text-[var(--na-burgundy)]">
                          {checked.pronunciation.matchedWords.filter((w) => w.matched).length}/
                          {checked.pronunciation.matchedWords.length} palavras
                        </span>
                      </div>
                      <div className="font-extrabold text-[var(--na-ink)] text-base">
                        "{checked.pronunciation.bestSpokenText || 'nada captado'}"
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-error-dark)]">
                        🔎 Palavra por palavra (toque na vermelha para ouvir devagar):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {checked.pronunciation.matchedWords.map((w, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => speakSingleWord(w.word, language)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border-2 ${
                              w.status === 'ok'
                                ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                                : w.status === 'close'
                                  ? 'bg-[var(--na-gold-soft)] border-[var(--na-gold-dark)] text-[#5a3b00]'
                                  : 'bg-[var(--na-error-soft)] border-[var(--na-error)] text-[var(--na-error-dark)]'
                            }`}
                          >
                            {w.status === 'ok' ? '✅' : w.status === 'close' ? '🟡' : '❌'} {w.word}
                            {!w.matched && w.heardWord
                              ? ` → ouviu "${w.heardWord}"`
                              : !w.matched
                                ? ' (faltou)'
                                : ''}
                          </button>
                        ))}
                      </div>
                      {checked.pronunciation.substitutedWords.length > 0 && (
                        <div className="text-xs font-bold text-[var(--na-error-dark)]">
                          • Palavras trocadas:{' '}
                          {checked.pronunciation.substitutedWords
                            .map((s) => `"${s.expected}" (ouviu "${s.heard}")`)
                            .join(' · ')}
                        </div>
                      )}
                    </div>

                    {!isExam && (
                      <button
                        type="button"
                        onClick={handleRetrySpeaking}
                        className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--na-teal)] text-white border-2 border-[var(--na-teal-dark)] border-b-4 text-xs font-extrabold uppercase tracking-wide inline-flex items-center justify-center gap-1.5"
                      >
                        <Microphone size={16} weight="fill" />
                        Tentar falar de novo agora
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-white/85 border border-[var(--na-border)] text-xs font-bold text-[var(--na-ink)] leading-relaxed">
              💡 <strong>Por que é assim:</strong> {exercise.brazilianTipPt}
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
              onClick={() => void handleCheck()}
              className="duo-btn-emerald w-full text-base uppercase tracking-wide"
            >
              {micState === 'whisper'
                ? 'CONFERINDO PALAVRAS COM IA...'
                : micState === 'draining'
                  ? 'FINALIZANDO MICROFONE...'
                  : isRecording
                    ? 'PARAR E VERIFICAR'
                    : 'VERIFICAR'}
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
                : isExam
                  ? 'VER NOTA DA PROVA 🎓'
                  : 'VER MINHA VITÓRIA! 🏆'}
            {!isWalkingNext && <ArrowRight size={20} weight="bold" />}
          </button>
        )}
      </div>
    </div>
  );
}
