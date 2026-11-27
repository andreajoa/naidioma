import { useCallback, useEffect, useState } from 'react';
import {
  ArrowsClockwise,
  Brain,
  CaretDown,
  ChatCircleDots,
  ChatTeardropText,
  Compass,
  Fire,
  Heart,
  Leaf,
  PuzzlePiece,
  SpeakerHigh,
  SpeakerSlash,
  UserCircle,
  WifiSlash,
} from '@phosphor-icons/react';
import { LANGUAGES, type LanguageCode, type Lesson } from '@naidioma/shared';
import { AdminConsole } from './components/AdminConsole';
import { AlphabetView } from './components/AlphabetView';
import { AuthScreen } from './components/AuthScreen';
import { BillingModal } from './components/BillingModal';
import { ConversationView } from './components/ConversationView';
import { FeedbackDrawer } from './components/FeedbackDrawer';
import { InstallAppBanner } from './components/InstallAppBanner';
import { LearnView } from './components/LearnView';
import { LessonPlayer } from './components/LessonPlayer';
import { LANGUAGE_FLAGS, PuzzleMascot } from './components/Mascots';
import {
  PetPickerModal,
  PetSprite,
  loadPetProfile,
  savePetProfile,
  type PetProfile,
} from './components/PetBuddy';
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
import {
  applyCalmMode,
  isCalmModeEnabled,
  isSoundEnabled,
  playTapSound,
  setSoundEnabled,
} from './lib/sound';

type MainTab = 'learn' | 'alphabet' | 'conversation' | 'review' | 'profile';

const LANGUAGE_ORDER: LanguageCode[] = ['ko', 'en', 'ja', 'es', 'fr', 'de', 'it', 'zh'];

