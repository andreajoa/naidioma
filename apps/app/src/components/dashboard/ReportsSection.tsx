import { useState, type FormEvent } from 'react';
import {
  CheckCircle,
  DownloadSimple,
  EnvelopeSimple,
  FileCsv,
  FileText,
  FloppyDisk,
  PaperPlaneTilt,
  Printer,
  Trash,
} from '@phosphor-icons/react';
import {
  api,
  type AdminDashboardSummary,
  type AdminSavedReportListItem,
} from '../../lib/api';
import {
  downloadTextFile,
  formatDateTimeBr,
  formatDuration,
} from './formatters';

interface ReportsSectionProps {
  adminToken: string;
  currentRange: '7d' | '30d' | '90d' | 'all' | 'custom';
  customFrom: string;
  customTo: string;
  reports: AdminSavedReportListItem[];
  onReportsChanged: () => Promise<void>;
}

export function ReportsSection({
  adminToken,
  currentRange,
  customFrom,
  customTo,
  reports,
  onReportsChanged,
}: ReportsSectionProps) {
  const [title, setTitle] = useState('');
  const [periodType, setPeriodType] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>(currentRange);
  const [notes, setNotes] = useState('');
  const [sendEmailTo, setSendEmailTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<{
    report: Omit<AdminSavedReportListItem, 'kpis'>;
    summary: AdminDashboardSummary;
  } | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [emailModalTarget, setEmailModalTarget] = useState('');

  async function handleGenerateReport(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const created = await api.adminCreateReport(adminToken, {
        title: title.trim() || undefined,
        periodType,
        from: periodType === 'custom' ? customFrom || undefined : undefined,
        to: periodType === 'custom' ? customTo || undefined : undefined,
        notes: notes.trim() || undefined,
        sendEmailTo: sendEmailTo.trim() || undefined,
      });
      setTitle('');
      setNotes('');
      setSelectedReport({ report: created.report, summary: created.summary });
      setEditNotes(created.report.notes ?? '');
      const emailNotice = created.emailResult
        ? created.emailResult.sent
          ? ` e enviado por e-mail via ${created.emailResult.provider}`
          : ` (e-mail não enviado: ${created.emailResult.error ?? 'provedor não configurado'})`
        : '';
      setStatusMsg(`Relatório salvo no banco com sucesso${emailNotice}!`);
      await onReportsChanged();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao gerar relatório.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenReport(id: string) {
    setBusy(true);
    setStatusMsg(null);
    try {
      const full = await api.adminGetReport(adminToken, id);
      setSelectedReport(full);
      setEditNotes(full.report.notes ?? '');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao abrir relatório.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNotes() {
    if (!selectedReport) return;
    setBusy(true);
    try {
      await api.adminUpdateReportNotes(adminToken, selectedReport.report.id, editNotes);
      setSelectedReport({
        ...selectedReport,
        report: { ...selectedReport.report, notes: editNotes },
      });
      setStatusMsg('Anotações do relatório salvas!');
      await onReportsChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSelectedReport() {
    if (!selectedReport || !emailModalTarget.trim()) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await api.adminEmailReport(
        adminToken,
        selectedReport.report.id,
        emailModalTarget.trim(),
      );
      setStatusMsg(
        `Relatório enviado para ${emailModalTarget.trim()} via ${res.provider}!`,
      );
      await onReportsChanged();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Falha ao enviar e-mail.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteReport(id: string) {
    if (!window.confirm('Deseja remover este relatório salvo do histórico?')) return;
    setBusy(true);
    try {
      await api.adminDeleteReport(adminToken, id);
      if (selectedReport?.report.id === id) setSelectedReport(null);
      await onReportsChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadCsv(type: 'users' | 'visitors' | 'lessons') {
    setBusy(true);
    setStatusMsg(null);
    try {
      const csv = await api.adminDownloadDashboardCsv(adminToken, type, currentRange);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(csv, `naidioma-${type}-${stamp}.csv`, 'text/csv;charset=utf-8;');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Falha ao baixar CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadJson() {
    setBusy(true);
    setStatusMsg(null);
    try {
      const json = await api.adminDownloadDashboardJson(adminToken, currentRange);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(json, `naidioma-relatorio-${stamp}.json`, 'application/json;charset=utf-8;');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Falha ao baixar JSON.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Export Bar */}
      <section className="bg-white border-2 border-[#E5D8C8] p-5 space-y-4 no-print">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1496B0]">
            Exportação Imediata (Excel / Google Sheets / BI)
          </div>
          <h2 className="font-display text-xl text-[#1E1A1D] mt-0.5">
            Baixar Dados Completos do Período
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDownloadCsv('users')}
            className="min-h-[46px] px-4 bg-[#9A1B45] hover:bg-[#821539] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <FileCsv size={17} weight="bold" /> CSV Perfis &amp; Níveis
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDownloadCsv('visitors')}
            className="min-h-[46px] px-4 bg-[#1496B0] hover:bg-[#0F7E94] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <FileCsv size={17} weight="bold" /> CSV Acessos &amp; Cidades
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDownloadCsv('lessons')}
            className="min-h-[46px] px-4 bg-[#2CB65E] hover:bg-[#229A4E] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <FileCsv size={17} weight="bold" /> CSV Diagnóstico Lições
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDownloadJson()}
            className="min-h-[46px] px-4 bg-[#FFFBF5] hover:bg-[#F5ECE0] border-2 border-[#E5D8C8] text-[#1E1A1D] text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <DownloadSimple size={17} weight="bold" /> JSON Completo
          </button>
        </div>
      </section>

      {/* Generate & Save Snapshot Report */}
      <form
        onSubmit={handleGenerateReport}
        className="bg-white border-2 border-[#E5D8C8] p-5 space-y-4 no-print"
      >
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9A1B45]">
            Memória Histórica no Banco (Cloudflare KV Criptografado)
          </div>
          <h2 className="font-display text-xl text-[#1E1A1D] mt-0.5">
            Gerar e Salvar Relatório Executivo
          </h2>
          <p className="text-xs text-[var(--na-muted)] mt-1">
            Congela todos os indicadores, cidades, idiomas, níveis CEFR e recomendações em um registro
            permanente para comparar evolução mês a mês. Toda segunda-feira o sistema também salva um
            relatório semanal automático.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Título do Relatório (opcional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Fechamento Novembro 2026"
              className="w-full min-h-[42px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Janela de Análise
            </label>
            <select
              value={periodType}
              onChange={(e) =>
                setPeriodType(e.target.value as '7d' | '30d' | '90d' | 'all' | 'custom')
              }
              className="w-full min-h-[42px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm font-bold"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="all">Todo o histórico</option>
              <option value="custom">Intervalo customizado atual</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
              Enviar cópia por e-mail (opcional)
            </label>
            <input
              type="email"
              value={sendEmailTo}
              onChange={(e) => setSendEmailTo(e.target.value)}
              placeholder="seu@email.com"
              className="w-full min-h-[42px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
            Anotações / Plano de Melhorias deste ciclo (opcional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Melhorar lição A1 de pronúncia e reforçar convite PWA após a 1ª aula..."
            className="w-full p-3 bg-[#FFFBF5] border border-[#E5D8C8] text-sm"
          />
        </div>

        {statusMsg && (
          <div className="p-3 bg-[#E2F9EB] border border-[#2CB65E] text-xs font-bold text-[#1D8A45] flex items-center gap-2">
            <CheckCircle size={16} weight="fill" /> {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5">
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] px-5 bg-[#9A1B45] hover:bg-[#821539] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2"
          >
            <FileText size={16} weight="bold" />
            {busy ? 'Gerando...' : 'Gerar & Salvar Relatório Agora'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-4 bg-white border-2 border-[#E5D8C8] hover:border-[#9A1B45] text-[#1E1A1D] text-xs font-extrabold inline-flex items-center gap-2"
          >
            <Printer size={16} weight="bold" /> Imprimir / Salvar PDF
          </button>
        </div>
      </form>

      {/* Saved Reports Archive + Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 bg-white border-2 border-[#E5D8C8] p-5 space-y-3 no-print">
          <h3 className="font-display text-lg text-[#1E1A1D]">
            Histórico Salvo ({reports.length})
          </h3>
          {reports.length === 0 ? (
            <div className="text-xs text-[var(--na-muted)] py-6">
              Nenhum relatório salvo ainda. Clique em "Gerar &amp; Salvar Relatório Agora" acima para
              criar o primeiro marco histórico.
            </div>
          ) : (
            <div className="divide-y divide-[#EFE5D8] max-h-[520px] overflow-y-auto">
              {reports.map((rep) => {
                const active = selectedReport?.report.id === rep.id;
                return (
                  <div
                    key={rep.id}
                    className={`py-3 px-2.5 transition-colors ${
                      active ? 'bg-[#FFF5E8] border-l-4 border-[#9A1B45]' : 'hover:bg-[#FFFBF5]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenReport(rep.id)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="font-extrabold text-sm text-[#1E1A1D] truncate">
                          {rep.title}
                        </div>
                        <div className="font-mono-code text-[11px] text-[var(--na-muted)] mt-0.5">
                          {formatDateTimeBr(rep.createdAt)} · {rep.periodType.toUpperCase()}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1.5 font-mono-code text-[11px] font-bold">
                          <span className="text-[#9A1B45]">
                            {rep.kpis.totalSessions ?? 0} acessos
                          </span>
                          <span className="text-[#1496B0]">
                            {rep.kpis.totalRegisteredUsers ?? 0} alunos
                          </span>
                          <span className="text-[#1D8A45]">
                            {rep.kpis.lessonsCompletedInPeriod ?? 0} lições
                          </span>
                        </div>
                        {rep.emailedTo && (
                          <div className="text-[10px] text-[#1D8A45] font-bold mt-1 inline-flex items-center gap-1">
                            <EnvelopeSimple size={12} /> Enviado para {rep.emailedTo}
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteReport(rep.id)}
                        aria-label="Excluir relatório"
                        className="p-1.5 text-[var(--na-muted)] hover:text-[#E04338] shrink-0"
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Opened Report Executive Printable Sheet */}
        <section className="lg:col-span-7 bg-white border-2 border-[#E5D8C8] p-6 space-y-5 print-break-avoid">
          {!selectedReport ? (
            <div className="py-16 text-center text-xs text-[var(--na-muted)]">
              Selecione um relatório salvo à esquerda (ou gere um novo) para visualizar o resumo
              executivo completo, adicionar anotações, enviar por e-mail ou imprimir em PDF.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b-2 border-[#1E1A1D]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9A1B45]">
                    NAidioma · Relatório Executivo Salvo
                  </div>
                  <h3 className="font-display text-2xl text-[#1E1A1D] mt-1">
                    {selectedReport.report.title}
                  </h3>
                  <div className="font-mono-code text-xs text-[var(--na-muted)] mt-0.5">
                    Período: {selectedReport.summary.period.labelPt} · Gerado em{' '}
                    {formatDateTimeBr(selectedReport.report.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print min-h-[38px] px-3.5 bg-[#1E1A1D] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Printer size={15} weight="bold" /> Salvar PDF
                </button>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#FFFBF5] border border-[#E5D8C8]">
                  <div className="text-[10px] font-bold uppercase text-[var(--na-muted)]">Acessos</div>
                  <div className="font-mono-code text-xl font-extrabold text-[#9A1B45]">
                    {selectedReport.summary.kpis.totalSessions}
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)]">
                    {selectedReport.summary.kpis.uniqueVisitors} únicos
                  </div>
                </div>
                <div className="p-3 bg-[#FFFBF5] border border-[#E5D8C8]">
                  <div className="text-[10px] font-bold uppercase text-[var(--na-muted)]">Cadastros</div>
                  <div className="font-mono-code text-xl font-extrabold text-[#1496B0]">
                    {selectedReport.summary.kpis.totalRegisteredUsers}
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)]">
                    +{selectedReport.summary.kpis.newUsersInPeriod} ({selectedReport.summary.kpis.visitorToSignupRate}%)
                  </div>
                </div>
                <div className="p-3 bg-[#FFFBF5] border border-[#E5D8C8]">
                  <div className="text-[10px] font-bold uppercase text-[var(--na-muted)]">Tempo Uso</div>
                  <div className="font-mono-code text-xl font-extrabold text-[#1D8A45]">
                    {formatDuration(selectedReport.summary.kpis.totalUsageSecondsPeriod)}
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)]">
                    méd. {formatDuration(selectedReport.summary.kpis.avgSessionSeconds)}/sessão
                  </div>
                </div>
                <div className="p-3 bg-[#FFFBF5] border border-[#E5D8C8]">
                  <div className="text-[10px] font-bold uppercase text-[var(--na-muted)]">Ativos</div>
                  <div className="font-mono-code text-xl font-extrabold text-[#C98A00]">
                    {selectedReport.summary.kpis.dau}/{selectedReport.summary.kpis.wau}/
                    {selectedReport.summary.kpis.mau}
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)]">DAU / WAU / MAU</div>
                </div>
              </div>

              {/* Languages + Top Cities Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="font-extrabold uppercase text-[10px] text-[var(--na-muted)]">
                    Idiomas &amp; Lições
                  </div>
                  {selectedReport.summary.languageBreakdown
                    .filter((l) => l.activeUsers > 0 || l.lessonsCompleted > 0)
                    .slice(0, 6)
                    .map((l) => (
                      <div key={l.code} className="flex justify-between py-1 border-b border-[#F2E9DD]">
                        <span className="font-bold">{l.namePt}</span>
                        <span className="font-mono-code">
                          {l.activeUsers} ativos · {l.lessonsCompleted} lições
                        </span>
                      </div>
                    ))}
                </div>

                <div className="space-y-1.5">
                  <div className="font-extrabold uppercase text-[10px] text-[var(--na-muted)]">
                    Principais Cidades
                  </div>
                  {selectedReport.summary.topCities.slice(0, 6).map((c) => (
                    <div key={c.label} className="flex justify-between py-1 border-b border-[#F2E9DD]">
                      <span className="font-bold truncate pr-2">{c.label}</span>
                      <span className="font-mono-code shrink-0">
                        {c.registeredUsers} alunos · {c.sessions} sess.
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations snapshot */}
              {selectedReport.summary.recommendations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold uppercase text-[10px] text-[#9A1B45]">
                    Diagnóstico &amp; Recomendações do Período
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {selectedReport.summary.recommendations.map((rec) => (
                      <li key={rec.id} className="p-2.5 bg-[#FFFBF5] border border-[#E5D8C8]">
                        <strong>{rec.title}</strong> ({rec.metricBadge}): {rec.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes & Email delivery */}
              <div className="pt-3 border-t border-[#E5D8C8] space-y-3 no-print">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[var(--na-muted)] mb-1">
                    Anotações do Proprietário
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Escreva decisões tomadas com base neste relatório..."
                    className="w-full p-2.5 bg-[#FFFBF5] border border-[#E5D8C8] text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveNotes()}
                    className="mt-2 min-h-[36px] px-3.5 bg-[#1496B0] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                  >
                    <FloppyDisk size={14} weight="bold" /> Salvar anotações
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F2E9DD]">
                  <input
                    type="email"
                    value={emailModalTarget}
                    onChange={(e) => setEmailModalTarget(e.target.value)}
                    placeholder="Enviar este relatório por e-mail (NovaMail)..."
                    className="flex-1 min-w-[200px] min-h-[38px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy || !emailModalTarget.trim()}
                    onClick={() => void handleEmailSelectedReport()}
                    className="min-h-[38px] px-4 bg-[#9A1B45] disabled:opacity-45 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                  >
                    <PaperPlaneTilt size={14} weight="bold" /> Enviar E-mail
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
