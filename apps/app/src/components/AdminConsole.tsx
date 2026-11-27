import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CloudCheck,
  DownloadSimple,
  EnvelopeSimple,
  SlidersHorizontal,
  Users,
} from '@phosphor-icons/react';
import { api } from '../lib/api';

interface AdminConsoleProps {
  onBack: () => void;
  onConfigChanged: () => void;
}

export function AdminConsole({ onBack, onConfigChanged }: AdminConsoleProps) {
  const [adminKey, setAdminKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<'mailing' | 'feedback' | 'config'>('mailing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.getAdminOverview>> | null>(
    null,
  );
  const [mailing, setMailing] = useState<Awaited<ReturnType<typeof api.getAdminMailing>> | null>(
    null,
  );

  // Runtime config form state
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('gpt-oss:20b');
  const [ollamaApiKey, setOllamaApiKey] = useState('');
  const [dailyFreeAiTurns, setDailyFreeAiTurns] = useState(60);
  const [freeBetaMode, setFreeBetaMode] = useState(true);
  const [billingUiEnabled, setBillingUiEnabled] = useState(false);
  const [latestAppVersion, setLatestAppVersion] = useState('1.0.0');
  const [releaseNotesPt, setReleaseNotesPt] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  async function loadAdmin(keyToUse: string) {
    setLoading(true);
    setError(null);
    try {
      const [ov, ml] = await Promise.all([
        api.getAdminOverview(keyToUse),
        api.getAdminMailing(keyToUse),
      ]);
      setOverview(ov);
      setMailing(ml);
      setOllamaBaseUrl(ov.runtime.ollamaBaseUrl);
      setOllamaModel(ov.runtime.ollamaModel);
      setDailyFreeAiTurns(ov.runtime.dailyFreeAiTurns);
      setFreeBetaMode(ov.runtime.freeBetaMode);
      setBillingUiEnabled(ov.runtime.billingUiEnabled);
      setLatestAppVersion(ov.runtime.latestAppVersion);
      setReleaseNotesPt(ov.runtime.releaseNotesPt);
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chave inválida.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    await loadAdmin(adminKey);
  }

  async function handleExportCsv() {
    const csv = await api.downloadMailingCsv(adminKey);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `naidioma-mailing-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

    const res = await api.saveAdminRuntimeConfig(adminKey, payload);
    setSaveNotice(
      res.ollamaStatus.reachable
        ? `Configuração salva! Ollama conectado (${res.ollamaStatus.availableModels.length} modelos).`
        : `Configuração salva! (${res.ollamaStatus.error ?? 'Fallback automático ativo'}).`,
    );
    await loadAdmin(adminKey);
    onConfigChanged();
  }

  async function handleStatusFeedback(id: string, status: 'new' | 'in_progress' | 'resolved') {
    await api.updateAdminFeedback(adminKey, id, status);
    await loadAdmin(adminKey);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-tactile-secondary px-4 text-sm inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} weight="bold" /> Voltar ao app
        </button>
        <div className="text-right">
          <div className="font-display text-2xl text-[var(--na-wine)]">Painel Admin NAidioma</div>
          <div className="text-xs text-[var(--na-muted)]">
            Mailing LGPD · Feedbacks · Ollama/Kaggle · Stripe Oculto
          </div>
        </div>
      </div>

      {!unlocked ? (
        <form onSubmit={handleUnlock} className="surface-card max-w-md mx-auto p-6 space-y-4">
          <h2 className="font-display text-2xl">Acesso do proprietário</h2>
          <p className="text-xs text-[var(--na-muted)]">
            Informe a chave <code className="font-mono-code">ADMIN_API_KEY</code> configurada nas
            variáveis de ambiente do servidor (NexaCloud).
          </p>
          <input
            type="password"
            required
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Chave administrativa"
            className="w-full min-h-[48px] px-4 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-sm"
          />
          {error && <div className="text-xs text-[var(--na-error)]">{error}</div>}
          <button type="submit" disabled={loading} className="btn-tactile-primary w-full text-sm">
            {loading ? 'Validando...' : 'Abrir Painel Admin'}
          </button>
        </form>
      ) : (
        overview && (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="surface-card p-4">
                <div className="text-xs text-[var(--na-muted)]">Cadastros totais</div>
                <div className="text-2xl font-extrabold text-[var(--na-wine)] mt-1">
                  {overview.metrics.totalUsers}
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs text-[var(--na-muted)]">Mailing Opt-In (LGPD)</div>
                <div className="text-2xl font-extrabold text-[var(--na-success)] mt-1">
                  {overview.metrics.optInUsers}
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs text-[var(--na-muted)]">Lições concluídas</div>
                <div className="text-2xl font-extrabold text-[var(--na-teal)] mt-1">
                  {overview.metrics.totalLessonsCompleted}
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs text-[var(--na-muted)]">Feedbacks abertos</div>
                <div className="text-2xl font-extrabold text-[var(--na-burgundy)] mt-1">
                  {overview.metrics.openFeedbackCount}
                </div>
              </div>
            </div>

            {/* Section Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('mailing')}
                className={`px-4 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${
                  tab === 'mailing'
                    ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)]'
                    : 'bg-[var(--na-ivory)] text-[var(--na-ink)] border-[var(--na-border)]'
                }`}
              >
                <EnvelopeSimple size={15} /> Mailing ({mailing?.total ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setTab('feedback')}
                className={`px-4 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${
                  tab === 'feedback'
                    ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)]'
                    : 'bg-[var(--na-ivory)] text-[var(--na-ink)] border-[var(--na-border)]'
                }`}
              >
                <Users size={15} /> Feedbacks ({overview.feedbacks.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('config')}
                className={`px-4 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${
                  tab === 'config'
                    ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)]'
                    : 'bg-[var(--na-ivory)] text-[var(--na-ink)] border-[var(--na-border)]'
                }`}
              >
                <SlidersHorizontal size={15} /> Ollama/Kaggle · Stripe · Versão
              </button>
            </div>

            {/* Tab 1: Mailing & CSV Export */}
            {tab === 'mailing' && (
              <div className="surface-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl">Base de E-mail Marketing</h3>
                    <p className="text-xs text-[var(--na-muted)]">
                      Pronta para importar na Brevo, Resend ou campanhas do Núcleo Afetar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleExportCsv()}
                    className="btn-tactile-primary px-4 text-xs inline-flex items-center gap-2"
                  >
                    <DownloadSimple size={16} weight="bold" /> Baixar Mailing CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--na-border)] text-[var(--na-muted)]">
                        <th className="py-2 pr-3">Nome</th>
                        <th className="py-2 pr-3">E-mail</th>
                        <th className="py-2 pr-3">WhatsApp</th>
                        <th className="py-2 pr-3">Idioma</th>
                        <th className="py-2 pr-3">Origem</th>
                        <th className="py-2">Peças</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--na-border)]">
                      {(mailing?.contacts ?? []).map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 pr-3 font-semibold">{c.displayName}</td>
                          <td className="py-2.5 pr-3 font-mono-code">{c.email}</td>
                          <td className="py-2.5 pr-3">{c.whatsapp || '—'}</td>
                          <td className="py-2.5 pr-3 uppercase font-bold">{c.activeLanguage}</td>
                          <td className="py-2.5 pr-3">{c.leadSource}</td>
                          <td className="py-2.5 font-bold">{c.xpTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Tester Feedbacks */}
            {tab === 'feedback' && (
              <div className="space-y-3">
                {overview.feedbacks.length === 0 ? (
                  <div className="surface-card p-6 text-sm text-[var(--na-muted)]">
                    Nenhum feedback enviado ainda.
                  </div>
                ) : (
                  overview.feedbacks.map((fb) => (
                    <div
                      key={fb.id}
                      className="surface-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                          <span className="px-2 py-0.5 rounded-full bg-[var(--na-sand)] text-[var(--na-burgundy)] uppercase">
                            {fb.platform} · {fb.category}
                          </span>
                          {fb.language && <span className="uppercase">{fb.language}</span>}
                          <span className="text-[var(--na-muted)]">
                            {fb.user ? `${fb.user.displayName} (${fb.user.email})` : 'Anônimo'}
                          </span>
                        </div>
                        <div className="text-sm text-[var(--na-ink)]">{fb.message}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleStatusFeedback(fb.id, 'in_progress')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            fb.status === 'in_progress'
                              ? 'bg-[var(--na-teal)] text-white border-transparent'
                              : 'border-[var(--na-border)]'
                          }`}
                        >
                          Em análise
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatusFeedback(fb.id, 'resolved')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${
                            fb.status === 'resolved'
                              ? 'bg-[var(--na-success)] text-white border-transparent'
                              : 'border-[var(--na-border)]'
                          }`}
                        >
                          <CheckCircle size={14} weight="fill" /> Resolvido
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Live Ollama/Kaggle, Stripe Visibility & Release Version */}
            {tab === 'config' && (
              <form onSubmit={handleSaveConfig} className="surface-card p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--na-border)]">
                  <div>
                    <h3 className="font-display text-2xl">IA 24/7 na Nuvem (Llama 3.3 70B + Whisper + Ollama)</h3>
                    <p className="text-xs text-[var(--na-muted)]">
                      {overview.runtime.openaiBaseUrl
                        ? `Motor 24/7 ativo: ${overview.runtime.openaiModel || 'llama-3.3-70b'} (${overview.runtime.openaiBaseUrl}) + Whisper HD grátis.`
                        : 'Configure OPENAI_BASE_URL / OPENAI_API_KEY (Llama 3.3 24/7 grátis) ou uma URL do Ollama/Kaggle abaixo.'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                      overview.runtime.openaiBaseUrl || overview.ollamaStatus.reachable
                        ? 'bg-[var(--na-success-soft)] text-[var(--na-success)]'
                        : 'bg-[var(--na-sand)] text-[var(--na-muted)]'
                    }`}
                  >
                    <CloudCheck size={15} weight="fill" />
                    {overview.runtime.openaiBaseUrl
                      ? 'Llama 3.3 · 24/7'
                      : overview.ollamaStatus.reachable
                        ? 'Ollama Online'
                        : 'Fallback Ativo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">URL do Ollama (Kaggle / Cloud)</label>
                    <input
                      type="url"
                      value={ollamaBaseUrl}
                      onChange={(e) => setOllamaBaseUrl(e.target.value)}
                      placeholder="https://seu-tunel.trycloudflare.com ou https://ollama.com"
                      className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] text-xs font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Modelo Ollama</label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="gpt-oss:20b"
                      className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] text-xs font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Ollama API Key (opcional — só para Ollama Cloud)
                    </label>
                    <input
                      type="password"
                      value={ollamaApiKey}
                      onChange={(e) => setOllamaApiKey(e.target.value)}
                      placeholder={
                        overview.runtime.ollamaHasApiKey ? '•••••••• (já configurada)' : 'Opcional'
                      }
                      className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Limite diário de turnos IA no beta grátis
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={dailyFreeAiTurns}
                      onChange={(e) => setDailyFreeAiTurns(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] text-xs"
                    />
                  </div>
                </div>

                {/* Billing Master Switch (Hidden by default) */}
                <div className="p-4 rounded-[14px] bg-[var(--na-sand)]/70 border border-[var(--na-sand-dark)] space-y-3">
                  <div className="font-bold text-sm text-[var(--na-wine)]">
                    Chave Mestra de Cobrança (Stripe)
                  </div>
                  <label className="flex items-center gap-3 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeBetaMode}
                      onChange={(e) => setFreeBetaMode(e.target.checked)}
                      className="w-4 h-4 accent-[var(--na-burgundy)]"
                    />
                    <span>
                      <strong>Modo Beta 100% Gratuito ativo</strong> (todos os 8 idiomas liberados)
                    </span>
                  </label>
                  <label className="flex items-center gap-3 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingUiEnabled}
                      onChange={(e) => setBillingUiEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[var(--na-burgundy)]"
                    />
                    <span>
                      <strong>Exibir tela de planos e pagamentos Stripe no app</strong> (mantenha
                      DESMARCADO até decidir cobrar!)
                    </span>
                  </label>
                </div>

                {/* App Release Version Control */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Versão mais recente do app</label>
                    <input
                      type="text"
                      value={latestAppVersion}
                      onChange={(e) => setLatestAppVersion(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] text-xs font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Novidades da atualização</label>
                    <input
                      type="text"
                      value={releaseNotesPt}
                      onChange={(e) => setReleaseNotesPt(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--na-cream)] border border-[var(--na-border)] text-xs"
                    />
                  </div>
                </div>

                {saveNotice && (
                  <div className="p-3 rounded-[10px] bg-[var(--na-success-soft)] text-xs font-semibold text-[var(--na-success)]">
                    {saveNotice}
                  </div>
                )}

                <button type="submit" className="btn-tactile-primary px-6 text-sm">
                  Salvar e aplicar em Web, Android e iOS
                </button>
              </form>
            )}
          </>
        )
      )}
    </div>
  );
}
