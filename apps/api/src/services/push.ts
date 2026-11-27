import webpush from 'web-push';
import { LANGUAGES, type LanguageCode } from '@naidioma/shared';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { scheduleCloudSync } from './cloud-sync.js';

const VAPID_CONFIG_KEY = 'naidioma_vapid_keys_v1';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedVapid: VapidKeys | null = null;

export async function getOrCreateVapidKeys(): Promise<VapidKeys> {
  if (cachedVapid) return cachedVapid;

  const envPub = (process.env.VAPID_PUBLIC_KEY ?? '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY ?? '').trim();
  if (envPub && envPriv) {
    cachedVapid = { publicKey: envPub, privateKey: envPriv };
    applyVapidDetails(cachedVapid);
    return cachedVapid;
  }

  const saved = await prisma.runtimeConfig.findUnique({ where: { key: VAPID_CONFIG_KEY } });
  if (saved) {
    try {
      const parsed = JSON.parse(saved.valueJson) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) {
        cachedVapid = parsed;
        applyVapidDetails(cachedVapid);
        return cachedVapid;
      }
    } catch {
      // regenerate below if corrupted
    }
  }

  const generated = webpush.generateVAPIDKeys();
  cachedVapid = { publicKey: generated.publicKey, privateKey: generated.privateKey };
  await prisma.runtimeConfig.upsert({
    where: { key: VAPID_CONFIG_KEY },
    create: { key: VAPID_CONFIG_KEY, valueJson: JSON.stringify(cachedVapid) },
    update: { valueJson: JSON.stringify(cachedVapid) },
  });
  scheduleCloudSync();
  applyVapidDetails(cachedVapid);
  return cachedVapid;
}

function applyVapidDetails(keys: VapidKeys) {
  const contactEmail = config.emailFrom.match(/<([^>]+)>/)?.[1] ?? 'contato@naidioma.com.br';
  webpush.setVapidDetails(`mailto:${contactEmail}`, keys.publicKey, keys.privateKey);
}

const MOTIVATIONAL_REMINDERS: Array<
  (ctx: { petName: string; langName: string; streakDays: number; childName: string }) => {
    title: string;
    body: string;
  }
> = [
  ({ petName, langName }) => ({
    title: `🦕 Roooar! ${petName} e o Dino estão te esperando!`,
    body: `Que tal brincar 3 minutinhos de ${langName} hoje e encaixar novas Peças 🧩? Você consegue!`,
  }),
  ({ petName, langName, childName }) => ({
    title: `🧩 ${childName}, seu superpoder de ${langName} está chamando!`,
    body: `Vem dar um passeio na trilha com ${petName}! Cada pecinha deixa seu cérebro ainda mais incrível!`,
  }),
  ({ petName, langName }) => ({
    title: `🌟 Missão Dinossauro liberada em ${langName}!`,
    body: `O Dino e ${petName} guardaram um desafio super legal para você hoje. Bora jogar? 🦕`,
  }),
  ({ petName, langName, streakDays }) => ({
    title:
      streakDays > 0
        ? `⚡ ${streakDays} dias no Ritmo de Foco! Bora continuar?`
        : `⚡ Hora de brilhar no seu ritmo!`,
    body: `Sem pressa e sem medo de errar: 3 minutinhos de ${langName} já deixam ${petName} pulando de alegria! 💖`,
  }),
  ({ petName, langName }) => ({
    title: `💖 ${petName} quer dar um pulo de alegria!`,
    body: `Vem encaixar só 1 pecinha de ${langName} hoje — você já está ficando fera nisso! 🧩`,
  }),
  ({ petName, langName }) => ({
    title: `🦕 Pequenos passos fazem grandes campeões!`,
    body: `${petName} está prontinho para andar até a próxima atividade de ${langName} com você! 🐾`,
  }),
  ({ petName, langName }) => ({
    title: `🚀 Rumo à próxima estrela em ${langName}!`,
    body: `O Dino preparou sons e figurinhas divertidas para você e ${petName} brincarem hoje!`,
  }),
  ({ petName, langName, childName }) => ({
    title: `🌈 Oi ${childName}! Hora da nossa aventura de ${langName}!`,
    body: `Só 3 minutinhos no seu tempo para deixar ${petName} super feliz e ganhar mais Peças 🧩!`,
  }),
];

function getLocalDateAndHour(now: Date, timezoneOffsetHours: number): { dateKey: string; hour: number } {
  const shifted = new Date(now.getTime() + timezoneOffsetHours * 3600 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    dateKey: `${year}-${month}-${day}`,
    hour: shifted.getUTCHours(),
  };
}

export async function sendPushNotificationToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ sent: boolean; expired?: boolean; error?: string }> {
  await getOrCreateVapidKeys();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? '/',
        tag: payload.tag ?? 'naidioma-daily-reminder',
      }),
      { TTL: 60 * 60 * 6 },
    );
    return { sent: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      return { sent: false, expired: true };
    }
    return { sent: false, error: err instanceof Error ? err.message : 'Push send error' };
  }
}

export async function sendDailyStudyReminders(): Promise<{
  checked: number;
  sent: number;
  skippedAlreadyStudied: number;
  expiredCleaned: number;
}> {
  await getOrCreateVapidKeys();
  const subs = await prisma.pushSubscription.findMany({
    where: { active: true },
    include: {
      user: {
        select: {
          displayName: true,
          activeLanguage: true,
          streakDays: true,
          lastStudyDate: true,
        },
      },
    },
  });

  const now = new Date();
  let sent = 0;
  let skippedAlreadyStudied = 0;
  let expiredCleaned = 0;

  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i]!;
    const { dateKey, hour } = getLocalDateAndHour(now, sub.timezoneOffset);

    if (sub.user.lastStudyDate === dateKey) {
      skippedAlreadyStudied++;
      continue;
    }
    if (sub.lastSentDate === dateKey) continue;
    if (hour < sub.reminderHour) continue;

    const langCode = (sub.user.activeLanguage as LanguageCode) || 'ko';
    const langName = LANGUAGES[langCode]?.namePt.split(' ')[0] ?? 'Idiomas';
    const childName = sub.user.displayName.split(' ')[0] || 'Campeão';
    const dayIndex = (now.getUTCDate() + i) % MOTIVATIONAL_REMINDERS.length;
    const msg = MOTIVATIONAL_REMINDERS[dayIndex]!({
      petName: sub.petName || 'Puzinho',
      langName,
      streakDays: sub.user.streakDays,
      childName,
    });

    const result = await sendPushNotificationToSubscription(sub, {
      ...msg,
      url: '/',
      tag: `naidioma-daily-${dateKey}`,
    });

    if (result.sent) {
      sent++;
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastSentDate: dateKey },
      });
    } else if (result.expired) {
      expiredCleaned++;
    }
  }

  if (sent > 0 || expiredCleaned > 0) {
    scheduleCloudSync();
  }

  return { checked: subs.length, sent, skippedAlreadyStudied, expiredCleaned };
}
