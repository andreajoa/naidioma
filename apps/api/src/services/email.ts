import { LANGUAGES, type LanguageCode } from '@naidioma/shared';
import { config } from '../lib/config.js';

export const BRAND_SLOGAN_PT =
  'Seu ritmo, sua voz, sua fluência — 100% grátis do primeiro passo ao C2.';
export const BRAND_SLOGAN_EN =
  'Your pace, your voice, your fluency — 100% free from first word to C2.';

export type EmailProviderName = 'novamail' | 'resend' | 'brevo' | 'none';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (match && match[2]) {
    return { name: (match[1] ?? 'NAidioma').trim(), email: match[2].trim() };
  }
  return { name: 'NAidioma', email: from.trim() };
}

function splitName(displayName: string): { firstName: string; lastName?: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? 'Aluno';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  return { firstName, lastName };
}

function wrapBrandEmailHtml(params: {
  preheader: string;
  badge: string;
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
}): string {
  const appUrl = escapeHtml(config.appPublicUrl);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F1E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#242126;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(params.preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#FFFDF9;border:2px solid #EAE0D2;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="background:#C12B5B;padding:26px 30px;color:#FFFFFF;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#FFE27A;font-weight:800;">
                ${escapeHtml(params.badge)}
              </div>
              <div style="font-size:30px;font-weight:900;margin-top:6px;letter-spacing:-0.02em;color:#FFFFFF;">
                NAidioma
              </div>
              <div style="font-size:13px;line-height:1.5;color:#FFEAF1;margin-top:6px;font-weight:600;">
                ${escapeHtml(BRAND_SLOGAN_PT)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="height:6px;background:#F4B400;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:30px 30px 26px;">
              <h1 style="font-size:24px;line-height:1.25;color:#242126;margin:0 0 16px;font-weight:800;">
                ${escapeHtml(params.headline)}
              </h1>
              ${params.bodyHtml}
              <div style="margin:26px 0 8px;">
                <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#C12B5B;color:#FFFFFF;text-decoration:none;padding:14px 26px;border-radius:14px;font-weight:800;font-size:15px;border-bottom:4px solid #8A183D;">
                  ${escapeHtml(params.ctaLabel)}
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 30px;background:#F3ECE2;font-size:12px;color:#6A615B;line-height:1.6;border-top:1px solid #E5DACB;">
              <strong style="color:#242126;">NAidioma · Núcleo Afetar</strong> — ${escapeHtml(BRAND_SLOGAN_PT)}<br />
              ${escapeHtml(params.footerNote)}<br />
              Acesse quando quiser: <a href="${appUrl}" style="color:#1496B0;font-weight:700;text-decoration:none;">${appUrl}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWelcomeEmailContent(displayName: string, language: LanguageCode): {
  subject: string;
  html: string;
  text: string;
} {
  const { firstName } = splitName(displayName);
  const langName = LANGUAGES[language]?.namePt ?? 'Inglês';
  const appUrl = config.appPublicUrl;
  const subject = `Bem-vindo(a) ao NAidioma, ${firstName}! 100% grátis até a fluência 🧩`;

  const bodyHtml = `
    <p style="font-size:15px;line-height:1.7;color:#453D42;margin:0 0 14px;">
      Que alegria ter você com a gente, <strong>${escapeHtml(firstName)}</strong>!
      Sua conta no <strong>NAidioma</strong> está pronta — e o melhor: o aplicativo é
      <strong style="color:#1496B0;">100% gratuito</strong> para você estudar até ficar fluente no idioma que quiser,
      sem pagar nada, sem travar lições e sem perder vidas.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#453D42;margin:0 0 18px;">
      Você começou por <strong style="color:#C12B5B;">${escapeHtml(langName)}</strong>, mas pode alternar livremente entre
      todos os <strong>8 idiomas completos</strong> (Inglês A1 ao C2, Coreano com estúdio Hangul, Japonês, Espanhol, Francês, Alemão, Italiano e Chinês).
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF7E0;border:2px solid #F4B400;border-radius:14px;margin:0 0 18px;">
      <tr>
        <td style="padding:16px 18px;font-size:13px;line-height:1.65;color:#4A3500;">
          <strong style="font-size:14px;color:#8A183D;">O que já está liberado grátis para você hoje:</strong><br />
          ✅ <strong>Trilha completa A1 → C2</strong> com gramática prática (botão "Ver Regra") e Exames Oficiais de Nível.<br />
          🎙️ <strong>Chamada ao Vivo com Tutor IA 24h</strong> (Maya, Oliver ou seu Bichinho) com Boletim de Erros palavra por palavra.<br />
          📱 <strong>App Offline</strong> no Android, iPhone e PC — toque em <strong>"Instalar"</strong> dentro do app.<br />
          🧩 <strong>Conforto Sensorial</strong> (Autismo &amp; TDAH): Modo Calmo, som ajustável e tentativas infinitas.
        </td>
      </tr>
    </table>
    <p style="font-size:14px;line-height:1.65;color:#6A615B;margin:0;">
      Dica de ouro: faça apenas <strong>10 minutos por dia</strong> e teste uma conversa rápida na aba <strong>Falar</strong>.
      Você vai se surpreender com o quanto evolui na primeira semana!
    </p>
  `;

  const html = wrapBrandEmailHtml({
    preheader: 'Sua conta 100% gratuita no NAidioma está ativa! Estude do A1 ao C2 com Tutor IA 24h.',
    badge: 'NÚCLEO AFETAR · 100% GRÁTIS ATÉ A FLUÊNCIA',
    headline: `Olá, ${firstName}! Sua jornada até a fluência começou 🧩`,
    bodyHtml,
    ctaLabel: 'Começar minha primeira lição grátis',
    ctaUrl: appUrl,
    footerNote:
      'Você recebeu este e-mail porque criou sua conta gratuita no NAidioma. Para alterar suas preferências de comunicação, acesse a aba Perfil dentro do app.',
  });

  const text = [
    `Olá, ${firstName}! Bem-vindo(a) ao NAidioma!`,
    BRAND_SLOGAN_PT,
    '',
    `Sua conta 100% gratuita está ativa. Você escolheu começar por ${langName}, e pode estudar até a fluência em qualquer um dos 8 idiomas (Inglês A1 ao C2, Coreano, Japonês, Espanhol, Francês, Alemão, Italiano e Chinês), sem pagar nada e sem perder vidas.`,
    '',
    '- Trilha completa CEFR A1 ao C2 com provas oficiais de nível',
    '- Chamada ao Vivo por voz com Tutor IA 24h e correção palavra por palavra',
    '- App instalável offline para Android, iPhone e computador',
    '- Conforto sensorial para Autismo e TDAH (Modo Calmo)',
    '',
    `Comece agora: ${appUrl}`,
  ].join('\n');

  return { subject, html, text };
}

export function buildPromoEmailHtml(params: {
  subject: string;
  headline: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  badge?: string;
  recipientFirstName?: string;
}): { html: string; text: string } {
  const firstName = params.recipientFirstName || '{{first_name}}';
  const greeting =
    firstName === '{{first_name}}'
      ? 'Olá, {{first_name}}!'
      : `Olá, ${escapeHtml(firstName)}!`;

  const paragraphs = params.bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="font-size:15px;line-height:1.7;color:#453D42;margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

  const html = wrapBrandEmailHtml({
    preheader: params.subject,
    badge: params.badge ?? 'NAIDIOMA · NOVIDADES E DICAS PARA FLUÊNCIA',
    headline: params.headline,
    bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#453D42;margin:0 0 14px;"><strong>${greeting}</strong></p>${paragraphs}`,
    ctaLabel: params.ctaLabel || 'Abrir o NAidioma grátis',
    ctaUrl: params.ctaUrl || config.appPublicUrl,
    footerNote:
      'Você recebeu esta mensagem porque ativou novidades e comunicados do NAidioma e Núcleo Afetar. Desative a qualquer momento na aba Perfil do app ou pelo link de descadastro.',
  });

  const text = `${params.headline}\n\n${params.bodyText}\n\n${params.ctaLabel || 'Abrir o NAidioma'}: ${params.ctaUrl || config.appPublicUrl}\n\nNAidioma — ${BRAND_SLOGAN_PT}`;
  return { html, text };
}

export function getActiveEmailProvider(): EmailProviderName {
  if (config.novamailApiKey) return 'novamail';
  if (config.resendApiKey) return 'resend';
  if (config.brevoApiKey) return 'brevo';
  return 'none';
}

export async function sendTransactionalEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
  idempotencyKey?: string;
}): Promise<{ sent: boolean; provider: EmailProviderName; id?: string; error?: string }> {
  // 1. Primary: NovaMail (self-hosted Resend-compatible API on Amazon SES live)
  if (config.novamailApiKey) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.novamailApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NAidioma-API/1.0',
      };
      if (params.idempotencyKey) {
        headers['Idempotency-Key'] = params.idempotencyKey;
      }

      const res = await fetch(`${config.novamailBaseUrl}/emails`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: config.emailFrom,
          to: [params.to],
          reply_to: config.emailReplyTo ? [config.emailReplyTo] : undefined,
          subject: params.subject,
          html: params.html,
          text: params.text,
          tags: [
            { name: 'app', value: 'naidioma' },
            { name: 'category', value: (params.category ?? 'transactional').replace(/[^A-Za-z0-9_-]/g, '_') },
          ],
        }),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { sent: true, provider: 'novamail', id: data.id };
      }
      const errText = await res.text().catch(() => '');
      if (!config.resendApiKey && !config.brevoApiKey) {
        return { sent: false, provider: 'novamail', error: `NovaMail HTTP ${res.status}: ${errText.slice(0, 180)}` };
      }
    } catch (err) {
      if (!config.resendApiKey && !config.brevoApiKey) {
        return {
          sent: false,
          provider: 'novamail',
          error: err instanceof Error ? err.message : 'NovaMail unreachable',
        };
      }
    }
  }

  // 2. Fallback: Resend
  if (config.resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.emailFrom,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { sent: true, provider: 'resend', id: data.id };
      }
    } catch {
      // non-blocking
    }
  }

  // 3. Fallback: Brevo
  if (config.brevoApiKey) {
    try {
      const sender = parseFromHeader(config.emailFrom);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': config.brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: params.to, name: params.toName ?? params.to }],
          subject: params.subject,
          htmlContent: params.html,
          textContent: params.text,
        }),
      });
      if (res.ok) return { sent: true, provider: 'brevo' };
    } catch {
      // non-blocking
    }
  }

  return { sent: false, provider: 'none' };
}

