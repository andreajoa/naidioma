import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowCounterClockwise,
  ArrowLeft,
  Eye,
  EyeSlash,
  Keyboard,
  Lightbulb,
  Microphone,
  PaperPlaneTilt,
  PhoneDisconnect,
  SpeakerHigh,
  Sparkle,
  StopCircle,
  Translate,
  Trophy,
} from '@phosphor-icons/react';
import {
  LANGUAGES,
  diffTokenSequences,
  type CoachFeedback,
  type ConversationScenario,
  type LanguageCode,
} from '@naidioma/shared';
import { api } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { playCorrectSound, playTapSound, playVictoryFanfare } from '../lib/sound';
import {
  createAudioRecorder,
  createSpeechRecognizer,
  isAudioRecorderSupported,
  isSpeechRecognitionSupported,
  speakText,
  speakTextWithLipSync,
  stopSpeaking,
  type AudioRecorderHandle,
  type SpeechRecognizerHandle,
} from '../lib/speech';
import { ConfettiBurst } from './Mascots';
import type { PetProfile } from './PetBuddy';
import {
  TUTOR_PROFILES,
  TutorAvatar,
  type TutorCallState,
  type TutorId,
} from './TutorAvatar';

interface LiveCallViewProps {
  language: LanguageCode;
  scenario: ConversationScenario;
  tutorId: TutorId;
  pet: PetProfile;
  onExit: () => void;
  onPetHappinessChange?: (delta: number) => void;
}

interface CallExchange {
  id: string;
  userText: string;
  aiReplyText: string;
  aiReplyReading?: string;
  aiReplyTranslationPt: string;
  coach: CoachFeedback;
  providerUsed: string;
  modelUsed: string;
}

