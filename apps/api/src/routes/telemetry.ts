import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LanguageCodeSchema } from '@naidioma/shared';
import { prisma } from '../lib/prisma.js';
import { requireUser } from './auth.js';
import {
  extractClientIp,
  hashClientIp,
  parseUserAgent,
  resolveRequestLocation,
} from '../services/geo.js';

const SessionStartSchema = z.object({
  visitorId: z.string().trim().min(6).max(80),
  sessionId: z.string().trim().max(80).optional(),
  entryPath: z.string().trim().max(200).default('/'),
  referrer: z.string().trim().max(300).optional().nullable(),
  utmSource: z.string().trim().max(80).optional().nullable(),
  utmMedium: z.string().trim().max(80).optional().nullable(),
  utmCampaign: z.string().trim().max(120).optional().nullable(),
  platform: z.enum(['web', 'pwa', 'android', 'ios']).default('web'),
  screenWidth: z.number().int().min(100).max(8000).optional(),
  screenHeight: z.number().int().min(100).max(8000).optional(),
  pwaInstalled: z.boolean().optional(),
  calmModeEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  timezone: z.string().trim().max(60).optional(),
  activeLanguage: LanguageCodeSchema.optional(),
});

const HeartbeatSchema = z.object({
  visitorId: z.string().trim().min(6).max(80),
  sessionId: z.string().trim().min(6).max(80),
  deltaSeconds: z.number().int().min(1).max(180),
  screen: z.string().trim().max(40).default('learn'),
  path: z.string().trim().max(200).optional(),
  language: LanguageCodeSchema.optional(),
  pwaInstalled: z.boolean().optional(),
  calmModeEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

const EventSchema = z.object({
  visitorId: z.string().trim().min(6).max(80),
  sessionId: z.string().trim().max(80).optional(),
  eventType: z.string().trim().min(2).max(60),
  language: LanguageCodeSchema.optional(),
  cefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  lessonId: z.string().trim().max(80).optional(),
  screen: z.string().trim().max(40).optional(),
  valueNum: z.number().int().min(0).max(100_000).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  platform: z.enum(['web', 'pwa', 'android', 'ios']).optional(),
});

function parseJsonBodyIfText(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function mergeScreensJson(existingRaw: string, screen: string, deltaSeconds: number): string {
  let current: Record<string, number> = {};
  try {
    const parsed = JSON.parse(existingRaw) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) current[k] = v;
    }
  } catch {
    current = {};
  }
  const cleanScreen = screen.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'learn';
  current[cleanScreen] = (current[cleanScreen] ?? 0) + deltaSeconds;
  return JSON.stringify(current);
}

export async function trackSeoPageVisit(req: FastifyRequest, slug: string): Promise<void> {
  try {
    const uaStr = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const ua = parseUserAgent(uaStr);
    if (ua.isBot) return;

    const ip = extractClientIp(req);
    const ipHash = hashClientIp(ip);
    const loc = await resolveRequestLocation(req);
    const referrer = typeof req.headers.referer === 'string' ? req.headers.referer.slice(0, 260) : null;
    const visitorId = `seo_${ipHash}`;
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    const recent = await prisma.visitorSession.findFirst({
      where: {
        visitorId,
        entryPath: `/${slug}/`,
        lastSeenAt: { gte: tenMinAgo },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (recent) {
      await prisma.visitorSession.update({
        where: { id: recent.id },
        data: { lastSeenAt: new Date(), eventsCount: { increment: 1 } },
      });
      return;
    }

    await prisma.visitorSession.create({
      data: {
        visitorId,
        entryPath: `/${slug}/`,
        lastPath: `/${slug}/`,
        referrer,
        platform: 'web',
        deviceType: ua.deviceType,
        os: ua.os,
        browser: ua.browser,
        city: loc.city,
        region: loc.region,
        country: loc.country,
        timezone: loc.timezone,
        ipHash,
      },
    });
  } catch {
    // Never impact SEO page response
  }
}

export async function registerTelemetryRoutes(app: FastifyInstance) {
  app.post('/api/telemetry/session/start', async (req, reply) => {
    const rawBody = parseJsonBodyIfText(req.body);
    const parsed = SessionStartSchema.safeParse(rawBody);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Payload de sessão inválido.' });
    }

    // Never track admin dashboard views inside student telemetry
    if (parsed.data.entryPath.startsWith('/dashboard')) {
      return { ok: true, ignored: true };
    }

    const user = await requireUser(req);
    const uaStr = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const ua = parseUserAgent(uaStr);
    const ip = extractClientIp(req);
    const ipHash = hashClientIp(ip);
    const loc = await resolveRequestLocation(req, parsed.data.timezone);
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Resume an active session from the last 30 minutes if provided or same visitor
    let session = parsed.data.sessionId
      ? await prisma.visitorSession.findUnique({ where: { id: parsed.data.sessionId } })
      : null;

    if (session && session.lastSeenAt < thirtyMinAgo) {
      session = null;
    }

    if (session) {
      session = await prisma.visitorSession.update({
        where: { id: session.id },
        data: {
          userId: user?.id ?? session.userId,
          lastSeenAt: now,
          lastPath: parsed.data.entryPath,
          platform: parsed.data.platform,
          pwaInstalled: parsed.data.pwaInstalled ?? session.pwaInstalled,
          activeLanguage: parsed.data.activeLanguage ?? user?.activeLanguage ?? session.activeLanguage,
          city: session.city ?? loc.city,
          region: session.region ?? loc.region,
          country: session.country ?? loc.country,
          timezone: session.timezone ?? loc.timezone,
          eventsCount: { increment: 1 },
        },
      });
    } else {
      session = await prisma.visitorSession.create({
        data: {
          visitorId: parsed.data.visitorId,
          userId: user?.id ?? null,
          entryPath: parsed.data.entryPath,
          lastPath: parsed.data.entryPath,
          referrer: parsed.data.referrer?.slice(0, 260) || null,
          utmSource: parsed.data.utmSource?.slice(0, 80) || null,
          utmMedium: parsed.data.utmMedium?.slice(0, 80) || null,
          utmCampaign: parsed.data.utmCampaign?.slice(0, 120) || null,
          platform: parsed.data.platform,
          deviceType: ua.deviceType,
          os: ua.os,
          browser: ua.browser,
          screenWidth: parsed.data.screenWidth ?? null,
          screenHeight: parsed.data.screenHeight ?? null,
          pwaInstalled: parsed.data.pwaInstalled ?? false,
          city: user?.city ?? loc.city,
          region: user?.region ?? loc.region,
          country: user?.country ?? loc.country,
          timezone: user?.timezone ?? loc.timezone,
          ipHash,
          activeLanguage: parsed.data.activeLanguage ?? user?.activeLanguage ?? null,
        },
      });

      if (user) {
        const userPatch: Record<string, unknown> = {
          sessionsCount: { increment: 1 },
          lastActiveAt: now,
          lastPlatform: parsed.data.platform,
          lastDeviceType: ua.deviceType,
          lastOs: ua.os,
          lastBrowser: ua.browser,
          visitorId: user.visitorId ?? parsed.data.visitorId,
        };
        if (typeof parsed.data.pwaInstalled === 'boolean' && parsed.data.pwaInstalled) {
          userPatch.pwaInstalled = true;
        }
        if (typeof parsed.data.calmModeEnabled === 'boolean') {
          userPatch.calmModeEnabled = parsed.data.calmModeEnabled;
        }
        if (typeof parsed.data.soundEnabled === 'boolean') {
          userPatch.soundEnabled = parsed.data.soundEnabled;
        }
        if (user.locationSource !== 'user' && (loc.city || loc.country)) {
          if (loc.city && !user.city) userPatch.city = loc.city;
          if (loc.region && !user.region) userPatch.region = loc.region;
          if (loc.country && !user.country) userPatch.country = loc.country;
          if (loc.timezone && !user.timezone) userPatch.timezone = loc.timezone;
          if (!user.locationSource && loc.source) userPatch.locationSource = loc.source;
        }
        await prisma.user.update({ where: { id: user.id }, data: userPatch });
      }
    }

    return {
      ok: true,
      sessionId: session.id,
      detectedLocation: {
        city: session.city,
        region: session.region,
        country: session.country,
      },
    };
  });

  app.post('/api/telemetry/heartbeat', async (req, reply) => {
    const rawBody = parseJsonBodyIfText(req.body);
    const parsed = HeartbeatSchema.safeParse(rawBody);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Heartbeat inválido.' });
    }

    if (parsed.data.path?.startsWith('/dashboard')) {
      return { ok: true, ignored: true };
    }

    const user = await requireUser(req);
    const now = new Date();
    const session = await prisma.visitorSession.findUnique({
      where: { id: parsed.data.sessionId },
    });

    if (!session) {
      return { ok: true, recreated: false };
    }

    const nextScreensJson = mergeScreensJson(
      session.screensJson,
      parsed.data.screen,
      parsed.data.deltaSeconds,
    );

    const linkedUserId = user?.id ?? session.userId;

    await prisma.visitorSession.update({
      where: { id: session.id },
      data: {
        userId: linkedUserId,
        lastSeenAt: now,
        durationSeconds: { increment: parsed.data.deltaSeconds },
        lastPath: parsed.data.path ?? session.lastPath,
        activeLanguage: parsed.data.language ?? session.activeLanguage,
        pwaInstalled: parsed.data.pwaInstalled ?? session.pwaInstalled,
        screensJson: nextScreensJson,
      },
    });

    if (linkedUserId) {
      const userUpdate: Record<string, unknown> = {
        totalTimeSeconds: { increment: parsed.data.deltaSeconds },
        lastActiveAt: now,
      };
      if (parsed.data.pwaInstalled) userUpdate.pwaInstalled = true;
      if (typeof parsed.data.calmModeEnabled === 'boolean') {
        userUpdate.calmModeEnabled = parsed.data.calmModeEnabled;
      }
      if (typeof parsed.data.soundEnabled === 'boolean') {
        userUpdate.soundEnabled = parsed.data.soundEnabled;
      }
      await prisma.user
        .update({
          where: { id: linkedUserId },
          data: userUpdate,
        })
        .catch(() => {});
    }

    return { ok: true };
  });

  app.post('/api/telemetry/event', async (req, reply) => {
    const rawBody = parseJsonBodyIfText(req.body);
    const parsed = EventSchema.safeParse(rawBody);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Evento inválido.' });
    }

    const user = await requireUser(req);
    const session = parsed.data.sessionId
      ? await prisma.visitorSession.findUnique({
          where: { id: parsed.data.sessionId },
          select: { id: true, city: true, country: true, platform: true },
        })
      : null;

    await prisma.analyticsEvent.create({
      data: {
        visitorId: parsed.data.visitorId,
        sessionId: session?.id ?? null,
        userId: user?.id ?? null,
        eventType: parsed.data.eventType,
        language: parsed.data.language ?? user?.activeLanguage ?? null,
        cefr: parsed.data.cefr ?? null,
        lessonId: parsed.data.lessonId ?? null,
        screen: parsed.data.screen ?? null,
        valueNum: parsed.data.valueNum ?? null,
        metaJson: parsed.data.meta ? JSON.stringify(parsed.data.meta).slice(0, 500) : null,
        city: user?.city ?? session?.city ?? null,
        country: user?.country ?? session?.country ?? null,
        platform: parsed.data.platform ?? session?.platform ?? 'web',
      },
    });

    if (session) {
      await prisma.visitorSession
        .update({
          where: { id: session.id },
          data: { eventsCount: { increment: 1 }, lastSeenAt: new Date() },
        })
        .catch(() => {});
    }

    return reply.status(201).send({ ok: true });
  });
}
