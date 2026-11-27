import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpenText,
  Check,
  Fire,
  Gift,
  Microphone,
  Play,
  SpeakerHigh,
  Star,
  Trophy,
  X,
} from '@phosphor-icons/react';
import type { LanguageCode, Lesson, Unit } from '@naidioma/shared';
import type { CourseDetailResponse, UserProfile } from '../lib/api';
import { hapticSuccess, hapticTap } from '../lib/native';
import { playChestOpenSound, playTapSound } from '../lib/sound';
import { speakText } from '../lib/speech';
import {
  ConfettiBurst,
  InteractiveCast,
  LANGUAGE_FLAGS,
  PuzzleMascot,
  type CastId,
} from './Mascots';

interface LearnViewProps {
  user: UserProfile;
  courseDetail: CourseDetailResponse | null;
  loading: boolean;
  onSelectLanguage: (lang: LanguageCode) => void;
  onStartLesson: (lesson: Lesson) => void;
  onGoToAlphabet: () => void;
  onGoToConversation: () => void;
  onGoToReview: () => void;
}

interface UnitTheme {
  bg: string;
  border: string;
  soft: string;
  text: string;
  cast: CastId;
}

const UNIT_THEMES: UnitTheme[] = [
  {
    bg: '#1496B0',
    border: '#0C6F84',
    soft: '#E2F7FB',
    text: '#0C6F84',
    cast: 'puz',
  },
  {
    bg: '#C12B5B',
    border: '#7A1436',
    soft: '#FFE8F0',
    text: '#7A1436',
    cast: 'leo',
  },
  {
    bg: '#2CB65E',
    border: '#1D8A45',
    soft: '#E2F9EB',
    text: '#1D8A45',
    cast: 'bia',
  },
  {
    bg: '#E5A300',
    border: '#B37A00',
    soft: '#FFF6D6',
    text: '#7A5200',
    cast: 'mochi',
  },
];

// Curva senoidal idêntica à trilha sinuosa em S do Duolingo!
const WINDING_OFFSETS = [0, -56, -74, -40, 14, 62, 74, 34];

const CHESTS_STORAGE_KEY = 'naidioma_opened_chests_v1';

function readOpenedChests(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(CHESTS_STORAGE_KEY) || '{}') as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

