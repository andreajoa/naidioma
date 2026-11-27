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
} from '@phosphor-icons/react';
import {
  LANGUAGES,
  type CoachFeedback,
  type ConversationScenario,
  type LanguageCode,
} from '@naidioma/shared';
import { api } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { createSpeechRecognizer, isSpeechRecognitionSupported, speakText } from '../lib/speech';
import { InteractiveCast } from './Mascots';

interface ConversationViewProps {
  language: LanguageCode;
  scenarios: ConversationScenario[];
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

export function ConversationView({ language, scenarios }: ConversationViewProps) {
  const langMeta = LANGUAGES[language];
  const [activeScenario, setActiveScenario] = useState<ConversationScenario | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quotaLeft, setQuotaLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveScenario(null);
    setMessages([]);
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  function startScenario(scenario: ConversationScenario) {
    void hapticTap();
    setActiveScenario(scenario);
    setError(null);
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

  function toggleVoiceCapture() {
    if (recording) {
      recognizerRef.current?.stop();
      setRecording(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setError('Reconhecimento de voz não suportado neste navegador. Digite sua resposta abaixo.');
      return;
    }

    setError(null);
    const rec = createSpeechRecognizer(language, {
      onTranscript: (text) => setDraft(text),
      onError: (msg) => {
        setError(msg);
        setRecording(false);
      },
      onEnd: () => setRecording(false),
    });

    if (!rec) return;
    recognizerRef.current = rec;
    setRecording(true);
    rec.start();
  }

  if (!activeScenario) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 pb-8">
        <div className="rounded-[24px] bg-[var(--na-burgundy)] text-white p-5 border-2 border-[var(--na-wine-deep)] border-b-[6px] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#ffd7e5]">
              Bate-Papo por Voz IA · {langMeta.namePt}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl leading-tight">
              Converse sem vergonha com nossos personagens!
            </h1>
            <p className="text-xs sm:text-sm text-white/90 font-semibold max-w-xl">
              Toque em uma história, fale no microfone (ou toque nas sugestões prontas) e ouça a resposta!
            </p>
          </div>
          <InteractiveCast character="leo" size={86} customPhrase="Vamos conversar juntos! 🎙️" />
        </div>

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

              <button
                type="button"
                onClick={() => startScenario(sc)}
                className="btn-tactile-primary w-full text-sm flex items-center justify-center gap-2"
              >
                <ChatCircleDots size={18} weight="fill" />
                Iniciar simulação agora
              </button>
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
          onClick={toggleVoiceCapture}
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
          placeholder={`Responda em ${langMeta.nativeName}...`}
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
