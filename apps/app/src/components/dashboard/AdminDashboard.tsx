import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowsClockwise,
  ChartBar,
  Clock,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  FileText,
  GlobeHemisphereWest,
  GraduationCap,
  Lightbulb,
  LockKey,
  MagnifyingGlass,
  MapPin,
  Printer,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Users,
  WarningCircle,
} from '@phosphor-icons/react';
import { CEFR_ORDER, LANGUAGE_LIST } from '@naidioma/shared';
import {
  api,
  type AdminAuditEntry,
  type AdminDashboardSummary,
  type AdminDashboardUserRow,
  type AdminSavedReportListItem,
  type AdminVisitorSessionRow,
} from '../../lib/api';
import {
  FunnelChart,
  HorizontalRankBars,
  HourlyBarChart,
  TimelineChart,
} from './DashboardCharts';
import {
  CEFR_BADGE_STYLES,
  formatDateTimeBr,
  formatDuration,
  formatRelativeBr,
} from './formatters';
import { OperationsSection } from './OperationsSection';
import { ReportsSection } from './ReportsSection';
import { UserDossierDrawer } from './UserDossierDrawer';

const ADMIN_TOKEN_SESSION_KEY = 'naidioma_admin_dashboard_jwt';

type DashboardTab =
  | 'overview'
  | 'users'
  | 'traffic'
  | 'pedagogy'
  | 'reports'
  | 'mailing'
  | 'system';