export function LearnView({
  user,
  courseDetail,
  loading,
  onStartLesson,
  onGoToAlphabet,
  onGoToConversation,
  onGoToReview,
}: LearnViewProps) {
  const course = courseDetail?.course;
  const completedMap = courseDetail?.progress.completedLessons ?? {};
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [guideUnit, setGuideUnit] = useState<Unit | null>(null);
  const [openedChests, setOpenedChests] = useState<Record<string, boolean>>(() =>
    readOpenedChests(),
  );
  const [chestCelebration, setChestCelebration] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLessonId(null);
    setGuideUnit(null);
  }, [user.activeLanguage]);

  const allLessons: Lesson[] = course?.units.flatMap((u) => u.lessons) ?? [];
  const nextLesson =
    allLessons.find((lesson) => !completedMap[lesson.id]) ?? allLessons[0] ?? null;

  const dailyGoalXp = Math.max(30, user.dailyGoalMinutes * 5);
  const completedCount = Object.keys(completedMap).length;
  const dailyPct = Math.min(100, Math.round(((completedCount * 40 + (user.xpTotal % dailyGoalXp)) / dailyGoalXp) * 100));

  function handleOpenChest(chestId: string) {
    void hapticSuccess();
    playChestOpenSound();
    const updated = { ...openedChests, [chestId]: true };
    setOpenedChests(updated);
    try {
      window.localStorage.setItem(CHESTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage full
    }
    setChestCelebration(chestId);
    setTimeout(() => setChestCelebration(null), 2600);
  }

  if (loading || !course) {
    return (
      <div className="max-w-xl mx-auto py-10 flex flex-col items-center gap-4">
        <PuzzleMascot mood="wave" size={110} />
        <div className="text-sm font-extrabold text-[var(--na-burgundy)]">
          Montando sua trilha de {LANGUAGE_FLAGS[user.activeLanguage].shortName}...
        </div>
      </div>
    );
  }

  const flag = LANGUAGE_FLAGS[user.activeLanguage];

  return (
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 items-start pb-12">
      {/* COLUNA CENTRAL: A TRILHA SINUOSA ESTILO DUOLINGO */}
      <div className="flex-1 w-full max-w-[560px] mx-auto space-y-10">
        {/* Cardzinho amigável de boas-vindas para crianças (Coreano/Idiomas com letras!) */}
        {course.meta.script.hasNativeScript && (
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              playTapSound();
              onGoToAlphabet();
            }}
            className="w-full p-4 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] border-b-[5px] flex items-center justify-between gap-3 text-left transition-transform active:translate-y-[2px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-12 h-12 rounded-2xl bg-[var(--na-gold)] text-[#4a2e00] font-display text-2xl flex items-center justify-center shrink-0 border-b-4 border-[var(--na-gold-dark)]">
                {flag.letterBadge}
              </span>
              <div className="min-w-0">
                <div className="font-extrabold text-sm sm:text-base text-[#5a3b00]">
                  {user.activeLanguage === 'ko'
                    ? 'Aprender as letras do Coreano (Hangul)!'
                    : `Treinar letras e sons de ${flag.shortName}!`}
                </div>
                <div className="text-xs font-bold text-[#8a6010] truncate">
                  Toque para ouvir cada letra e brincar na Fábrica de Sílabas 🧩
                </div>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-white text-[#5a3b00] text-xs font-extrabold border-2 border-[var(--na-gold)] shrink-0">
              ABRIR
            </span>
          </button>
        )}

        {/* UNIDADES + CAMINHO SINUOSO EM S */}
        {course.units.map((unit, unitIndex) => {
          const theme = UNIT_THEMES[unitIndex % UNIT_THEMES.length]!;
          const doneInUnit = unit.lessons.filter((l) => Boolean(completedMap[l.id])).length;
          const unitCompleted = doneInUnit === unit.lessons.length;

          // Intercala lições + baú de tesouro no meio + troféu final da unidade
          type PathItem =
            | { kind: 'lesson'; lesson: Lesson; idx: number }
            | { kind: 'chest'; id: string; unlocked: boolean }
            | { kind: 'trophy'; id: string; unlocked: boolean };

          const pathItems: PathItem[] = [];
          unit.lessons.forEach((lesson, idx) => {
            pathItems.push({ kind: 'lesson', lesson, idx });
            if (idx === 0 && unit.lessons.length >= 2) {
              pathItems.push({
                kind: 'chest',
                id: `${unit.id}-chest-1`,
                unlocked: Boolean(completedMap[lesson.id]),
              });
            }
          });
          pathItems.push({
            kind: 'trophy',
            id: `${unit.id}-trophy`,
            unlocked: unitCompleted,
          });

          // Decide em qual lado fica o bonequinho animado (lado oposto à curvatura dos nós!)
          const companionSide: 'left' | 'right' = unitIndex % 2 === 0 ? 'right' : 'left';
          const companionRowIndex = Math.min(1, Math.max(0, pathItems.length - 2));

          return (
            <section key={unit.id} className="space-y-6">
              {/* BANNER COLORIDO DA UNIDADE (Igual ao Duolingo!) */}
              <div
                className="rounded-[22px] p-5 text-white border-2 border-b-[6px] flex items-center justify-between gap-4 shadow-xs"
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                }}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/85">
                    UNIDADE {unit.order} · {doneInUnit}/{unit.lessons.length} CONCLUÍDAS
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl leading-tight mt-0.5">
                    {unit.titlePt}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    playTapSound();
                    setGuideUnit(unit);
                  }}
                  className="shrink-0 min-h-[44px] px-3.5 rounded-2xl bg-black/15 hover:bg-black/25 border-2 border-white/30 text-white text-xs font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5"
                >
                  <BookOpenText size={17} weight="fill" />
                  GUIA
                </button>
              </div>

              {/* CAMINHO SINUOSO EM S */}
              <div className="relative flex flex-col items-center gap-7 py-3">
                {pathItems.map((item, stepIdx) => {
                  const offset = WINDING_OFFSETS[(stepIdx + unitIndex * 2) % WINDING_OFFSETS.length] ?? 0;

                  // Personagem animado ao lado do caminho nesta altura
                  const showCompanionHere = stepIdx === companionRowIndex;

                  if (item.kind === 'chest') {
                    const isOpen = Boolean(openedChests[item.id]);
                    const isCelebrating = chestCelebration === item.id;
                    return (
                      <div
                        key={item.id}
                        className="relative flex items-center justify-center w-full"
                      >
                        <div
                          className="relative"
                          style={{ transform: `translateX(${offset}px)` }}
                        >
                          <ConfettiBurst active={isCelebrating} />
                          {isCelebrating && (
                            <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-[var(--na-gold)] text-[#4a2e00] text-xs font-extrabold shadow-sm z-20">
                              +25 peças mágicas! 🧩✨
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (!isOpen && item.unlocked) {
                                handleOpenChest(item.id);
                              } else {
                                playTapSound();
                              }
                            }}
                            aria-label="Baú de tesouro"
                            className={`duo-path-node ${
                              item.unlocked && !isOpen ? 'animate-na-chest' : ''
                            }`}
                            style={{
                              backgroundColor: isOpen
                                ? '#F4EADC'
                                : item.unlocked
                                  ? '#F4B400'
                                  : '#EDE4D8',
                              borderColor: isOpen
                                ? '#D9CBB9'
                                : item.unlocked
                                  ? '#C98A00'
                                  : '#D6C7B5',
                              color: isOpen ? '#9E8F7E' : item.unlocked ? '#4A2E00' : '#A69787',
                            }}
                          >
                            <Gift size={34} weight="fill" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === 'trophy') {
                    return (
                      <div
                        key={item.id}
                        className="relative flex flex-col items-center justify-center w-full pt-1"
                      >
                        <div style={{ transform: `translateX(${offset}px)` }}>
                          <button
                            type="button"
                            onClick={() => {
                              void hapticTap();
                              if (item.unlocked) {
                                playChestOpenSound();
                              } else {
                                playTapSound();
                                if (unit.lessons[0]) setSelectedLessonId(unit.lessons[0].id);
                              }
                            }}
                            aria-label={`Troféu da Unidade ${unit.order}`}
                            className="duo-path-node"
                            style={{
                              backgroundColor: item.unlocked ? '#F4B400' : '#EFE7DC',
                              borderColor: item.unlocked ? '#C98A00' : '#D6C7B5',
                              color: item.unlocked ? '#FFFFFF' : '#B3A494',
                            }}
                          >
                            <Trophy size={34} weight="fill" />
                          </button>
                        </div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-muted)] mt-2">
                          {item.unlocked ? `Unidade ${unit.order} conquistada! 🏆` : `Troféu da Unidade ${unit.order}`}
                        </span>
                      </div>
                    );
                  }

                  // NÓ DE LIÇÃO
                  const { lesson } = item;
                  const done = completedMap[lesson.id];
                  const isCurrent = nextLesson?.id === lesson.id;
                  const isSelected = selectedLessonId === lesson.id;

                  const nodeBg = done
                    ? '#F4B400'
                    : isCurrent
                      ? theme.bg
                      : '#FFFFFF';
                  const nodeBorder = done
                    ? '#C98A00'
                    : isCurrent
                      ? theme.border
                      : '#D9CCBC';
                  const nodeIconColor = done || isCurrent ? '#FFFFFF' : theme.bg;

                  return (
                    <div
                      key={lesson.id}
                      className="relative flex flex-col items-center w-full"
                    >
                      {/* Bonequinho animado ao lado da trilha! */}
                      {showCompanionHere && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 z-10 ${
                            companionSide === 'right'
                              ? 'right-2 sm:right-6'
                              : 'left-2 sm:left-6'
                          }`}
                        >
                          <InteractiveCast
                            character={theme.cast}
                            size={104}
                            mood={isCurrent ? 'wave' : 'idle'}
                            customPhrase={
                              user.activeLanguage === 'ko'
                                ? '안녕하세요! Vamos lá! 🧩'
                                : 'Você está indo super bem! ⭐'
                            }
                          />
                        </div>
                      )}

                      <div
                        className="relative flex flex-col items-center"
                        style={{ transform: `translateX(${offset}px)` }}
                      >
                        {/* Balão "COMEÇAR!" pulando em cima da lição ativa (marca registrada do Duolingo!) */}
                        {isCurrent && !isSelected && (
                          <div
                            className="animate-na-callout absolute -top-12 left-1/2 z-20 px-4 py-1.5 rounded-2xl bg-white border-2 shadow-sm text-xs font-extrabold uppercase tracking-wider whitespace-nowrap"
                            style={{ borderColor: theme.bg, color: theme.bg }}
                          >
                            COMEÇAR!
                            <span
                              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 rotate-45"
                              style={{ borderColor: theme.bg }}
                            />
                          </div>
                        )}

                        {/* Anel brilhante em volta do nó ativo */}
                        <div
                          className={`rounded-full p-1.5 transition-all ${
                            isCurrent ? 'ring-4 ring-offset-4 ring-offset-[var(--na-cream)]' : ''
                          }`}
                          style={
                            isCurrent
                              ? { ['--tw-ring-color' as string]: `${theme.bg}55` }
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              void hapticTap();
                              playTapSound();
                              setSelectedLessonId((prev) =>
                                prev === lesson.id ? null : lesson.id,
                              );
                            }}
                            aria-label={lesson.titlePt}
                            className="duo-path-node"
                            style={{
                              backgroundColor: nodeBg,
                              borderColor: nodeBorder,
                              color: nodeIconColor,
                            }}
                          >
                            {done ? (
                              <Check size={34} weight="bold" />
                            ) : (
                              <Star size={34} weight="fill" />
                            )}
                          </button>
                        </div>

                        {/* Rótulo curtinho e amigável embaixo do nó */}
                        <span className="mt-1.5 max-w-[140px] text-center text-xs font-extrabold text-[var(--na-ink)] leading-tight">
                          {lesson.titlePt}
                        </span>
                      </div>

                      {/* POPOVER ESTILO DUOLINGO AO TOCAR NO NÓ */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="mt-3 w-full max-w-[330px] rounded-[22px] p-4 text-white border-2 border-b-[6px] shadow-lg z-20 space-y-3"
                          style={{
                            backgroundColor: theme.bg,
                            borderColor: theme.border,
                          }}
                        >
                          <div>
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/85">
                              LIÇÃO {lesson.order} · {lesson.exercises.length} DESAFIOS ·{' '}
                              {lesson.durationMinutes} MIN
                            </div>
                            <h3 className="font-display text-lg leading-snug mt-0.5">
                              {lesson.titlePt}
                            </h3>
                            <p className="text-xs text-white/90 font-semibold mt-0.5">
                              {lesson.subtitlePt}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void hapticTap();
                              playTapSound();
                              onStartLesson(lesson);
                            }}
                            className="w-full min-h-[50px] px-4 rounded-2xl bg-white font-extrabold text-sm uppercase tracking-wide flex items-center justify-center gap-2 border-2 border-b-[5px] active:translate-y-[2px]"
                            style={{
                              color: theme.text,
                              borderColor: `${theme.border}55`,
                              borderBottomColor: '#DFD2C2',
                            }}
                          >
                            <Play size={18} weight="fill" />
                            {done ? `PRATICAR DE NOVO (+${lesson.xpReward} XP)` : `COMEÇAR (+${lesson.xpReward} XP)`}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* PAINEL LATERAL DIREITO (DESKTOP — IGUAL AO DUOLINGO WEB!) */}
      <aside className="hidden lg:flex lg:flex-col w-80 shrink-0 sticky top-6 space-y-4">
        {/* Card Meta Diária com o Puz */}
        <div className="duo-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-[var(--na-ink)]">Meta de hoje</h3>
            <span className="text-xs font-extrabold text-[var(--na-flame)] inline-flex items-center gap-1">
              <Fire size={16} weight="fill" /> {user.streakDays}d seguidos
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PuzzleMascot mood={dailyPct >= 100 ? 'celebrate' : 'happy'} size={66} />
            <div className="flex-1 space-y-1.5">
              <div className="text-xs font-extrabold text-[var(--na-ink)]">
                Ganhe {dailyGoalXp} XP hoje!
              </div>
              <div className="h-4 rounded-full bg-[var(--na-sand)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[var(--na-gold)] transition-all duration-500"
                  style={{ width: `${Math.max(12, dailyPct)}%` }}
                />
              </div>
              <div className="text-[11px] font-bold text-[var(--na-muted)]">
                {user.xpTotal} XP acumulado · Energia infinita ❤️
              </div>
            </div>
          </div>
        </div>

        {/* Card Prática de Letras / Sons */}
        <div className="duo-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] text-[var(--na-teal-dark)] font-display text-xl flex items-center justify-center shrink-0">
              {flag.letterBadge}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[var(--na-ink)]">
                {user.activeLanguage === 'ko' ? 'Treinar Hangul (한)' : 'Treinar Letras & Sons'}
              </h3>
              <p className="text-xs font-semibold text-[var(--na-muted)]">
                Toque, ouça e monte sílabas brincando!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onGoToAlphabet();
            }}
            className="duo-btn-teal w-full text-xs uppercase tracking-wide"
          >
            ABRIR LABORATÓRIO DE LETRAS
          </button>
        </div>

        {/* Card Conversa com Personagem IA */}
        <div className="duo-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <InteractiveCast character="leo" size={62} />
            <div>
              <h3 className="font-extrabold text-sm text-[var(--na-ink)]">Conversar por Voz</h3>
              <p className="text-xs font-semibold text-[var(--na-muted)]">
                Bata papo em {flag.shortName} com dicas em português!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onGoToConversation();
            }}
            className="duo-btn-wine w-full text-xs uppercase tracking-wide flex items-center justify-center gap-1.5"
          >
            <Microphone size={16} weight="fill" /> CONVERSAR AGORA
          </button>
        </div>

        {/* Atalho Revisão */}
        <button
          type="button"
          onClick={() => {
            playTapSound();
            onGoToReview();
          }}
          className="duo-btn-white w-full px-4 py-3 text-xs font-extrabold text-[var(--na-ink)] flex items-center justify-between"
        >
          <span>🧠 Revisar cartões de memória</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[var(--na-rose-soft)] text-[var(--na-burgundy)]">
            {courseDetail.progress.dueReviewsCount}
          </span>
        </button>
      </aside>

      {/* MODAL DO GUIA DA UNIDADE (Dicas + Frases que falam ao tocar!) */}
      {guideUnit && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="duo-card w-full sm:max-w-lg rounded-b-none sm:rounded-[24px] p-6 space-y-4 max-h-[85dvh] overflow-y-auto safe-bottom"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-teal)]">
                  Guia da Unidade {guideUnit.order}
                </div>
                <h3 className="font-display text-2xl text-[var(--na-ink)] mt-0.5">
                  {guideUnit.titlePt}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideUnit(null)}
                aria-label="Fechar guia"
                className="w-10 h-10 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] flex items-center justify-center"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-sm font-semibold text-[#5a3b00] leading-relaxed">
              💡 <strong>Dica do Puz: </strong>
              {guideUnit.culturalNotePt}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                Frases e palavras desta unidade (toque para ouvir!):
              </div>
              {guideUnit.lessons.flatMap((l) => l.exercises.slice(0, 2)).map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    speakText(ex.targetText, user.activeLanguage, 0.88);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] hover:border-[var(--na-teal)] flex items-center justify-between gap-3 text-left"
                >
                  <div>
                    <div className="font-extrabold text-base text-[var(--na-ink)]">
                      {ex.targetText}
                    </div>
                    {ex.reading && (
                      <div className="font-mono-code text-xs font-bold text-[var(--na-teal)]">
                        {ex.reading}
                      </div>
                    )}
                    <div className="text-xs font-semibold text-[var(--na-muted)]">
                      {ex.translationPt}
                    </div>
                  </div>
                  <span className="w-10 h-10 rounded-xl bg-[var(--na-teal)] text-white flex items-center justify-center shrink-0">
                    <SpeakerHigh size={18} weight="fill" />
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setGuideUnit(null)}
              className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
            >
              ENTENDI, VAMOS PRATICAR!
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
