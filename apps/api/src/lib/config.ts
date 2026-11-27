import crypto from 'node:crypto';
import 'dotenv/config';

export interface AppConfig {
  port: number;
  host: string;
  appPublicUrl: string;
  serveWebDist: boolean;
  jwtSecret: string;
  adminApiKey: string;
  freeBetaMode: boolean;
  billingUiEnabled: boolean;
  dailyFreeAiTurns: number;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePrices: Record<string, string>;
  emailFrom: string;
  emailReplyTo: string;
  novamailApiKey: string;
  novamailBaseUrl: string;
  novamailAudienceId: string;
  resendApiKey: string;
  brevoApiKey: string;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  ollamaModel: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  appVersion: string;
  minSupportedVersion: string;
  androidStoreUrl: string;
  iosStoreUrl: string;
  corsOrigins: string[];
}

const isProduction = process.env.NODE_ENV === 'production';

function resolveSecret(envName: string): string {
  const value = (process.env[envName] ?? '').trim();
  if (value) return value;
  if (isProduction) {
    throw new Error(`Variável obrigatória ${envName} não definida em produção.`);
  }
  return crypto.randomBytes(32).toString('hex');
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  appPublicUrl: (process.env.APP_PUBLIC_URL ?? 'https://naidioma.nexaclouds.online').replace(/\/+$/, ''),
  serveWebDist: (process.env.SERVE_WEB_DIST ?? 'true').toLowerCase() !== 'false',
  jwtSecret: resolveSecret('JWT_SECRET'),
  adminApiKey: resolveSecret('ADMIN_API_KEY'),
  freeBetaMode: (process.env.FREE_BETA_MODE ?? 'true').toLowerCase() !== 'false',
  billingUiEnabled: (process.env.BILLING_UI_ENABLED ?? 'false').toLowerCase() === 'true',
  dailyFreeAiTurns: Number(process.env.DAILY_FREE_AI_TURNS ?? 60),
  stripeSecretKey: (process.env.STRIPE_SECRET_KEY ?? '').trim(),
  stripeWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim(),
  stripePrices: {
    STRIPE_PRICE_PLUS_MONTHLY: (process.env.STRIPE_PRICE_PLUS_MONTHLY ?? '').trim(),
    STRIPE_PRICE_PLUS_YEARLY: (process.env.STRIPE_PRICE_PLUS_YEARLY ?? '').trim(),
    STRIPE_PRICE_PRO_MONTHLY: (process.env.STRIPE_PRICE_PRO_MONTHLY ?? '').trim(),
    STRIPE_PRICE_PRO_YEARLY: (process.env.STRIPE_PRICE_PRO_YEARLY ?? '').trim(),
  },
  emailFrom: (process.env.EMAIL_FROM ?? 'NAidioma <oi@mail.nexaclouds.online>').trim(),
  emailReplyTo: (process.env.EMAIL_REPLY_TO ?? 'novamail@nexaclouds.online').trim(),
  novamailApiKey: (process.env.NOVAMAIL_API_KEY ?? '').trim(),
  novamailBaseUrl: (process.env.NOVAMAIL_BASE_URL ?? 'https://api.novamail.nexaclouds.online')
    .trim()
    .replace(/\/+$/, ''),
  novamailAudienceId: (process.env.NOVAMAIL_AUDIENCE_ID ?? '').trim(),
  resendApiKey: (process.env.RESEND_API_KEY ?? '').trim(),
  brevoApiKey: (process.env.BREVO_API_KEY ?? '').trim(),
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  ollamaApiKey: (process.env.OLLAMA_API_KEY ?? '').trim(),
  ollamaModel: (process.env.OLLAMA_MODEL ?? 'inkling-2-small').trim(),
  openaiBaseUrl: (process.env.OPENAI_BASE_URL ?? process.env.AI_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  openaiApiKey: (process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? '').trim(),
  openaiModel: (process.env.OPENAI_MODEL ?? process.env.AI_MODEL ?? 'llama-3.3-70b').trim(),
  geminiApiKey: (process.env.GEMINI_API_KEY ?? '').trim(),
  geminiModel: (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim(),
  appVersion: (process.env.APP_VERSION ?? '1.0.0').trim(),
  minSupportedVersion: (process.env.MIN_SUPPORTED_VERSION ?? '1.0.0').trim(),
  androidStoreUrl: (process.env.ANDROID_STORE_URL ?? '').trim(),
  iosStoreUrl: (process.env.IOS_STORE_URL ?? '').trim(),
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    'https://naidioma.nexaclouds.online,https://naidioma.com.br,https://www.naidioma.com.br,capacitor://localhost,https://localhost'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