type DateRangeKey = '7d' | '30d' | '90d' | 'all' | 'custom';

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [checkingSession, setCheckingSession] = useState(Boolean(adminToken));
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<DashboardTab>('overview');
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [usersData, setUsersData] = useState<{ total: number; items: AdminDashboardUserRow[] }>({
    total: 0,
    items: [],
  });
  const [visitors, setVisitors] = useState<AdminVisitorSessionRow[]>([]);
  const [reports, setReports] = useState<AdminSavedReportListItem[]>([]);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.getAdminOverview>> | null>(
    null,
  );
  const [mailing, setMailing] = useState<Awaited<ReturnType<typeof api.getAdminMailing>> | null>(
    null,
  );
  const [authMeta, setAuthMeta] = useState<{
    source: string;
    mustConfigurePassword: boolean;
    sessionVersion: number;
    passwordUpdatedAt: string | null;
  } | null>(null);
  const [recentAudits, setRecentAudits] = useState<AdminAuditEntry[]>([]);

  // Users filters
  const [userSearch, setUserSearch] = useState('');
  const [userLangFilter, setUserLangFilter] = useState('');
  const [userCefrFilter, setUserCefrFilter] = useState('');
  const [userCityFilter, setUserCityFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userSort, setUserSort] = useState('created');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Visitors filters
  const [onlyAnonymous, setOnlyAnonymous] = useState(false);
  const [visitorCityFilter, setVisitorCityFilter] = useState('');

  // Enforce noindex + private document title whenever on /dashboard
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'NAidioma · Painel Administrativo Restrito';
    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prevRobots = robotsMeta?.content ?? null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = 'noindex, nofollow, noarchive';

    return () => {
      document.title = prevTitle;
      if (robotsMeta && prevRobots) robotsMeta.content = prevRobots;
    };
  }, []);

  const clearSession = useCallback(() => {
    setAdminToken('');
    setSummary(null);
    try {
      window.sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const saveToken = useCallback((token: string) => {
    setAdminToken(token);
    try {
      window.sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
    } catch {
      // ignore
    }
  }, []);

  const loadAllDashboardData = useCallback(
    async (tokenToUse: string) => {
      setLoadingData(true);
      setDataError(null);
      try {
        const [sess, sum, usrs, vis, reps, ov, ml] = await Promise.all([
          api.adminGetSession(tokenToUse),
          api.adminGetDashboardSummary(tokenToUse, {
            range,
            from: range === 'custom' ? customFrom || undefined : undefined,
            to: range === 'custom' ? customTo || undefined : undefined,
          }),
          api.adminGetDashboardUsers(tokenToUse, {
            search: userSearch || undefined,
            language: userLangFilter || undefined,
            cefr: userCefrFilter || undefined,
            city: userCityFilter || undefined,
            status: userStatusFilter === 'all' ? undefined : userStatusFilter,
            sort: userSort,
            limit: 150,
          }),
          api.adminGetDashboardVisitors(tokenToUse, {
            range,
            onlyAnonymous,
            city: visitorCityFilter || undefined,
            limit: 120,
          }),
          api.adminListReports(tokenToUse),
          api.getAdminOverview(tokenToUse),
          api.getAdminMailing(tokenToUse),
        ]);

        setAuthMeta(sess.auth);
        setRecentAudits(sess.recentAudits);
        setSummary(sum);
        setUsersData({ total: usrs.total, items: usrs.items });
        setVisitors(vis.sessions);
        setReports(reps.reports);
        setOverview(ov);
        setMailing(ml);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados do painel.';
        if (msg.toLowerCase().includes('expirada') || msg.toLowerCase().includes('restrito')) {
          clearSession();
          setLoginError('Sessão encerrada. Faça login novamente com sua senha administrativa.');
        } else {
          setDataError(msg);
        }
      } finally {
        setLoadingData(false);
        setCheckingSession(false);
      }
    },
    [
      clearSession,
      customFrom,
      customTo,
      onlyAnonymous,
      range,
      userCefrFilter,
      userCityFilter,
      userLangFilter,
      userSearch,
      userSort,
      userStatusFilter,
      visitorCityFilter,
    ],
  );

  useEffect(() => {
    if (!adminToken) {
      setCheckingSession(false);
      return;
    }
    void loadAllDashboardData(adminToken);
  }, [adminToken, loadAllDashboardData]);

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await api.adminLogin(passwordInput);
      setPasswordInput('');
      saveToken(res.token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Senha inválida.');
    } finally {
      setLoginBusy(false);
    }
  }

  // =========================================================================
  // AUTH GATE (Exclusive Owner Login — Clean, High-Trust Editorial Lock)
  // =========================================================================
  if (checkingSession) {
    return (
      <div className="min-h-[100dvh] bg-[#FFFBF5] text-[#1E1A1D] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="font-mono-code text-xs uppercase tracking-[0.2em] text-[#9A1B45] font-bold">
            NAidioma · /dashboard
          </div>
          <div className="font-display text-2xl">Verificando sessão administrativa...</div>
        </div>
      </div>
    );
  }

  if (!adminToken) {
    return (
      <div className="min-h-[100dvh] bg-[#FFFBF5] text-[#1E1A1D] flex flex-col justify-between p-6">
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#9A1B45] text-white flex items-center justify-center font-display text-lg">
              NA
            </div>
            <div>
              <div className="font-display text-lg leading-none">NAidioma</div>
              <div className="font-mono-code text-[10px] uppercase tracking-[0.18em] text-[var(--na-muted)] mt-1">
                Centro de Comando · Acesso Restrito
              </div>
            </div>
          </div>
          <a
            href="/"
            className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)] hover:text-[#9A1B45]"
          >
            ← Ir ao aplicativo
          </a>
        </header>

        <main className="max-w-md w-full mx-auto my-10">
          <div className="bg-white border-2 border-[#1E1A1D] p-7 space-y-5 shadow-[6px_6px_0px_#E5D8C8]">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFE8F0] border border-[#9A1B45]/40 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9A1B45]">
                <LockKey size={13} weight="fill" /> Exclusivo do Proprietário
              </div>
              <h1 className="font-display text-3xl text-[#1E1A1D] leading-tight pt-1">
                Painel de Inteligência NAidioma
              </h1>
              <p className="text-xs text-[var(--na-muted)] leading-relaxed">
                Acesso protegido por criptografia <code className="font-mono-code">scrypt</code>,
                bloqueio anti-força-bruta e trilha de auditoria. Nenhum aluno tem acesso a esta rota.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-dashboard-password"
                  className="block text-[11px] font-extrabold uppercase tracking-wider text-[#1E1A1D] mb-1.5"
                >
                  Senha de Administrador
                </label>
                <div className="relative">
                  <input
                    id="admin-dashboard-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Digite sua senha exclusiva..."
                    className="w-full min-h-[48px] pl-3.5 pr-11 bg-[#FFFBF5] border-2 border-[#E5D8C8] focus:border-[#9A1B45] text-sm font-mono-code"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--na-muted)] hover:text-[#1E1A1D]"
                  >
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="p-3 bg-[#FFECEB] border border-[#E04338] text-xs font-bold text-[#B02B22]"
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full min-h-[48px] bg-[#9A1B45] hover:bg-[#7D1437] text-white font-extrabold text-xs uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
              >
                {loginBusy ? 'Validando credencial...' : 'Entrar no /dashboard'}
              </button>
            </form>
          </div>
        </main>

        <footer className="max-w-4xl w-full mx-auto text-center font-mono-code text-[11px] text-[var(--na-muted)] pb-2">
          NAidioma · Núcleo Afetar · Sessão expirável em 12h · Indexação bloqueada (noindex)
        </footer>
      </div>
    );
  }

  const navItems: Array<{ id: DashboardTab; label: string; icon: typeof ChartBar; count?: number }> = [
    { id: 'overview', label: 'Visão Geral', icon: ChartBar },
    { id: 'users', label: 'Perfis & Alunos', icon: Users, count: summary?.kpis.totalRegisteredUsers },
    { id: 'traffic', label: 'Acessos & Cidades', icon: MapPin, count: summary?.kpis.totalSessions },
    { id: 'pedagogy', label: 'Pedagógico & Melhorias', icon: GraduationCap },
    { id: 'reports', label: 'Relatórios', icon: FileText, count: reports.length },
    {
      id: 'mailing',
      label: 'Mailing & Feedbacks',
      icon: EnvelopeSimple,
      count: summary?.kpis.openFeedbackCount || undefined,
    },
    { id: 'system', label: 'Sistema & Segurança', icon: SlidersHorizontal },
  ];

  const k = summary?.kpis;

  return (
    <div className="min-h-[100dvh] bg-[#FFFBF5] text-[#1E1A1D] flex flex-col lg:flex-row">
      {/* Left Executive Rail (Desktop) */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 shrink-0 bg-white border-r-2 border-[#E5D8C8] sticky top-0 h-[100dvh] justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#EFE5D8]">
            <div className="w-10 h-10 bg-[#9A1B45] text-white flex items-center justify-center font-display text-lg shrink-0">
              NA
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg leading-none truncate">NAidioma Admin</div>
              <div className="font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#1496B0] font-bold mt-1">
                /dashboard exclusivo
              </div>
            </div>
          </div>

          <nav className="space-y-1" aria-label="Seções do dashboard">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full min-h-[44px] px-3 text-left text-xs font-extrabold flex items-center justify-between gap-2 border-l-4 transition-colors ${
                    active
                      ? 'bg-[#FFF5E8] border-[#9A1B45] text-[#9A1B45]'
                      : 'border-transparent text-[#554E54] hover:bg-[#FAF4EC] hover:text-[#1E1A1D]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    <Icon size={18} weight={active ? 'fill' : 'bold'} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && (
                    <span className="font-mono-code text-[10px] px-1.5 py-0.5 bg-white border border-[#E5D8C8] text-[#1E1A1D]">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-[#EFE5D8]">
          <a
            href="/"
            className="w-full min-h-[38px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-[11px] font-extrabold text-[#1E1A1D] flex items-center justify-center hover:border-[#1496B0]"
          >
            Abrir App (Visão Aluno)
          </a>
          <button
            type="button"
            onClick={clearSession}
            className="w-full min-h-[38px] px-3 bg-white border border-[#E5D8C8] hover:border-[#E04338] text-[11px] font-extrabold text-[#B02B22] flex items-center justify-center gap-1.5"
          >
            <SignOut size={15} weight="bold" /> Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Command Bar */}
        <header className="no-print sticky top-0 z-30 bg-white border-b-2 border-[#E5D8C8] px-4 sm:px-6 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="lg:hidden w-8 h-8 bg-[#9A1B45] text-white flex items-center justify-center font-display text-sm">
                NA
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-xl text-[#1E1A1D] leading-none">
                  {navItems.find((n) => n.id === tab)?.label}
                </h1>
                <div className="font-mono-code text-[11px] text-[var(--na-muted)] mt-1">
                  {summary ? `Atualizado ${formatDateTimeBr(summary.generatedAt)}` : 'Carregando...'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Period switcher */}
              <div className="inline-flex border border-[#E5D8C8] bg-[#FFFBF5]">
                {(
                  [
                    ['7d', '7d'],
                    ['30d', '30d'],
                    ['90d', '90d'],
                    ['all', 'Tudo'],
                    ['custom', 'Datas'],
                  ] as Array<[DateRangeKey, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRange(key)}
                    className={`px-2.5 py-1.5 text-[11px] font-mono-code font-extrabold transition-colors ${
                      range === key
                        ? 'bg-[#9A1B45] text-white'
                        : 'text-[#554E54] hover:bg-[#F3E9DC]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {range === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 px-2 border border-[#E5D8C8] bg-white font-mono-code text-[11px]"
                  />
                  <span className="text-xs text-[var(--na-muted)]">a</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 px-2 border border-[#E5D8C8] bg-white font-mono-code text-[11px]"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={loadingData}
                onClick={() => void loadAllDashboardData(adminToken)}
                className="h-8 px-3 bg-white border border-[#E5D8C8] hover:border-[#1496B0] text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <ArrowsClockwise size={14} weight="bold" className={loadingData ? 'animate-spin' : ''} />
                Atualizar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex h-8 px-3 bg-[#1E1A1D] text-white text-xs font-extrabold items-center gap-1.5"
              >
                <Printer size={14} weight="bold" /> PDF
              </button>

              <button
                type="button"
                onClick={clearSession}
                className="lg:hidden h-8 px-2.5 border border-[#E5D8C8] text-[#B02B22] text-xs font-extrabold inline-flex items-center gap-1"
              >
                <SignOut size={14} weight="bold" /> Sair
              </button>
            </div>
          </div>

          {/* Mobile horizontal navigation */}
          <nav className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-extrabold inline-flex items-center gap-1.5 border ${
                    active
                      ? 'bg-[#9A1B45] text-white border-[#9A1B45]'
                      : 'bg-[#FFFBF5] text-[#554E54] border-[#E5D8C8]'
                  }`}
                >
                  <Icon size={14} weight={active ? 'fill' : 'bold'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Security warning banner if still on ADMIN_API_KEY fallback */}
        {authMeta?.mustConfigurePassword && (
          <div className="no-print bg-[#FFF6D6] border-b-2 border-[#E5A300] px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#6E4A00]">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} weight="fill" />
              Você entrou com a chave de contingência. Defina sua senha exclusiva do /dashboard para
              blindar o acesso.
            </span>
            <button
              type="button"
              onClick={() => setTab('system')}
              className="px-3 py-1 bg-[#9A1B45] text-white font-extrabold text-[11px] uppercase"
            >
              Definir Senha Agora
            </button>
          </div>
        )}

        {dataError && (
          <div className="m-6 p-4 bg-[#FFECEB] border-2 border-[#E04338] text-xs font-bold text-[#B02B22]">
            {dataError}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-6">
          {/* Print-only executive header */}
          <div className="hidden print-only pb-4 border-b-2 border-[#1E1A1D]">
            <div className="text-xs font-mono-code uppercase tracking-widest text-[#9A1B45]">
              NAidioma · Núcleo Afetar · Relatório Administrativo
            </div>
            <h1 className="font-display text-2xl mt-1">
              Painel Executivo ({summary?.period.labelPt})
            </h1>
            <div className="font-mono-code text-xs text-[#6C6670]">
              Gerado em {formatDateTimeBr(summary?.generatedAt)}
            </div>
          </div>

          {/* ================================================================= */}
          {/* TAB 1: VISÃO GERAL                                                */}
          {/* ================================================================= */}
          {tab === 'overview' && summary && k && (
            <div className="space-y-6">
              {/* Asymmetric Editorial KPI Strip */}
              <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="col-span-2 lg:col-span-2 bg-[#9A1B45] text-white p-5 border-2 border-[#7A1436] flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#FFE27A]">
                    Acessos no Período ({summary.period.labelPt})
                  </div>
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="font-mono-code text-4xl font-extrabold">{k.totalSessions}</span>
                    <span className="text-xs font-bold text-[#FFDCE8]">
                      sessões · {k.uniqueVisitors} visitantes únicos
                    </span>
                  </div>
                  <div className="text-[11px] text-[#FFDCE8] mt-2 pt-2 border-t border-white/20 flex justify-between">
                    <span>Anônimos puros: {k.anonymousVisitorsOnly}</span>
                    <span>Conv. cadastro: {k.visitorToSignupRate}%</span>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#E5D8C8] p-4 flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                    Perfis Cadastrados
                  </div>
                  <div className="font-mono-code text-3xl font-extrabold text-[#1E1A1D] mt-1">
                    {k.totalRegisteredUsers}
                  </div>
                  <div className="text-[11px] font-bold text-[#1D8A45] mt-1">
                    +{k.newUsersInPeriod} no período · {k.activationRate}% ativados
                  </div>
                </div>

                <div className="bg-white border-2 border-[#E5D8C8] p-4 flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                    Tempo de Uso
                  </div>
                  <div className="font-mono-code text-3xl font-extrabold text-[#1496B0] mt-1">
                    {formatDuration(k.totalUsageSecondsPeriod)}
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)] mt-1">
                    Méd. {formatDuration(k.avgSessionSeconds)}/sessão ·{' '}
                    {formatDuration(k.avgSecondsPerUser)}/aluno
                  </div>
                </div>

                <div className="bg-white border-2 border-[#E5D8C8] p-4 flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                    Ativos (DAU/WAU/MAU)
                  </div>
                  <div className="font-mono-code text-2xl font-extrabold text-[#1E1A1D] mt-1">
                    {k.dau} / {k.wau} / {k.mau}
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)] mt-1">
                    Stickiness: <strong>{k.stickinessPct}%</strong>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#E5D8C8] p-4 flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                    Prática &amp; App
                  </div>
                  <div className="font-mono-code text-2xl font-extrabold text-[#C98A00] mt-1">
                    {k.totalLessonsCompletedAllTime} <span className="text-xs font-bold">lições</span>
                  </div>
                  <div className="text-[11px] text-[var(--na-muted)] mt-1">
                    {k.totalAiTurnsAllTime} turnos IA · {k.pwaInstalledUsers} PWA · {k.calmModeUsers} Calmo
                  </div>
                </div>
              </section>

              {/* Main Chart + Funnel (Asymmetric 7 / 5 split) */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9A1B45]">
                        Evolução Diária
                      </div>
                      <h2 className="font-display text-lg text-[#1E1A1D]">
                        Acessos, Novos Cadastros e Lições
                      </h2>
                    </div>
                  </div>
                  <TimelineChart data={summary.timeline} />
                </div>

                <div className="lg:col-span-5 bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1496B0]">
                      Diagnóstico de Abandono
                    </div>
                    <h2 className="font-display text-lg text-[#1E1A1D]">
                      Funil: Acesso → Cadastro → Estudo
                    </h2>
                  </div>
                  <FunnelChart steps={summary.funnel} />
                </div>
              </section>

              {/* Recommendations + Top Cities + Top Languages */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F26522] flex items-center gap-1">
                        <Lightbulb size={13} weight="fill" /> Inteligência de Produto
                      </div>
                      <h2 className="font-display text-lg text-[#1E1A1D]">
                        Recomendações Automáticas para Melhorar o App
                      </h2>
                    </div>
                  </div>
                  {summary.recommendations.length === 0 ? (
                    <div className="p-4 bg-[#E2F9EB] border border-[#2CB65E] text-xs font-bold text-[#1D8A45]">
                      Nenhum gargalo crítico detectado até o momento. Conforme entrarem mais acessos e
                      lições, os insights aparecem automaticamente aqui.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {summary.recommendations.map((rec) => {
                        const badgeColors =
                          rec.severity === 'high'
                            ? 'bg-[#FFECEB] border-[#E04338] text-[#B02B22]'
                            : rec.severity === 'medium'
                              ? 'bg-[#FFF6D6] border-[#E5A300] text-[#7A5200]'
                              : 'bg-[#E2F7FB] border-[#1496B0] text-[#0C6F84]';
                        return (
                          <div key={rec.id} className="p-3.5 bg-[#FFFBF5] border border-[#E5D8C8] space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-extrabold text-xs text-[#1E1A1D]">{rec.title}</span>
                              <span
                                className={`font-mono-code text-[10px] font-extrabold px-2 py-0.5 border ${badgeColors}`}
                              >
                                {rec.metricBadge}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--na-muted)] leading-relaxed">{rec.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base text-[#1E1A1D]">Top Cidades</h2>
                    <button
                      type="button"
                      onClick={() => setTab('traffic')}
                      className="text-[11px] font-extrabold text-[#1496B0] hover:underline"
                    >
                      Ver todas →
                    </button>
                  </div>
                  <HorizontalRankBars
                    color="#1496B0"
                    items={summary.topCities.slice(0, 7).map((c) => ({
                      label: c.label,
                      value: c.registeredUsers || c.sessions,
                      badge: `${c.registeredUsers} al.`,
                      sublabel: `${c.sessions} sess.`,
                    }))}
                  />
                </div>

                <div className="lg:col-span-3 bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base text-[#1E1A1D]">Idiomas &amp; Níveis</h2>
                    <button
                      type="button"
                      onClick={() => setTab('pedagogy')}
                      className="text-[11px] font-extrabold text-[#9A1B45] hover:underline"
                    >
                      Detalhes →
                    </button>
                  </div>
                  <HorizontalRankBars
                    color="#9A1B45"
                    items={summary.languageBreakdown.slice(0, 6).map((l) => ({
                      label: l.namePt,
                      value: l.activeUsers || l.totalLearners,
                      badge: `${l.activeUsers} ativos`,
                      sublabel: `${l.lessonsCompleted} liç.`,
                    }))}
                  />
                </div>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PERFIS & ALUNOS                                            */}
          {/* ================================================================= */}
          {tab === 'users' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <section className="bg-white border-2 border-[#E5D8C8] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <div className="lg:col-span-2 relative">
                  <MagnifyingGlass
                    size={16}
                    weight="bold"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--na-muted)]"
                  />
                  <input
                    type="text"
                    aria-label="Buscar perfil por nome, e-mail, cidade ou WhatsApp"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar nome, e-mail, cidade, WhatsApp..."
                    className="w-full min-h-[40px] pl-9 pr-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-semibold"
                  />
                </div>

                <select
                  aria-label="Filtrar por idioma"
                  value={userLangFilter}
                  onChange={(e) => setUserLangFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-bold"
                >
                  <option value="">Todos os idiomas</option>
                  {LANGUAGE_LIST.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.namePt}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por nível CEFR"
                  value={userCefrFilter}
                  onChange={(e) => setUserCefrFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-bold"
                >
                  <option value="">Todos os níveis CEFR</option>
                  {CEFR_ORDER.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Nível {lvl}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  aria-label="Filtrar perfis por cidade"
                  value={userCityFilter}
                  onChange={(e) => setUserCityFilter(e.target.value)}
                  placeholder="Filtrar por cidade..."
                  className="min-h-[40px] px-3 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-semibold"
                />

                <div className="flex gap-1.5">
                  <select
                    aria-label="Filtrar por status de atividade"
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="flex-1 min-h-[40px] px-2 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-bold"
                  >
                    <option value="all">Status: Todos</option>
                    <option value="active_7d">Ativos 7d</option>
                    <option value="inactive">Inativos (+7d)</option>
                    <option value="never_studied">Sem lição</option>
                    <option value="pwa">App Instalado</option>
                  </select>
                  <select
                    aria-label="Ordenar perfis"
                    value={userSort}
                    onChange={(e) => setUserSort(e.target.value)}
                    className="flex-1 min-h-[40px] px-2 bg-[#FFFBF5] border border-[#E5D8C8] text-xs font-bold"
                  >
                    <option value="created">Recentes</option>
                    <option value="active">Últ. acesso</option>
                    <option value="time">Mais tempo</option>
                    <option value="lessons">Mais lições</option>
                    <option value="xp">Mais XP</option>
                  </select>
                </div>
              </section>

              {/* Users Directory Table */}
              <section className="bg-white border-2 border-[#E5D8C8] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E5D8C8] bg-[#FAF4EC] flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#1E1A1D]">
                    {usersData.total} perfil(is) encontrado(s) — clique em qualquer aluno para abrir o
                    dossiê completo
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#E5D8C8] text-[10px] uppercase tracking-wider text-[var(--na-muted)] bg-white">
                        <th className="py-3 px-4">Aluno / Contato</th>
                        <th className="py-3 px-3">Cidade / Local</th>
                        <th className="py-3 px-3">Idiomas &amp; Nível CEFR</th>
                        <th className="py-3 px-3">Tempo de Uso</th>
                        <th className="py-3 px-3">Estudo &amp; IA</th>
                        <th className="py-3 px-3">Último Acesso</th>
                        <th className="py-3 px-4 text-right">Dossiê</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE5D8]">
                      {usersData.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[var(--na-muted)]">
                            Nenhum perfil encontrado para os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        usersData.items.map((u) => {
                          const badge = CEFR_BADGE_STYLES[u.activeCefr] ?? CEFR_BADGE_STYLES.A1!;
                          return (
                            <tr
                              key={u.id}
                              tabIndex={0}
                              onClick={() => setSelectedUserId(u.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedUserId(u.id);
                                }
                              }}
                              className="hover:bg-[#FFF8EE] cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="font-extrabold text-sm text-[#1E1A1D]">
                                  {u.displayName}
                                </div>
                                <div className="font-mono-code text-[11px] text-[var(--na-muted)]">
                                  {u.email}
                                </div>
                                <div className="text-[10px] text-[var(--na-muted)] mt-0.5">
                                  {u.whatsapp ? `WhatsApp: ${u.whatsapp} · ` : ''}
                                  Cadastro: {formatDateTimeBr(u.createdAt)}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="font-bold text-[#1E1A1D] inline-flex items-center gap-1">
                                  <MapPin size={13} weight="fill" className="text-[#1496B0]" />
                                  {u.locationLabel}
                                </div>
                                <div className="text-[10px] text-[var(--na-muted)]">
                                  {(u.lastPlatform ?? 'web').toUpperCase()}
                                  {u.lastDeviceType ? ` · ${u.lastDeviceType}` : ''}
                                  {u.pwaInstalled ? ' · PWA ✓' : ''}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-extrabold text-[#1E1A1D]">
                                    {u.activeLanguageNamePt}
                                  </span>
                                  <span
                                    className="font-mono-code text-[10px] font-extrabold px-1.5 py-0.5 border"
                                    style={{
                                      backgroundColor: badge.bg,
                                      color: badge.text,
                                      borderColor: badge.border,
                                    }}
                                  >
                                    {u.activeCefr} · {u.activeLevelProgressPct}%
                                  </span>
                                </div>
                                {u.languagesStudied.length > 1 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {u.languagesStudied.slice(1, 4).map((extra) => (
                                      <span
                                        key={extra.language}
                                        className="font-mono-code text-[10px] px-1.5 py-0.5 bg-[#FAF4EC] border border-[#E5D8C8] text-[#554E54]"
                                      >
                                        +{extra.language.toUpperCase()} {extra.currentCefr}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3 font-mono-code">
                                <div className="font-extrabold text-[#9A1B45] inline-flex items-center gap-1">
                                  <Clock size={13} weight="bold" />
                                  {formatDuration(u.totalTimeSeconds)}
                                </div>
                                <div className="text-[10px] text-[var(--na-muted)]">
                                  {u.sessionsCount} sess. (méd. {formatDuration(u.avgSessionSeconds)})
                                </div>
                              </td>

                              <td className="py-3 px-3 font-mono-code">
                                <div className="font-bold text-[#1E1A1D]">
                                  {u.lessonsCompleted} lições ({u.averageAccuracy}%)
                                </div>
                                <div className="text-[10px] text-[var(--na-muted)]">
                                  {u.aiTurnsTotal} IA · {u.fsrsReviewsCount} FSRS · {u.streakDays}d foco
                                </div>
                              </td>

                              <td className="py-3 px-3 font-mono-code text-[11px]">
                                <div className="font-bold text-[#1E1A1D]">
                                  {formatRelativeBr(u.lastActiveAt)}
                                </div>
                                <div className="text-[10px] text-[var(--na-muted)]">
                                  {u.lastActiveAt ? formatDateTimeBr(u.lastActiveAt) : '—'}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUserId(u.id);
                                  }}
                                  className="px-2.5 py-1.5 bg-[#FFFBF5] border border-[#E5D8C8] hover:border-[#9A1B45] text-[11px] font-extrabold text-[#9A1B45]"
                                >
                                  Abrir
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: ACESSOS, VISITANTES & CIDADES                              */}
          {/* ================================================================= */}
          {tab === 'traffic' && summary && (
            <div className="space-y-6">
              {/* Top Cities & Countries + Peak Hours */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1496B0]">
                    Geolocalização (Cloudflare + IP + Declarada)
                  </div>
                  <h2 className="font-display text-lg text-[#1E1A1D]">
                    Ranking de Cidades &amp; Estados
                  </h2>
                  <HorizontalRankBars
                    color="#1496B0"
                    items={summary.topCities.slice(0, 12).map((c) => ({
                      label: c.label,
                      value: c.sessions || c.registeredUsers,
                      badge: `${c.sessions} acessos`,
                      sublabel: `${c.registeredUsers} alunos · ${c.totalMinutes}m`,
                    }))}
                  />
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9A1B45]">
                      Quando os Alunos Estudam
                    </div>
                    <h2 className="font-display text-lg text-[#1E1A1D]">
                      Horários de Pico (00h–23h)
                    </h2>
                    <HourlyBarChart data={summary.hourlyActivity} />
                    <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-[#EFE5D8]">
                      {summary.weekdayActivity.map((wd) => (
                        <div key={wd.dayIndex} className="p-2 bg-[#FFFBF5] border border-[#E5D8C8] text-center">
                          <div className="text-[10px] font-extrabold text-[var(--na-muted)]">
                            {wd.label}
                          </div>
                          <div className="font-mono-code text-sm font-extrabold text-[#1E1A1D]">
                            {wd.sessions}
                          </div>
                          <div className="font-mono-code text-[10px] text-[#1496B0]">
                            {wd.minutes}m
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-[#E5D8C8] p-4 space-y-2.5">
                      <h3 className="font-display text-sm text-[#1E1A1D]">
                        Páginas de Entrada &amp; Origens
                      </h3>
                      <HorizontalRankBars
                        color="#9A1B45"
                        items={summary.acquisition.entryPages.slice(0, 6).map((p) => ({
                          label: p.name,
                          value: p.count,
                        }))}
                      />
                    </div>
                    <div className="bg-white border-2 border-[#E5D8C8] p-4 space-y-2.5">
                      <h3 className="font-display text-sm text-[#1E1A1D]">
                        Dispositivos &amp; Plataformas
                      </h3>
                      <HorizontalRankBars
                        color="#2CB65E"
                        items={[
                          ...summary.devices.platforms.map((p) => ({
                            label: `Plataforma: ${p.name.toUpperCase()}`,
                            value: p.count,
                          })),
                          ...summary.devices.os.slice(0, 4).map((o) => ({
                            label: `OS: ${o.name}`,
                            value: o.count,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Recent Accesses Log (Anonymous + Identified) */}
              <section className="bg-white border-2 border-[#E5D8C8] overflow-hidden">
                <div className="p-4 border-b border-[#E5D8C8] bg-[#FAF4EC] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-[#1E1A1D]">
                      Registro Recente de Quem Acessou ({visitors.length})
                    </h2>
                    <div className="text-xs text-[var(--na-muted)]">
                      Mostra tanto visitantes anônimos quanto usuários cadastrados, cidade, tempo
                      ativo e se converteu em cadastro.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={visitorCityFilter}
                      onChange={(e) => setVisitorCityFilter(e.target.value)}
                      placeholder="Filtrar cidade..."
                      className="h-9 px-3 bg-white border border-[#E5D8C8] text-xs font-semibold"
                    />
                    <label className="inline-flex items-center gap-2 px-3 h-9 bg-white border border-[#E5D8C8] text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyAnonymous}
                        onChange={(e) => setOnlyAnonymous(e.target.checked)}
                        className="accent-[#9A1B45]"
                      />
                      Só anônimos
                    </label>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5D8C8] text-[10px] uppercase text-[var(--na-muted)]">
                        <th className="py-2.5 px-4">Quando</th>
                        <th className="py-2.5 px-3">Visitante / Perfil</th>
                        <th className="py-2.5 px-3">Cidade / País</th>
                        <th className="py-2.5 px-3">Entrada &amp; Origem</th>
                        <th className="py-2.5 px-3">Dispositivo</th>
                        <th className="py-2.5 px-4 text-right">Tempo Ativo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE5D8]">
                      {visitors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-[var(--na-muted)]">
                            Nenhuma sessão registrada para este filtro ainda.
                          </td>
                        </tr>
                      ) : (
                        visitors.map((s) => (
                          <tr key={s.id} className="hover:bg-[#FFFBF5]">
                            <td className="py-2.5 px-4 font-mono-code text-[11px] whitespace-nowrap">
                              <div className="font-bold text-[#1E1A1D]">
                                {formatRelativeBr(s.lastSeenAt)}
                              </div>
                              <div className="text-[10px] text-[var(--na-muted)]">
                                {formatDateTimeBr(s.startedAt)}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {s.user ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserId(s.user!.id)}
                                  className="text-left hover:underline"
                                >
                                  <div className="font-extrabold text-[#9A1B45]">
                                    {s.user.displayName}
                                  </div>
                                  <div className="font-mono-code text-[10px] text-[var(--na-muted)]">
                                    {s.user.email}
                                  </div>
                                </button>
                              ) : (
                                <div>
                                  <span className="px-2 py-0.5 bg-[#F4EADC] text-[#6C6670] text-[10px] font-extrabold uppercase">
                                    Visitante Anônimo
                                  </span>
                                  <div className="font-mono-code text-[10px] text-[var(--na-muted)] mt-0.5">
                                    {s.visitorId.slice(0, 14)}
                                  </div>
                                </div>
                              )}
                              {s.convertedToSignup && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#E2F9EB] text-[#1D8A45] text-[10px] font-extrabold">
                                  Converteu em Cadastro ✓
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#1E1A1D]">
                              {s.city
                                ? `${s.city}${s.region ? ` · ${s.region}` : ''}${s.country && s.country !== 'BR' ? ` (${s.country})` : ''}`
                                : s.country ?? 'Não identificada'}
                            </td>
                            <td className="py-2.5 px-3">
                              <code className="font-mono-code text-[11px] font-bold text-[#1496B0]">
                                {s.entryPath}
                              </code>
                              {(s.utmSource || s.referrer) && (
                                <div className="text-[10px] text-[var(--na-muted)] truncate max-w-[200px]">
                                  {s.utmSource ?? s.referrer}
                                  {s.utmCampaign ? ` · ${s.utmCampaign}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <span className="font-bold uppercase">{s.platform}</span> ·{' '}
                              {s.deviceType}
                              <div className="text-[10px] text-[var(--na-muted)]">
                                {s.os ?? '—'} · {s.browser ?? '—'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-code font-extrabold text-[#9A1B45]">
                              {formatDuration(s.durationSeconds)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: PEDAGÓGICO & MELHORIAS                                     */}
          {/* ================================================================= */}
          {tab === 'pedagogy' && summary && (
            <div className="space-y-6">
              {/* All 8 Languages Matrix */}
              <section className="bg-white border-2 border-[#E5D8C8] overflow-hidden">
                <div className="p-4 border-b border-[#E5D8C8] bg-[#FAF4EC] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9A1B45] flex items-center gap-1">
                      <GlobeHemisphereWest size={13} weight="bold" /> Mapa Completo dos 8 Idiomas
                    </div>
                    <h2 className="font-display text-lg text-[#1E1A1D]">
                      Alunos por Idioma e Distribuição Exata de Nível CEFR (A1 → C2)
                    </h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5D8C8] text-[10px] uppercase text-[var(--na-muted)]">
                        <th className="py-2.5 px-4">Idioma</th>
                        <th className="py-2.5 px-2 text-right">Ativos</th>
                        <th className="py-2.5 px-2 text-right">Total Estudando</th>
                        <th className="py-2.5 px-2 text-right">Lições</th>
                        <th className="py-2.5 px-2 text-right">Precisão</th>
                        <th className="py-2.5 px-2 text-right">Tempo</th>
                        {CEFR_ORDER.map((lvl) => (
                          <th key={lvl} className="py-2.5 px-2 text-center font-mono-code">
                            {lvl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE5D8]">
                      {summary.languageBreakdown.map((l) => (
                        <tr key={l.code} className="hover:bg-[#FFFBF5]">
                          <td className="py-2.5 px-4 font-extrabold text-[#1E1A1D]">
                            {l.namePt}{' '}
                            <span className="text-[10px] font-normal text-[var(--na-muted)]">
                              ({l.nativeName})
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-code font-extrabold text-[#9A1B45]">
                            {l.activeUsers}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-code">{l.totalLearners}</td>
                          <td className="py-2.5 px-2 text-right font-mono-code font-bold text-[#1496B0]">
                            {l.lessonsCompleted}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-code">{l.avgAccuracy}%</td>
                          <td className="py-2.5 px-2 text-right font-mono-code">
                            {l.studyMinutes} min
                          </td>
                          {CEFR_ORDER.map((lvl) => (
                            <td key={lvl} className="py-2.5 px-2 text-center font-mono-code">
                              {l.cefrCounts[lvl] > 0 ? (
                                <span className="inline-block min-w-[24px] px-1 py-0.5 bg-[#FFF5E8] border border-[#E5D8C8] font-bold">
                                  {l.cefrCounts[lvl]}
                                </span>
                              ) : (
                                <span className="text-[#D2C7B9]">0</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* CEFR overall + Screen Time usage */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <h2 className="font-display text-lg text-[#1E1A1D]">
                    Distribuição Geral por Nível CEFR
                  </h2>
                  <HorizontalRankBars
                    color="#C98A00"
                    items={summary.cefrDistribution.map((c) => ({
                      label: `Nível ${c.cefr}`,
                      value: c.count,
                      badge: `${c.count} alunos`,
                      sublabel: `(${c.pct}%)`,
                    }))}
                  />
                  <div className="pt-3 border-t border-[#EFE5D8] flex flex-wrap gap-4 font-mono-code text-xs">
                    <span>
                      Exames aprovados: <strong className="text-[#1D8A45]">{summary.kpis.examPassedEvents}</strong>
                    </span>
                    <span>
                      Exames reprovados: <strong className="text-[#B02B22]">{summary.kpis.examFailedEvents}</strong>
                    </span>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <h2 className="font-display text-lg text-[#1E1A1D]">
                    Tempo Gasto por Área do Aplicativo
                  </h2>
                  <HorizontalRankBars
                    color="#1496B0"
                    emptyText="O detalhamento por aba/tela começa a aparecer assim que houver sessões ativas."
                    items={summary.screenUsage.map((s) => ({
                      label: s.label,
                      value: s.seconds,
                      badge: formatDuration(s.seconds),
                      sublabel: `${s.pct}%`,
                    }))}
                  />
                </div>
              </section>

              {/* Hardest Lessons (Actionable for App Improvements!) */}
              <section className="bg-white border-2 border-[#E5D8C8] overflow-hidden">
                <div className="p-4 border-b border-[#E5D8C8] bg-[#FAF4EC]">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#E04338] flex items-center gap-1">
                    <WarningCircle size={13} weight="fill" /> Prioridade de Melhoria Pedagógica
                  </div>
                  <h2 className="font-display text-lg text-[#1E1A1D]">
                    Lições com Maior Dificuldade / Menor Precisão / Abandono
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5D8C8] text-[10px] uppercase text-[var(--na-muted)]">
                        <th className="py-2.5 px-4">Lição</th>
                        <th className="py-2.5 px-3">Idioma / Nível</th>
                        <th className="py-2.5 px-3 text-right">Precisão Média</th>
                        <th className="py-2.5 px-3 text-right">Conclusões</th>
                        <th className="py-2.5 px-3 text-right">Retentativas</th>
                        <th className="py-2.5 px-3 text-right">Abandonos</th>
                        <th className="py-2.5 px-4 text-right">Tempo Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE5D8]">
                      {summary.hardestLessons.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[var(--na-muted)]">
                            Ainda não há lições concluídas suficientes para ranking de dificuldade.
                          </td>
                        </tr>
                      ) : (
                        summary.hardestLessons.map((l) => (
                          <tr key={l.lessonId}>
                            <td className="py-2.5 px-4 font-bold text-[#1E1A1D]">
                              {l.titlePt}
                              {l.isLevelExam && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-[#FFE8F0] text-[#9A1B45] font-extrabold">
                                  EXAME
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono-code uppercase">
                              {l.language} · {l.cefr}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code font-extrabold">
                              <span
                                className={
                                  l.avgAccuracy < 75
                                    ? 'text-[#B02B22]'
                                    : l.avgAccuracy < 85
                                      ? 'text-[#C98A00]'
                                      : 'text-[#1D8A45]'
                                }
                              >
                                {l.avgAccuracy}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code">{l.completions}</td>
                            <td className="py-2.5 px-3 text-right font-mono-code">{l.retryRatio}x</td>
                            <td className="py-2.5 px-3 text-right font-mono-code font-bold text-[#B02B22]">
                              {l.abandons}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-code">
                              {formatDuration(l.avgDurationSeconds)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Churn Watch & Power Users */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <h3 className="font-display text-base text-[#B02B22]">
                    Alerta de Evasão (Inativos há 3–14 dias)
                  </h3>
                  {summary.churnRiskUsers.length === 0 ? (
                    <div className="text-xs text-[var(--na-muted)]">
                      Nenhum aluno em janela de risco de evasão no momento.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EFE5D8]">
                      {summary.churnRiskUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className="w-full py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#FFFBF5]"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#1E1A1D] truncate">
                              {u.displayName}{' '}
                              <span className="font-normal text-[var(--na-muted)]">
                                ({u.locationLabel})
                              </span>
                            </div>
                            <div className="font-mono-code text-[10px] text-[var(--na-muted)]">
                              {u.activeLanguage.toUpperCase()} {u.activeCefr} · {u.lessonsCompleted} lições
                            </div>
                          </div>
                          <span className="font-mono-code text-[11px] font-bold text-[#B02B22] shrink-0">
                            {formatRelativeBr(u.lastActiveAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border-2 border-[#E5D8C8] p-5 space-y-3">
                  <h3 className="font-display text-base text-[#1D8A45]">
                    Top Alunos Mais Engajados (Tempo &amp; XP)
                  </h3>
                  {summary.powerUsers.length === 0 ? (
                    <div className="text-xs text-[var(--na-muted)]">Sem alunos cadastrados ainda.</div>
                  ) : (
                    <div className="divide-y divide-[#EFE5D8]">
                      {summary.powerUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className="w-full py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#FFFBF5]"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#1E1A1D] truncate">
                              {u.displayName}{' '}
                              <span className="font-normal text-[var(--na-muted)]">
                                ({u.locationLabel})
                              </span>
                            </div>
                            <div className="font-mono-code text-[10px] text-[var(--na-muted)]">
                              {u.activeLanguage.toUpperCase()} {u.activeCefr} · {u.lessonsCompleted}{' '}
                              lições · {u.streakDays}d foco
                            </div>
                          </div>
                          <span className="font-mono-code text-[11px] font-extrabold text-[#1D8A45] shrink-0">
                            {formatDuration(u.totalTimeSeconds)} · {u.xpTotal} XP
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: RELATÓRIOS & EXPORTAÇÃO                                    */}
          {/* ================================================================= */}
          {tab === 'reports' && (
            <ReportsSection
              adminToken={adminToken}
              currentRange={range}
              customFrom={customFrom}
              customTo={customTo}
              reports={reports}
              onReportsChanged={() => loadAllDashboardData(adminToken)}
            />
          )}

          {/* ================================================================= */}
          {/* TAB 6 & 7: MAILING/FEEDBACKS & SISTEMA/SEGURANÇA                  */}
          {/* ================================================================= */}
          {(tab === 'mailing' || tab === 'system') && (
            <OperationsSection
              mode={tab}
              adminToken={adminToken}
              overview={overview}
              mailing={mailing}
              authMeta={authMeta}
              recentAudits={recentAudits}
              onRefreshOperations={() => loadAllDashboardData(adminToken)}
              onTokenRotated={saveToken}
            />
          )}
        </main>
      </div>

      {/* Individual User Dossier Drawer */}
      {selectedUserId && (
        <UserDossierDrawer
          adminToken={adminToken}
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
