import { useState } from 'react';
import {
  Crown,
  EnvelopeSimple,
  Fire,
  GearSix,
  Leaf,
  PuzzlePiece,
  SignOut,
  SpeakerHigh,
  SpeakerSlash,
  Trophy,
} from '@phosphor-icons/react';
import { LANGUAGES } from '@naidioma/shared';
import { api, type BillingStatusResponse, type UserProfile } from '../lib/api';
import { APP_CLIENT_VERSION, getPlatform, hapticSuccess, hapticTap } from '../lib/native';
import {
  applyCalmMode,
  isCalmModeEnabled,
  isSoundEnabled,
  playCorrectSound,
  playTapSound,
  setSoundEnabled,
} from '../lib/sound';
import { LANGUAGE_FLAGS, PuzzleMascot } from './Mascots';
import { ReminderCard } from './ReminderCard';

interface ProfileViewProps {
  user: UserProfile;
  petName: string;
  billing: BillingStatusResponse | null;
  onUserUpdated: (user: UserProfile) => void;
  onOpenBilling: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function ProfileView({
  user,
  petName,
  billing,
  onUserUpdated,
  onOpenBilling,
  onOpenAdmin,
  onLogout,
}: ProfileViewProps) {
  const [dailyGoal, setDailyGoal] = useState(user.dailyGoalMinutes);
  const [marketingOptIn, setMarketingOptIn] = useState(user.marketingOptIn);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [calmMode, setCalmMode] = useState(() => isCalmModeEnabled());
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function handleSavePrefs() {
    setSaving(true);
    setSavedMsg(null);
    void hapticTap();
    playTapSound();
    try {
      const res = await api.updatePreferences({
        dailyGoalMinutes: dailyGoal,
        marketingOptIn,
      });
      void hapticSuccess();
      playCorrectSound(1);
      onUserUpdated(res.user);
      setSavedMsg('Preferências salvas na nuvem! 🧩');
    } finally {
      setSaving(false);
    }
  }

  const flag = LANGUAGE_FLAGS[user.activeLanguage];

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Cartão do Perfil com o Puz */}
      <section className="duo-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-18 h-18 rounded-3xl bg-[var(--na-rose-soft)] border-2 border-[var(--na-burgundy)] flex items-center justify-center shrink-0">
            <PuzzleMascot mood="happy" size={64} />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-[var(--na-ink)] leading-tight">
              {user.displayName}
            </h1>
            <div className="text-xs sm:text-sm font-semibold text-[var(--na-muted)] flex items-center gap-1.5 mt-0.5">
              <EnvelopeSimple size={15} weight="bold" /> {user.email}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-[var(--na-teal-soft)] text-xs font-extrabold text-[var(--na-teal-dark)]">
              <span>{flag.emoji}</span>
              <span>Estudando {LANGUAGES[user.activeLanguage]?.namePt}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="duo-btn-white px-4 text-sm inline-flex items-center justify-center gap-2 shrink-0"
        >
          <SignOut size={16} weight="bold" /> Sair
        </button>
      </section>

      {/* Estatísticas vibrantes (Autismo & TDAH) */}
      <section className="grid grid-cols-3 gap-3">
        <div className="duo-card p-4 text-center bg-[var(--na-flame-soft)]/50">
          <Fire size={26} weight="fill" className="mx-auto text-[var(--na-flame)]" />
          <div className="text-2xl font-extrabold text-[var(--na-ink)] mt-1">{user.streakDays}</div>
          <div className="text-xs font-bold text-[var(--na-muted)]">Ritmo de Foco</div>
        </div>
        <div className="duo-card p-4 text-center bg-[var(--na-gold-soft)]/60">
          <Trophy size={26} weight="fill" className="mx-auto text-[var(--na-gold-dark)]" />
          <div className="text-2xl font-extrabold text-[var(--na-ink)] mt-1">
            {user.longestStreak}
          </div>
          <div className="text-xs font-bold text-[var(--na-muted)]">Maior Ritmo</div>
        </div>
        <div className="duo-card p-4 text-center bg-[var(--na-teal-soft)]/60">
          <PuzzlePiece size={26} weight="fill" className="mx-auto text-[var(--na-teal)]" />
          <div className="text-2xl font-extrabold text-[var(--na-ink)] mt-1">{user.xpTotal}</div>
          <div className="text-xs font-bold text-[var(--na-muted)]">Peças 🧩</div>
        </div>
      </section>

