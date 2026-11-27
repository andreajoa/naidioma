import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LANGUAGES, type LanguageCode } from '@naidioma/shared';
import { prisma } from '../lib/prisma.js';
import {
  getOrCreateVapidKeys,
  sendPushNotificationToSubscription,
} from '../services/push.js';
import { requireUser } from './auth.js';

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(6).max(256),
  }),
  reminderHour: z.number().int().min(6).max(22).default(18),
  timezoneOffset: z.number().int().min(-12).max(14).default(-3),
  petName: z.string().trim().min(1).max(24).default('Puzinho'),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048).optional(),
});

export async function registerPushRoutes(app: FastifyInstance) {
  app.get('/api/push/status', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Não autenticado.' });

    const vapid = await getOrCreateVapidKeys();
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: user.id, active: true },
      orderBy: { updatedAt: 'desc' },
    });

    const latest = subs[0];
    return {
      vapidPublicKey: vapid.publicKey,
      enabled: subs.length > 0,
      devicesCount: subs.length,
      reminderHour: latest?.reminderHour ?? 18,
      petName: latest?.petName ?? 'Puzinho',
    };
  });

  app.post('/api/push/subscribe', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Não autenticado.' });

    const parsed = SubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Assinatura de notificação inválida.' });
    }

    const d = parsed.data;
    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint: d.endpoint },
      create: {
        userId: user.id,
        endpoint: d.endpoint,
        p256dh: d.keys.p256dh,
        auth: d.keys.auth,
        reminderHour: d.reminderHour,
        timezoneOffset: d.timezoneOffset,
        petName: d.petName,
        active: true,
      },
      update: {
        userId: user.id,
        p256dh: d.keys.p256dh,
        auth: d.keys.auth,
        reminderHour: d.reminderHour,
        timezoneOffset: d.timezoneOffset,
        petName: d.petName,
        active: true,
      },
    });

    return reply.status(201).send({
      ok: true,
      id: saved.id,
      reminderHour: saved.reminderHour,
    });
  });

  app.delete('/api/push/subscribe', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Não autenticado.' });

    const parsed = UnsubscribeSchema.safeParse(req.body ?? {});
    const endpoint = parsed.success ? parsed.data.endpoint : undefined;

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id },
      });
    }
    return { ok: true };
  });

  app.post('/api/push/test', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Não autenticado.' });

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: user.id, active: true },
    });

    if (subs.length === 0) {
      return reply
        .status(400)
        .send({ error: 'Ative os avisos na tela primeiro antes de enviar um teste.' });
    }

    const langCode = (user.activeLanguage as LanguageCode) || 'ko';
    const langName = LANGUAGES[langCode]?.namePt.split(' ')[0] ?? 'Idiomas';
    const childName = user.displayName.split(' ')[0] || 'Campeão';
    const petName = subs[0]?.petName || 'Puzinho';

    let delivered = 0;
    for (const sub of subs) {
      const res = await sendPushNotificationToSubscription(sub, {
        title: `🦕 Roooar! ${petName} e o Dino passaram para te dar um oi, ${childName}!`,
        body: `Avisos ativados! Todo dia vamos te chamar com carinho para encaixar Peças 🧩 de ${langName} no seu ritmo!`,
        url: '/',
        tag: `naidioma-test-${Date.now()}`,
      });
      if (res.sent) delivered++;
    }

    return { ok: delivered > 0, delivered };
  });
}
