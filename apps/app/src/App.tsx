import { useCallback, useEffect, useState } from 'react';
import {
  ArrowsClockwise,
  BookOpenText,
  Brain,
  ChatCircleDots,
  ChatTeardropText,
  Fire,
  Star,
  UserCircle,
  WifiSlash,
} from '@phosphor-icons/react';
import type { LanguageCode, Lesson } from '@naidioma/shared';
import { AdminConsole } from './components/AdminConsole';
import { AuthScreen } from './components/AuthScreen';
import { BillingModal } from './components/BillingModal';
import { ConversationView } from './components/ConversationView';
import { FeedbackDrawer } from './components/FeedbackDrawer';
import { InstallAppBanner } from './components/InstallAppBanner';
import { LearnView } from './components/LearnView';
import { LessonPlayer } from './components/LessonPlayer';
import { ProfileView } from './components/ProfileView';
import { ReviewView } from './components/ReviewView';
import {
  api,
  clearAuthToken,
  getAuthToken,
  syncOfflineQueueNow,
  type AppVersionResponse,
  type BillingStatusResponse,
  type CourseDetailResponse,
  type UserProfile,
} from './lib/api';
import { APP_CLIENT_VERSION, getPlatform, hapticTap, initNativeChrome } from './lib/native';

type MainTab = 'learn' | 'conversation' | 'review' | 'profile';