function defaultRateForCefr(cefr: ConversationScenario['cefr']): number {
  if (cefr === 'A1') return 0.82;
  if (cefr === 'A2') return 0.9;
  if (cefr === 'B1') return 0.95;
  if (cefr === 'B2') return 0.98;
  return 1.04;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function normalizeCmp(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'’‘()¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function LiveCallView({
  language,
  scenario,
  tutorId,
  pet,
  onExit,
  onPetHappinessChange,
}: LiveCallViewProps) {
  const langMeta = LANGUAGES[language];
  const tutorDisplayName =
    tutorId === 'pet'
      ? pet.name
      : tutorId === 'oliver'
        ? TUTOR_PROFILES.oliver.name
        : TUTOR_PROFILES.maya.name;
  const voicePreference: 'female' | 'male' =
    tutorId === 'oliver' ? 'male' : 'female';

  const [callSeconds, setCallSeconds] = useState(0);
  const [speechRate, setSpeechRate] = useState(() => defaultRateForCefr(scenario.cefr));
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranslation, setShowTranslation] = useState(scenario.cefr === 'A1' || scenario.cefr === 'A2');
  const [showHints, setShowHints] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const [avatarState, setAvatarState] = useState<TutorCallState>('idle');
  const [mouthLevel, setMouthLevel] = useState<0 | 1 | 2 | 3>(0);
  const [micVolume, setMicVolume] = useState(0);

  const [currentAiLine, setCurrentAiLine] = useState({
    text: scenario.openingLine,
    reading: scenario.openingReading,
    translationPt: scenario.openingTranslationPt,
  });
  const [exchanges, setExchanges] = useState<CallExchange[]>([]);
  const [liveDraft, setLiveDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const cancelLipSyncRef = useRef<(() => void) | null>(null);
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
  const recorderRef = useRef<AudioRecorderHandle | null>(null);
  const liveDraftRef = useRef('');
  const sttReadyRef = useRef(true);

  useEffect(() => {
    void api.getAiStatus().then((st) => {
      sttReadyRef.current = st.sttAvailable;
    });
  }, []);

  // Call duration clock
  useEffect(() => {
    if (ended) return undefined;
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [ended]);

  function speakTutorLine(text: string, overrideRate?: number) {
    cancelLipSyncRef.current?.();
    cancelLipSyncRef.current = speakTextWithLipSync(text, language, {
      rate: overrideRate ?? speechRate,
      voicePreference,
      onStart: () => setAvatarState('speaking'),
      onMouthLevel: (lvl) => setMouthLevel(lvl),
      onEnd: () => {
        setMouthLevel(0);
        setAvatarState('idle');
      },
    });
  }

  // Greet the learner immediately when the call connects
  useEffect(() => {
    const t = setTimeout(() => {
      speakTutorLine(scenario.openingLine);
    }, 320);

    return () => {
      clearTimeout(t);
      cancelLipSyncRef.current?.();
      recognizerRef.current?.abort();
      recorderRef.current?.abort();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const latestExchange = exchanges[exchanges.length - 1] ?? null;
  const quickHints = latestExchange?.coach.suggestedReplies ?? scenario.starterHints;

  const avgNaturalness = useMemo(() => {
    if (exchanges.length === 0) return 0;
    const sum = exchanges.reduce((acc, ex) => acc + ex.coach.naturalnessScore, 0);
    return Math.round(sum / exchanges.length);
  }, [exchanges]);

  async function submitUserUtterance(rawText: string) {
    const content = rawText.trim();
    if (!content || isThinking) return;

    setErrorMsg(null);
    setLiveDraft('');
    liveDraftRef.current = '';
    setShowHints(false);
    setIsThinking(true);
    setAvatarState('thinking');

    const history: Array<{ role: 'user' | 'assistant'; text: string }> = [
      { role: 'assistant', text: scenario.openingLine },
    ];
    for (const ex of exchanges) {
      history.push({ role: 'user', text: ex.userText });
      history.push({ role: 'assistant', text: ex.aiReplyText });
    }

    try {
      const res = await api.sendConversationTurn(scenario.id, content, history);
      const nextExchange: CallExchange = {
        id: `call-${Date.now()}`,
        userText: content,
        aiReplyText: res.replyText,
        aiReplyReading: res.replyReading,
        aiReplyTranslationPt: res.replyTranslationPt,
        coach: res.coach,
        providerUsed: res.providerUsed,
        modelUsed: res.modelUsed,
      };
      setExchanges((prev) => [...prev, nextExchange]);
      setCurrentAiLine({
        text: res.replyText,
        reading: res.replyReading,
        translationPt: res.replyTranslationPt,
      });

      if (res.coach.naturalnessScore >= 82) {
        void hapticSuccess();
        playCorrectSound(exchanges.length + 1);
        onPetHappinessChange?.(6);
      } else {
        onPetHappinessChange?.(3);
      }

      setIsThinking(false);
      speakTutorLine(res.replyText);
    } catch (err) {
      void hapticError();
      setIsThinking(false);
      setAvatarState('idle');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao responder agora. Tente novamente.');
    }
  }

  async function handleMicToggle() {
    if (isThinking || isProcessingSpeech) return;
    void hapticTap();

    // STOP RECORDING -> DRAIN WEB SPEECH + WHISPER RESCUE -> SEND TO LLAMA 3.3!
    if (isRecording) {
      setIsRecording(false);
      setMicVolume(0);
      setIsProcessingSpeech(true);
      setAvatarState('thinking');

      try {
        const [speechRes, clip] = await Promise.all([
          recognizerRef.current
            ? recognizerRef.current.stop()
            : Promise.resolve({ text: liveDraftRef.current, alternatives: [] }),
          recorderRef.current ? recorderRef.current.stop() : Promise.resolve(null),
        ]);
        recognizerRef.current = null;
        recorderRef.current = null;

        let finalText = speechRes.text.trim() || liveDraftRef.current.trim();

        // Always confirm via 24/7 Cloud Whisper when clip captured cleanly so short/paused words are NEVER missed
        if (clip && sttReadyRef.current) {
          const cloud = await api.transcribeAudio(language, clip.audioBase64, clip.mimeType);
          if (cloud.available && cloud.transcript.trim()) {
            const whisperLen = cloud.transcript.trim().split(/\s+/).length;
            const browserLen = finalText ? finalText.split(/\s+/).length : 0;
            if (!finalText || whisperLen >= browserLen) {
              finalText = cloud.transcript.trim();
            }
          }
        }

        setIsProcessingSpeech(false);
        if (!finalText) {
          setAvatarState('idle');
          setErrorMsg('Não captamos sua voz — chegue um pouco mais perto do microfone ou use o teclado abaixo.');
          return;
        }
        await submitUserUtterance(finalText);
      } catch {
        setIsProcessingSpeech(false);
        setAvatarState('idle');
        setErrorMsg('Falha rápida na captura de áudio — tente falar de novo.');
      }
      return;
    }

    // START RECORDING -> Immediately silence tutor so ZERO speaker echo enters the mic!
    cancelLipSyncRef.current?.();
    stopSpeaking();
    setMouthLevel(0);
    setErrorMsg(null);
    setLiveDraft('');
    liveDraftRef.current = '';

    const canWebSpeech = isSpeechRecognitionSupported();
    const canRecorder = isAudioRecorderSupported();
    if (!canWebSpeech && !canRecorder) {
      setShowKeyboard(true);
      setErrorMsg('Microfone indisponível neste navegador — digite sua fala abaixo.');
      return;
    }

    if (canWebSpeech) {
      const rec = createSpeechRecognizer(language, {
        onTranscript: (text) => {
          liveDraftRef.current = text;
          setLiveDraft(text);
        },
        onError: (msg) => {
          if (!canRecorder || !sttReadyRef.current) setErrorMsg(msg);
        },
        onEnd: () => {},
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
        recorderRef.current = recorder;
        const ok = await recorder.start();
        if (!ok && !recognizerRef.current) {
          recorderRef.current = null;
          setErrorMsg('Permissão de microfone bloqueada. Libere o microfone ou use o teclado.');
          return;
        }
      }
    }

    setIsRecording(true);
    setAvatarState('listening');
  }

  function handleEndCall() {
    playTapSound();
    cancelLipSyncRef.current?.();
    recognizerRef.current?.abort();
    recorderRef.current?.abort();
    stopSpeaking();
    setIsRecording(false);
    setMouthLevel(0);
    setAvatarState('happy');
    if (exchanges.length > 0) {
      void hapticSuccess();
      playVictoryFanfare();
      onPetHappinessChange?.(10);
      setEnded(true);
    } else {
      onExit();
    }
  }

  function cycleSpeed() {
    playTapSound();
    setSpeechRate((prev) => (prev <= 0.84 ? 0.95 : prev <= 1.0 ? 1.08 : 0.8));
  }

  const speedLabel = speechRate <= 0.84 ? '🐢 0.8x' : speechRate <= 1.0 ? '1.0x' : '⚡ 1.1x';

  // ==================== BOLETIM FINAL DA LIGAÇÃO ====================
  if (ended) {
    const xpEarned = exchanges.length * 12;
    return (
      <div className="max-w-2xl mx-auto py-4 pb-12 space-y-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="duo-card p-6 text-center space-y-5 relative overflow-visible"
        >
          <ConfettiBurst active />
          <div className="flex justify-center">
            <TutorAvatar
              tutorId={tutorId}
              pet={pet}
              state="happy"
              mouthLevel={0}
              size={132}
            />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-xs font-extrabold uppercase tracking-wider text-[#7a5200]">
              <Trophy size={15} weight="fill" /> Boletim da Ligação · Nível {scenario.cefr}
            </div>
            <h2 className="font-display text-3xl text-[var(--na-ink)] mt-2">
              Ótima conversa com {tutorDisplayName}! 🎉
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[var(--na-muted)] mt-1">
              Cada ligação destrava sua fala real. Veja abaixo os ajustes nítidos para soar ainda mais nativo:
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)]">
              <div className="text-[11px] font-extrabold uppercase text-[var(--na-teal-dark)]">Duração</div>
              <div className="text-xl font-extrabold text-[var(--na-teal-dark)] mt-0.5">
                {formatTimer(callSeconds)}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--na-success-soft)] border-2 border-[var(--na-success)]">
              <div className="text-[11px] font-extrabold uppercase text-[var(--na-success-dark)]">Naturalidade</div>
              <div className="text-xl font-extrabold text-[var(--na-success-dark)] mt-0.5">
                {avgNaturalness}%
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)]">
              <div className="text-[11px] font-extrabold uppercase text-[#8a6010]">Peças 🧩</div>
              <div className="text-xl font-extrabold text-[#7a5200] mt-0.5">+{xpEarned}</div>
            </div>
          </div>

          {/* QUADRO NÍTIDO DE MELHORIAS POR TURNO FALADO */}
          <div className="text-left space-y-3 max-h-[380px] overflow-y-auto pr-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
              🔎 Análise de cada frase que você falou ({exchanges.length} turno{exchanges.length > 1 ? 's' : ''}):
            </div>
            {exchanges.map((ex, i) => {
              const targetSuggestion =
                ex.coach.correctedVersion &&
                normalizeCmp(ex.coach.correctedVersion) !== normalizeCmp(ex.userText)
                  ? ex.coach.correctedVersion
                  : ex.coach.nativeAlternative;
              const hasDiff = normalizeCmp(targetSuggestion) !== normalizeCmp(ex.userText);
              const diff = hasDiff
                ? diffTokenSequences(
                    ex.userText.split(/\s+/).filter(Boolean),
                    targetSuggestion.split(/\s+/).filter(Boolean),
                  )
                : null;

              return (
                <div
                  key={ex.id}
                  className="p-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-[var(--na-ink)]">Turno {i + 1}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-extrabold ${
                        ex.coach.naturalnessScore >= 80
                          ? 'bg-[var(--na-success-soft)] text-[var(--na-success-dark)]'
                          : 'bg-[var(--na-gold-soft)] text-[#7a5200]'
                      }`}
                    >
                      Naturalidade {ex.coach.naturalnessScore}%
                    </span>
                  </div>

                  {hasDiff && diff ? (
                    <>
                      <div className="p-2.5 rounded-xl bg-[var(--na-error-soft)]/70 border border-[var(--na-error)]/30 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase text-[var(--na-error-dark)]">
                          ❌ O que você falou:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {diff
                            .filter((d) => d.actual)
                            .map((d, idx) => (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  d.kind === 'match'
                                    ? 'text-[var(--na-ink)] bg-white/80'
                                    : 'bg-[var(--na-error)] text-white line-through'
                                }`}
                              >
                                {d.actual}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[var(--na-success-soft)]/80 border border-[var(--na-success)]/40 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase text-[var(--na-success-dark)]">
                            ✅ Forma certa / mais nativa:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => speakText(targetSuggestion, language, 0.92)}
                              className="px-2 py-0.5 rounded-lg bg-[var(--na-success)] text-white text-[10px] font-extrabold inline-flex items-center gap-1"
                            >
                              <SpeakerHigh size={12} weight="fill" /> Ouvir
                            </button>
                            <button
                              type="button"
                              onClick={() => speakText(targetSuggestion, language, 0.68)}
                              className="px-2 py-0.5 rounded-lg bg-white border border-[var(--na-success)] text-[var(--na-success-dark)] text-[10px] font-extrabold"
                            >
                              🐢
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {diff
                            .filter((d) => d.expected)
                            .map((d, idx) => (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 rounded font-extrabold ${
                                  d.kind === 'match'
                                    ? 'text-[var(--na-success-dark)] bg-white/80'
                                    : 'bg-[var(--na-success)] text-white'
                                }`}
                              >
                                {d.expected}
                              </span>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[var(--na-success-soft)] border border-[var(--na-success)] font-extrabold text-[var(--na-success-dark)]">
                      ✅ Você falou perfeitamente: "{ex.userText}"
                    </div>
                  )}

                  <div className="text-[var(--na-ink)]/85 font-semibold leading-relaxed">
                    💡 {ex.coach.explanationPt}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setExchanges([]);
                setCallSeconds(0);
                setEnded(false);
                setCurrentAiLine({
                  text: scenario.openingLine,
                  reading: scenario.openingReading,
                  translationPt: scenario.openingTranslationPt,
                });
                speakTutorLine(scenario.openingLine);
              }}
              className="duo-btn-teal text-xs uppercase tracking-wide flex items-center justify-center gap-1.5"
            >
              <ArrowCounterClockwise size={17} weight="bold" />
              Ligar de Novo
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                onExit();
              }}
              className="duo-btn-emerald text-xs uppercase tracking-wide"
            >
              Voltar aos Cenários
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==================== TELA DE VIDEOCHAMADA AO VIVO ====================
  const statusBadge = isProcessingSpeech
    ? '✨ Conferindo sua fala (Whisper HD)...'
    : isThinking
      ? `💭 ${tutorDisplayName} está pensando...`
      : isRecording
        ? '🎙️ Ouvindo você... toque no botão vermelho para enviar'
        : avatarState === 'speaking'
          ? `🔊 ${tutorDisplayName} está falando...`
          : `🟢 Em chamada · Toque no microfone para responder`;

  return (
    <div className="max-w-xl mx-auto flex flex-col min-h-[calc(100dvh-150px)] md:min-h-[calc(100dvh-105px)] justify-between gap-3 pb-4">
      {/* BARRA SUPERIOR DA CHAMADA */}
      <div className="flex items-center justify-between gap-2 bg-white border-2 border-[var(--na-border)] rounded-2xl px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleEndCall}
            aria-label="Sair da chamada"
            className="w-9 h-9 rounded-xl bg-[var(--na-cream)] border border-[var(--na-border)] flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={17} weight="bold" />
          </button>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[var(--na-ink)] truncate">
              {scenario.titlePt}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--na-muted)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--na-success)] animate-pulse" />
              <span>{formatTimer(callSeconds)}</span>
              <span>·</span>
              <span className="text-[var(--na-burgundy)]">Nível {scenario.cefr}</span>
              <span>·</span>
              <span>{exchanges.length} turno{exchanges.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            title="Velocidade da voz do tutor"
            className="px-2.5 py-1.5 rounded-xl bg-[var(--na-cream)] border border-[var(--na-border)] text-[11px] font-extrabold text-[var(--na-ink)]"
          >
            {speedLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setShowCaptions((v) => !v);
            }}
            title={showCaptions ? 'Esconder legenda (Treino de Ouvido)' : 'Mostrar legenda'}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              showCaptions
                ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                : 'bg-[var(--na-gold-soft)] border-[var(--na-gold)] text-[#7a5200]'
            }`}
          >
            {showCaptions ? <Eye size={17} weight="bold" /> : <EyeSlash size={17} weight="bold" />}
          </button>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setShowTranslation((v) => !v);
            }}
            title="Mostrar/ocultar tradução em português"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              showTranslation
                ? 'bg-[var(--na-rose-soft)] border-[var(--na-burgundy)]/40 text-[var(--na-burgundy)]'
                : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
            }`}
          >
            <Translate size={17} weight="bold" />
          </button>
        </div>
      </div>

      {/* PALCO CENTRAL: TUTOR AVATAR EM VIDEOCHAMADA + BALÃO DE FALA */}
      <div className="flex-1 duo-card p-5 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-white via-[var(--na-cream)]/60 to-[var(--na-sand)]/50 relative overflow-hidden">
        <div className="px-3.5 py-1 rounded-full bg-white border-2 border-[var(--na-border)] text-[11px] font-extrabold text-[var(--na-ink)] shadow-2xs">
          {statusBadge}
        </div>

        <TutorAvatar
          tutorId={tutorId}
          pet={pet}
          state={avatarState}
          mouthLevel={mouthLevel}
          micVolume={micVolume}
          size={196}
        />

        <div className="text-center">
          <div className="font-display text-xl text-[var(--na-ink)] leading-tight">
            {tutorDisplayName}
          </div>
          <div className="text-[11px] font-bold text-[var(--na-teal-dark)]">
            {scenario.aiRoleTitlePt} · Llama 3.3 24/7
          </div>
        </div>

        {/* LEGENDA DA FALA DO TUTOR (OCULTÁVEL PARA TREINO DE OUVIDO!) */}
        <div className="w-full max-w-md">
          {showCaptions ? (
            <div className="p-4 rounded-2xl bg-white border-2 border-[var(--na-border)] shadow-xs space-y-1.5 text-center">
              <div className="text-base sm:text-lg font-extrabold text-[var(--na-ink)] leading-snug">
                "{currentAiLine.text}"
              </div>
              {currentAiLine.reading && (
                <div className="font-mono-code text-xs font-bold text-[var(--na-teal)]">
                  {currentAiLine.reading}
                </div>
              )}
              {showTranslation && (
                <div className="text-xs font-semibold text-[var(--na-muted)] pt-1 border-t border-[var(--na-border)]">
                  🇧🇷 {currentAiLine.translationPt}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCaptions(true)}
              className="w-full p-3.5 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-dashed border-[var(--na-gold-dark)] text-xs font-extrabold text-[#5a3b00] text-center"
            >
              🙈 Modo Treino de Ouvido ativo — toque aqui se quiser revelar o texto
            </button>
          )}
        </div>

        {/* DICA DISCRETA DO COACH SEM INTERROMPER A LIGAÇÃO */}
        {latestExchange && (
          <div className="w-full max-w-md p-3 rounded-2xl bg-[var(--na-success-soft)]/75 border border-[var(--na-success)]/50 text-xs space-y-1">
            <div className="flex items-center justify-between font-extrabold text-[var(--na-success-dark)]">
              <span className="inline-flex items-center gap-1">
                <Sparkle size={13} weight="fill" /> Naturalidade: {latestExchange.coach.naturalnessScore}%
              </span>
              <button
                type="button"
                onClick={() => speakText(latestExchange.coach.nativeAlternative, language, 0.9)}
                className="text-[11px] underline inline-flex items-center gap-1"
              >
                <SpeakerHigh size={12} weight="fill" /> Ouvir jeito nativo
              </button>
            </div>
            <div className="font-bold text-[var(--na-ink)]">
              💡 Nativo diria: "{latestExchange.coach.nativeAlternative}"
            </div>
          </div>
        )}

        {/* TRANSCRIÇÃO AO VIVO DO QUE O ALUNO ESTÁ FALANDO */}
        {(isRecording || liveDraft) && (
          <div className="w-full max-w-md p-3 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] text-xs space-y-1.5">
            <div className="flex items-center justify-between font-extrabold text-[var(--na-teal-dark)]">
              <span>🎙️ Você falando:</span>
              {isRecording && (
                <div className="w-24 h-2 rounded-full bg-white overflow-hidden">
                  <div
                    className="h-full bg-[var(--na-success)] transition-all duration-75"
                    style={{ width: `${Math.max(10, Math.round(micVolume * 100))}%` }}
                  />
                </div>
              )}
            </div>
            <div className="font-bold text-sm text-[var(--na-ink)]">
              {liveDraft || 'Pode falar normal ou pausado palavra por palavra...'}
            </div>
          </div>
        )}
      </div>

      {/* AJUDA RÁPIDA SE TRAVAR */}
      {showHints && quickHints.length > 0 && (
        <div className="p-3 rounded-2xl bg-white border-2 border-[var(--na-gold)] space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7a5200] flex items-center gap-1">
            <Lightbulb size={14} weight="fill" /> Ideias prontas para destravar (toque para enviar ou leia em voz alta):
          </div>
          <div className="flex flex-col gap-1.5">
            {quickHints.map((h, i) => (
              <button
                key={i}
                type="button"
                disabled={isThinking || isRecording}
                onClick={() => void submitUserUtterance(h.text)}
                className="p-2.5 rounded-xl bg-[var(--na-cream)] border border-[var(--na-border)] hover:border-[var(--na-burgundy)] text-left"
              >
                <div className="text-xs font-extrabold text-[var(--na-ink)]">{h.text}</div>
                <div className="text-[11px] font-semibold text-[var(--na-muted)]">{h.translationPt}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TECLADO OPCIONAL (PARA QUANDO NÃO PUDER FALAR) */}
      {showKeyboard && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitUserUtterance(liveDraft);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={liveDraft}
            onChange={(e) => {
              liveDraftRef.current = e.target.value;
              setLiveDraft(e.target.value);
            }}
            placeholder={`Digite em ${langMeta.nativeName}...`}
            className="flex-1 min-h-[46px] px-4 rounded-2xl bg-white border-2 border-[var(--na-border)] text-sm font-semibold"
          />
          <button
            type="submit"
            disabled={isThinking || !liveDraft.trim()}
            className="w-12 h-12 rounded-2xl bg-[var(--na-burgundy)] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <PaperPlaneTilt size={20} weight="fill" />
          </button>
        </form>
      )}

      {errorMsg && (
        <div className="text-xs font-bold text-[var(--na-error-dark)] bg-[var(--na-error-soft)] border border-[var(--na-error)] px-3.5 py-2.5 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* CONTROLES DE VIDEOCHAMADA (ZONA DO POLEGAR) */}
      <div className="bg-white border-2 border-[var(--na-border)] rounded-3xl px-4 py-3 flex items-center justify-between gap-2 safe-bottom">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRecording}
            onClick={() => {
              playTapSound();
              speakTutorLine(currentAiLine.text);
            }}
            title="Ouvir novamente"
            className="w-12 h-12 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-[var(--na-teal-dark)] flex items-center justify-center active:scale-95"
          >
            <SpeakerHigh size={22} weight="fill" />
          </button>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setShowHints((v) => !v);
            }}
            title="Ver ideias se travar"
            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center active:scale-95 ${
              showHints
                ? 'bg-[var(--na-gold)] border-[var(--na-gold-dark)] text-[#4a2e00]'
                : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[#8a6010]'
            }`}
          >
            <Lightbulb size={22} weight="fill" />
          </button>
        </div>

        {/* BOTÃO CENTRAL GIGANTE: FALAR / ENVIAR */}
        <button
          type="button"
          disabled={isThinking || isProcessingSpeech}
          onClick={() => void handleMicToggle()}
          aria-label={isRecording ? 'Enviar fala' : 'Falar na chamada'}
          className={`min-w-[116px] h-16 px-5 rounded-full border-4 border-b-[6px] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:translate-y-[2px] ${
            isRecording
              ? 'bg-[var(--na-error)] border-[var(--na-error-dark)] text-white scale-105'
              : isThinking || isProcessingSpeech
                ? 'bg-[var(--na-gold)] border-[var(--na-gold-dark)] text-[#4a2e00] animate-pulse'
                : 'bg-[var(--na-teal)] border-[var(--na-teal-dark)] text-white'
          }`}
        >
          {isRecording ? (
            <>
              <StopCircle size={26} weight="fill" />
              <span>Enviar</span>
            </>
          ) : (
            <>
              <Microphone size={26} weight="fill" />
              <span>{isProcessingSpeech ? 'Ouvindo' : isThinking ? '...' : 'Falar'}</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setShowKeyboard((v) => !v);
            }}
            title="Digitar em vez de falar"
            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center active:scale-95 ${
              showKeyboard
                ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
            }`}
          >
            <Keyboard size={22} weight="bold" />
          </button>
          <button
            type="button"
            onClick={handleEndCall}
            title="Encerrar chamada e ver Boletim"
            className="w-12 h-12 rounded-2xl bg-[var(--na-error)] border-2 border-[var(--na-error-dark)] text-white flex items-center justify-center active:scale-95"
          >
            <PhoneDisconnect size={22} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
