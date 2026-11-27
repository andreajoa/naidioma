import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';

export interface AppRuntimeSettings {
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  ollamaModel: string;
  openaiBaseUrl: string;
  openaiModel: string;
  freeBetaMode: boolean;
  billingUiEnabled: boolean;
  dailyFreeAiTurns: number;
  latestAppVersion: string;
  minSupportedVersion: string;
  releaseNotesPt: string;
  androidStoreUrl: string;
  iosStoreUrl: string;
}

const RUNTIME_KEY = 'naidioma_runtime_settings';

export async function getRuntimeSettings(): Promise<AppRuntimeSettings> {
  const defaults: AppRuntimeSettings = {
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaApiKey: config.ollamaApiKey,
    ollamaModel: config.ollamaModel,
    openaiBaseUrl: config.openaiBaseUrl,
    openaiModel: config.openaiModel,
    freeBetaMode: config.freeBetaMode,
    billingUiEnabled: config.billingUiEnabled,
    dailyFreeAiTurns: config.dailyFreeAiTurns,
    latestAppVersion: config.appVersion,
    minSupportedVersion: config.minSupportedVersion,
    releaseNotesPt: 'Lançamento NAidioma 1.0: 8 idiomas completos, Estúdio de Voz IA e revisão FSRS-4.5.',
    androidStoreUrl: config.androidStoreUrl,
    iosStoreUrl: config.iosStoreUrl,
  };

  try {
    const row = await prisma.runtimeConfig.findUnique({
      where: { key: RUNTIME_KEY },
    });
    if (!row) return defaults;
    const saved = JSON.parse(row.valueJson) as Partial<AppRuntimeSettings>;
    return {
      ollamaBaseUrl: (saved.ollamaBaseUrl ?? defaults.ollamaBaseUrl).trim().replace(/\/+$/, ''),
      ollamaApiKey: (saved.ollamaApiKey ?? defaults.ollamaApiKey).trim(),
      ollamaModel: (saved.ollamaModel ?? defaults.ollamaModel).trim(),
      openaiBaseUrl: (saved.openaiBaseUrl ?? defaults.openaiBaseUrl).trim().replace(/\/+$/, ''),
      openaiModel: (saved.openaiModel ?? defaults.openaiModel).trim(),
      freeBetaMode: saved.freeBetaMode ?? defaults.freeBetaMode,
      billingUiEnabled: saved.billingUiEnabled ?? defaults.billingUiEnabled,
      dailyFreeAiTurns: saved.dailyFreeAiTurns ?? defaults.dailyFreeAiTurns,
      latestAppVersion: (saved.latestAppVersion ?? defaults.latestAppVersion).trim(),
      minSupportedVersion: (saved.minSupportedVersion ?? defaults.minSupportedVersion).trim(),
      releaseNotesPt: (saved.releaseNotesPt ?? defaults.releaseNotesPt).trim(),
      androidStoreUrl: (saved.androidStoreUrl ?? defaults.androidStoreUrl).trim(),
      iosStoreUrl: (saved.iosStoreUrl ?? defaults.iosStoreUrl).trim(),
    };
  } catch {
    return defaults;
  }
}

export async function updateRuntimeSettings(
  patch: Partial<AppRuntimeSettings>,
): Promise<AppRuntimeSettings> {
  const current = await getRuntimeSettings();
  const next: AppRuntimeSettings = {
    ...current,
    ...patch,
    ollamaBaseUrl: (patch.ollamaBaseUrl ?? current.ollamaBaseUrl).trim().replace(/\/+$/, ''),
    openaiBaseUrl: (patch.openaiBaseUrl ?? current.openaiBaseUrl).trim().replace(/\/+$/, ''),
  };

  await prisma.runtimeConfig.upsert({
    where: { key: RUNTIME_KEY },
    create: { key: RUNTIME_KEY, valueJson: JSON.stringify(next) },
    update: { valueJson: JSON.stringify(next) },
  });

  return next;
}
