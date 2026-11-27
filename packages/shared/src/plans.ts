export type PlanKey = 'free' | 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly';

export interface BillingPlan {
  key: PlanKey;
  tier: 'free' | 'plus' | 'pro';
  namePt: string;
  taglinePt: string;
  billingCycle: 'forever' | 'month' | 'year';
  priceCentsBrl: number;
  monthlyEquivalentCentsBrl: number;
  savingsBadgePt?: string;
  highlighted?: boolean;
  dailyAiTurns: number; // -1 = unlimited
  featuresPt: string[];
  stripePriceEnvKey?: string;
}

/**
 * Brazilian market-calibrated plans (competitive vs Duolingo Super R$ 29-39/mo,
 * Babbel R$ 39-59/mo, and Speak/Praktika R$ 69-99/mo).
 * Remains 100% hidden in UI while BILLING_UI_ENABLED=false.
 */
export const NAIDIOMA_PLANS: BillingPlan[] = [
  {
    key: 'free',
    tier: 'free',
    namePt: 'Essencial',
    taglinePt: 'Para criar o hábito diário sem custo',
    billingCycle: 'forever',
    priceCentsBrl: 0,
    monthlyEquivalentCentsBrl: 0,
    dailyAiTurns: 5,
    featuresPt: [
      'Acesso à unidade inicial dos 8 idiomas',
      'Revisão científica FSRS básica',
      '5 turnos diários no Estúdio de Conversa IA',
      'Sincronização entre Web, Android e iOS',
    ],
  },
  {
    key: 'plus_monthly',
    tier: 'plus',
    namePt: 'NAidioma Plus',
    taglinePt: 'Todos os 8 idiomas + revisão FSRS ilimitada',
    billingCycle: 'month',
    priceCentsBrl: 2990,
    monthlyEquivalentCentsBrl: 2990,
    dailyAiTurns: 40,
    stripePriceEnvKey: 'STRIPE_PRICE_PLUS_MONTHLY',
    featuresPt: [
      'Todas as trilhas A1→C1 dos 8 idiomas',
      'Trilha completa Inglês para Brasileiros',
      'Revisão científica FSRS ilimitada',
      '40 turnos diários de Conversa por Voz IA',
      'Sem anúncios e sem sistema punitivo de vidas',
    ],
  },
  {
    key: 'plus_yearly',
    tier: 'plus',
    namePt: 'NAidioma Plus Anual',
    taglinePt: 'Melhor custo-benefício para fluência real',
    billingCycle: 'year',
    priceCentsBrl: 21480,
    monthlyEquivalentCentsBrl: 1790,
    savingsBadgePt: '40% de economia',
    highlighted: true,
    dailyAiTurns: 40,
    stripePriceEnvKey: 'STRIPE_PRICE_PLUS_YEARLY',
    featuresPt: [
      'Tudo do NAidioma Plus por apenas R$ 17,90/mês',
      'Todas as trilhas A1→C1 dos 8 idiomas',
      'Revisão científica FSRS ilimitada',
      '40 turnos diários de Conversa por Voz IA',
      'Acesso antecipado a novos cenários e módulos',
    ],
  },
  {
    key: 'pro_monthly',
    tier: 'pro',
    namePt: 'NAidioma Pro IA',
    taglinePt: 'Conversação ilimitada + simulador de carreira',
    billingCycle: 'month',
    priceCentsBrl: 4990,
    monthlyEquivalentCentsBrl: 4990,
    dailyAiTurns: -1,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY',
    featuresPt: [
      'Conversação por Voz IA ilimitada 24h',
      'Simulador de entrevistas e reuniões internacionais',
      'Diagnóstico avançado de pronúncia e naturalidade',
      'Prioridade de resposta nos modelos de IA em nuvem',
      'Tudo do NAidioma Plus incluso',
    ],
  },
  {
    key: 'pro_yearly',
    tier: 'pro',
    namePt: 'NAidioma Pro IA Anual',
    taglinePt: 'Fluência acelerada com tutor IA ilimitado',
    billingCycle: 'year',
    priceCentsBrl: 35880,
    monthlyEquivalentCentsBrl: 2990,
    savingsBadgePt: '40% de economia',
    dailyAiTurns: -1,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO_YEARLY',
    featuresPt: [
      'Tudo do NAidioma Pro IA por apenas R$ 29,90/mês',
      'Conversação por Voz IA ilimitada nos 8 idiomas',
      'Simulador de carreira, viagens e negócios',
      'Prioridade de resposta nos modelos de IA em nuvem',
    ],
  },
];

export function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function getPlanByKey(key: string): BillingPlan | undefined {
  return NAIDIOMA_PLANS.find((p) => p.key === key);
}
