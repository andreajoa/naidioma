import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  checkAdminLoginRateLimit,
  clearAdminLoginFailures,
  getAdminAuthMetadata,
  isAuthorizedAdmin,
  recordAdminAudit,
  recordAdminLoginFailure,
  rotateAdminPassword,
  signAdminDashboardToken,
  verifyAdminCredential,
} from '../services/admin-auth.js';
import {
  buildDashboardSummary,
  buildEnrichedUsers,
  csvEscape,
  emailSavedReport,
  generateAndSaveReport,
  getDashboardUserDetail,
  resolveDateWindow,
  type ReportPeriodType,
} from '../services/analytics.js';
import { extractClientIp, hashClientIp } from '../services/geo.js';

const AdminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, 'A nova senha precisa ter no mínimo 12 caracteres.').max(200),
});

const CreateReportSchema = z.object({
  title: z.string().trim().max(160).optional(),
  periodType: z.enum(['7d', '30d', '90d', 'all', 'custom']).default('30d'),
  from: z.string().optional(),
  to: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  sendEmailTo: z.string().trim().email().optional(),
});

const UpdateReportNotesSchema = z.object({
  notes: z.string().trim().max(2000),
});

const EmailReportSchema = z.object({
  toEmail: z.string().trim().email(),
});

export async function registerAdminDashboardRoutes(app: FastifyInstance) {
  // =========================================================================
  // 1. Admin Exclusive Authentication (Password -> Signed Admin Session JWT)
  // =========================================================================
  app.post('/api/admin/auth/login', async (req, reply) => {
    const parsed = AdminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Informe a senha de administrador.' });
    }

    const ipHash = hashClientIp(extractClientIp(req));
    const rate = checkAdminLoginRateLimit(ipHash);
    if (!rate.allowed) {
      await recordAdminAudit('login_blocked', req, `Rate limit lockout (${rate.retryAfterSeconds}s)`);
      return reply.status(429).send({
        error: `Muitas tentativas incorretas. Aguarde ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s) e tente novamente.`,
        retryAfterSeconds: rate.retryAfterSeconds,
      });
    }

    const verified = await verifyAdminCredential(parsed.data.password);
    if (!verified.ok) {
      const fail = recordAdminLoginFailure(ipHash);
      await recordAdminAudit('login_failed', req, `Remaining attempts: ${fail.remainingAttempts}`);
      return reply.status(401).send({
        error: fail.locked
          ? 'Acesso temporariamente bloqueado por 15 minutos devido a múltiplas senhas incorretas.'
          : `Senha de administrador incorreta. Restam ${fail.remainingAttempts} tentativa(s).`,
      });
    }

    clearAdminLoginFailures(ipHash);
    const signed = signAdminDashboardToken(verified.sessionVersion);
    const meta = await getAdminAuthMetadata();
    await recordAdminAudit('login_success', req, `Auth source: ${meta.source}`);

    return {
      authenticated: true,
      token: signed.token,
      expiresAt: signed.expiresAt,
      mustConfigurePassword: verified.mustConfigurePassword,
      authSource: meta.source,
    };
  });

  app.get('/api/admin/auth/session', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(401).send({ authenticated: false, error: 'Sessão administrativa expirada.' });
    }

    const [meta, recentAudits] = await Promise.all([
      getAdminAuthMetadata(),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return {
      authenticated: true,
      auth: meta,
      recentAudits: recentAudits.map((a) => ({
        id: a.id,
        action: a.action,
        city: a.city,
        country: a.country,
        ipHash: a.ipHash,
        userAgent: a.userAgent,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  app.post('/api/admin/auth/change-password', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Informe uma nova senha com pelo menos 12 caracteres.',
      });
    }

    const result = await rotateAdminPassword(
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    if (!result.ok) {
      await recordAdminAudit('password_change_failed', req, result.error);
      return reply.status(400).send({ error: result.error });
    }

    await recordAdminAudit('password_changed', req, 'Admin rotated dashboard password');
    return {
      ok: true,
      token: result.token,
      expiresAt: result.expiresAt,
      message: 'Senha atualizada e criptografada com scrypt no banco em nuvem! Sessões anteriores foram encerradas.',
    };
  });

  // =========================================================================
  // 2. Dashboard Analytics Summary, Users Directory & Visitor Access Log
  // =========================================================================
  app.get('/api/admin/dashboard/summary', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const q = req.query as { range?: string; from?: string; to?: string };
    const window = resolveDateWindow(q.range, q.from, q.to);
    return buildDashboardSummary(window);
  });

  app.get('/api/admin/dashboard/users', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }

    const q = req.query as {
      search?: string;
      language?: string;
      cefr?: string;
      city?: string;
      country?: string;
      status?: string;
      sort?: string;
      page?: string;
      limit?: string;
    };

    let rows = await buildEnrichedUsers();

    if (q.search?.trim()) {
      const needle = q.search.trim().toLowerCase();
      rows = rows.filter(
        (u) =>
          u.displayName.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          (u.city ?? '').toLowerCase().includes(needle) ||
          (u.region ?? '').toLowerCase().includes(needle) ||
          (u.whatsapp ?? '').toLowerCase().includes(needle) ||
          u.leadSource.toLowerCase().includes(needle),
      );
    }

    if (q.language?.trim()) {
      const lang = q.language.trim();
      rows = rows.filter(
        (u) =>
          u.activeLanguage === lang ||
          u.languagesStudied.some((s) => s.language === lang && s.completedLessons > 0),
      );
    }

    if (q.cefr?.trim()) {
      rows = rows.filter((u) => u.activeCefr === q.cefr!.trim().toUpperCase());
    }

    if (q.city?.trim()) {
      const c = q.city.trim().toLowerCase();
      rows = rows.filter((u) => (u.city ?? '').toLowerCase().includes(c));
    }

    if (q.country?.trim()) {
      const country = q.country.trim().toUpperCase();
      rows = rows.filter((u) => (u.country ?? '').toUpperCase() === country);
    }

    const nowMs = Date.now();
    if (q.status === 'active_7d') {
      rows = rows.filter(
        (u) => u.lastActiveAt && nowMs - new Date(u.lastActiveAt).getTime() <= 7 * 86_400_000,
      );
    } else if (q.status === 'inactive') {
      rows = rows.filter((u) => {
        const ref = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : new Date(u.createdAt).getTime();
        return nowMs - ref > 7 * 86_400_000;
      });
    } else if (q.status === 'never_studied') {
      rows = rows.filter((u) => u.lessonsCompleted === 0);
    } else if (q.status === 'pwa') {
      rows = rows.filter((u) => u.pwaInstalled);
    }

    switch (q.sort) {
      case 'time':
        rows.sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds);
        break;
      case 'xp':
        rows.sort((a, b) => b.xpTotal - a.xpTotal);
        break;
      case 'lessons':
        rows.sort((a, b) => b.lessonsCompleted - a.lessonsCompleted);
        break;
      case 'active':
        rows.sort((a, b) => {
          const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
          const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
          return tb - ta;
        });
        break;
      default:
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(10, Number(q.limit) || 50));
    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit);

    return { total, page, limit, items };
  });

  app.get('/api/admin/dashboard/users/:id', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const { id } = req.params as { id: string };
    const detail = await getDashboardUserDetail(id);
    if (!detail) return reply.status(404).send({ error: 'Perfil não encontrado.' });
    return detail;
  });

  app.get('/api/admin/dashboard/visitors', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }

    const q = req.query as {
      range?: string;
      onlyAnonymous?: string;
      city?: string;
      limit?: string;
    };
    const window = resolveDateWindow(q.range ?? '30d');
    const take = Math.min(250, Math.max(20, Number(q.limit) || 100));

    const where: Record<string, unknown> = {
      startedAt: { gte: window.start, lte: window.end },
    };
    if (q.onlyAnonymous === 'true') {
      where.userId = null;
    }
    if (q.city?.trim()) {
      where.city = { contains: q.city.trim() };
    }

    const sessions = await prisma.visitorSession.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      take,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            activeLanguage: true,
          },
        },
      },
    });

    return {
      total: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        visitorId: s.visitorId,
        userId: s.userId,
        user: s.user,
        startedAt: s.startedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        durationSeconds: s.durationSeconds,
        entryPath: s.entryPath,
        lastPath: s.lastPath,
        referrer: s.referrer,
        utmSource: s.utmSource,
        utmCampaign: s.utmCampaign,
        platform: s.platform,
        deviceType: s.deviceType,
        os: s.os,
        browser: s.browser,
        pwaInstalled: s.pwaInstalled,
        city: s.city,
        region: s.region,
        country: s.country,
        timezone: s.timezone,
        activeLanguage: s.activeLanguage,
        eventsCount: s.eventsCount,
        convertedToSignup: s.convertedToSignup,
      })),
    };
  });

  // =========================================================================
  // 3. Persistent Reports History, Creation, Notes & Email Delivery
  // =========================================================================
  app.get('/api/admin/dashboard/reports', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }

    const reports = await prisma.savedReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    return {
      reports: reports.map((r) => {
        let kpis: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(r.summaryJson) as { kpis?: Record<string, unknown> };
          kpis = parsed.kpis ?? {};
        } catch {
          kpis = {};
        }
        return {
          id: r.id,
          title: r.title,
          periodType: r.periodType,
          periodStart: r.periodStart.toISOString(),
          periodEnd: r.periodEnd.toISOString(),
          notes: r.notes,
          emailedTo: r.emailedTo,
          emailedAt: r.emailedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          kpis,
        };
      }),
    };
  });

  app.post('/api/admin/dashboard/reports', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const parsed = CreateReportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros de relatório inválidos.' });
    }

    const result = await generateAndSaveReport({
      title: parsed.data.title,
      periodType: parsed.data.periodType as ReportPeriodType,
      from: parsed.data.from,
      to: parsed.data.to,
      notes: parsed.data.notes,
      sendEmailTo: parsed.data.sendEmailTo,
    });

    await recordAdminAudit('report_generated', req, `Report ${result.report.id} (${parsed.data.periodType})`);

    return reply.status(201).send({
      report: {
        id: result.report.id,
        title: result.report.title,
        periodType: result.report.periodType,
        periodStart: result.report.periodStart.toISOString(),
        periodEnd: result.report.periodEnd.toISOString(),
        notes: result.report.notes,
        emailedTo: result.report.emailedTo,
        emailedAt: result.report.emailedAt?.toISOString() ?? null,
        createdAt: result.report.createdAt.toISOString(),
      },
      summary: result.summary,
      emailResult: result.emailResult,
    });
  });

  app.get('/api/admin/dashboard/reports/:id', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const { id } = req.params as { id: string };
    const report = await prisma.savedReport.findUnique({ where: { id } });
    if (!report) return reply.status(404).send({ error: 'Relatório não encontrado.' });

    return {
      report: {
        id: report.id,
        title: report.title,
        periodType: report.periodType,
        periodStart: report.periodStart.toISOString(),
        periodEnd: report.periodEnd.toISOString(),
        notes: report.notes,
        emailedTo: report.emailedTo,
        emailedAt: report.emailedAt?.toISOString() ?? null,
        createdAt: report.createdAt.toISOString(),
      },
      summary: JSON.parse(report.summaryJson),
    };
  });

  app.patch('/api/admin/dashboard/reports/:id', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const { id } = req.params as { id: string };
    const parsed = UpdateReportNotesSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Anotações inválidas.' });

    const updated = await prisma.savedReport.update({
      where: { id },
      data: { notes: parsed.data.notes },
    });
    return { ok: true, notes: updated.notes };
  });

  app.delete('/api/admin/dashboard/reports/:id', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const { id } = req.params as { id: string };
    await prisma.savedReport.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/api/admin/dashboard/reports/:id/email', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const { id } = req.params as { id: string };
    const parsed = EmailReportSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Informe um e-mail de destino válido.' });

    const res = await emailSavedReport(id, parsed.data.toEmail);
    await recordAdminAudit('report_emailed', req, `Report ${id} -> ${parsed.data.toEmail} (${res.sent ? 'ok' : 'fail'})`);
    if (!res.sent) {
      return reply.status(502).send({ error: res.error ?? 'Falha ao enviar relatório por e-mail.', ...res });
    }
    return res;
  });

  // =========================================================================
  // 4. Multi-Format Exports (CSV with UTF-8 BOM for Brazilian Excel + JSON)
  // =========================================================================
  app.get('/api/admin/dashboard/export.csv', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const q = req.query as { type?: string; range?: string };
    const type = q.type ?? 'users';
    const dateStamp = new Date().toISOString().slice(0, 10);
    await recordAdminAudit('csv_exported', req, `type=${type}`);

    if (type === 'visitors') {
      const window = resolveDateWindow(q.range ?? '30d');
      const sessions = await prisma.visitorSession.findMany({
        where: { startedAt: { gte: window.start, lte: window.end } },
        orderBy: { startedAt: 'desc' },
        take: 2000,
        include: { user: { select: { displayName: true, email: true } } },
      });

      const header = [
        'inicio',
        'ultimo_sinal',
        'duracao_segundos',
        'visitante_id',
        'cadastrado',
        'nome_usuario',
        'email_usuario',
        'cidade',
        'estado_regiao',
        'pais',
        'pagina_entrada',
        'origem_utm',
        'campanha_utm',
        'referrer',
        'plataforma',
        'dispositivo',
        'sistema',
        'navegador',
        'pwa_instalado',
        'idioma_ativo',
        'converteu_cadastro',
      ].join(',');

      const lines = sessions.map((s) =>
        [
          csvEscape(s.startedAt.toISOString()),
          csvEscape(s.lastSeenAt.toISOString()),
          csvEscape(s.durationSeconds),
          csvEscape(s.visitorId),
          csvEscape(s.userId ? 'Sim' : 'Anônimo'),
          csvEscape(s.user?.displayName ?? ''),
          csvEscape(s.user?.email ?? ''),
          csvEscape(s.city ?? ''),
          csvEscape(s.region ?? ''),
          csvEscape(s.country ?? ''),
          csvEscape(s.entryPath),
          csvEscape(s.utmSource ?? ''),
          csvEscape(s.utmCampaign ?? ''),
          csvEscape(s.referrer ?? ''),
          csvEscape(s.platform),
          csvEscape(s.deviceType),
          csvEscape(s.os ?? ''),
          csvEscape(s.browser ?? ''),
          csvEscape(s.pwaInstalled ? 'Sim' : 'Não'),
          csvEscape(s.activeLanguage ?? ''),
          csvEscape(s.convertedToSignup ? 'Sim' : 'Não'),
        ].join(','),
      );

      const csv = `\uFEFF${[header, ...lines].join('\n')}`;
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="naidioma-acessos-${dateStamp}.csv"`)
        .send(csv);
    }

    if (type === 'lessons') {
      const window = resolveDateWindow(q.range ?? 'all');
      const summary = await buildDashboardSummary(window);
      const header = [
        'licao_id',
        'titulo',
        'idioma',
        'nivel_cefr',
        'exame_oficial',
        'conclusoes',
        'tentativas',
        'media_precisao_pct',
        'duracao_media_seg',
        'abandonos',
        'taxa_retentativa',
      ].join(',');

      const seen = new Set<string>();
      const combined = [...summary.hardestLessons, ...summary.mostPopularLessons].filter((l) => {
        if (seen.has(l.lessonId)) return false;
        seen.add(l.lessonId);
        return true;
      });

      const lines = combined.map((l) =>
        [
          csvEscape(l.lessonId),
          csvEscape(l.titlePt),
          csvEscape(l.language),
          csvEscape(l.cefr),
          csvEscape(l.isLevelExam ? 'Sim' : 'Não'),
          csvEscape(l.completions),
          csvEscape(l.attempts),
          csvEscape(l.avgAccuracy),
          csvEscape(l.avgDurationSeconds),
          csvEscape(l.abandons),
          csvEscape(l.retryRatio),
        ].join(','),
      );

      const csv = `\uFEFF${[header, ...lines].join('\n')}`;
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="naidioma-licoes-${dateStamp}.csv"`)
        .send(csv);
    }

    // Default: Complete Users & Profiles Report CSV
    const users = await buildEnrichedUsers();
    const header = [
      'nome',
      'email',
      'whatsapp',
      'cidade',
      'estado_regiao',
      'pais',
      'idioma_ativo',
      'nivel_cefr_ativo',
      'progresso_nivel_pct',
      'todos_idiomas_e_niveis',
      'tempo_total_minutos',
      'sessoes',
      'media_sessao_minutos',
      'licoes_concluidas',
      'exames_aprovados',
      'precisao_media_pct',
      'revisoes_fsrs',
      'turnos_ia',
      'xp_total',
      'ofensiva_dias',
      'plataforma',
      'dispositivo',
      'pwa_instalado',
      'modo_calmo',
      'origem',
      'campanha_utm',
      'opt_in_email',
      'cadastrado_em',
      'ultimo_acesso',
    ].join(',');

    const lines = users.map((u) => {
      const langsSummary = u.languagesStudied
        .map((s) => `${s.languageNamePt}:${s.currentCefr}(${s.levelProgressPct}%)`)
        .join(' | ');
      return [
        csvEscape(u.displayName),
        csvEscape(u.email),
        csvEscape(u.whatsapp ?? ''),
        csvEscape(u.city ?? ''),
        csvEscape(u.region ?? ''),
        csvEscape(u.country ?? ''),
        csvEscape(u.activeLanguageNamePt),
        csvEscape(u.activeCefr),
        csvEscape(u.activeLevelProgressPct),
        csvEscape(langsSummary),
        csvEscape(Math.round(u.totalTimeSeconds / 60)),
        csvEscape(u.sessionsCount),
        csvEscape(Math.round((u.avgSessionSeconds / 60) * 10) / 10),
        csvEscape(u.lessonsCompleted),
        csvEscape(u.examsPassed),
        csvEscape(u.averageAccuracy),
        csvEscape(u.fsrsReviewsCount),
        csvEscape(u.aiTurnsTotal),
        csvEscape(u.xpTotal),
        csvEscape(u.streakDays),
        csvEscape(u.lastPlatform ?? ''),
        csvEscape(u.lastDeviceType ?? ''),
        csvEscape(u.pwaInstalled ? 'Sim' : 'Não'),
        csvEscape(u.calmModeEnabled ? 'Sim' : 'Não'),
        csvEscape(u.leadSource),
        csvEscape(u.utmCampaign ?? ''),
        csvEscape(u.marketingOptIn ? 'Sim' : 'Não'),
        csvEscape(u.createdAt),
        csvEscape(u.lastActiveAt ?? ''),
      ].join(',');
    });

    const csv = `\uFEFF${[header, ...lines].join('\n')}`;
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="naidioma-usuarios-completo-${dateStamp}.csv"`)
      .send(csv);
  });

  app.get('/api/admin/dashboard/export.json', async (req, reply) => {
    if (!(await isAuthorizedAdmin(req))) {
      return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
    const q = req.query as { range?: string; from?: string; to?: string };
    const window = resolveDateWindow(q.range ?? '30d', q.from, q.to);
    const [summary, users] = await Promise.all([buildDashboardSummary(window), buildEnrichedUsers()]);
    const dateStamp = new Date().toISOString().slice(0, 10);
    await recordAdminAudit('json_exported', req, `range=${window.periodType}`);

    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="naidioma-relatorio-${dateStamp}.json"`)
      .send(JSON.stringify({ summary, users }, null, 2));
  });
}
