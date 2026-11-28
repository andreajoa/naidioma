import { useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  EnvelopeSimple,
  LockSimple,
  MapPin,
  User,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { LANGUAGES, type LanguageCode } from '@naidioma/shared';
import { api, type UserProfile } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { usePwaInstall } from '../lib/pwaInstall';
import { playCorrectSound, playGentleRetrySound, playTapSound } from '../lib/sound';
import { speakText } from '../lib/speech';
import {
  detectClientPlatform,
  getClientTimezone,
  getVisitorId,
  trackTelemetryEvent,
} from '../lib/telemetry';
import { FlagSvg, HeroAutismScene } from './HeroAutismScene';
import { LANGUAGE_FLAGS, PuzzleMascot } from './Mascots';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
}

type AuthStep = 'welcome' | 'language' | 'register' | 'login';

const ORDERED_LANGUAGES: LanguageCode[] = ['en', 'ko', 'es', 'fr', 'de', 'it', 'ja', 'zh'];

const GREETING_BY_LANG: Record<LanguageCode, string> = {
  ko: '안녕하세요!',
  en: 'Hello!',
  ja: 'こんにちは!',
  es: '¡Hola!',
  fr: 'Bonjour!',
  de: 'Hallo!',
  it: 'Ciao!',
  zh: '你好!',
};

