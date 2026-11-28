import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LanguageCodeSchema, type LanguageCode } from '@naidioma/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../lib/auth.js';
import { sendWelcomeEmail, syncContactToNovaMail } from '../services/email.js';
import {
  parseCityRegionInput,
  parseUserAgent,
  resolveRequestLocation,
} from '../services/geo.js';

export function extractBearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export async function requireUser(req: FastifyRequest) {
  const token = extractBearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.sub } });
}

const RegisterSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.').max(100),
  displayName: z.string().trim().min(2, 'Informe seu nome.').max(60),
  whatsapp: z.string().trim().max(30).optional(),
  city: z.string().trim().max(90).optional(),
  region: z.string().trim().max(40).optional(),
  country: z.string().trim().max(8).optional(),
  timezone: z.string().trim().max(60).optional(),
  visitorId: z.string().trim().max(80).optional(),
  platform: z.enum(['web', 'pwa', 'android', 'ios']).optional(),
  activeLanguage: LanguageCodeSchema.default('en'),
  dailyGoalMinutes: z.number().int().min(5).max(60).default(10),
  marketingOptIn: z.boolean().default(true),
  leadSource: z.string().trim().max(80).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  visitorId: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(60).optional(),
  platform: z.enum(['web', 'pwa', 'android', 'ios']).optional(),
});

const PreferencesSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  city: z.string().trim().max(90).optional().nullable(),
  region: z.string().trim().max(40).optional().nullable(),
  activeLanguage: LanguageCodeSchema.optional(),
  dailyGoalMinutes: z.number().int().min(5).max(60).optional(),
  marketingOptIn: z.boolean().optional(),
});

