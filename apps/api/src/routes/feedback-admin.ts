import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  FeedbackCategorySchema,
  LanguageCodeSchema,
  PlatformTypeSchema,
} from '@naidioma/shared';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { isAuthorizedAdmin } from '../services/admin-auth.js';
import { pingOllamaEndpoint } from '../services/ai-gateway.js';
import {
  bulkSyncContactsToNovaMail,
  getActiveEmailProvider,
  sendPromotionalCampaign,
} from '../services/email.js';
import { getRuntimeSettings, updateRuntimeSettings } from '../services/runtime-config.js';
import { requireUser } from './auth.js';

const CreateFeedbackSchema = z.object({
  platform: PlatformTypeSchema.default('web'),
  category: FeedbackCategorySchema.default('ux'),
  language: LanguageCodeSchema.optional(),
  route: z.string().max(120).optional(),
  lessonId: z.string().max(80).optional(),
  message: z.string().trim().min(4).max(2000),
});

const UpdateFeedbackSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved']),
  adminNote: z.string().max(500).optional(),
});

const UpdateRuntimeConfigSchema = z.object({
  ollamaBaseUrl: z.string().max(300).optional(),
  ollamaApiKey: z.string().max(300).optional(),
  ollamaModel: z.string().max(120).optional(),
  openaiBaseUrl: z.string().max(300).optional(),
  openaiModel: z.string().max(120).optional(),
  freeBetaMode: z.boolean().optional(),
  billingUiEnabled: z.boolean().optional(),
  dailyFreeAiTurns: z.number().int().min(5).max(500).optional(),
  latestAppVersion: z.string().max(30).optional(),
  minSupportedVersion: z.string().max(30).optional(),
  releaseNotesPt: z.string().max(400).optional(),
  androidStoreUrl: z.string().max(300).optional(),
  iosStoreUrl: z.string().max(300).optional(),
});

