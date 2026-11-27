import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ChatCircleDots,
  Lightbulb,
  Microphone,
  PaperPlaneTilt,
  SpeakerHigh,
  Sparkle,
  StopCircle,
  VideoCamera,
} from '@phosphor-icons/react';
import {
  LANGUAGES,
  type CoachFeedback,
  type ConversationScenario,
  type LanguageCode,
} from '@naidioma/shared';
import { api } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { playTapSound } from '../lib/sound';
import {
  createAudioRecorder,
  createSpeechRecognizer,
  isAudioRecorderSupported,
  isSpeechRecognitionSupported,
  speakText,
  type AudioRecorderHandle,
  type SpeechRecognizerHandle,
} from '../lib/speech';
import { LiveCallView } from './LiveCallView';
import { InteractiveCast } from './Mascots';
import type { PetProfile } from './PetBuddy';
import { TUTOR_PROFILES, TutorAvatar, type TutorId } from './TutorAvatar';

interface ConversationViewProps {
  language: LanguageCode;
  scenarios: ConversationScenario[];
  pet: PetProfile;
  onPetHappinessChange?: (delta: number) => void;
}

interface ChatTurn {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  reading?: string;
  translationPt?: string;
  coach?: CoachFeedback;
  providerUsed?: string;
}

export function ConversationView({
  language,
  scenarios,
  pet,
  onPetHappinessChange,
}: ConversationViewProps) {
  const langMeta = LANGUAGES[language];
  const [practiceMode, setPracticeMode] = useState<'call' | 'chat'>('call');
  const [selectedTutor, setSelectedTutor] = useState<TutorId>('maya');
  const [activeScenario, setActiveScenario] = useState<ConversationScenario | null>(null);
  const [activeMode, setActiveMode] = useState<'call' | 'chat'>('call');
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [quotaLeft, setQuotaLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
  const audioRecorderRef = useRef<AudioRecorderHandle | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveScenario(null);
    setMessages([]);
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  function startScenario(scenario: ConversationScenario, mode: 'call' | 'chat' = practiceMode) {
    void hapticTap();
    playTapSound();
    setActiveMode(mode);
    setActiveScenario(scenario);
    setError(null);
    if (mode === 'chat') {
      setMessages([
        {
          id: 'opening',
          role: 'assistant',
          text: scenario.openingLine,
          reading: scenario.openingReading,
          translationPt: scenario.openingTranslationPt,
        },
      ]);
      speakText(scenario.openingLine, language, 0.95);
    }
  }

  async function sendTurn(textToSend?: string) {
    const content = (textToSend ?? draft).trim();
    if (!activeScenario || !content || sending) return;

    void hapticTap();
    setError(null);
    setDraft('');
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: content,
    };

    const nextHistory = [...messages, userTurn];
    setMessages(nextHistory);
    setSending(true);

    try {
      const res = await api.sendConversationTurn(
        activeScenario.id,
        content,
        messages.map((m) => ({ role: m.role, text: m.text })),
      );
      void hapticSuccess();
      setQuotaLeft(res.dailyQuotaRemaining);
      const aiTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.replyText,
        reading: res.replyReading,
        translationPt: res.replyTranslationPt,
        coach: res.coach,
        providerUsed: res.providerUsed,
      };
      setMessages((prev) => [...prev, aiTurn]);
      speakText(res.replyText, language, 0.95);
    } catch (err) {
      void hapticError();
      setError(err instanceof Error ? err.message : 'Erro ao conversar com o tutor IA.');
    } finally {
      setSending(false);
    }
  }

  async function toggleVoiceCapture() {
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const [speechRes, clip] = await Promise.all([
          recognizerRef.current ? recognizerRef.current.stop() : Promise.resolve({ text: '', alternatives: [] }),
          audioRecorderRef.current ? audioRecorderRef.current.stop() : Promise.resolve(null),
        ]);
        recognizerRef.current = null;
        audioRecorderRef.current = null;

        let finalText = speechRes.text.trim();
        if (clip && (!finalText || finalText.split(/\s+/).length < 2)) {
          const cloud = await api.transcribeAudio(language, clip.audioBase64, clip.mimeType);
          if (cloud.available && cloud.transcript.trim()) {
            finalText = cloud.transcript.trim();
          }
        }
        if (finalText) setDraft(finalText);
      } finally {
        setTranscribing(false);
      }
      return;
    }

    const canWebSpeech = isSpeechRecognitionSupported();
    const canRecorder = isAudioRecorderSupported();
    if (!canWebSpeech && !canRecorder) {
      setError('Reconhecimento de voz não suportado neste navegador. Digite sua resposta abaixo.');
      return;
    }

    setError(null);
    if (canWebSpeech) {
      const rec = createSpeechRecognizer(language, {
        onTranscript: (text) => {
          if (text.trim()) setDraft(text);
        },
        onError: (msg) => {
          if (!canRecorder) setError(msg);
        },
        onEnd: () => {},
      });
      if (rec) {
        recognizerRef.current = rec;
        rec.start();
      }
    }

    if (canRecorder) {
      const recorder = createAudioRecorder();
      if (recorder) {
        audioRecorderRef.current = recorder;
        await recorder.start();
      }
    }

    setRecording(true);
  }

  if (activeScenario && activeMode === 'call') {
    return (
      <LiveCallView
        language={language}
        scenario={activeScenario}
        tutorId={selectedTutor}
        pet={pet}
        onExit={() => setActiveScenario(null)}
        onPetHappinessChange={onPetHappinessChange}
      />
    );
  }

  if (!activeScenario) {
    const tutorChoices: Array<{ id: TutorId; name: string; sub: string }> = [
      { id: 'maya', name: TUTOR_PROFILES.maya.name, sub: TUTOR_PROFILES.maya.accentPt },
      { id: 'oliver', name: TUTOR_PROFILES.oliver.name, sub: TUTOR_PROFILES.oliver.accentPt },
      { id: 'pet', name: pet.name, sub: 'Seu bichinho' },
    ];

    return (
      <div className="max-w-3xl mx-auto space-y-5 pb-8">
        <div className="rounded-[24px] bg-[var(--na-burgundy)] text-white p-5 border-2 border-[var(--na-wine-deep)] border-b-[6px] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#ffd7e5]">
              Prática Real por Voz · Llama 3.3 + Whisper 24/7 · {langMeta.namePt}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl leading-tight">
              Converse cara a cara com seu Tutor IA!
            </h1>
            <p className="text-xs sm:text-sm text-white/90 font-semibold max-w-xl">
              Escolha entre <strong>Chamada ao Vivo com Avatar</strong> (estilo ligação com boca sincronizada e boletim de erros) ou <strong>Chat Guiado</strong>!
            </p>
          </div>
          <InteractiveCast character="leo" size={86} customPhrase="Vamos conversar juntos! 🎙️" />
        </div>

        {/* SELETOR DOS DOIS MODOS (CHAMADA AO VIVO vs CHAT GUIADO) */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setPracticeMode('call');
            }}
            className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 border-b-[5px] text-left flex items-center gap-3 transition-all ${
              practiceMode === 'call'
                ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                : 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
            }`}
          >
            <span className="w-10 h-10 rounded-xl bg-[var(--na-teal)] text-white flex items-center justify-center shrink-0">
              <VideoCamera size={22} weight="fill" />
            </span>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold leading-tight">Chamada ao Vivo</div>
              <div className="text-[11px] font-semibold opacity-80 truncate">Avatar + Lip-Sync + Boletim</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              playTapSound();
              setPracticeMode('chat');
            }}
            className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 border-b-[5px] text-left flex items-center gap-3 transition-all ${
              practiceMode === 'chat'
                ? 'bg-[var(--na-rose-soft)] border-[var(--na-burgundy)] text-[var(--na-burgundy)]'
                : 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
            }`}
          >
            <span className="w-10 h-10 rounded-xl bg-[var(--na-burgundy)] text-white flex items-center justify-center shrink-0">
              <ChatCircleDots size={22} weight="fill" />
            </span>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold leading-tight">Chat Guiado</div>
              <div className="text-[11px] font-semibold opacity-80 truncate">Mensagens + Dicas ao vivo</div>
            </div>
          </button>
        </div>

        {/* ESCOLHA DO TUTOR AVATAR (QUANDO NO MODO CHAMADA AO VIVO) */}
        {practiceMode === 'call' && (
          <div className="duo-card p-4 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
              Escolha quem vai conversar com você na ligação:
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {tutorChoices.map((t) => {
                const selected = selectedTutor === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setSelectedTutor(t.id);
                    }}
                    className={`p-3 rounded-2xl border-2 border-b-4 flex flex-col items-center gap-1.5 text-center transition-all ${
                      selected
                        ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                        : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-ink)]'
                    }`}
                  >
                    <TutorAvatar tutorId={t.id} pet={pet} state="idle" mouthLevel={0} size={62} />
                    <div className="text-xs font-extrabold leading-tight">{t.name}</div>
                    <div className="text-[10px] font-semibold opacity-80 leading-tight">{t.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((sc) => (
            <motion.div
              key={sc.id}
              whileHover={{ y: -2 }}
              className="surface-card p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-code text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--na-sand)] text-[var(--na-burgundy)]">
                    Nível {sc.cefr}
                  </span>
                  <span className="text-xs font-semibold text-[var(--na-teal)]">
                    Com {sc.aiRoleName} ({sc.aiRoleTitlePt})
                  </span>
                </div>
                <h2 className="font-display text-2xl text-[var(--na-ink)]">{sc.titlePt}</h2>
                <p className="text-sm text-[var(--na-muted)] leading-relaxed">{sc.situationPt}</p>
                <ul className="space-y-1 pt-1">
                  {sc.missionGoalsPt.map((goal, idx) => (
                    <li key={idx} className="text-xs text-[var(--na-ink)] flex items-start gap-2">
                      <span className="text-[var(--na-burgundy)] font-bold">•</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startScenario(sc, practiceMode)}
                  className="btn-tactile-primary flex-1 text-sm flex items-center justify-center gap-2"
                >
                  {practiceMode === 'call' ? (
                    <>
                      <VideoCamera size={18} weight="fill" />
                      Ligar ao vivo agora
                    </>
                  ) : (
                    <>
                      <ChatCircleDots size={18} weight="fill" />
                      Abrir chat agora
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => startScenario(sc, practiceMode === 'call' ? 'chat' : 'call')}
                  title={practiceMode === 'call' ? 'Abrir como Chat' : 'Abrir como Chamada ao Vivo'}
                  className="min-h-[48px] px-3 rounded-[14px] bg-[var(--na-cream)] border-2 border-[var(--na-border)] text-[var(--na-ink)] flex items-center justify-center shrink-0"
                >
                  {practiceMode === 'call' ? (
                    <ChatCircleDots size={19} weight="bold" />
                  ) : (
                    <VideoCamera size={19} weight="bold" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  const latestCoach = [...messages].reverse().find((m) => m.coach)?.coach;
  const quickHints = latestCoach?.suggestedReplies ?? activeScenario.starterHints;

  return (
    <div className="flex flex-col h-[calc(100dvh-150px)] md:h-[calc(100dvh-110px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="surface-card p-3.5 mb-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveScenario(null)}
            className="w-10 h-10 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] flex items-center justify-center shrink-0"
            aria-label="Voltar aos cenários"
          >
            <ArrowLeft size={18} weight="bold" />
          </button>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{activeScenario.titlePt}</div>
            <div className="text-xs text-[var(--na-muted)] truncate">
              {activeScenario.aiRoleName} · {activeScenario.aiRoleTitlePt}
            </div>
          </div>
        </div>
        {quotaLeft !== null && (
          <span className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded-full bg-[var(--na-sand)] text-[var(--na-burgundy)] shrink-0">
            {quotaLeft} turnos hoje
          </span>
        )}
      </div>

      {/* Chat Stream */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-[16px] p-4 ${
                msg.role === 'user'
                  ? 'bg-[var(--na-wine)] text-[var(--na-ivory)]'
                  : 'surface-card text-[var(--na-ink)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[15px] font-semibold leading-snug">{msg.text}</div>
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => speakText(msg.text, language, 0.92)}
                    className="text-[var(--na-teal)] shrink-0 p-1"
                    aria-label="Ouvir fala"
                  >
                    <SpeakerHigh size={18} weight="fill" />
                  </button>
                )}
              </div>
              {msg.reading && (
                <div className="font-mono-code text-xs text-[var(--na-teal)] mt-1">
                  {msg.reading}
                </div>
              )}
              {msg.translationPt && (
                <div className="text-xs text-[var(--na-muted)] mt-1.5 pt-1.5 border-t border-[var(--na-border)]">
                  {msg.translationPt}
                </div>
              )}
            </div>

            {/* Coach Feedback Card */}
            {msg.coach && (
              <div className="max-w-[88%] mt-2 p-3.5 rounded-[14px] bg-[var(--na-sand)]/80 border border-[var(--na-sand-dark)] text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--na-burgundy)] inline-flex items-center gap-1">
                    <Sparkle size={14} weight="fill" /> Coach NAidioma · Naturalidade{' '}
                    {msg.coach.naturalnessScore}%
                  </span>
                  {msg.providerUsed && (
                    <span className="font-mono-code text-[10px] text-[var(--na-muted)]">
                      {msg.providerUsed}
                    </span>
                  )}
                </div>
                <div className="text-[var(--na-ink)]">
                  <strong>Como nativos diriam:</strong> {msg.coach.nativeAlternative}
                </div>
                <div className="text-[var(--na-muted)] leading-relaxed">
                  {msg.coach.explanationPt}
                </div>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="text-xs font-semibold text-[var(--na-teal)] px-2">
            {activeScenario.aiRoleName} está respondendo...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Reply Hints if user freezes */}
      {quickHints.length > 0 && (
        <div className="pt-2.5 pb-1 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-bold text-[var(--na-teal)] inline-flex items-center gap-1 shrink-0">
            <Lightbulb size={14} weight="fill" /> Sugestão:
          </span>
          {quickHints.map((hint, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendTurn(hint.text)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-[var(--na-ivory)] border border-[var(--na-border)] hover:border-[var(--na-burgundy)] text-[var(--na-ink)]"
              title={hint.translationPt}
            >
              {hint.text}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-xs text-[var(--na-error)] bg-[var(--na-error-soft)] px-3 py-2 rounded-[10px] mt-1">
          {error}
        </div>
      )}

      {/* Thumb-Zone Voice + Text Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendTurn();
        }}
        className="pt-2 flex items-center gap-2 shrink-0"
      >
        <button
          type="button"
          disabled={transcribing}
          onClick={() => void toggleVoiceCapture()}
          aria-label={recording ? 'Parar microfone' : 'Falar no microfone'}
          className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 transition-all ${
            recording
              ? 'bg-[var(--na-error)] text-white animate-pulse'
              : 'bg-[var(--na-teal)] text-white'
          }`}
        >
          {recording ? <StopCircle size={22} weight="fill" /> : <Microphone size={22} weight="fill" />}
        </button>

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            transcribing
              ? 'Transcrevendo sua fala com precisão...'
              : `Responda em ${langMeta.nativeName}...`
          }
          className="flex-1 min-h-[48px] px-4 rounded-[14px] bg-[var(--na-ivory)] border border-[var(--na-border)] text-sm text-[var(--na-ink)]"
        />

        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Enviar resposta"
          className="w-12 h-12 rounded-[14px] bg-[var(--na-burgundy)] text-[var(--na-ivory)] flex items-center justify-center shrink-0 disabled:opacity-40"
        >
          <PaperPlaneTilt size={20} weight="fill" />
        </button>
      </form>
    </div>
  );
}