export function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<MainTab>('learn');
  const [courseDetail, setCourseDetail] = useState<CourseDetailResponse | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [pet, setPet] = useState<PetProfile>(() => loadPetProfile());
  const [petPickerOpen, setPetPickerOpen] = useState(false);
  const [justCompletedLessonId, setJustCompletedLessonId] = useState<string | null>(null);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState<AppVersionResponse | null>(null);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [calmMode, setCalmMode] = useState(() => isCalmModeEnabled());
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    applyCalmMode(calmMode);
  }, [calmMode]);

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
    setLangPickerOpen(false);
    if (!user || user.activeLanguage === lang) return;
    playTapSound();
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

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playTapSound();
  }

  function toggleCalm() {
    const next = !calmMode;
    setCalmMode(next);
    applyCalmMode(next);
    playTapSound();
  }

  function handleSavePet(next: PetProfile) {
    setPet(savePetProfile(next));
  }

  const handlePetHappinessChange = useCallback((delta: number) => {
    setPet((prev) => savePetProfile({ ...prev, happiness: prev.happiness + delta }));
  }, []);

  const handleClearJustCompleted = useCallback(() => {
    setJustCompletedLessonId(null);
  }, []);

  // SPLASH DE ABERTURA COM O MASCOTE QUEBRA-CABEÇA PUZ (No lugar da coruja!)
  if (booting) {
    return (
      <div className="min-h-[100dvh] bg-[var(--na-burgundy)] text-white flex flex-col items-center justify-center p-6">
        <PuzzleMascot mood="wave" size={160} />
        <div className="font-display text-4xl tracking-tight mt-3">NAidioma</div>
        <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#ffd7e5] mt-1.5">
          Núcleo Afetar · Carregando...
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

  const activeFlag = LANGUAGE_FLAGS[user.activeLanguage];
  const updateAvailable =
    Boolean(versionInfo?.latestVersion) && versionInfo?.latestVersion !== APP_CLIENT_VERSION;

  const navItems: Array<{
    id: MainTab;
    label: string;
    badge?: string;
    icon: typeof Compass;
    activeColor: string;
  }> = [
    { id: 'learn', label: 'Trilha', icon: Compass, activeColor: '#1496B0' },
    {
      id: 'alphabet',
      label: user.activeLanguage === 'ko' ? 'Hangul' : 'Letras',
      badge: activeFlag.letterBadge,
      icon: PuzzlePiece,
      activeColor: '#E5A300',
    },
    { id: 'conversation', label: 'Falar', icon: ChatCircleDots, activeColor: '#C12B5B' },
    { id: 'review', label: 'Revisar', icon: Brain, activeColor: '#2CB65E' },
    { id: 'profile', label: 'Perfil', icon: UserCircle, activeColor: '#C12B5B' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--na-cream)] text-[var(--na-ink)] flex flex-col md:flex-row">
      {/* SIDEBAR ESQUERDA ESTILO DUOLINGO (DESKTOP) */}
      <aside className="hidden md:flex md:flex-col md:w-64 shrink-0 border-r-2 border-[var(--na-border)] bg-white p-4 justify-between sticky top-0 h-[100dvh]">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2 pt-1">
            <PuzzleMascot mood="idle" size={46} />
            <div>
              <div className="font-display text-2xl text-[var(--na-burgundy)] leading-none">
                NAidioma
              </div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--na-teal)] mt-0.5">
                Núcleo Afetar
              </div>
            </div>
          </div>

          <nav className="space-y-2" aria-label="Navegação principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !adminOpen && !activeLesson && tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    playTapSound();
                    setAdminOpen(false);
                    setActiveLesson(null);
                    setTab(item.id);
                  }}
                  className={`w-full min-h-[52px] px-4 rounded-2xl border-2 flex items-center gap-3 text-sm font-extrabold uppercase tracking-wide transition-all ${
                    active
                      ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)] border-b-4'
                      : 'bg-transparent border-transparent text-[var(--na-muted)] hover:bg-[var(--na-cream)]'
                  }`}
                >
                  {item.badge ? (
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold text-white shrink-0"
                      style={{ backgroundColor: item.activeColor }}
                    >
                      {item.badge}
                    </span>
                  ) : (
                    <Icon
                      size={24}
                      weight={active ? 'fill' : 'duotone'}
                      style={{ color: active ? item.activeColor : undefined }}
                    />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2.5">
          {/* Controles sensoriais rápidos (Autismo & TDAH) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className="min-h-[42px] px-2.5 rounded-xl border-2 border-[var(--na-border)] bg-[var(--na-cream)] text-xs font-extrabold flex items-center justify-center gap-1.5 text-[var(--na-ink)]"
            >
              {soundOn ? <SpeakerHigh size={16} weight="fill" className="text-[var(--na-teal)]" /> : <SpeakerSlash size={16} />}
              {soundOn ? 'Som ON' : 'Mudo'}
            </button>
            <button
              type="button"
              onClick={toggleCalm}
              className={`min-h-[42px] px-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                calmMode
                  ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                  : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-ink)]'
              }`}
              title="Reduz animações contínuas para conforto visual"
            >
              <Leaf size={15} weight="fill" />
              Calmo
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="w-full min-h-[44px] px-3 rounded-2xl border-2 border-[var(--na-border)] bg-white hover:border-[var(--na-burgundy)] text-xs font-extrabold text-[var(--na-burgundy)] flex items-center justify-center gap-2"
          >
            <ChatTeardropText size={16} weight="fill" />
            Enviar ideia / feedback
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        <InstallAppBanner />

        {!online && (
          <div className="bg-[var(--na-wine-deep)] text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2">
            <WifiSlash size={15} weight="bold" />
            <span>Modo Offline ativo · Pode continuar brincando e estudando normalmente!</span>
          </div>
        )}
        {syncNotice && (
          <div className="bg-[var(--na-success)] text-white px-4 py-2 text-xs font-extrabold text-center">
            {syncNotice}
          </div>
        )}

        {/* BARRA SUPERIOR HUD ESTILO DUOLINGO (Bandeira + Ofensiva + Peças XP + Energia ∞) */}
        {!activeLesson && !adminOpen && (
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b-2 border-[var(--na-border)] px-3 sm:px-5 h-16 flex items-center justify-between gap-2 safe-top">
            {/* Botão seletor de bandeira / idioma */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  playTapSound();
                  setLangPickerOpen((v) => !v);
                }}
                className="min-h-[44px] px-3 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] border-b-4 flex items-center gap-2 font-extrabold text-sm text-[var(--na-ink)] active:translate-y-[1px]"
                aria-label="Trocar idioma"
              >
                <span className="text-xl leading-none">{activeFlag.emoji}</span>
                <span className="hidden xs:inline sm:inline">{activeFlag.shortName}</span>
                <CaretDown size={14} weight="bold" className="text-[var(--na-muted)]" />
              </button>

              {langPickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLangPickerOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 sm:w-80 duo-card p-3 shadow-xl z-50 grid grid-cols-2 gap-2">
                    {LANGUAGE_ORDER.map((code) => {
                      const f = LANGUAGE_FLAGS[code];
                      const active = user.activeLanguage === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => void handleSelectLanguage(code)}
                          className={`p-2.5 rounded-2xl border-2 text-left flex items-center gap-2 transition-all ${
                            active
                              ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                              : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-ink)] hover:border-[var(--na-gold)]'
                          }`}
                        >
                          <span className="text-2xl leading-none">{f.emoji}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold truncate">{f.shortName}</div>
                            <div className="text-[10px] font-bold opacity-75 truncate">
                              {LANGUAGES[code].nativeName}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Métricas HUD NAidioma (Ritmo de Foco ⚡ · Peças 🧩 · Meu Bichinho · Infinito ∞) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--na-flame-soft)] text-[var(--na-flame)] font-extrabold text-sm"
                title="Ritmo de Foco — dias seguidos praticando"
              >
                <Fire size={19} weight="fill" />
                <span>{user.streakDays}</span>
              </div>

              <div
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--na-gold-soft)] text-[#996600] font-extrabold text-sm"
                title="Suas Peças do Quebra-Cabeça"
              >
                <PuzzlePiece size={19} weight="fill" className="text-[var(--na-gold-dark)]" />
                <span>{user.xpTotal}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  playTapSound();
                  setPetPickerOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[var(--na-rose-soft)] border-2 border-[var(--na-burgundy)]/30 text-[var(--na-burgundy)] font-extrabold text-xs"
                title={`Seu bichinho: ${pet.name} (${pet.happiness}% feliz)`}
              >
                <PetSprite
                  species={pet.species}
                  mood={pet.happiness < 45 ? 'sad' : 'happy'}
                  size={26}
                />
                <span className="hidden sm:inline">{pet.name}</span>
              </button>

              <div
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--na-teal-soft)] text-[var(--na-teal-dark)] font-extrabold text-sm"
                title="Infinito Neurodiverso — tente no seu ritmo, sem perder nada!"
              >
                <Heart size={18} weight="fill" className="text-[var(--na-burgundy)]" />
                <span>∞</span>
              </div>

              {/* Botões rápidos de Som e Modo Calmo no celular */}
              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundOn ? 'Desligar sons' : 'Ligar sons'}
                className="md:hidden w-10 h-10 rounded-xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] flex items-center justify-center text-[var(--na-teal)]"
              >
                {soundOn ? <SpeakerHigh size={18} weight="fill" /> : <SpeakerSlash size={18} />}
              </button>
            </div>
          </header>
        )}

        {/* Banner de atualização automática */}
        {updateAvailable && versionInfo && (
          <div className="bg-[var(--na-teal)] text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3">
            <span>
              Novidade v{versionInfo.latestVersion}: {versionInfo.releaseNotesPt}
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
              className="px-3 py-1 rounded-full bg-white text-[var(--na-teal-dark)] font-extrabold inline-flex items-center gap-1 shrink-0"
            >
              <ArrowsClockwise size={13} weight="bold" /> Atualizar
            </button>
          </div>
        )}

        <main className="flex-1 w-full mx-auto px-4 sm:px-6 pt-5 pb-28 md:pb-10">
          {adminOpen ? (
            <AdminConsole
              onBack={() => setAdminOpen(false)}
              onConfigChanged={() => void loadCourseAndMeta(user.activeLanguage)}
            />
          ) : activeLesson ? (
            <LessonPlayer
              language={user.activeLanguage}
              lesson={activeLesson}
              unit={courseDetail?.course.units.find((u) => u.id === activeLesson.unitId)}
              pet={pet}
              onPetHappinessChange={handlePetHappinessChange}
              onExit={() => setActiveLesson(null)}
              onCompleted={(summary) => {
                setJustCompletedLessonId(summary.lessonId);
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
                  pet={pet}
                  justCompletedLessonId={justCompletedLessonId}
                  onClearJustCompleted={handleClearJustCompleted}
                  onOpenPetPicker={() => setPetPickerOpen(true)}
                  courseDetail={courseDetail}
                  loading={loadingCourse}
                  onSelectLanguage={(lang) => void handleSelectLanguage(lang)}
                  onStartLesson={(lesson) => setActiveLesson(lesson)}
                  onGoToAlphabet={() => setTab('alphabet')}
                  onGoToConversation={() => setTab('conversation')}
                  onGoToReview={() => setTab('review')}
                />
              )}
              {tab === 'alphabet' && <AlphabetView language={user.activeLanguage} />}
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
                  petName={pet.name}
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

        {/* BARRA INFERIOR MOBILE ESTILO DUOLINGO (5 abas com ícones grandes coloridos) */}
        {!activeLesson && !adminOpen && (
          <nav
            aria-label="Menu inferior"
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-[var(--na-border)] grid grid-cols-5 px-1.5 pt-1.5 safe-bottom"
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
                    playTapSound();
                    setTab(item.id);
                  }}
                  className={`min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-all ${
                    active
                      ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)] font-extrabold'
                      : 'border-transparent text-[var(--na-muted)] font-bold'
                  }`}
                >
                  {item.badge ? (
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold text-white"
                      style={{ backgroundColor: active ? item.activeColor : '#B7A99A' }}
                    >
                      {item.badge}
                    </span>
                  ) : (
                    <Icon
                      size={24}
                      weight={active ? 'fill' : 'duotone'}
                      style={{ color: active ? item.activeColor : undefined }}
                    />
                  )}
                  <span className="text-[10px] leading-none">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Modais */}
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

      {petPickerOpen && (
        <PetPickerModal
          pet={pet}
          onSave={handleSavePet}
          onClose={() => setPetPickerOpen(false)}
        />
      )}
    </div>
  );
}