      {/* Lembretes Diários Motivacionais na Tela do Celular */}
      <ReminderCard petName={petName} />

      {/* Conforto Sensorial (Autismo & TDAH) */}
      <section className="duo-card p-5 space-y-3">
        <h2 className="font-display text-xl text-[var(--na-ink)]">
          🧩 Conforto Sensorial (Autismo & TDAH)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) playTapSound();
            }}
            className={`p-4 rounded-2xl border-2 border-b-4 text-left flex items-center gap-3 ${
              soundOn
                ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
            }`}
          >
            {soundOn ? <SpeakerHigh size={24} weight="fill" /> : <SpeakerSlash size={24} weight="fill" />}
            <div>
              <div className="text-sm font-extrabold">
                Efeitos Sonoros: {soundOn ? 'Ligados' : 'Silencioso'}
              </div>
              <div className="text-[11px] font-semibold opacity-80">
                Sons suaves de acerto e celebração
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !calmMode;
              setCalmMode(next);
              applyCalmMode(next);
              playTapSound();
            }}
            className={`p-4 rounded-2xl border-2 border-b-4 text-left flex items-center gap-3 ${
              calmMode
                ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
            }`}
          >
            <Leaf size={24} weight="fill" />
            <div>
              <div className="text-sm font-extrabold">
                Modo Calmo: {calmMode ? 'Ativo' : 'Normal'}
              </div>
              <div className="text-[11px] font-semibold opacity-80">
                Pausa animações contínuas na tela
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Cobrança Stripe (100% oculta enquanto billing.billingVisible === false) */}
      {billing?.billingVisible && (
        <section className="rounded-[22px] bg-[var(--na-burgundy)] text-white p-6 border-2 border-[var(--na-wine-deep)] border-b-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--na-gold)]">
              <Crown size={16} weight="fill" /> Assinatura NAidioma
            </div>
            <h2 className="font-display text-2xl">
              Plano atual:{' '}
              {billing.currentTier === 'free'
                ? 'Essencial (Gratuito)'
                : billing.currentTier.toUpperCase()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenBilling}
            className="duo-btn-gold px-5 text-sm shrink-0"
          >
            Ver planos
          </button>
        </section>
      )}

      {/* Preferências & LGPD */}
      <section className="duo-card p-5 sm:p-6 space-y-5">
        <h2 className="font-display text-xl text-[var(--na-ink)]">Meta diária & E-mail</h2>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)] mb-2">
            Tempo de estudo por dia
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => {
                  playTapSound();
                  setDailyGoal(min);
                }}
                className={`min-h-[46px] rounded-2xl border-2 border-b-4 text-sm font-extrabold ${
                  dailyGoal === min
                    ? 'bg-[var(--na-burgundy)] text-white border-[var(--na-wine-deep)]'
                    : 'bg-[var(--na-cream)] text-[var(--na-ink)] border-[var(--na-border)]'
                }`}
              >
                {min} min
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-[var(--na-ink)] cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[var(--na-burgundy)]"
          />
          <span className="text-xs font-semibold text-[var(--na-muted)] leading-relaxed">
            Receber dicas semanais, novidades de idiomas e comunicados oficiais do NAidioma e
            Núcleo Afetar por e-mail.
          </span>
        </label>

        {savedMsg && <div className="text-xs font-extrabold text-[var(--na-success-dark)]">{savedMsg}</div>}

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSavePrefs()}
          className="duo-btn-emerald px-6 text-sm uppercase tracking-wide"
        >
          {saving ? 'Salvando...' : 'Salvar preferências'}
        </button>
      </section>

      {/* Versão & Painel Admin */}
      <section className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-bold text-[var(--na-muted)]">
        <span className="font-mono-code">
          NAidioma v{APP_CLIENT_VERSION} · {getPlatform()}
        </span>
        <button
          type="button"
          onClick={onOpenAdmin}
          className="inline-flex items-center gap-1.5 font-extrabold text-[var(--na-muted)] hover:text-[var(--na-burgundy)] py-2"
        >
          <GearSix size={15} weight="bold" /> Painel Admin
        </button>
      </section>
    </div>
  );
}
