import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  EnvelopeSimple,
  GlobeHemisphereWest,
  LockSimple,
  Microphone,
  Sparkle,
  User,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { LANGUAGE_LIST, type LanguageCode } from '@naidioma/shared';
import { api, type UserProfile } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
}

function readUrlMarketingParams(): { leadSource: string; utmCampaign?: string } {
  if (typeof window === 'undefined') return { leadSource: 'nucleoafetar' };
  const params = new URLSearchParams(window.location.search);
  const src = params.get('utm_source') || params.get('ref') || 'nucleoafetar';
  const campaign = params.get('utm_campaign') || undefined;
  return { leadSource: src.slice(0, 60), utmCampaign: campaign?.slice(0, 100) };
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('en');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(10);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    void hapticTap();

    try {
      if (mode === 'register') {
        const { leadSource, utmCampaign } = readUrlMarketingParams();
        const user = await api.register({
          displayName,
          email,
          whatsapp: whatsapp.trim() || undefined,
          password,
          activeLanguage: selectedLang,
          dailyGoalMinutes,
          marketingOptIn,
          leadSource,
          utmCampaign,
        });
        void hapticSuccess();
        onAuthenticated(user);
      } else {
        const user = await api.login({ email, password });
        void hapticSuccess();
        onAuthenticated(user);
      }
    } catch (err) {
      void hapticError();
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o acesso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--na-cream)] text-[var(--na-ink)] flex flex-col">
      {/* Top editorial bar */}
      <header className="w-full border-b border-[var(--na-border)] bg-[var(--na-cream)] safe-top">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[11px] bg-[var(--na-wine)] text-[var(--na-cream)] flex items-center justify-center font-display text-xl font-semibold border border-[var(--na-gold)]/50">
              NA
            </div>
            <div className="leading-tight">
              <div className="font-display text-2xl font-semibold tracking-tight text-[var(--na-wine)]">
                NAidioma
              </div>
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--na-teal)]">
                Núcleo Afetar · Idiomas
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void hapticTap();
              setError(null);
              setMode(mode === 'register' ? 'login' : 'register');
            }}
            className="text-sm font-semibold text-[var(--na-burgundy)] hover:text-[var(--na-wine-deep)] px-3 py-2 rounded-lg"
          >
            {mode === 'register' ? 'Já tenho conta' : 'Criar conta grátis'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left editorial column */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="lg:col-span-6 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--na-sand)] border border-[var(--na-sand-dark)] text-xs font-bold tracking-wider uppercase text-[var(--na-burgundy)]">
            <Sparkle size={14} weight="fill" />
            Acesso Gratuito · 8 Idiomas Completos
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.06] tracking-tight text-[var(--na-ink)]">
            Fale idiomas com{' '}
            <em className="italic text-[var(--na-burgundy)] font-normal">
              naturalidade real
            </em>
            , sem travar.
          </h1>

          <p className="text-[15px] leading-relaxed text-[var(--na-muted)] max-w-xl">
            Criado para destravar brasileiros desde a primeira semana: conversação por voz com IA,
            revisão científica FSRS e foco direto nas armadilhas entre o português e o mundo.
          </p>

          {/* Language quick picker preview */}
          <div className="space-y-3 pt-1">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--na-muted)]">
              Escolha por qual idioma começar agora:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {LANGUAGE_LIST.map((lang) => {
                const active = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      setSelectedLang(lang.code);
                    }}
                    className={`min-h-[54px] px-3 py-2.5 rounded-[14px] border text-left transition-all flex flex-col justify-center ${
                      active
                        ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)] shadow-sm'
                        : 'bg-[var(--na-ivory)] text-[var(--na-ink)] border-[var(--na-border)] hover:border-[var(--na-gold)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono-code text-[11px] font-bold opacity-80">
                        {lang.isoBadge}
                      </span>
                      {lang.flagship && (
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-[var(--na-gold)] text-[var(--na-wine-deep)]'
                              : 'bg-[var(--na-sand)] text-[var(--na-burgundy)]'
                          }`}
                        >
                          Destaque
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] font-bold leading-tight mt-0.5 truncate">
                      {lang.code === 'en' ? 'Inglês BR' : lang.namePt.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 concrete differentiators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="surface-sand p-4 space-y-1.5">
              <Microphone size={20} weight="duotone" className="text-[var(--na-burgundy)]" />
              <div className="text-sm font-bold text-[var(--na-ink)]">Voz IA ao vivo</div>
              <p className="text-xs text-[var(--na-muted)] leading-relaxed">
                Treine diálogos reais e receba correção clara em português.
              </p>
            </div>
            <div className="surface-sand p-4 space-y-1.5">
              <GlobeHemisphereWest size={20} weight="duotone" className="text-[var(--na-teal)]" />
              <div className="text-sm font-bold text-[var(--na-ink)]">Escrita & Tons</div>
              <p className="text-xs text-[var(--na-muted)] leading-relaxed">
                Furigana, Pinyin e Hangul ligáveis com um toque.
              </p>
            </div>
            <div className="surface-sand p-4 space-y-1.5">
              <Check size={20} weight="bold" className="text-[var(--na-success)]" />
              <div className="text-sm font-bold text-[var(--na-ink)]">Zero "vidas"</div>
              <p className="text-xs text-[var(--na-muted)] leading-relaxed">
                Estude no seu ritmo, sem travas irritantes por errar.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Right card: Mandatory signup for mailing + progress sync */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.06 }}
          className="lg:col-span-6 w-full"
        >
          <div className="surface-card p-6 sm:p-8 shadow-sm">
            {/* Mode switch tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[12px] bg-[var(--na-sand)] mb-6">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className={`min-h-[44px] rounded-[10px] text-sm font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-[var(--na-ivory)] text-[var(--na-wine)] shadow-xs'
                    : 'text-[var(--na-muted)]'
                }`}
              >
                Criar conta grátis
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className={`min-h-[44px] rounded-[10px] text-sm font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-[var(--na-ivory)] text-[var(--na-wine)] shadow-xs'
                    : 'text-[var(--na-muted)]'
                }`}
              >
                Entrar
              </button>
            </div>

            <div className="mb-5">
              <h2 className="font-display text-3xl text-[var(--na-ink)] leading-tight">
                {mode === 'register'
                  ? 'Comece gratuitamente agora'
                  : 'Que bom ter você de volta'}
              </h2>
              <p className="text-sm text-[var(--na-muted)] mt-1">
                {mode === 'register'
                  ? 'Cadastre seu e-mail para liberar todos os 8 idiomas gratuitamente e salvar seu progresso em qualquer aparelho.'
                  : 'Entre com seu e-mail e senha para retomar sua ofensiva.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="na-name"
                    className="block text-xs font-bold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                  >
                    Seu nome completo
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                    />
                    <input
                      id="na-name"
                      type="text"
                      required
                      minLength={2}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex.: Mariana Souza"
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-[var(--na-ink)] placeholder:text-[var(--na-muted)]/70 focus:border-[var(--na-teal)]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="na-email"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative">
                  <EnvelopeSimple
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                  />
                  <input
                    id="na-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com.br"
                    className="w-full min-h-[48px] pl-10 pr-4 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-[var(--na-ink)] placeholder:text-[var(--na-muted)]/70 focus:border-[var(--na-teal)]"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="na-whatsapp"
                    className="block text-xs font-bold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                  >
                    WhatsApp <span className="font-normal text-[var(--na-muted)]">(opcional)</span>
                  </label>
                  <div className="relative">
                    <WhatsappLogo
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                    />
                    <input
                      id="na-whatsapp"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(13) 99999-0000"
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-[var(--na-ink)] placeholder:text-[var(--na-muted)]/70 focus:border-[var(--na-teal)]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="na-password"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--na-ink)] mb-1.5"
                >
                  Senha
                </label>
                <div className="relative">
                  <LockSimple
                    size={18}
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
                    className="w-full min-h-[48px] pl-10 pr-4 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-[var(--na-ink)] placeholder:text-[var(--na-muted)]/70 focus:border-[var(--na-teal)]"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--na-ink)] mb-1.5">
                      Meta diária confortável
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => setDailyGoalMinutes(min)}
                          className={`min-h-[44px] rounded-[11px] border text-sm font-bold transition-colors ${
                            dailyGoalMinutes === min
                              ? 'bg-[var(--na-sand)] border-[var(--na-burgundy)] text-[var(--na-wine)]'
                              : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
                          }`}
                        >
                          {min} min/dia
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-start gap-3 text-xs text-[var(--na-muted)] leading-relaxed pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(e) => setMarketingOptIn(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[var(--na-burgundy)] shrink-0"
                    />
                    <span>
                      Aceito receber novidades, dicas de estudo e comunicados do{' '}
                      <strong className="text-[var(--na-ink)]">NAidioma</strong> e do{' '}
                      <strong className="text-[var(--na-ink)]">Núcleo Afetar</strong> por e-mail
                      (você pode cancelar quando quiser — LGPD).
                    </span>
                  </label>
                </>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[12px] bg-[var(--na-error-soft)] border border-[var(--na-error)]/30 text-sm font-medium text-[var(--na-error)]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-tactile-primary w-full flex items-center justify-center gap-2 text-base mt-2"
              >
                {loading
                  ? 'Preparando sua trilha...'
                  : mode === 'register'
                    ? 'Criar conta e estudar grátis'
                    : 'Entrar no NAidioma'}
                {!loading && <ArrowRight size={18} weight="bold" />}
              </button>
            </form>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
