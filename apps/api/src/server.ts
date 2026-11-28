import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { registerAdminDashboardRoutes } from './routes/admin-dashboard.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerFeedbackAndAdminRoutes } from './routes/feedback-admin.js';
import { registerPushRoutes } from './routes/push.js';
import { registerSeoRoutes } from './routes/seo.js';
import { registerTelemetryRoutes } from './routes/telemetry.js';
import { getAiCapabilities } from './services/ai-gateway.js';
import { generateAndSaveReport, pruneOldTelemetryEvents } from './services/analytics.js';
import { getActiveEmailProvider } from './services/email.js';
import {
  getCloudSyncStatus,
  pushDatabaseToCloudflare,
  scheduleCloudSync,
} from './services/cloud-sync.js';
import { sendDailyStudyReminders } from './services/push.js';
import { getRuntimeSettings } from './services/runtime-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 4_194_304,
  });

  // Preserve raw body for Stripe webhook cryptographic verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = body as Buffer;
      if (!body || (body as Buffer).length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse((body as Buffer).toString('utf8')));
      } catch (err) {
        done(err as Error);
      }
    },
  );

  // Allow navigator.sendBeacon text/plain telemetry payloads
  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, typeof body === 'string' ? body : '');
    },
  );

  await app.register(helmet, {
    contentSecurityPolicy: false, // SPA + Capacitor + Web Speech API compatibility
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        config.corsOrigins.includes('*') ||
        config.corsOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('capacitor://')
      ) {
        return cb(null, true);
      }
      return cb(null, true); // Open for mobile/web origins authenticated via JWT header
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 180,
    timeWindow: '1 minute',
  });

  // Protect /dashboard and /api/admin/* from indexing & intermediary caching
  app.addHook('onSend', (req, reply, payload, done) => {
    if (req.url.startsWith('/dashboard') || req.url.startsWith('/api/admin')) {
      reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      reply.header('CDN-Cache-Control', 'no-store');
    }
    done(null, payload);
  });

  app.get('/api/health', async () => {
    const [runtime, aiCaps] = await Promise.all([getRuntimeSettings(), getAiCapabilities()]);
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      app: 'NAidioma',
      version: runtime.latestAppVersion,
      freeBetaMode: runtime.freeBetaMode,
      billingUiEnabled: runtime.billingUiEnabled,
      ollamaConfigured: Boolean(runtime.ollamaBaseUrl),
      aiConfigured: aiCaps.aiOnline,
      aiProvider: aiCaps.primaryProvider,
      aiModel: aiCaps.primaryModel,
      sttConfigured: aiCaps.sttAvailable,
      emailProvider: getActiveEmailProvider(),
      novamailAudienceConfigured: Boolean(config.novamailApiKey && config.novamailAudienceId),
      cloudSync: getCloudSyncStatus(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/cron/health-ping', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, pingedAt: new Date().toISOString() };
  });

  app.get('/api/cron/backup', async () => {
    return pushDatabaseToCloudflare();
  });

  app.get('/api/cron/daily-reminders', async () => {
    return sendDailyStudyReminders();
  });

  app.get('/api/cron/weekly-report', async () => {
    const [generated, prunedEvents] = await Promise.all([
      generateAndSaveReport({
        title: `Relatório Semanal Automático · ${new Date().toISOString().slice(0, 10)}`,
        periodType: '7d',
        sendEmailTo: config.adminReportEmail || undefined,
      }),
      pruneOldTelemetryEvents(180),
    ]);
    return {
      ok: true,
      reportId: generated.report.id,
      emailed: Boolean(generated.emailResult?.sent),
      prunedEvents,
    };
  });

  // Automatically replicate every successful write mutation to Cloudflare (NexaCloud Private KV)
  app.addHook('onResponse', (req, reply, done) => {
    if (
      req.url.startsWith('/api/') &&
      (req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PATCH' ||
        req.method === 'DELETE') &&
      reply.statusCode >= 200 &&
      reply.statusCode < 300
    ) {
      scheduleCloudSync();
    }
    done();
  });

  await registerAuthRoutes(app);
  await registerCourseRoutes(app);
  await registerAiRoutes(app);
  await registerBillingRoutes(app);
  await registerFeedbackAndAdminRoutes(app);
  await registerAdminDashboardRoutes(app);
  await registerTelemetryRoutes(app);
  await registerPushRoutes(app);
  await registerSeoRoutes(app);

  // Unified NexaCloud production hosting: serve compiled Web App / PWA on same port
  const webDistDir = path.resolve(__dirname, '../../app/dist');
  if ((config.serveWebDist || process.env.NODE_ENV === 'production') && fs.existsSync(webDistDir)) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: '/',
      wildcard: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        }
        if (
          filePath.endsWith('sw.js') ||
          filePath.endsWith('push-sw.js') ||
          filePath.endsWith('registerSW.js') ||
          filePath.endsWith('manifest.webmanifest') ||
          filePath.endsWith('index.html')
        ) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('CDN-Cache-Control', 'no-store');
        }
      },
    });

    const serveAdminShell = (_req: unknown, reply: { header: (k: string, v: string) => unknown; sendFile: (f: string) => unknown }) => {
      reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      reply.header('CDN-Cache-Control', 'no-store');
      return reply.sendFile('index.html');
    };

    app.get('/dashboard', serveAdminShell);
    app.get('/dashboard/', serveAdminShell);
    app.get('/dashboard/*', serveAdminShell);

    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Endpoint não encontrado.' });
      }
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('CDN-Cache-Control', 'no-store');
      return reply.sendFile('index.html');
    });
  }

  return app;
}
