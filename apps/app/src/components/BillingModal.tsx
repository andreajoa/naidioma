import { useState } from 'react';
import { Check, Crown, X } from '@phosphor-icons/react';
import { formatBrl } from '@naidioma/shared';
import { api, type BillingStatusResponse } from '../lib/api';

interface BillingModalProps {
  billing: BillingStatusResponse;
  onClose: () => void;
}

/**
 * Complete Stripe-wired subscription modal with compatible Brazilian BRL plans.
 * Never rendered while billing.billingVisible === false.
 */
export function BillingModal({ billing, onClose }: BillingModalProps) {
  const [cycle, setCycle] = useState<'year' | 'month'>('year');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!billing.billingVisible) return null;

  const visiblePlans = billing.plans.filter(
    (p) => p.billingCycle === 'forever' || p.billingCycle === cycle,
  );

  async function handleCheckout(planKey: 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly') {
    setError(null);
    setLoadingPlan(planKey);
    try {
      const res = await api.createCheckout(planKey);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="surface-card max-w-4xl w-full p-6 sm:p-8 space-y-6 my-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--na-burgundy)]">
              <Crown size={15} weight="fill" /> Planos NAidioma
            </div>
            <h2 className="font-display text-3xl sm:text-4xl text-[var(--na-ink)] mt-1">
              Invista na sua fluência com preço justo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar planos"
            className="w-10 h-10 rounded-[10px] border border-[var(--na-border)] flex items-center justify-center"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Billing cycle switcher */}
        <div className="inline-flex p-1 rounded-[12px] bg-[var(--na-sand)]">
          <button
            type="button"
            onClick={() => setCycle('year')}
            className={`px-4 py-2 rounded-[10px] text-xs font-bold ${
              cycle === 'year'
                ? 'bg-[var(--na-wine)] text-[var(--na-ivory)]'
                : 'text-[var(--na-muted)]'
            }`}
          >
            Anual (40% OFF)
          </button>
          <button
            type="button"
            onClick={() => setCycle('month')}
            className={`px-4 py-2 rounded-[10px] text-xs font-bold ${
              cycle === 'month'
                ? 'bg-[var(--na-wine)] text-[var(--na-ivory)]'
                : 'text-[var(--na-muted)]'
            }`}
          >
            Mensal
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-[10px] bg-[var(--na-error-soft)] text-xs font-semibold text-[var(--na-error)]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visiblePlans.map((plan) => {
            const isPaid = plan.key !== 'free';
            return (
              <div
                key={plan.key}
                className={`p-5 rounded-[16px] border flex flex-col justify-between gap-5 ${
                  plan.highlighted
                    ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)]'
                    : 'bg-[var(--na-cream)] text-[var(--na-ink)] border-[var(--na-border)]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-2xl">{plan.namePt}</h3>
                    {plan.savingsBadgePt && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--na-gold)] text-[var(--na-wine-deep)]">
                        {plan.savingsBadgePt}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${plan.highlighted ? 'text-[#e9d1c0]' : 'text-[var(--na-muted)]'}`}>
                    {plan.taglinePt}
                  </p>
                  <div className="pt-1">
                    <span className="text-3xl font-extrabold">
                      {formatBrl(plan.monthlyEquivalentCentsBrl)}
                    </span>
                    <span className="text-xs opacity-75"> /mês</span>
                    {plan.billingCycle === 'year' && (
                      <div className="text-[11px] opacity-80 mt-0.5">
                        Cobrado {formatBrl(plan.priceCentsBrl)} por ano via Stripe
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 pt-2">
                    {plan.featuresPt.map((feat, i) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <Check size={15} weight="bold" className="shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isPaid ? (
                  <button
                    type="button"
                    disabled={loadingPlan === plan.key}
                    onClick={() =>
                      void handleCheckout(
                        plan.key as 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly',
                      )
                    }
                    className={`min-h-[48px] rounded-[12px] font-bold text-sm ${
                      plan.highlighted
                        ? 'bg-[var(--na-cream)] text-[var(--na-wine-deep)]'
                        : 'btn-tactile-primary'
                    }`}
                  >
                    {loadingPlan === plan.key ? 'Abrindo Stripe...' : 'Assinar agora'}
                  </button>
                ) : (
                  <div className="text-center text-xs font-bold opacity-70 py-3">
                    Plano inicial incluso
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
