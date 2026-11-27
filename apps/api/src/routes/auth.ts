import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LanguageCodeSchema, type LanguageCode } from '@naidioma/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../lib/auth.js';
import { sendWelcomeEmail, syncContactToNovaMail } from '../services/email.js';

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
  activeLanguage: LanguageCodeSchema.default('en'),
  dailyGoalMinutes: z.number().int().min(5).max(60).default(10),
  marketingOptIn: z.boolean().default(true),
  leadSource: z.string().trim().max(80).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const PreferencesSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  activeLanguage: LanguageCodeSchema.optional(),
  dailyGoalMinutes: z.number().int().min(5).max(60).optional(),
  marketingOptIn: z.boolean().optional(),
});

function sanitizeUser(user: {
  id: string;
  email: string;
  displayName: string;
  whatsapp: string | null;
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

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: parsed.data.displayName,
        whatsapp: parsed.data.whatsapp?.trim() || null,
        activeLanguage: parsed.data.activeLanguage,
        dailyGoalMinutes: parsed.data.dailyGoalMinutes,
        marketingOptIn: parsed.data.marketingOptIn,
        marketingOptInAt: parsed.data.marketingOptIn ? now : null,
        leadSource: parsed.data.leadSource || 'nucleoafetar',
        utmCampaign: parsed.data.utmCampaign || null,
      },
    });

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

    const token = signToken(user);
    return { token, user: sanitizeUser(user) };
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

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (typeof parsed.data.marketingOptIn === 'boolean') {
      updateData.marketingOptInAt = parsed.data.marketingOptIn ? new Date() : null;
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