function readUrlMarketingParams(): { leadSource: string; utmCampaign?: string } {
  if (typeof window === 'undefined') return { leadSource: 'nucleoafetar' };
  const params = new URLSearchParams(window.location.search);
  const src = params.get('utm_source') || params.get('ref') || 'nucleoafetar';
  const campaign = params.get('utm_campaign') || undefined;
  return { leadSource: src.slice(0, 60), utmCampaign: campaign?.slice(0, 100) };
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('ko');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [password, setPassword] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(10);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const pwaInstall = usePwaInstall();

  function scrollRibbon(dir: -1 | 1) {
    playTapSound();
    ribbonRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  }

  function handleQuickPickFromRibbon(code: LanguageCode) {
    void hapticTap();
    playCorrectSound(1);
    setSelectedLang(code);
    speakText(GREETING_BY_LANG[code], code, 0.95);
    trackTelemetryEvent('onboarding_language_picked', { language: code, screen: 'auth' });
    trackTelemetryEvent('signup_started', { language: code, screen: 'auth' });
    setError(null);
    setStep('register');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    void hapticTap();
    playTapSound();

    try {
      const visitorId = getVisitorId();
      const timezone = getClientTimezone();
      const platform = detectClientPlatform();

      if (step === 'register') {
        const { leadSource, utmCampaign } = readUrlMarketingParams();
        const user = await api.register({
          displayName,
          email,
          whatsapp: whatsapp.trim() || undefined,
          city: cityInput.trim() || undefined,
          timezone,
          visitorId,
          platform,
          password,
          activeLanguage: selectedLang,
          dailyGoalMinutes,
          marketingOptIn,
          leadSource,
          utmCampaign,
        });
        void hapticSuccess();
        playCorrectSound(2);
        onAuthenticated(user);
      } else {
        const user = await api.login({ email, password, visitorId, timezone, platform });
        void hapticSuccess();
        playCorrectSound(2);
        onAuthenticated(user);
      }
    } catch (err) {
      void hapticError();
      playGentleRetrySound();
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o acesso.');
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // PASSO 1: PRIMEIRA TELA LIMPA ESTILO DUOLINGO (Paleta NAidioma + Autismo/TDAH)
  // =========================================================================
  if (step === 'welcome') {
    return (
      <div className="min-h-[100dvh] bg-[#FFFDF9] text-[var(--na-ink)] flex flex-col justify-between">
        {/* Topo super limpo igual ao Duolingo */}
        <header className="w-full max-w-5xl mx-auto px-5 sm:px-8 h-18 flex items-center justify-between safe-top">
          <div className="flex items-center gap-2">
            <PuzzleMascot mood="idle" size={44} />
            <span className="font-display text-2xl sm:text-[28px] tracking-tight text-[var(--na-burgundy)]">
              NAidioma
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {!pwaInstall.isStandalone && (
              <button
                type="button"
                onClick={() => void pwaInstall.triggerInstall()}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--na-burgundy)] text-white border-2 border-[var(--na-wine-deep)] border-b-4 text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-1.5 active:translate-y-[1px]"
              >
                <DownloadSimple size={15} weight="bold" />
                Instalar App
              </button>
            )}
            <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.08em] text-[#9A8E83] select-none">
              <span>IDIOMA DO SITE: PORTUGUÊS</span>
              <CaretDown size={13} weight="bold" />
            </div>
          </div>
        </header>

        {/* Centro respirável: Cena animada à esquerda + Título e 2 botões 3D à direita */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-6 sm:py-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="w-full lg:w-1/2 flex items-center justify-center"
          >
            <HeroAutismScene />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24, delay: 0.06 }}
            className="w-full max-w-[460px] lg:w-1/2 flex flex-col items-center text-center space-y-5"
          >
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#6B4600]">
              ✨ 100% GRÁTIS ATÉ A FLUÊNCIA · 8 IDIOMAS
            </div>

            <h1 className="font-display text-[28px] sm:text-[34px] leading-[1.2] text-[#453D42]">
              Seu ritmo, sua voz, sua fluência — 100% grátis do primeiro passo ao C2!
            </h1>

            <p className="text-sm sm:text-[15px] font-semibold text-[#6C646B] leading-relaxed max-w-[400px]">
              Estude Inglês completo (A1 ao C2), Coreano, Japonês e mais 5 idiomas no idioma que
              quiser, com provas oficiais e Chamada ao Vivo com Tutor IA 24h — sem pagar nada e sem
              perder vidas.
            </p>

            <div className="w-full max-w-[330px] space-y-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  playCorrectSound(1);
                  setStep('language');
                }}
                className="duo-btn-wine w-full text-[15px] uppercase tracking-wider"
              >
                COMEÇAR 100% GRÁTIS
              </button>

              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  playTapSound();
                  setError(null);
                  setStep('login');
                }}
                className="duo-btn-white w-full text-[15px] uppercase tracking-wider text-[var(--na-teal)]"
              >
                JÁ TENHO UMA CONTA
              </button>
            </div>
          </motion.div>
        </main>

        {/* Barra inferior de bandeiras igual ao Duolingo (com setas < > e clique direto!) */}
        <footer className="w-full border-t-2 border-[#EFE6DA] bg-white/90 safe-bottom">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 h-[74px] flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollRibbon(-1)}
              aria-label="Idiomas anteriores"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#9A8E83] hover:text-[var(--na-burgundy)] hover:bg-[var(--na-cream)] shrink-0"
            >
              <CaretLeft size={18} weight="bold" />
            </button>

            <div
              ref={ribbonRef}
              className="flex-1 flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar py-2 scroll-smooth"
            >
              {ORDERED_LANGUAGES.map((code) => {
                const flag = LANGUAGE_FLAGS[code];
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleQuickPickFromRibbon(code)}
                    className="shrink-0 inline-flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--na-cream)] transition-colors group"
                  >
                    <FlagSvg code={code} className="w-9 h-6 shadow-2xs group-hover:scale-105 transition-transform" />
                    <span className="text-[13px] font-extrabold uppercase tracking-wider text-[#6C646B] group-hover:text-[var(--na-burgundy)]">
                      {flag.shortName}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollRibbon(1)}
              aria-label="Próximos idiomas"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#9A8E83] hover:text-[var(--na-burgundy)] hover:bg-[var(--na-cream)] shrink-0"
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </div>

          <nav
            aria-label="Guias regionais e currículo NAidioma"
            className="border-t border-[#F4ECE1] bg-[#FFFDF9] px-4 py-2.5"
          >
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold text-[#7F756E]">
              <a href="/pt-br/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                Brasil (PT-BR)
              </a>
              <a href="/ingles-a1-c2/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                Inglês A1 ao C2
              </a>
              <a href="/chamada-ao-vivo-ia/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                Chamada ao Vivo IA
              </a>
              <a href="/en-us/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                USA (EN)
              </a>
              <a href="/en-ca/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                Canada (EN)
              </a>
              <a href="/en-au/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                Australia (EN)
              </a>
              <a href="/en-nz/" className="hover:text-[var(--na-burgundy)] underline-offset-2 hover:underline">
                New Zealand (EN)
              </a>
            </div>
          </nav>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // PASSO 2: Escolha do idioma com bandeiras nítidas e áudio instantâneo
  // =========================================================================
  if (step === 'language') {
    return (
      <div className="min-h-[100dvh] bg-[var(--na-cream)] flex flex-col justify-between px-5 py-6 safe-top safe-bottom">
        <div className="max-w-xl w-full mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setStep('welcome');
              }}
              aria-label="Voltar"
              className="w-11 h-11 rounded-2xl bg-white border-2 border-[var(--na-border)] border-b-4 flex items-center justify-center text-[var(--na-ink)]"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
            <div className="flex-1 h-4 rounded-full bg-[var(--na-sand-dark)] overflow-hidden p-0.5">
              <div className="h-full w-1/2 rounded-full bg-[var(--na-burgundy)] transition-all duration-300" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <PuzzleMascot mood="happy" size={84} className="shrink-0" />
            <div className="relative flex-1 p-4 rounded-2xl bg-white border-2 border-[var(--na-border)] text-sm sm:text-base font-extrabold text-[var(--na-ink)]">
              Qual idioma você quer aprender primeiro?
              <span className="block text-xs font-semibold text-[var(--na-muted)] mt-0.5">
                Você pode trocar ou estudar todos os 8 quando quiser!
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ORDERED_LANGUAGES.map((code) => {
              const meta = LANGUAGES[code];
              const flag = LANGUAGE_FLAGS[code];
              const active = selectedLang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    playTapSound();
                    setSelectedLang(code);
                    speakText(GREETING_BY_LANG[code], code, 0.95);
                  }}
                  className={`p-4 rounded-2xl border-2 border-b-[5px] text-left transition-all flex items-center gap-3 active:translate-y-[2px] ${
                    active
                      ? 'bg-[var(--na-rose-soft)] border-[var(--na-burgundy)] text-[var(--na-wine-deep)]'
                      : 'bg-white border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                  }`}
                >
                  <FlagSvg code={code} className="w-10 h-7" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-base leading-tight truncate">
                      {flag.shortName}
                    </div>
                    <div className="text-xs font-bold opacity-75 truncate mt-0.5">
                      {meta.nativeName}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-xl w-full mx-auto pt-6">
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              playCorrectSound(1);
              trackTelemetryEvent('onboarding_language_picked', {
                language: selectedLang,
                screen: 'auth',
              });
              trackTelemetryEvent('signup_started', { language: selectedLang, screen: 'auth' });
              setStep('register');
            }}
            className="duo-btn-wine w-full text-base uppercase tracking-wide flex items-center justify-center gap-2"
          >
            CONTINUAR COM {LANGUAGE_FLAGS[selectedLang].shortName.toUpperCase()}
            <ArrowRight size={20} weight="bold" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PASSO 3: Criar perfil rápido ou Entrar (com cadastro obrigatório + LGPD)
  // =========================================================================
  const isRegister = step === 'register';

  return (
    <div className="min-h-[100dvh] bg-[var(--na-cream)] flex flex-col px-5 py-6 safe-top safe-bottom">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setError(null);
                setStep(isRegister ? 'language' : 'welcome');
              }}
              aria-label="Voltar"
              className="w-11 h-11 rounded-2xl bg-white border-2 border-[var(--na-border)] border-b-4 flex items-center justify-center text-[var(--na-ink)]"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
            <div className="flex-1 h-4 rounded-full bg-[var(--na-sand-dark)] overflow-hidden p-0.5">
              <div className="h-full w-full rounded-full bg-[var(--na-burgundy)] transition-all duration-300" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <PuzzleMascot mood={isRegister ? 'celebrate' : 'wave'} size={78} className="shrink-0" />
            <div className="flex-1 p-3.5 rounded-2xl bg-white border-2 border-[var(--na-border)]">
              <div className="font-extrabold text-sm text-[var(--na-ink)] leading-snug flex items-center gap-2 flex-wrap">
                {isRegister ? (
                  <>
                    <span>Crie seu perfil grátis para</span>
                    <span className="inline-flex items-center gap-1.5 text-[var(--na-burgundy)]">
                      <FlagSvg code={selectedLang} className="w-6 h-4" />
                      {LANGUAGE_FLAGS[selectedLang].shortName}
                    </span>
                  </>
                ) : (
                  'Que bom te ver de volta! Vamos continuar a trilha?'
                )}
              </div>
              {isRegister && (
                <div className="text-[11px] font-semibold text-[var(--na-muted)] mt-0.5">
                  Pais podem colocar seu e-mail para salvar o progresso da criança na nuvem.
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="duo-card p-5 space-y-4">
            {isRegister && (
              <div>
                <label
                  htmlFor="na-name"
                  className="block text-xs font-extrabold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                >
                  Nome do aluno (ou apelido)
                </label>
                <div className="relative">
                  <User
                    size={18}
                    weight="bold"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                  />
                  <input
                    id="na-name"
                    type="text"
                    required
                    minLength={2}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex.: Lucas ou Sofia"
                    className="w-full min-h-[50px] pl-10 pr-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] font-semibold text-[var(--na-ink)] focus:border-[var(--na-teal)]"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="na-email"
                className="block text-xs font-extrabold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
              >
                E-mail {isRegister ? '(do aluno ou responsável)' : ''}
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                />
                <input
                  id="na-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com.br"
                  className="w-full min-h-[50px] pl-10 pr-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] font-semibold text-[var(--na-ink)] focus:border-[var(--na-teal)]"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label
                    htmlFor="na-whatsapp"
                    className="block text-xs font-extrabold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                  >
                    WhatsApp <span className="font-semibold text-[var(--na-muted)]">(opcional)</span>
                  </label>
                  <div className="relative">
                    <WhatsappLogo
                      size={18}
                      weight="bold"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                    />
                    <input
                      id="na-whatsapp"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(13) 99999-0000"
                      className="w-full min-h-[50px] pl-10 pr-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] font-semibold text-[var(--na-ink)] focus:border-[var(--na-teal)]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="na-city"
                    className="block text-xs font-extrabold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                  >
                    Cidade / Estado{' '}
                    <span className="font-semibold text-[var(--na-muted)]">(opcional)</span>
                  </label>
                  <div className="relative">
                    <MapPin
                      size={18}
                      weight="bold"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                    />
                    <input
                      id="na-city"
                      type="text"
                      maxLength={90}
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="Ex.: São Paulo - SP"
                      className="w-full min-h-[50px] pl-10 pr-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] font-semibold text-[var(--na-ink)] focus:border-[var(--na-teal)]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="na-password"
                className="block text-xs font-extrabold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <LockSimple
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                />
                <input
                  id="na-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[50px] pl-10 pr-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] font-semibold text-[var(--na-ink)] focus:border-[var(--na-teal)]"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-ink)] mb-1.5">
                    Meta divertida por dia
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { min: 5, label: '5 min', tag: '🌱 Leve' },
                      { min: 10, label: '10 min', tag: '🚀 Legal' },
                      { min: 15, label: '15 min', tag: '🔥 Turbo' },
                    ].map((opt) => (
                      <button
                        key={opt.min}
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setDailyGoalMinutes(opt.min);
                        }}
                        className={`p-2.5 rounded-2xl border-2 border-b-4 text-center transition-all ${
                          dailyGoalMinutes === opt.min
                            ? 'bg-[var(--na-gold-soft)] border-[var(--na-gold)] text-[#7a5200]'
                            : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
                        }`}
                      >
                        <div className="text-sm font-extrabold">{opt.label}</div>
                        <div className="text-[11px] font-bold">{opt.tag}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)]/40 text-xs font-extrabold text-[var(--na-teal-dark)] leading-relaxed">
                  ✨ 100% gratuito até a fluência: estude do A1 ao C2 no idioma que quiser, sem
                  pagar nada e sem perder vidas.
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[var(--na-muted)] leading-relaxed cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--na-burgundy)] shrink-0"
                  />
                  <span>
                    Aceito receber e-mail de boas-vindas, dicas de estudo, novidades e comunicados
                    promocionais do <strong className="text-[var(--na-ink)]">NAidioma</strong> e do{' '}
                    <strong className="text-[var(--na-ink)]">Núcleo Afetar</strong> (LGPD — pode
                    sair com 1 clique quando quiser).
                  </span>
                </label>
              </>
            )}

            {error && (
              <div
                role="alert"
                className="p-3 rounded-2xl bg-[var(--na-error-soft)] border-2 border-[var(--na-error)]/40 text-sm font-bold text-[var(--na-error)]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="duo-btn-wine w-full text-base uppercase tracking-wide flex items-center justify-center gap-2"
            >
              {loading
                ? 'Preparando sua trilha...'
                : isRegister
                  ? 'CRIAR CONTA E COMEÇAR!'
                  : 'ENTRAR NO NAIDIOMA'}
              {!loading && <ArrowRight size={20} weight="bold" />}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              playTapSound();
              setError(null);
              setStep(isRegister ? 'login' : 'language');
            }}
            className="w-full mt-4 py-2 text-sm font-extrabold text-[var(--na-teal)]"
          >
            {isRegister ? 'Já tenho conta → Entrar' : 'Ainda não tem conta? Criar grátis'}
          </button>
        </div>
      </div>
    </div>
  );
}
