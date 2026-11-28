import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../lib/config.js';
import { resetAdminRateLimitsForTests } from '../services/admin-auth.js';

describe('NAidioma API Integration', () => {
  let app: FastifyInstance;
  let authToken = '';
  const testEmail = `beta-${Date.now()}@naidioma.com.br`;
  const testVisitorId = `v_test_${Date.now()}`;
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    resetAdminRateLimitsForTests();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await prisma.savedReport.deleteMany({ where: { id: { in: createdReportIds } } });
    await prisma.analyticsEvent.deleteMany({ where: { visitorId: testVisitorId } });
    await prisma.visitorSession.deleteMany({ where: { visitorId: testVisitorId } });
    await prisma.runtimeConfig.deleteMany({ where: { key: 'naidioma_admin_auth' } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
    await prisma.$disconnect();
  });

  it('returns healthy status with hidden billing and free beta enabled', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.app).toBe('NAidioma');
    expect(body.freeBetaMode).toBe(true);
    expect(body.billingUiEnabled).toBe(false);
  });

  it('enforces registration with email & LGPD mailing opt-in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testEmail,
        password: 'Password123!',
        displayName: 'Maria Silva',
        whatsapp: '13999990000',
        activeLanguage: 'en',
        marketingOptIn: true,
        leadSource: 'nucleoafetar',
        utmCampaign: 'lancamento',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.marketingOptIn).toBe(true);
    expect(body.user.leadSource).toBe('nucleoafetar');
    authToken = body.token;
  });

  it('lists all 8 courses and records lesson completion + FSRS review', async () => {
    const coursesRes = await app.inject({
      method: 'GET',
      url: '/api/courses',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(coursesRes.statusCode).toBe(200);
    expect(coursesRes.json().languages).toHaveLength(8);

    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/lessons/en-u1-l1/complete',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { accuracy: 92, durationSeconds: 120 },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().xpGained).toBeGreaterThan(0);
    expect(completeRes.json().streakDays).toBe(1);

    const reviewRes = await app.inject({
      method: 'POST',
      url: '/api/review/en-fc-1',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { language: 'en', rating: 3 },
    });
    expect(reviewRes.statusCode).toBe(200);
    expect(reviewRes.json().intervalDays).toBeGreaterThanOrEqual(1);

    // Official Level Exam MUST be blocked (403) before mastering all study stages of A1
    const earlyExamRes = await app.inject({
      method: 'POST',
      url: '/api/lessons/en-exam-a1/complete',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { accuracy: 100, durationSeconds: 180 },
    });
    expect(earlyExamRes.statusCode).toBe(403);
  });

  it('exposes AI capabilities status endpoint for 24/7 Llama 3.3 & Whisper detection', async () => {
    const statusRes = await app.inject({ method: 'GET', url: '/api/ai/status' });
    expect(statusRes.statusCode).toBe(200);
    const body = statusRes.json();
    expect(typeof body.aiOnline).toBe('boolean');
    expect(typeof body.sttAvailable).toBe('boolean');
    expect(typeof body.primaryModel).toBe('string');
  });

  it('handles AI conversation gracefully even before Ollama/Kaggle URL is set', async () => {
    const aiRes = await app.inject({
      method: 'POST',
      url: '/api/ai/conversation',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        scenarioId: 'en-sc-coffee',
        userMessage: 'Hi! Can I get an iced latte to go, please?',
        history: [],
      },
    });
    expect(aiRes.statusCode).toBe(200);
    const body = aiRes.json();
    expect(body.replyText).toBeTruthy();
    expect(body.coach.naturalnessScore).toBeGreaterThan(50);
  });

  it('keeps Stripe billing hidden & blocked until explicitly enabled', async () => {
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/billing/status',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().billingVisible).toBe(false);
    expect(statusRes.json().plans.length).toBeGreaterThanOrEqual(5);

    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { planKey: 'plus_yearly' },
    });
    expect(checkoutRes.statusCode).toBe(403);
  });

  it('collects tester feedback and exports mailing CSV in admin API', async () => {
    const fbRes = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        platform: 'web',
        category: 'idea',
        language: 'en',
        route: '/learn',
        message: 'Adorei o treino de falsos cognatos para brasileiros!',
      },
    });
    expect(fbRes.statusCode).toBe(201);

    const csvRes = await app.inject({
      method: 'GET',
      url: '/api/admin/mailing.csv',
      headers: { 'x-admin-key': config.adminApiKey },
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.body).toContain(testEmail);
    expect(csvRes.body).toContain('nucleoafetar');
  });

  it('serves complete SEO & GEO assets for Brazil, USA, Canada, Australia, and New Zealand', async () => {
    const robots = await app.inject({ method: 'GET', url: '/robots.txt' });
    expect(robots.statusCode).toBe(200);
    expect(robots.body).toContain('GPTBot');
    expect(robots.body).toContain('PerplexityBot');
    expect(robots.body).toContain('ClaudeBot');
    expect(robots.body).toContain('Disallow: /dashboard');
    expect(robots.body).toContain('Sitemap:');

    const sitemap = await app.inject({ method: 'GET', url: '/sitemap.xml' });
    expect(sitemap.statusCode).toBe(200);
    expect(sitemap.body).toContain('hreflang="pt-BR"');
    expect(sitemap.body).toContain('hreflang="en-US"');
    expect(sitemap.body).toContain('hreflang="en-CA"');
    expect(sitemap.body).toContain('hreflang="en-AU"');
    expect(sitemap.body).toContain('hreflang="en-NZ"');

    const llms = await app.inject({ method: 'GET', url: '/llms.txt' });
    expect(llms.statusCode).toBe(200);
    expect(llms.body).toContain('100% FREE');
    expect(llms.body).toContain('New Zealand');

    for (const slug of ['pt-br', 'en-us', 'en-ca', 'en-au', 'en-nz', 'ingles-a1-c2', 'chamada-ao-vivo-ia']) {
      const page = await app.inject({ method: 'GET', url: `/${slug}/` });
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain('application/ld+json');
      expect(page.body).toContain('FAQPage');
      expect(page.body).toContain('hreflang="pt-BR"');

      const redir = await app.inject({ method: 'GET', url: `/${slug}` });
      expect(redir.statusCode).toBe(301);
    }
  });

  it('tracks visitor sessions with Cloudflare geolocation, sendBeacon heartbeats, city, time & CEFR levels in /dashboard API', async () => {
    // 1. Anonymous visitor opens the app from São Paulo via Cloudflare headers
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/telemetry/session/start',
      headers: {
        'cf-ipcity': 'S%C3%A3o%20Paulo',
        'cf-region-code': 'SP',
        'cf-ipcountry': 'BR',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      },
      payload: {
        visitorId: testVisitorId,
        entryPath: '/pt-br/',
        utmSource: 'instagram',
        platform: 'pwa',
        pwaInstalled: true,
        activeLanguage: 'en',
      },
    });
    expect(startRes.statusCode).toBe(200);
    const startBody = startRes.json();
    expect(startBody.sessionId).toBeTruthy();
    expect(startBody.detectedLocation.city).toBe('São Paulo');
    expect(startBody.detectedLocation.region).toBe('SP');

    // 2. Heartbeat via navigator.sendBeacon text/plain while authenticated
    const hbRes = await app.inject({
      method: 'POST',
      url: '/api/telemetry/heartbeat',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'content-type': 'text/plain',
      },
      payload: JSON.stringify({
        visitorId: testVisitorId,
        sessionId: startBody.sessionId,
        deltaSeconds: 95,
        screen: 'lesson',
        language: 'en',
        pwaInstalled: true,
      }),
    });
    expect(hbRes.statusCode).toBe(200);

    // 3. User updates city in profile preferences
    const prefRes = await app.inject({
      method: 'PATCH',
      url: '/api/me/preferences',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { city: 'Campina Grande - PB' },
    });
    expect(prefRes.statusCode).toBe(200);
    expect(prefRes.json().user.city).toBe('Campina Grande');
    expect(prefRes.json().user.region).toBe('PB');

    // 4. Student JWT MUST be blocked (403) from admin dashboard endpoints
    const forbiddenRes = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/summary',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.headers['x-robots-tag']).toContain('noindex');

    // 5. Admin logs in, rotates password (revoking old JWT), and inspects full analytics & reports
    const wrongPwRes = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { password: 'wrong-password-attempt' },
    });
    expect(wrongPwRes.statusCode).toBe(401);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { password: config.adminDashboardPassword || config.adminApiKey },
    });
    expect(loginRes.statusCode).toBe(200);
    const firstAdminToken = loginRes.json().token as string;
    expect(firstAdminToken).toBeTruthy();

    const newSecret = 'NAidioma#SuperStrongTest2026!';
    const rotateRes = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/change-password',
      headers: { Authorization: `Bearer ${firstAdminToken}` },
      payload: {
        currentPassword: config.adminDashboardPassword || config.adminApiKey,
        newPassword: newSecret,
      },
    });
    expect(rotateRes.statusCode).toBe(200);
    const rotatedToken = rotateRes.json().token as string;

    // Old token MUST be invalidated immediately after password change
    const staleTokenRes = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/session',
      headers: { Authorization: `Bearer ${firstAdminToken}` },
    });
    expect(staleTokenRes.statusCode).toBe(401);

    // Summary, users, visitors, saved reports & CSV export all work with rotated token
    const summaryRes = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/summary?range=30d',
      headers: { Authorization: `Bearer ${rotatedToken}` },
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary.kpis.totalRegisteredUsers).toBeGreaterThanOrEqual(1);
    expect(summary.kpis.totalSessions).toBeGreaterThanOrEqual(1);
    expect(summary.topCities.some((c: { city: string }) => c.city === 'São Paulo' || c.city === 'Campina Grande')).toBe(true);

    const usersRes = await app.inject({
      method: 'GET',
      url: `/api/admin/dashboard/users?search=${encodeURIComponent(testEmail)}`,
      headers: { Authorization: `Bearer ${rotatedToken}` },
    });
    expect(usersRes.statusCode).toBe(200);
    const matchedUser = usersRes.json().items[0];
    expect(matchedUser.city).toBe('Campina Grande');
    expect(matchedUser.activeCefr).toBe('A1');
    expect(matchedUser.totalTimeSeconds).toBeGreaterThanOrEqual(95);
    expect(matchedUser.languagesStudied.length).toBeGreaterThanOrEqual(1);

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/admin/dashboard/users/${matchedUser.id}`,
      headers: { Authorization: `Bearer ${rotatedToken}` },
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().recentLessons.length).toBeGreaterThanOrEqual(1);

    const createRepRes = await app.inject({
      method: 'POST',
      url: '/api/admin/dashboard/reports',
      headers: { Authorization: `Bearer ${rotatedToken}` },
      payload: { title: 'Relatório Teste Automatizado', periodType: '30d', notes: 'Checagem OK' },
    });
    expect(createRepRes.statusCode).toBe(201);
    const reportId = createRepRes.json().report.id as string;
    createdReportIds.push(reportId);

    const csvUsersRes = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/export.csv?type=users',
      headers: { Authorization: `Bearer ${rotatedToken}` },
    });
    expect(csvUsersRes.statusCode).toBe(200);
    expect(csvUsersRes.body).toContain('Campina Grande');
    expect(csvUsersRes.body).toContain('nivel_cefr_ativo');
  });
});
