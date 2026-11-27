import { useState } from 'react';
import {
  Crown,
  EnvelopeSimple,
  Fire,
  GearSix,
  SignOut,
  Star,
  Trophy,
} from '@phosphor-icons/react';
import { LANGUAGES } from '@naidioma/shared';
import { api, type BillingStatusResponse, type UserProfile } from '../lib/api';
import { APP_CLIENT_VERSION, getPlatform, hapticSuccess, hapticTap } from '../lib/native';

interface ProfileViewProps {
  user: UserProfile;
  billing: BillingStatusResponse | null;
  onUserUpdated: (user: UserProfile) => void;
  onOpenBilling: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function ProfileView({
  user,
  billing,
  onUserUpdated,
  onOpenBilling,
  onOpenAdmin,
  onLogout,
}: ProfileViewProps) {
  const [dailyGoal, setDailyGoal] = useState(user.dailyGoalMinutes);
  const [marketingOptIn, setMarketingOptIn] = useState(user.marketingOptIn);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function handleSavePrefs() {
    setSaving(true);
    setSavedMsg(null);
    void hapticTap();
    try {
      const res = await api.updatePreferences({
        dailyGoalMinutes: dailyGoal,
        marketingOptIn,
      });
      void hapticSuccess();
      onUserUpdated(res.user);
      setSavedMsg('Preferências salvas com sucesso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Header identity card */}
      <section className="surface-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--na-wine)] text-[var(--na-cream)] flex items-center justify-center font-display text-3xl">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-3xl text-[var(--na-ink)] leading-tight">
              {user.displayName}
            </h1>
            <div className="text-sm text-[var(--na-muted)] flex items-center gap-1.5 mt-0.5">
              <EnvelopeSimple size={15} /> {user.email}
            </div>
            <div className="text-xs font-semibold text-[var(--na-burgundy)] mt-1">
              Estudando agora: {LANGUAGES[user.activeLanguage]?.namePt}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="btn-tactile-secondary px-4 text-sm inline-flex items-center justify-center gap-2"
        >
          <SignOut size={16} /> Sair
        </button>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        <div className="surface-card p-4 text-center">
          <Fire size={24} weight="duotone" className="mx-auto text-[var(--na-burgundy)]" />
          <div className="text-2xl font-extrabold mt-1">{user.streakDays}</div>
          <div className="text-xs text-[var(--na-muted)]">Dias seguidos</div>
        </div>
        <div className="surface-card p-4 text-center">
          <Trophy size={24} weight="duotone" className="mx-auto text-[var(--na-gold)]" />
          <div className="text-2xl font-extrabold mt-1">{user.longestStreak}</div>
          <div className="text-xs text-[var(--na-muted)]">Recorde</div>
        </div>
        <div className="surface-card p-4 text-center">
          <Star size={24} weight="fill" className="mx-auto text-[var(--na-teal)]" />
          <div className="text-2xl font-extrabold mt-1">{user.xpTotal}</div>
          <div className="text-xs text-[var(--na-muted)]">XP total</div>
        </div>
      </section>

      {/* Hidden Billing Card: ONLY shown when billing.billingVisible === true */}
      {billing?.billingVisible && (
        <section className="rounded-[18px] bg-[var(--na-wine)] text-[var(--na-ivory)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--na-gold)]">
              <Crown size={16} weight="fill" /> Assinatura NAidioma
            </div>
            <h2 className="font-display text-2xl">
              Plano atual: {billing.currentTier === 'free' ? 'Essencial (Gratuito)' : billing.currentTier.toUpperCase()}
            </h2>
            <p className="text-xs text-[#e9d1c0]">
              Desbloqueie conversação por voz IA avançada e todas as trilhas.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBilling}
            className="min-h-[48px] px-5 rounded-[12px] bg-[var(--na-cream)] text-[var(--na-wine-deep)] font-bold text-sm shrink-0"
          >
            Ver planos
          </button>
        </section>
      )}

      {/* Preferences & LGPD Email Control */}
      <section className="surface-card p-6 space-y-5">
        <h2 className="font-display text-2xl text-[var(--na-ink)]">Preferências de estudo</h2>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--na-muted)] mb-2">
            Meta diária
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setDailyGoal(min)}
                className={`min-h-[44px] rounded-[12px] border text-sm font-bold ${
                  dailyGoal === min
                    ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)]'
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
          <span className="text-xs text-[var(--na-muted)] leading-relaxed">
            Receber dicas semanais, novidades de idiomas e comunicados oficiais do NAidioma e
            Núcleo Afetar por e-mail.
          </span>
        </label>

        {savedMsg && (
          <div className="text-xs font-semibold text-[var(--na-success)]">{savedMsg}</div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSavePrefs()}
          className="btn-tactile-primary px-6 text-sm"
        >
          {saving ? 'Salvando...' : 'Salvar preferências'}
        </button>
      </section>

      {/* Version & Owner Admin Link */}
      <section className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[var(--na-muted)]">
        <span className="font-mono-code">
          NAidioma v{APP_CLIENT_VERSION} · Plataforma: {getPlatform()}
        </span>
        <button
          type="button"
          onClick={onOpenAdmin}
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--na-muted)] hover:text-[var(--na-burgundy)] py-2"
        >
          <GearSix size={15} /> Painel Admin
        </button>
      </section>
    </div>
  );
}