export async function sendWelcomeEmail(params: {
  email: string;
  displayName: string;
  language: LanguageCode;
  userId?: string;
}): Promise<{ sent: boolean; provider: EmailProviderName; id?: string }> {
  const { subject, html, text } = buildWelcomeEmailContent(params.displayName, params.language);
  return sendTransactionalEmail({
    to: params.email,
    toName: params.displayName,
    subject,
    html,
    text,
    category: 'welcome',
    idempotencyKey: params.userId ? `naidioma-welcome-${params.userId}` : undefined,
  });
}

/**
 * Syncs a NAidioma user to the configured NovaMail Audience (triggers NovaMail promo/onboarding funnels)
 * and tags their contact with active language + lead source for segmented promotional campaigns.
 */
export async function syncContactToNovaMail(params: {
  email: string;
  displayName: string;
  language: LanguageCode;
  marketingOptIn: boolean;
  leadSource?: string;
}): Promise<{ synced: boolean; reason?: string }> {
  if (!config.novamailApiKey || !config.novamailAudienceId) {
    return { synced: false, reason: 'NovaMail audience not configured' };
  }

  const { firstName, lastName } = splitName(params.displayName);
  const headers = {
    Authorization: `Bearer ${config.novamailApiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'NAidioma-API/1.0',
  };

  try {
    const res = await fetch(
      `${config.novamailBaseUrl}/audiences/${encodeURIComponent(config.novamailAudienceId)}/contacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: params.email.trim().toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          unsubscribed: !params.marketingOptIn,
        }),
      },
    );

    if (!res.ok) {
      return { synced: false, reason: `HTTP ${res.status}` };
    }

    // Apply helpful segmentation tags (non-blocking)
    const cleanSource = (params.leadSource ?? 'organic').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 28);
    await fetch(`${config.novamailBaseUrl}/contacts/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        add: ['naidioma', `lang_${params.language}`, `src_${cleanSource}`],
      }),
    }).catch(() => {});

    return { synced: true };
  } catch (err) {
    return { synced: false, reason: err instanceof Error ? err.message : 'sync_error' };
  }
}

export async function bulkSyncContactsToNovaMail(
  contacts: Array<{ email: string; displayName: string; marketingOptIn: boolean }>,
): Promise<{ synced: number; error?: string }> {
  if (!config.novamailApiKey || !config.novamailAudienceId) {
    return { synced: 0, error: 'NOVAMAIL_API_KEY ou NOVAMAIL_AUDIENCE_ID não configurados.' };
  }
  if (contacts.length === 0) return { synced: 0 };

  const headers = {
    Authorization: `Bearer ${config.novamailApiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'NAidioma-API/1.0',
  };

  let synced = 0;
  for (let i = 0; i < contacts.length; i += 500) {
    const chunk = contacts.slice(i, i + 500).map((c) => {
      const { firstName, lastName } = splitName(c.displayName);
      return {
        email: c.email.trim().toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        unsubscribed: !c.marketingOptIn,
      };
    });
    const res = await fetch(
      `${config.novamailBaseUrl}/audiences/${encodeURIComponent(config.novamailAudienceId)}/contacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { synced, error: `NovaMail HTTP ${res.status}: ${txt.slice(0, 180)}` };
    }
    synced += chunk.length;
  }

  return { synced };
}

/**
 * Triggers a promotional campaign via NovaMail:
 * - If testEmail is provided, sends a single test email via POST /emails.
 * - Otherwise, sends individually or via NovaMail Broadcast to opted-in contacts.
 */
export async function sendPromotionalCampaign(params: {
  subject: string;
  headline: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  testEmail?: string;
  recipients: Array<{ email: string; displayName: string }>;
}): Promise<{
  sentCount: number;
  failedCount: number;
  provider: EmailProviderName;
  broadcastId?: string;
  error?: string;
}> {
  const provider = getActiveEmailProvider();
  if (provider === 'none') {
    return {
      sentCount: 0,
      failedCount: 0,
      provider: 'none',
      error: 'Nenhum provedor de e-mail configurado (configure NOVAMAIL_API_KEY).',
    };
  }

  if (params.testEmail) {
    const built = buildPromoEmailHtml({
      subject: `[TESTE] ${params.subject}`,
      headline: params.headline,
      bodyText: params.bodyText,
      ctaLabel: params.ctaLabel,
      ctaUrl: params.ctaUrl,
      recipientFirstName: 'André',
    });
    const res = await sendTransactionalEmail({
      to: params.testEmail,
      subject: `[TESTE] ${params.subject}`,
      html: built.html,
      text: built.text,
      category: 'promo_test',
    });
    return {
      sentCount: res.sent ? 1 : 0,
      failedCount: res.sent ? 0 : 1,
      provider: res.provider,
      error: res.error,
    };
  }

  // If NovaMail Audience is configured, sync recipients first and trigger a native NovaMail Broadcast
  // (includes automatic RFC 8058 1-click unsubscribe + open/click tracking + rate-safe cron batching!)
  if (config.novamailApiKey && config.novamailAudienceId) {
    const syncRes = await bulkSyncContactsToNovaMail(
      params.recipients.map((r) => ({ ...r, marketingOptIn: true })),
    );
    if (!syncRes.error) {
      const built = buildPromoEmailHtml({
        subject: params.subject,
        headline: params.headline,
        bodyText: params.bodyText,
        ctaLabel: params.ctaLabel,
        ctaUrl: params.ctaUrl,
      });
      const headers = {
        Authorization: `Bearer ${config.novamailApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NAidioma-API/1.0',
      };
      const createRes = await fetch(`${config.novamailBaseUrl}/broadcasts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audience_id: config.novamailAudienceId,
          name: `NAidioma Promo: ${params.subject.slice(0, 80)}`,
          from: config.emailFrom,
          reply_to: config.emailReplyTo || undefined,
          subject: params.subject,
          html: built.html,
          text: built.text,
        }),
      });
      if (createRes.ok) {
        const created = (await createRes.json()) as { id?: string };
        if (created.id) {
          const sendRes = await fetch(
            `${config.novamailBaseUrl}/broadcasts/${encodeURIComponent(created.id)}/send`,
            { method: 'POST', headers },
          );
          if (sendRes.ok) {
            return {
              sentCount: params.recipients.length,
              failedCount: 0,
              provider: 'novamail',
              broadcastId: created.id,
            };
          }
        }
      }
    }
  }

  // Direct transactional fallback loop for small lists
  let sentCount = 0;
  let failedCount = 0;
  for (const recipient of params.recipients) {
    const { firstName } = splitName(recipient.displayName);
    const built = buildPromoEmailHtml({
      subject: params.subject,
      headline: params.headline,
      bodyText: params.bodyText,
      ctaLabel: params.ctaLabel,
      ctaUrl: params.ctaUrl,
      recipientFirstName: firstName,
    });
    const res = await sendTransactionalEmail({
      to: recipient.email,
      toName: recipient.displayName,
      subject: params.subject,
      html: built.html,
      text: built.text,
      category: 'promo_campaign',
    });
    if (res.sent) sentCount += 1;
    else failedCount += 1;
  }

  return { sentCount, failedCount, provider };
}