function sanitizeUser(user: {
  id: string;
  email: string;
  displayName: string;
  whatsapp: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  role: string;
  activeLanguage: string;
  dailyGoalMinutes: number;
  xpTotal: number;
  streakDays: number;
  longestStreak: number;
  lastStudyDate: string | null;
  marketingOptIn: boolean;
  leadSource: string;
  subscriptionTier: string;
  subscriptionPlanKey: string | null;
  subscriptionExpiresAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    whatsapp: user.whatsapp,
    city: user.city,
    region: user.region,
    country: user.country,
    role: user.role,
    activeLanguage: user.activeLanguage,
    dailyGoalMinutes: user.dailyGoalMinutes,
    xpTotal: user.xpTotal,
    streakDays: user.streakDays,
    longestStreak: user.longestStreak,
    lastStudyDate: user.lastStudyDate,
    marketingOptIn: user.marketingOptIn,
    leadSource: user.leadSource,
    subscriptionTier: user.subscriptionTier,
    subscriptionPlanKey: user.subscriptionPlanKey,
    subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Verifique os dados informados.';
      return reply.status(400).send({ error: firstIssue });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        error: 'Este e-mail já possui conta no NAidioma. Faça login para continuar de onde parou.',
      });
    }

    const [passwordHash, geo] = await Promise.all([
      hashPassword(parsed.data.password),
      resolveRequestLocation(req, parsed.data.timezone),
    ]);
    const userCityParsed = parseCityRegionInput(parsed.data.city, parsed.data.region);
    const ua = parseUserAgent(
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
    );
    const now = new Date();

    const finalCity = userCityParsed.city ?? geo.city;
    const finalRegion = userCityParsed.region ?? geo.region;
    const finalCountry = parsed.data.country?.toUpperCase() || geo.country || (userCityParsed.city ? 'BR' : null);
    const locationSource = userCityParsed.city ? 'user' : geo.source;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: parsed.data.displayName,
        whatsapp: parsed.data.whatsapp?.trim() || null,
        city: finalCity,
        region: finalRegion,
        country: finalCountry,
        timezone: geo.timezone,
        locationSource,
        visitorId: parsed.data.visitorId || null,
        sessionsCount: 1,
        lastActiveAt: now,
        lastPlatform: parsed.data.platform || 'web',
        lastDeviceType: ua.deviceType,
        lastOs: ua.os,
        lastBrowser: ua.browser,
        activeLanguage: parsed.data.activeLanguage,
        dailyGoalMinutes: parsed.data.dailyGoalMinutes,
        marketingOptIn: parsed.data.marketingOptIn,
        marketingOptInAt: parsed.data.marketingOptIn ? now : null,
        leadSource: parsed.data.leadSource || 'nucleoafetar',
        utmCampaign: parsed.data.utmCampaign || null,
      },
    });

    // Link anonymous pre-signup sessions and log signup conversion event
    if (parsed.data.visitorId) {
      void prisma.visitorSession
        .updateMany({
          where: { visitorId: parsed.data.visitorId, userId: null },
          data: {
            userId: user.id,
            convertedToSignup: true,
            city: finalCity ?? undefined,
            region: finalRegion ?? undefined,
            country: finalCountry ?? undefined,
          },
        })
        .catch(() => {});
    }

    void prisma.analyticsEvent
      .create({
        data: {
          visitorId: parsed.data.visitorId || `user:${user.id}`,
          userId: user.id,
          eventType: 'signup_completed',
          language: user.activeLanguage,
          city: finalCity,
          country: finalCountry,
          platform: parsed.data.platform || 'web',
        },
      })
      .catch(() => {});

    // Fire-and-forget welcome email + automatic NovaMail Audience sync (for follow-up/promo campaigns)
    void sendWelcomeEmail({
      email: user.email,
      displayName: user.displayName,
      language: user.activeLanguage as LanguageCode,
      userId: user.id,
    })
      .then(async (res) => {
        if (res.sent) {
          await prisma.user.update({
            where: { id: user.id },
            data: { welcomeEmailSent: true },
          });
        }
      })
      .catch(() => {});

    void syncContactToNovaMail({
      email: user.email,
      displayName: user.displayName,
      language: user.activeLanguage as LanguageCode,
      marketingOptIn: user.marketingOptIn,
      leadSource: user.leadSource,
    }).catch(() => {});

    const token = signToken(user);
    return reply.status(201).send({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Informe e-mail e senha válidos.' });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
    }

    const geo = await resolveRequestLocation(req, parsed.data.timezone);
    const ua = parseUserAgent(
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
    );
    const now = new Date();
    const patch: Record<string, unknown> = {
      lastActiveAt: now,
      lastPlatform: parsed.data.platform ?? user.lastPlatform ?? 'web',
      lastDeviceType: ua.deviceType,
      lastOs: ua.os,
      lastBrowser: ua.browser,
    };
    if (user.locationSource !== 'user' && !user.city && geo.city) {
      patch.city = geo.city;
      patch.region = geo.region;
      patch.country = geo.country;
      patch.timezone = geo.timezone;
      patch.locationSource = geo.source;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: patch,
    });

    if (parsed.data.visitorId) {
      void prisma.visitorSession
        .updateMany({
          where: { visitorId: parsed.data.visitorId, userId: null },
          data: { userId: user.id },
        })
        .catch(() => {});
    }

    void prisma.analyticsEvent
      .create({
        data: {
          visitorId: parsed.data.visitorId || `user:${user.id}`,
          userId: user.id,
          eventType: 'login_completed',
          language: updatedUser.activeLanguage,
          city: updatedUser.city,
          country: updatedUser.country,
          platform: parsed.data.platform || 'web',
        },
      })
      .catch(() => {});

    const token = signToken(updatedUser);
    return { token, user: sanitizeUser(updatedUser) };
  });

  app.get('/api/me', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão expirada. Faça login novamente.' });
    return { user: sanitizeUser(user) };
  });

  app.patch('/api/me/preferences', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão expirada.' });

    const parsed = PreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Preferências inválidas.' });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
    if (parsed.data.whatsapp !== undefined) updateData.whatsapp = parsed.data.whatsapp;
    if (parsed.data.activeLanguage !== undefined) updateData.activeLanguage = parsed.data.activeLanguage;
    if (parsed.data.dailyGoalMinutes !== undefined) updateData.dailyGoalMinutes = parsed.data.dailyGoalMinutes;
    if (typeof parsed.data.marketingOptIn === 'boolean') {
      updateData.marketingOptIn = parsed.data.marketingOptIn;
      updateData.marketingOptInAt = parsed.data.marketingOptIn ? new Date() : null;
    }

    if (parsed.data.city !== undefined || parsed.data.region !== undefined) {
      const parsedLoc = parseCityRegionInput(parsed.data.city, parsed.data.region);
      updateData.city = parsedLoc.city;
      updateData.region = parsedLoc.region;
      if (parsedLoc.city) {
        updateData.locationSource = 'user';
        if (!user.country) updateData.country = 'BR';
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (typeof parsed.data.marketingOptIn === 'boolean' || parsed.data.activeLanguage) {
      void syncContactToNovaMail({
        email: updated.email,
        displayName: updated.displayName,
        language: updated.activeLanguage as LanguageCode,
        marketingOptIn: updated.marketingOptIn,
        leadSource: updated.leadSource,
      }).catch(() => {});
    }

    return { user: sanitizeUser(updated) };
  });
}
