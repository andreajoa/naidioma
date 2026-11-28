import { useState, type FormEvent } from 'react';
import {
  CheckCircle,
  CloudCheck,
  DownloadSimple,
  Key,
  ShieldCheck,
  Warning,
} from '@phosphor-icons/react';
import { api, type AdminAuditEntry } from '../../lib/api';
import { downloadTextFile, formatDateTimeBr } from './formatters';

interface OperationsSectionProps {
  mode: 'mailing' | 'system';
  adminToken: string;
  overview: Awaited<ReturnType<typeof api.getAdminOverview>> | null;
  mailing: Awaited<ReturnType<typeof api.getAdminMailing>> | null;
  authMeta: {
    source: string;
    mustConfigurePassword: boolean;
    sessionVersion: number;
    passwordUpdatedAt: string | null;
  } | null;
  recentAudits: AdminAuditEntry[];
  onRefreshOperations: () => Promise<void>;
  onTokenRotated: (newToken: string) => void;
}

export function OperationsSection({
  mode,
  adminToken,
  overview,
  mailing,
  authMeta,
  recentAudits,
  onRefreshOperations,
  onTokenRotated,
}: OperationsSectionProps) {
  // NovaMail campaign state
  const [campSubject, setCampSubject] = useState(
    'Seu ritmo, sua voz, sua fluência — novidade no NAidioma 🧩',
  );
  const [campHeadline, setCampHeadline] = useState(
    'Pratique inglês ao vivo com Tutor IA 24h (100% grátis!)',
  );
  const [campBody, setCampBody] = useState(
    'No NAidioma você pode estudar do A1 ao C2 em qualquer um dos 8 idiomas sem pagar nada.\n\nExperimente hoje a Chamada ao Vivo por voz com a Maya, o Oliver ou o seu Bichinho e receba seu Boletim de Erros palavra por palavra!',
  );
  const [campCtaLabel, setCampCtaLabel] = useState('Abrir NAidioma grátis agora');
  const [campTestEmail, setCampTestEmail] = useState('');
  const [campBusy, setCampBusy] = useState(false);
  const [campStatus, setCampStatus] = useState<string | null>(null);

  // Runtime config state
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(overview?.runtime.ollamaBaseUrl ?? '');
  const [ollamaModel, setOllamaModel] = useState(overview?.runtime.ollamaModel ?? 'gpt-oss:20b');
  const [ollamaApiKey, setOllamaApiKey] = useState('');
  const [dailyFreeAiTurns, setDailyFreeAiTurns] = useState(overview?.runtime.dailyFreeAiTurns ?? 60);
  const [freeBetaMode, setFreeBetaMode] = useState(overview?.runtime.freeBetaMode ?? true);
  const [billingUiEnabled, setBillingUiEnabled] = useState(
    overview?.runtime.billingUiEnabled ?? false,
  );
  const [latestAppVersion, setLatestAppVersion] = useState(
    overview?.runtime.latestAppVersion ?? '1.0.0',
  );
  const [releaseNotesPt, setReleaseNotesPt] = useState(overview?.runtime.releaseNotesPt ?? '');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Admin password rotation state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleExportMailingCsv() {
    const csv = await api.downloadMailingCsv(adminToken);
    downloadTextFile(
      `\uFEFF${csv}`,
      `naidioma-mailing-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;',
    );
  }

  async function handleSyncNovaMail() {
    setCampBusy(true);
    setCampStatus(null);
    try {
      const res = await api.syncMailingToNovaMail(adminToken);
      setCampStatus(`${res.synced} de ${res.totalUsers} contatos sincronizados com o NovaMail!`);
    } catch (err) {
      setCampStatus(err instanceof Error ? err.message : 'Falha ao sincronizar com NovaMail.');
    } finally {
      setCampBusy(false);
    }
  }

  async function handleSendCampaign(isTest: boolean) {
    setCampBusy(true);
    setCampStatus(null);
    try {
      const res = await api.sendAdminEmailCampaign(adminToken, {
        subject: campSubject,
        headline: campHeadline,
        bodyText: campBody,
        ctaLabel: campCtaLabel,
        testEmail: isTest ? campTestEmail.trim() : undefined,
      });
      setCampStatus(
        isTest
          ? `E-mail de teste enviado via ${res.provider} para ${campTestEmail.trim()}!`
          : `Campanha enviada via ${res.provider} para ${res.sentCount} contato(s)!`,
      );
    } catch (err) {
      setCampStatus(err instanceof Error ? err.message : 'Falha ao enviar campanha.');
    } finally {
      setCampBusy(false);
    }
  }

  async function handleStatusFeedback(id: string, status: 'new' | 'in_progress' | 'resolved') {
    await api.updateAdminFeedback(adminToken, id, status);
    await onRefreshOperations();
  }

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    setSaveNotice(null);
    const payload: Record<string, unknown> = {
      ollamaBaseUrl,
      ollamaModel,
      dailyFreeAiTurns,
      freeBetaMode,
      billingUiEnabled,
      latestAppVersion,
      releaseNotesPt,
    };
    if (ollamaApiKey.trim()) payload.ollamaApiKey = ollamaApiKey.trim();

    const res = await api.saveAdminRuntimeConfig(adminToken, payload);
    setSaveNotice(
      res.ollamaStatus.reachable
        ? `Configuração salva! Ollama conectado (${res.ollamaStatus.availableModels.length} modelos).`
        : `Configuração salva! (${res.ollamaStatus.error ?? 'Fallback automático ativo'}).`,
    );
    await onRefreshOperations();
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (newPassword.trim().length < 12) {
      setPwStatus({ ok: false, msg: 'A nova senha precisa ter pelo menos 12 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ ok: false, msg: 'A confirmação de senha não confere.' });
      return;
    }
    setPwBusy(true);
    try {
      const res = await api.adminChangePassword(adminToken, currentPassword, newPassword);
      onTokenRotated(res.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwStatus({ ok: true, msg: res.message });
      await onRefreshOperations();
    } catch (err) {
      setPwStatus({
        ok: false,
        msg: err instanceof Error ? err.message : 'Erro ao atualizar senha.',
      });
    } finally {
      setPwBusy(false);
    }
  }

  if (mode === 'mailing') {
    return (
      <div className="space-y-6">
        {/* Campaigns */}
        <section className="bg-white border-2 border-[#E5D8C8] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-[#1E1A1D]">
                Campanhas &amp; Retomada via NovaMail
              </h2>
              <p className="text-xs text-[var(--na-muted)]">
                Provedor ativo:{' '}
                <strong className="uppercase text-[#1496B0]">
                  {overview?.runtime.emailProvider ??
                    (overview?.runtime.emailConfigured ? 'ativo' : 'não configurado')}
                </strong>{' '}
                · Boas-vindas automático no cadastro + disparos segmentados.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={campBusy}
                onClick={() => void handleSyncNovaMail()}
                className="min-h-[40px] px-3.5 bg-white border-2 border-[#E5D8C8] hover:border-[#1496B0] text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <CloudCheck size={16} weight="bold" /> Sincronizar NovaMail
              </button>
              <button
                type="button"
                onClick={() => void handleExportMailingCsv()}
                className="min-h-[40px] px-3.5 bg-[#9A1B45] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <DownloadSimple size={16} weight="bold" /> Baixar Mailing CSV ({mailing?.total ?? 0})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Assunto do e-mail
              </label>
              <input
                type="text"
                value={campSubject}
                onChange={(e) => setCampSubject(e.target.value)}
                className="w-full min-h-[40px] px-3 border border-[#E5D8C8] bg-[#FFFBF5] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Título interno (Headline)
              </label>
              <input
                type="text"
                value={campHeadline}
                onChange={(e) => setCampHeadline(e.target.value)}
                className="w-full min-h-[40px] px-3 border border-[#E5D8C8] bg-[#FFFBF5] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Mensagem
            </label>
            <textarea
              rows={3}
              value={campBody}
              onChange={(e) => setCampBody(e.target.value)}
              className="w-full p-3 border border-[#E5D8C8] bg-[#FFFBF5] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Texto do botão (CTA)
              </label>
              <input
                type="text"
                value={campCtaLabel}
                onChange={(e) => setCampCtaLabel(e.target.value)}
                className="w-full min-h-[40px] px-3 border border-[#E5D8C8] bg-[#FFFBF5] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                E-mail para envio de teste
              </label>
              <input
                type="email"
                value={campTestEmail}
                onChange={(e) => setCampTestEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full min-h-[40px] px-3 border border-[#E5D8C8] bg-[#FFFBF5] text-sm"
              />
            </div>
          </div>

          {campStatus && (
            <div className="p-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-bold text-[#1E1A1D]">
              {campStatus}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={campBusy || !campTestEmail.trim()}
              onClick={() => void handleSendCampaign(true)}
              className="min-h-[40px] px-4 bg-white border-2 border-[#E5D8C8] text-xs font-extrabold disabled:opacity-45"
            >
              Enviar Teste
            </button>
            <button
              type="button"
              disabled={campBusy}
              onClick={() => void handleSendCampaign(false)}
              className="min-h-[40px] px-5 bg-[#9A1B45] text-white text-xs font-extrabold disabled:opacity-45"
            >
              {campBusy
                ? 'Enviando...'
                : `Disparar para ${overview?.metrics.optInUsers ?? 0} Opt-In`}
            </button>
          </div>
        </section>

        {/* Feedbacks */}
        <section className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-[#1E1A1D]">
              Feedbacks &amp; Sugestões dos Alunos ({overview?.feedbacks.length ?? 0})
            </h2>
            <span className="font-mono-code text-xs font-bold text-[#9A1B45]">
              {overview?.metrics.openFeedbackCount ?? 0} abertos
            </span>
          </div>

          {!overview || overview.feedbacks.length === 0 ? (
            <div className="text-xs text-[var(--na-muted)] py-4">
              Nenhum feedback enviado pelos usuários ainda.
            </div>
          ) : (
            <div className="divide-y divide-[#EFE5D8]">
              {overview.feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      <span className="px-2 py-0.5 bg-[#F4EADC] text-[#9A1B45] uppercase">
                        {fb.platform} · {fb.category}
                      </span>
                      {fb.language && <span className="uppercase font-mono-code">{fb.language}</span>}
                      <span className="text-[var(--na-muted)]">
                        {fb.user ? `${fb.user.displayName} (${fb.user.email})` : 'Anônimo'}
                      </span>
                      <span className="font-mono-code text-[10px] text-[var(--na-muted)]">
                        {formatDateTimeBr(fb.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm text-[#1E1A1D]">{fb.message}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleStatusFeedback(fb.id, 'in_progress')}
                      className={`px-3 py-1.5 text-xs font-bold border ${
                        fb.status === 'in_progress'
                          ? 'bg-[#1496B0] text-white border-transparent'
                          : 'border-[#E5D8C8] bg-white'
                      }`}
                    >
                      Em análise
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusFeedback(fb.id, 'resolved')}
                      className={`px-3 py-1.5 text-xs font-bold border inline-flex items-center gap-1 ${
                        fb.status === 'resolved'
                          ? 'bg-[#2CB65E] text-white border-transparent'
                          : 'border-[#E5D8C8] bg-white'
                      }`}
                    >
                      <CheckCircle size={14} weight="fill" /> Resolvido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // System & Security Tab
  return (
    <div className="space-y-6">
      {/* Admin Password & Security */}
      <section className="bg-white border-2 border-[#E5D8C8] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#EFE5D8]">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9A1B45] flex items-center gap-1.5">
              <ShieldCheck size={15} weight="fill" /> Segurança Exclusiva do Proprietário
            </div>
            <h2 className="font-display text-xl text-[#1E1A1D] mt-0.5">
              Senha do /dashboard (Zero Segredos no GitHub)
            </h2>
            <p className="text-xs text-[var(--na-muted)] mt-1">
              Origem atual da credencial:{' '}
              <code className="font-mono-code font-bold text-[#1E1A1D]">
                {authMeta?.source ?? 'verificado'}
              </code>{' '}
              · Versão da sessão: <code className="font-mono-code">v{authMeta?.sessionVersion ?? 1}</code>
              {authMeta?.passwordUpdatedAt
                ? ` · Última troca: ${formatDateTimeBr(authMeta.passwordUpdatedAt)}`
                : ''}
            </p>
          </div>
          {authMeta?.mustConfigurePassword && (
            <div className="px-3 py-2 bg-[#FFF6D6] border border-[#E5A300] text-xs font-bold text-[#7A5200] inline-flex items-center gap-1.5">
              <Warning size={16} weight="fill" /> Defina sua senha dedicada abaixo para desativar o fallback!
            </div>
          )}
        </div>

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Senha Atual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full min-h-[42px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Nova Senha (mín. 12 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full min-h-[42px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              required
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full min-h-[42px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm"
            />
          </div>

          {pwStatus && (
            <div
              className={`md:col-span-3 p-3 text-xs font-bold border ${
                pwStatus.ok
                  ? 'bg-[#E2F9EB] border-[#2CB65E] text-[#1D8A45]'
                  : 'bg-[#FFECEB] border-[#E04338] text-[#B02B22]'
              }`}
            >
              {pwStatus.msg}
            </div>
          )}

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={pwBusy}
              className="min-h-[42px] px-5 bg-[#9A1B45] hover:bg-[#821539] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <Key size={15} weight="bold" />
              {pwBusy ? 'Criptografando...' : 'Atualizar Senha do /dashboard'}
            </button>
          </div>
        </form>
      </section>

      {/* Runtime AI, Stripe & App Version */}
      {overview && (
        <form onSubmit={handleSaveConfig} className="bg-white border-2 border-[#E5D8C8] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE5D8]">
            <div>
              <h2 className="font-display text-xl text-[#1E1A1D]">
                IA 24/7 · Cobrança Stripe (Oculta) · Versão do App
              </h2>
              <p className="text-xs text-[var(--na-muted)]">
                {overview.runtime.openaiBaseUrl
                  ? `Motor 24/7 ativo: ${overview.runtime.openaiModel || 'llama-3.3-70b'} + Whisper HD.`
                  : 'Fallback automático ativo.'}
              </p>
            </div>
            <span className="px-3 py-1 bg-[#E2F9EB] text-[#1D8A45] text-xs font-extrabold inline-flex items-center gap-1.5">
              <CloudCheck size={15} weight="fill" />
              {overview.runtime.openaiBaseUrl
                ? 'Llama 3.3 · 24/7'
                : overview.ollamaStatus.reachable
                  ? 'Ollama Online'
                  : 'Fallback Ativo'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                URL do Ollama (Kaggle / Cloud)
              </label>
              <input
                type="url"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                className="w-full min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Modelo Ollama
              </label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Ollama API Key (opcional)
              </label>
              <input
                type="password"
                value={ollamaApiKey}
                onChange={(e) => setOllamaApiKey(e.target.value)}
                placeholder={overview.runtime.ollamaHasApiKey ? '•••••••• (configurada)' : 'Opcional'}
                className="w-full min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Limite diário de turnos IA (beta grátis)
              </label>
              <input
                type="number"
                min={5}
                max={500}
                value={dailyFreeAiTurns}
                onChange={(e) => setDailyFreeAiTurns(Number(e.target.value))}
                className="w-full min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-mono-code"
              />
            </div>
          </div>

          <div className="p-4 bg-[#FAF4EC] border border-[#E5D8C8] space-y-2.5 text-xs">
            <div className="font-extrabold text-[#9A1B45]">Chave Mestra de Cobrança (Stripe)</div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={freeBetaMode}
                onChange={(e) => setFreeBetaMode(e.target.checked)}
                className="w-4 h-4 accent-[#9A1B45]"
              />
              <span>
                <strong>Modo Beta 100% Gratuito ativo</strong> (todos os 8 idiomas liberados)
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={billingUiEnabled}
                onChange={(e) => setBillingUiEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#9A1B45]"
              />
              <span>
                <strong>Exibir tela de planos Stripe no app</strong> (mantenha desmarcado enquanto gratuito)
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Versão mais recente do app
              </label>
              <input
                type="text"
                value={latestAppVersion}
                onChange={(e) => setLatestAppVersion(e.target.value)}
                className="w-full min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                Novidades da atualização
              </label>
              <input
                type="text"
                value={releaseNotesPt}
                onChange={(e) => setReleaseNotesPt(e.target.value)}
                className="w-full min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs"
              />
            </div>
          </div>

          {saveNotice && (
            <div className="p-3 bg-[#E2F9EB] border border-[#2CB65E] text-xs font-bold text-[#1D8A45]">
              {saveNotice}
            </div>
          )}

          <button
            type="submit"
            className="min-h-[42px] px-5 bg-[#1496B0] hover:bg-[#0F7E94] text-white text-xs font-extrabold uppercase tracking-wider"
          >
            Salvar Configurações
          </button>
        </form>
      )}

      {/* Security Audit Trail */}
      <section className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
        <h2 className="font-display text-lg text-[#1E1A1D]">
          Auditoria de Acessos ao /dashboard (Últimos {recentAudits.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5D8C8] bg-[#FAF4EC] text-[10px] uppercase text-[var(--na-muted)]">
                <th className="py-2 px-3">Data/Hora</th>
                <th className="py-2 px-3">Evento</th>
                <th className="py-2 px-3">Localização</th>
                <th className="py-2 px-3">Hash IP</th>
                <th className="py-2 px-3">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE5D8]">
              {recentAudits.map((a) => {
                const isFail = a.action.includes('fail') || a.action.includes('blocked');
                return (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-mono-code text-[11px] whitespace-nowrap">
                      {formatDateTimeBr(a.createdAt)}
                    </td>
                    <td className="py-2 px-3 font-mono-code font-bold">
                      <span className={isFail ? 'text-[#B02B22]' : 'text-[#1D8A45]'}>
                        {a.action}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {a.city ? `${a.city}${a.country ? ` (${a.country})` : ''}` : a.country ?? '—'}
                    </td>
                    <td className="py-2 px-3 font-mono-code text-[11px] text-[var(--na-muted)]">
                      {a.ipHash ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-[var(--na-muted)]">{a.detail ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
