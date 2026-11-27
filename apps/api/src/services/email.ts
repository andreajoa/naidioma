import { LANGUAGES, type LanguageCode } from '@naidioma/shared';
import { config } from '../lib/config.js';

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

function buildWelcomeHtml(displayName: string, language: LanguageCode): string {
  const langName = LANGUAGES[language]?.namePt ?? 'Inglês para Brasileiros';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f8f4ed;font-family:Arial,Helvetica,sans-serif;color:#292b29;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#fffcf7;border:1px solid #dfd9cf;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#682b3c;padding:28px 32px;color:#fffcf7;">
              <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#e9d1c0;font-weight:700;">NÚCLEO AFETAR · PLATAFORMA DE IDIOMAS</div>
              <div style="font-family:Georgia,serif;font-size:30px;margin-top:6px;letter-spacing:-0.03em;">NAidioma</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="font-family:Georgia,serif;font-size:26px;color:#292b29;margin:0 0 14px;font-weight:normal;">
                Bem-vindo(a), ${escapeHtml(displayName)}!
              </h1>
              <p style="font-size:15px;line-height:1.7;color:#55534e;margin:0 0 16px;">
                Sua conta gratuita no <strong>NAidioma</strong> já está ativa. Você escolheu começar por
                <strong style="color:#783247;">${escapeHtml(langName)}</strong>, mas tem acesso livre aos 8 idiomas,
                revisão científica FSRS e ao Estúdio de Conversa por Voz com IA.
              </p>
              <p style="font-size:14px;line-height:1.7;color:#696a65;margin:0 0 24px;">
                Enquanto estamos na fase aberta de testes, 100% dos recursos estão liberados gratuitamente.
                Use o botão de feedback dentro do app sempre que quiser sugerir uma melhoria!
              </p>
              <a href="${escapeHtml(config.appPublicUrl)}" style="display:inline-block;background:#783247;color:#fffcf7;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700;font-size:14px;">
                Continuar minha primeira lição
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#eee5d9;font-size:12px;color:#696a65;line-height:1.6;">
              Enviado por NAidioma · Uma iniciativa inspirada pelo Núcleo Afetar.<br/>
              Você recebeu este e-mail porque criou uma conta gratuita no NAidioma.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(params: {
  email: string;
  displayName: string;
  language: LanguageCode;
}): Promise<{ sent: boolean; provider: 'resend' | 'brevo' | 'none' }> {
  const html = buildWelcomeHtml(params.displayName, params.language);
  const subject = `Bem-vindo(a) ao NAidioma, ${params.displayName}!`;

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
          to: [params.email],
          subject,
          html,
        }),
      });
      if (res.ok) return { sent: true, provider: 'resend' };
    } catch {
      // non-blocking
    }
  }

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
          to: [{ email: params.email, name: params.displayName }],
          subject,
          htmlContent: html,
        }),
      });
      if (res.ok) return { sent: true, provider: 'brevo' };
    } catch {
      // non-blocking
    }
  }

  return { sent: false, provider: 'none' };
}