export function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<MainTab>('learn');
  const [courseDetail, setCourseDetail] = useState<CourseDetailResponse | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState<AppVersionResponse | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const loadCourseAndMeta = useCallback(async (lang: LanguageCode) => {
    setLoadingCourse(true);
    try {
      const [detail, bill, ver] = await Promise.all([
        api.getCourseDetail(lang),
        api.getBillingStatus().catch(() => null),
        api.getVersion().catch(() => null),
      ]);
      setCourseDetail(detail);
      if (bill) setBilling(bill);
      if (ver) setVersionInfo(ver);
    } finally {
      setLoadingCourse(false);
    }
  }, []);

  // Listen to online/offline transitions & auto-sync queued offline progress
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void syncOfflineQueueNow().then((synced) => {
        if (synced > 0) {
          setSyncNotice(`${synced} atividade(s) offline sincronizada(s) com a nuvem!`);
          setTimeout(() => setSyncNotice(null), 4000);
          if (user) void loadCourseAndMeta(user.activeLanguage);
        }
      });
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCourseAndMeta, user]);

  useEffect(() => {
    void initNativeChrome();
    async function bootstrap() {
      try {
        const token = await getAuthToken();
        if (token) {
          const res = await api.getMe();
          setUser(res.user);
          await loadCourseAndMeta(res.user.activeLanguage);
          if (navigator.onLine) {
            void syncOfflineQueueNow();
          }
        }
      } catch {
        if (navigator.onLine) {
          await clearAuthToken();
        }
      } finally {
        setBooting(false);
      }
    }
    void bootstrap();
  }, [loadCourseAndMeta]);

  async function handleAuthenticated(loggedUser: UserProfile) {
    setUser(loggedUser);
    await loadCourseAndMeta(loggedUser.activeLanguage);
  }

  async function handleSelectLanguage(lang: LanguageCode) {
    if (!user || user.activeLanguage === lang) return;
    setUser({ ...user, activeLanguage: lang });
    await api.updatePreferences({ activeLanguage: lang }).catch(() => {});
    await loadCourseAndMeta(lang);
  }

  async function handleLogout() {
    await clearAuthToken();
    setUser(null);
    setCourseDetail(null);
    setActiveLesson(null);
    setAdminOpen(false);
  }

  if (booting) {
    return (
      <div className="min-h-[100dvh] bg-[var(--na-cream)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--na-wine)] text-[var(--na-cream)] flex items-center justify-center font-display text-2xl">
            NA
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--na-burgundy)]">
            Carregando NAidioma...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <InstallAppBanner />
        <AuthScreen onAuthenticated={(u) => void handleAuthenticated(u)} />
      </div>
    );
  }

  const updateAvailable =
    Boolean(versionInfo?.latestVersion) && versionInfo?.latestVersion !== APP_CLIENT_VERSION;

  const navItems: Array<{ id: MainTab; label: string; icon: typeof BookOpenText }> = [
    { id: 'learn', label: 'Aprender', icon: BookOpenText },
    { id: 'conversation', label: 'Voz IA', icon: ChatCircleDots },
    { id: 'review', label: 'Revisar', icon: Brain },
    { id: 'profile', label: 'Perfil', icon: UserCircle },
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--na-cream)] text-[var(--na-ink)] flex flex-col md:flex-row">
      {/* Desktop Editorial Sidebar Rail */}
      <aside className="hidden md:flex md:flex-col md:w-64 shrink-0 border-r border-[var(--na-border)] bg-[var(--na-ivory)] p-5 justify-between sticky top-0 h-[100dvh]">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[11px] bg-[var(--na-wine)] text-[var(--na-cream)] flex items-center justify-center font-display text-xl border border-[var(--na-gold)]/50">
              NA
            </div>
            <div className="leading-tight">
              <div className="font-display text-2xl font-semibold text-[var(--na-wine)]">
                NAidioma
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--na-teal)]">
                Núcleo Afetar
              </div>
            </div>
          </div>

          <nav className="space-y-1.5" aria-label="Navegação principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !adminOpen && !activeLesson && tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setAdminOpen(false);
                    setActiveLesson(null);
                    setTab(item.id);
                  }}
                  className={`w-full min-h-[48px] px-4 rounded-[12px] flex items-center gap-3 text-sm font-bold transition-colors ${
                    active
                      ? 'bg-[var(--na-wine)] text-[var(--na-ivory)]'
                      : 'text-[var(--na-ink)] hover:bg-[var(--na-sand)]'
                  }`}
                >
                  <Icon size={20} weight={active ? 'fill' : 'duotone'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 rounded-[14px] bg-[var(--na-cream)] border border-[var(--na-border)] flex items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-[var(--na-burgundy)]">
              <Fire size={16} weight="fill" /> {user.streakDays}d
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--na-teal)]">
              <Star size={16} weight="fill" /> {user.xpTotal} XP
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--na-border)] bg-[var(--na-cream)] hover:border-[var(--na-burgundy)] text-xs font-bold text-[var(--na-burgundy)] flex items-center justify-center gap-2"
          >
            <ChatTeardropText size={16} weight="duotone" />
            Enviar feedback
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 1-Click PWA Install Banner (Android/Desktop native prompt + iPhone 2-tap visual guide) */}
        <InstallAppBanner />

        {/* Offline / Sync Status Banner */}
        {!online && (
          <div className="bg-[var(--na-wine-deep)] text-[var(--na-cream)] px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2">
            <WifiSlash size={15} weight="bold" />
            <span>
              Modo Offline ativo · Continue estudando normalmente — seu progresso sincroniza ao
              reconectar.
            </span>
          </div>
        )}
        {syncNotice && (
          <div className="bg-[var(--na-success)] text-white px-4 py-2 text-xs font-bold text-center">
            {syncNotice}
          </div>
        )}

        {/* Mobile Top Bar */}
        <header className="md:hidden sticky top-0 z-30 bg-[var(--na-cream)]/95 backdrop-blur-xs border-b border-[var(--na-border)] px-4 h-15 flex items-center justify-between safe-top">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-[var(--na-wine)] text-[var(--na-cream)] flex items-center justify-center font-display text-base">
              NA
            </div>
            <span className="font-display text-xl font-semibold text-[var(--na-wine)]">
              NAidioma
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-extrabold text-[var(--na-burgundy)] inline-flex items-center gap-1">
              <Fire size={15} weight="fill" /> {user.streakDays}
            </span>
            <span className="text-xs font-extrabold text-[var(--na-teal)] inline-flex items-center gap-1">
              <Star size={15} weight="fill" /> {user.xpTotal}
            </span>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              aria-label="Enviar feedback"
              className="w-11 h-11 rounded-[10px] bg-[var(--na-ivory)] border border-[var(--na-border)] text-[var(--na-burgundy)] flex items-center justify-center"
            >
              <ChatTeardropText size={18} weight="duotone" />
            </button>
          </div>
        </header>

        {/* Automatic Update Banner (Web PWA / Android / Apple iOS) */}
        {updateAvailable && versionInfo && (
          <div className="bg-[var(--na-teal)] text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3">
            <span>
              Nova atualização v{versionInfo.latestVersion} disponível: {versionInfo.releaseNotesPt}
            </span>
            <button
              type="button"
              onClick={() => {
                const platform = getPlatform();
                if (platform === 'android' && versionInfo.androidStoreUrl) {
                  window.open(versionInfo.androidStoreUrl, '_blank');
                } else if (platform === 'ios' && versionInfo.iosStoreUrl) {
                  window.open(versionInfo.iosStoreUrl, '_blank');
                } else {
                  window.location.reload();
                }
              }}
              className="px-3 py-1 rounded-full bg-white text-[var(--na-teal)] font-bold inline-flex items-center gap-1 shrink-0"
            >
              <ArrowsClockwise size={13} weight="bold" /> Atualizar
            </button>
          </div>
        )}

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-8">
          {adminOpen ? (
            <AdminConsole
              onBack={() => setAdminOpen(false)}
              onConfigChanged={() => void loadCourseAndMeta(user.activeLanguage)}
            />
          ) : activeLesson ? (
            <LessonPlayer
              language={user.activeLanguage}
              lesson={activeLesson}
              onExit={() => setActiveLesson(null)}
              onCompleted={(summary) => {
                setUser((prev) =>
                  prev
                    ? { ...prev, xpTotal: summary.xpTotal, streakDays: summary.streakDays }
                    : prev,
                );
                void loadCourseAndMeta(user.activeLanguage);
              }}
            />
          ) : (
            <>
              {tab === 'learn' && (
                <LearnView
                  user={user}
                  courseDetail={courseDetail}
                  loading={loadingCourse}
                  onSelectLanguage={(lang) => void handleSelectLanguage(lang)}
                  onStartLesson={(lesson) => setActiveLesson(lesson)}
                  onGoToConversation={() => setTab('conversation')}
                  onGoToReview={() => setTab('review')}
                />
              )}
              {tab === 'conversation' && (
                <ConversationView
                  language={user.activeLanguage}
                  scenarios={courseDetail?.course.scenarios ?? []}
                />
              )}
              {tab === 'review' && (
                <ReviewView
                  language={user.activeLanguage}
                  onXpUpdated={() => {
                    void api.getMe().then((r) => setUser(r.user)).catch(() => {});
                  }}
                />
              )}
              {tab === 'profile' && (
                <ProfileView
                  user={user}
                  billing={billing}
                  onUserUpdated={setUser}
                  onOpenBilling={() => setBillingModalOpen(true)}
                  onOpenAdmin={() => setAdminOpen(true)}
                  onLogout={() => void handleLogout()}
                />
              )}
            </>
          )}
        </main>

        {/* Mobile Bottom Thumb-Zone Tab Bar (hidden inside active lesson) */}
        {!activeLesson && !adminOpen && (
          <nav
            aria-label="Menu inferior"
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--na-ivory)] border-t border-[var(--na-border)] grid grid-cols-4 px-2 pt-1.5 safe-bottom"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setTab(item.id);
                  }}
                  className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[10px] ${
                    active ? 'text-[var(--na-wine)] font-bold' : 'text-[var(--na-muted)]'
                  }`}
                >
                  <Icon size={22} weight={active ? 'fill' : 'regular'} />
                  <span className="text-[11px]">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Modals */}
      {feedbackOpen && (
        <FeedbackDrawer
          language={user.activeLanguage}
          route={activeLesson ? `/lesson/${activeLesson.id}` : `/${tab}`}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {billingModalOpen && billing?.billingVisible && (
        <BillingModal billing={billing} onClose={() => setBillingModalOpen(false)} />
      )}
    </div>
  );
}