function csvEscape(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function registerFeedbackAndAdminRoutes(app: FastifyInstance) {
  // Public version check endpoint for Web PWA, Android, and Apple iOS updates
  app.get('/api/app/version', async () => {
    const runtime = await getRuntimeSettings();
    return {
      appName: 'NAidioma',
      latestVersion: runtime.latestAppVersion,
      minSupportedVersion: runtime.minSupportedVersion,
      releaseNotesPt: runtime.releaseNotesPt,
      androidStoreUrl: runtime.androidStoreUrl,
      iosStoreUrl: runtime.iosStoreUrl,
      freeBetaMode: runtime.freeBetaMode,
      billingUiEnabled: runtime.billingUiEnabled,
    };
  });

  app.post('/api/feedback', async (req, reply) => {
    const parsed = CreateFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Descreva o feedback com pelo menos 4 caracteres.' });
    }

    const user = await requireUser(req);
    const created = await prisma.betaFeedback.create({
      data: {
        userId: user?.id ?? null,
        platform: parsed.data.platform,
        category: parsed.data.category,
        language: parsed.data.language ?? null,
        route: parsed.data.route ?? null,
        lessonId: parsed.data.lessonId ?? null,
        message: parsed.data.message,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent'].slice(0, 240)
            : null,
      },
    });

    return reply.status(201).send({
      id: created.id,
      message: 'Feedback recebido! Obrigado por ajudar a evoluir o NAidioma.',
    });
  });

  app.get('/api/admin/overview', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Chave de administrador inválida.' });
    }

    const [totalUsers, optInUsers, totalLessonsCompleted, feedbacks, runtime, ollamaStatus] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { marketingOptIn: true } }),
        prisma.lessonProgress.count(),
        prisma.betaFeedback.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { user: { select: { displayName: true, email: true } } },
        }),
        getRuntimeSettings(),
        pingOllamaEndpoint(),
      ]);

    return {
      metrics: {
        totalUsers,
        optInUsers,
        totalLessonsCompleted,
        openFeedbackCount: feedbacks.filter((f) => f.status !== 'resolved').length,
      },
      runtime: {
        ollamaBaseUrl: runtime.ollamaBaseUrl,
        ollamaHasApiKey: Boolean(runtime.ollamaApiKey),
        ollamaModel: runtime.ollamaModel,
        openaiBaseUrl: runtime.openaiBaseUrl,
        openaiModel: runtime.openaiModel,
        geminiConfigured: Boolean(config.geminiApiKey),
        stripeConfigured: Boolean(config.stripeSecretKey),
        emailConfigured: Boolean(config.novamailApiKey || config.resendApiKey || config.brevoApiKey),
        emailProvider: getActiveEmailProvider(),
        novamailAudienceConfigured: Boolean(config.novamailApiKey && config.novamailAudienceId),
        freeBetaMode: runtime.freeBetaMode,
        billingUiEnabled: runtime.billingUiEnabled,
        dailyFreeAiTurns: runtime.dailyFreeAiTurns,
        latestAppVersion: runtime.latestAppVersion,
        minSupportedVersion: runtime.minSupportedVersion,
        releaseNotesPt: runtime.releaseNotesPt,
        androidStoreUrl: runtime.androidStoreUrl,
        iosStoreUrl: runtime.iosStoreUrl,
      },
      ollamaStatus,
      feedbacks,
    };
  });

  // Mailing export for Email Marketing (JSON)
  app.get('/api/admin/mailing', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }
    const query = req.query as { onlyOptIn?: string; language?: string };
    const where: Record<string, unknown> = {};
    if (query.onlyOptIn !== 'false') where.marketingOptIn = true;
    if (query.language) where.activeLanguage = query.language;

    const contacts = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        whatsapp: true,
        activeLanguage: true,
        leadSource: true,
        utmCampaign: true,
        marketingOptIn: true,
        marketingOptInAt: true,
        xpTotal: true,
        streakDays: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    return { total: contacts.length, contacts };
  });

  // Mailing export for Brevo / Resend / Mailchimp (CSV download)
  app.get('/api/admin/mailing.csv', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }

    const contacts = await prisma.user.findMany({
      where: { marketingOptIn: true },
      orderBy: { createdAt: 'desc' },
      select: {
        displayName: true,
        email: true,
        whatsapp: true,
        activeLanguage: true,
        leadSource: true,
        utmCampaign: true,
        xpTotal: true,
        streakDays: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    const header = [
      'nome',
      'email',
      'whatsapp',
      'idioma_ativo',
      'origem',
      'campanha_utm',
      'xp_total',
      'ofensiva_dias',
      'plano',
      'cadastrado_em',
    ].join(',');

    const lines = contacts.map((c) =>
      [
        csvEscape(c.displayName),
        csvEscape(c.email),
        csvEscape(c.whatsapp),
        csvEscape(c.activeLanguage),
        csvEscape(c.leadSource),
        csvEscape(c.utmCampaign),
        csvEscape(c.xpTotal),
        csvEscape(c.streakDays),
        csvEscape(c.subscriptionTier),
        csvEscape(c.createdAt.toISOString()),
      ].join(','),
    );

    const csv = [header, ...lines].join('\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="naidioma-mailing.csv"')
      .send(csv);
  });

  app.patch('/api/admin/feedback/:id', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }
    const { id } = req.params as { id: string };
    const parsed = UpdateFeedbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Status inválido.' });

    const updated = await prisma.betaFeedback.update({
      where: { id },
      data: {
        status: parsed.data.status,
        adminNote: parsed.data.adminNote,
      },
    });
    return { feedback: updated };
  });

  app.post('/api/admin/ai-config', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }
    const parsed = UpdateRuntimeConfigSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Configuração inválida.' });

    const next = await updateRuntimeSettings(parsed.data);
    const ollamaStatus = await pingOllamaEndpoint();
    return {
      saved: true,
      runtime: {
        ollamaBaseUrl: next.ollamaBaseUrl,
        ollamaHasApiKey: Boolean(next.ollamaApiKey),
        ollamaModel: next.ollamaModel,
        openaiBaseUrl: next.openaiBaseUrl,
        openaiModel: next.openaiModel,
        freeBetaMode: next.freeBetaMode,
        billingUiEnabled: next.billingUiEnabled,
        dailyFreeAiTurns: next.dailyFreeAiTurns,
        latestAppVersion: next.latestAppVersion,
        minSupportedVersion: next.minSupportedVersion,
        releaseNotesPt: next.releaseNotesPt,
        androidStoreUrl: next.androidStoreUrl,
        iosStoreUrl: next.iosStoreUrl,
      },
      ollamaStatus,
    };
  });

  app.post('/api/admin/ai-ping', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }
    return pingOllamaEndpoint();
  });

  // Bulk-sync all NAidioma users into the configured NovaMail Audience (for funnels & broadcasts)
  app.post('/api/admin/mailing/sync-novamail', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }
    const users = await prisma.user.findMany({
      select: { email: true, displayName: true, marketingOptIn: true },
    });
    const res = await bulkSyncContactsToNovaMail(users);
    if (res.error) {
      return reply.status(400).send({ synced: res.synced, error: res.error });
    }
    return { ok: true, synced: res.synced, totalUsers: users.length };
  });

  // Send a test or live promotional email campaign via NovaMail to opted-in NAidioma users
  app.post('/api/admin/email-campaign', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito.' });
    }
    const schema = z.object({
      subject: z.string().trim().min(3).max(180),
      headline: z.string().trim().min(3).max(180),
      bodyText: z.string().trim().min(10).max(8000),
      ctaLabel: z.string().trim().max(80).optional(),
      ctaUrl: z.string().trim().url().max(300).optional(),
      testEmail: z.string().trim().email().optional(),
      language: LanguageCodeSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Preencha assunto, título e mensagem válidos.' });
    }

    const where: Record<string, unknown> = { marketingOptIn: true };
    if (parsed.data.language) where.activeLanguage = parsed.data.language;

    const recipients = parsed.data.testEmail
      ? []
      : await prisma.user.findMany({
          where,
          select: { email: true, displayName: true },
        });

    if (!parsed.data.testEmail && recipients.length === 0) {
      return reply.status(400).send({ error: 'Nenhum contato com opt-in encontrado para esse filtro.' });
    }

    const result = await sendPromotionalCampaign({
      subject: parsed.data.subject,
      headline: parsed.data.headline,
      bodyText: parsed.data.bodyText,
      ctaLabel: parsed.data.ctaLabel,
      ctaUrl: parsed.data.ctaUrl,
      testEmail: parsed.data.testEmail,
      recipients,
    });

    if (result.error && result.sentCount === 0) {
      return reply.status(502).send(result);
    }
    return result;
  });
}
