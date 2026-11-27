import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpenText,
  Check,
  Crown,
  Fire,
  Gift,
  GraduationCap,
  Heart,
  LockSimple,
  Microphone,
  Play,
  SpeakerHigh,
  Star,
  Trophy,
  X,
} from '@phosphor-icons/react';
import {
  LESSON_MASTERY_THRESHOLD,
  computeCourseLevelProgress,
  type CefrLevel,
  type LanguageCode,
  type Lesson,
  type Unit,
} from '@naidioma/shared';
import type { CourseDetailResponse, UserProfile } from '../lib/api';
import { hapticSuccess, hapticTap } from '../lib/native';
import {
  playChestOpenSound,
  playFootstepsSound,
  playPetHappySound,
  playTapSound,
} from '../lib/sound';
import { speakText } from '../lib/speech';
import {
  ConfettiBurst,
  InteractiveCast,
  LANGUAGE_FLAGS,
  PuzzleMascot,
  type CastId,
} from './Mascots';
import { PetSprite, type PetProfile } from './PetBuddy';
import { ReminderCard } from './ReminderCard';

interface LearnViewProps {
  user: UserProfile;
  pet: PetProfile;
  justCompletedLessonId: string | null;
  onClearJustCompleted: () => void;
  onOpenPetPicker: () => void;
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
    cast: 'dino',
  },
  {
    bg: '#C12B5B',
    border: '#7A1436',
    soft: '#FFE8F0',
    text: '#7A1436',
    cast: 'puz',
  },
  {
    bg: '#2CB65E',
    border: '#1D8A45',
    soft: '#E2F9EB',
    text: '#1D8A45',
    cast: 'leo',
  },
  {
    bg: '#E5A300',
    border: '#B37A00',
    soft: '#FFF6D6',
    text: '#7A5200',
    cast: 'bia',
  },
];

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
  pet,
  justCompletedLessonId,
  onClearJustCompleted,
  onOpenPetPicker,
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
  const [selectedCefr, setSelectedCefr] = useState<CefrLevel | null>(null);
  const [guideUnit, setGuideUnit] = useState<Unit | null>(null);
  const [openedChests, setOpenedChests] = useState<Record<string, boolean>>(() =>
    readOpenedChests(),
  );
  const [chestCelebration, setChestCelebration] = useState<string | null>(null);
  const [petWalkingOnPath, setPetWalkingOnPath] = useState(false);
  const [petArrivedCheer, setPetArrivedCheer] = useState(false);

  const levels = useMemo(() => {
    if (!course) return [];
    return computeCourseLevelProgress(course, completedMap);
  }, [course, completedMap]);

  // Nível mais alto desbloqueado ainda em andamento (ou o último aprovado)
  const highestActiveLevel = useMemo(() => {
    if (levels.length === 0) return null;
    const unlocked = levels.filter((l) => l.unlocked);
    const inProgress = unlocked.find((l) => !l.examPassed);
    return inProgress ?? unlocked[unlocked.length - 1] ?? levels[0]!;
  }, [levels]);

  useEffect(() => {
    setSelectedLessonId(null);
    setGuideUnit(null);
    setSelectedCefr(null);
  }, [user.activeLanguage]);

  // Se o aluno acabou de passar numa Prova de Passagem, avança automaticamente para o novo nível!
  useEffect(() => {
    if (!justCompletedLessonId || levels.length === 0) return;
    const passedExamLevel = levels.find(
      (l) => l.examLesson?.id === justCompletedLessonId && l.examPassed && l.nextCefr,
    );
    if (passedExamLevel?.nextCefr) {
      setSelectedCefr(passedExamLevel.nextCefr);
    }
  }, [justCompletedLessonId, levels]);

  useEffect(() => {
    if (!justCompletedLessonId) return undefined;
    setPetWalkingOnPath(true);
    setPetArrivedCheer(false);
    playFootstepsSound(6);

    const arriveTimer = setTimeout(() => {
      setPetWalkingOnPath(false);
      setPetArrivedCheer(true);
      playPetHappySound();
      onClearJustCompleted();
    }, 1550);

    const clearCheerTimer = setTimeout(() => {
      setPetArrivedCheer(false);
    }, 4000);

    return () => {
      clearTimeout(arriveTimer);
      clearTimeout(clearCheerTimer);
    };
  }, [justCompletedLessonId, onClearJustCompleted]);

  const activeLevel = useMemo(() => {
    if (levels.length === 0) return null;
    if (selectedCefr) {
      return levels.find((l) => l.cefr === selectedCefr) ?? highestActiveLevel ?? levels[0]!;
    }
    return highestActiveLevel ?? levels[0]!;
  }, [levels, selectedCefr, highestActiveLevel]);

  const activeLevelIndex = activeLevel
    ? levels.findIndex((l) => l.cefr === activeLevel.cefr)
    : 0;
  const previousLevel = activeLevelIndex > 0 ? levels[activeLevelIndex - 1] ?? null : null;

  const activeStudyLessons: Lesson[] = activeLevel
    ? activeLevel.studyUnits.flatMap((u) => u.lessons)
    : [];
  const nextLesson =
    activeStudyLessons.find((lesson) => {
      const rec = completedMap[lesson.id];
      return !rec || rec.bestAccuracy < LESSON_MASTERY_THRESHOLD;
    }) ??
    activeLevel?.examLesson ??
    activeStudyLessons[0] ??
    null;

  const dailyGoalXp = Math.max(30, user.dailyGoalMinutes * 5);
  const completedCount = Object.keys(completedMap).length;
  const dailyPct = Math.min(
    100,
    Math.round(((completedCount * 40 + (user.xpTotal % dailyGoalXp)) / dailyGoalXp) * 100),
  );

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

  if (loading || !course || !activeLevel) {
    return (
      <div className="max-w-xl mx-auto py-10 flex flex-col items-center gap-4">
        <PetSprite species={pet.species} mood="walking" size={110} />
        <div className="text-sm font-extrabold text-[var(--na-burgundy)]">
          {pet.name} está preparando sua trilha de {LANGUAGE_FLAGS[user.activeLanguage].shortName}...
        </div>
      </div>
    );
  }

  const flag = LANGUAGE_FLAGS[user.activeLanguage];
  const petPathMood = petWalkingOnPath
    ? 'walking'
    : petArrivedCheer
      ? 'celebrate'
      : pet.happiness < 45
        ? 'sad'
        : 'happy';

  const levelPct =
    activeLevel.totalStudyLessons === 0
      ? 0
      : Math.round((activeLevel.masteredStudyLessons / activeLevel.totalStudyLessons) * 100);

  return (
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 items-start pb-12">
      {/* COLUNA CENTRAL: SELETOR DE NÍVEIS CEFR (A1 -> C2) + TRILHA COMPLETA + PROVA DE PASSAGEM */}
      <div className="flex-1 w-full max-w-[560px] mx-auto space-y-6">
        {/* BANNER INTERATIVO DO BICHINHO NO TOPO */}
        <button
          type="button"
          onClick={() => {
            void hapticTap();
            playTapSound();
            onOpenPetPicker();
          }}
          className="w-full p-3.5 rounded-3xl bg-white border-2 border-[var(--na-border)] border-b-[5px] flex items-center justify-between gap-3 text-left overflow-hidden relative"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <PetSprite species={pet.species} mood={petPathMood} size={66} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-[var(--na-ink)]">{pet.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                    pet.happiness < 45
                      ? 'bg-[var(--na-error-soft)] text-[var(--na-error)]'
                      : 'bg-[var(--na-success-soft)] text-[var(--na-success-dark)]'
                  }`}
                >
                  {petWalkingOnPath
                    ? '🐾 Andando...'
                    : pet.happiness < 45
                      ? `🥺 Tristinho (${pet.happiness}%)`
                      : `💖 Feliz (${pet.happiness}%)`}
                </span>
              </div>
              <div className="text-xs font-semibold text-[var(--na-muted)] truncate mt-0.5">
                {petWalkingOnPath
                  ? `Caminhando até "${nextLesson?.titlePt ?? 'a próxima atividade'}"!`
                  : petArrivedCheer
                    ? `Chegamos! Vamos jogar "${nextLesson?.titlePt ?? 'a próxima'}"? 🎉`
                    : 'Toque para fazer carinho ou trocar de bichinho'}
              </div>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-[var(--na-rose-soft)] text-[var(--na-burgundy)] text-xs font-extrabold shrink-0">
            Cuidar
          </span>
        </button>

        {/* PAINEL DE NÍVEIS OFICIAIS CEFR (A1 -> A2 -> B1 -> B2 -> C1 -> C2) */}
        <div className="duo-card p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--na-teal-dark)]">
                Jornada Completa · {flag.shortName}
              </div>
              <h2 className="font-display text-lg text-[var(--na-ink)] leading-tight">
                {activeLevel.meta.badgePt}
              </h2>
            </div>
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold text-white shrink-0"
              style={{ backgroundColor: activeLevel.meta.accentBg }}
            >
              {activeLevel.studyUnits.length} etapas
            </span>
          </div>

          {/* Barra de abas de todos os níveis CEFR do curso */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {levels.map((lvl) => {
              const isSelected = lvl.cefr === activeLevel.cefr;
              return (
                <button
                  key={lvl.cefr}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    playTapSound();
                    setSelectedCefr(lvl.cefr);
                    setSelectedLessonId(null);
                  }}
                  className={`min-h-[42px] px-3 rounded-2xl border-2 border-b-4 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-all active:translate-y-[1px] ${
                    isSelected
                      ? 'text-white shadow-xs'
                      : lvl.examPassed
                        ? 'bg-[var(--na-success-soft)] border-[var(--na-success)] text-[var(--na-success-dark)]'
                        : lvl.unlocked
                          ? 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
                          : 'bg-[var(--na-sand)]/70 border-[var(--na-border)] text-[var(--na-muted)]'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: lvl.meta.accentBg,
                          borderColor: lvl.meta.accentBorder,
                        }
                      : undefined
                  }
                >
                  {lvl.examPassed ? (
                    <Check size={14} weight="bold" />
                  ) : lvl.unlocked ? (
                    <Star size={14} weight="fill" />
                  ) : (
                    <LockSimple size={14} weight="bold" />
                  )}
                  <span>{lvl.cefr}</span>
                </button>
              );
            })}
          </div>

          <p className="text-xs font-semibold text-[var(--na-muted)] leading-relaxed">
            {activeLevel.meta.goalPt}
          </p>

          {/* Progresso de domínio deste nível */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-[var(--na-ink)]">
              <span>
                Domínio do Nível {activeLevel.cefr}: {activeLevel.masteredStudyLessons}/
                {activeLevel.totalStudyLessons} atividades (≥ {LESSON_MASTERY_THRESHOLD}%)
              </span>
              <span style={{ color: activeLevel.meta.accentText }}>{levelPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-[var(--na-sand)] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(activeLevel.masteredStudyLessons > 0 ? 8 : 0, levelPct)}%`,
                  backgroundColor: activeLevel.meta.accentBg,
                }}
              />
            </div>
          </div>
        </div>

        {/* Cardzinho de Letras / Hangul para Coreano, Japonês e Chinês */}
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

        {/* Aviso Motivacional Diário na Tela (mobile) */}
        <div className="lg:hidden">
          <ReminderCard petName={pet.name} compact />
        </div>

        {/* CASO O NÍVEL SELECIONADO AINDA ESTEJA BLOQUEADO: EXIGE PROVAR DOMÍNIO DO NÍVEL ANTERIOR! */}
        {!activeLevel.unlocked ? (
          <div className="duo-card p-6 space-y-5 text-center border-[var(--na-gold)]">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] flex items-center justify-center text-[#8a6010]">
              <LockSimple size={34} weight="fill" />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
                Nível {activeLevel.cefr} · Bloqueado
              </div>
              <h3 className="font-display text-2xl text-[var(--na-ink)]">
                Prove o domínio do Nível {previousLevel?.cefr ?? 'anterior'} para avançar!
              </h3>
              <p className="text-sm font-semibold text-[var(--na-muted)] leading-relaxed">
                Aqui você aprende de verdade: conclua as etapas do{' '}
                <strong>Nível {previousLevel?.cefr}</strong> e passe na{' '}
                <strong>Prova Oficial de Passagem (≥ {previousLevel?.meta.passingAccuracy ?? 80}%)</strong>{' '}
                para desbloquear todas as {activeLevel.studyUnits.length} etapas do{' '}
                <strong>Nível {activeLevel.cefr}</strong>.
              </p>
            </div>

            {/* Prévia séria das etapas que esperam neste nível */}
            <div className="text-left rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] p-4 space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                O que você vai dominar no Nível {activeLevel.cefr}:
              </div>
              {activeLevel.studyUnits.map((u, idx) => (
                <div key={u.id} className="flex items-start gap-2 text-xs font-bold text-[var(--na-ink)]">
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-[var(--na-border)] text-[10px] font-extrabold shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <div>{u.titlePt}</div>
                    {u.grammarFocusPt && (
                      <div className="text-[11px] font-semibold text-[var(--na-muted)]">
                        {u.grammarFocusPt}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              {previousLevel && (
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[var(--na-border)] text-left text-xs space-y-1.5">
                  <div className="font-extrabold text-[var(--na-ink)] uppercase tracking-wider text-[11px]">
                    Requisitos para liberar o Nível {activeLevel.cefr}:
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className={previousLevel.allStudyLessonsMastered ? 'text-[var(--na-success-dark)]' : 'text-[var(--na-ink)]'}>
                      {previousLevel.allStudyLessonsMastered ? '✅' : '⏳'} 1. Dominar todas as atividades do {previousLevel.cefr} (≥ {LESSON_MASTERY_THRESHOLD}%)
                    </span>
                    <span className="font-extrabold text-[var(--na-burgundy)]">
                      {previousLevel.masteredStudyLessons}/{previousLevel.totalStudyLessons}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className={previousLevel.examPassed ? 'text-[var(--na-success-dark)]' : 'text-[var(--na-ink)]'}>
                      {previousLevel.examPassed ? '✅' : '🔒'} 2. Passar na Prova Oficial {previousLevel.cefr} → {activeLevel.cefr} (≥ {previousLevel.meta.passingAccuracy}%)
                    </span>
                    <span className="font-extrabold text-[var(--na-muted)]">
                      {previousLevel.examPassed ? `${previousLevel.examBestAccuracy}%` : 'Pendente'}
                    </span>
                  </div>
                </div>
              )}

              {previousLevel && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setSelectedCefr(previousLevel.cefr);
                  }}
                  className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
                >
                  CONTINUAR ESTUDANDO O NÍVEL {previousLevel.cefr}
                </button>
              )}

              {previousLevel?.examLesson && previousLevel.examReady && !previousLevel.examPassed && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    onStartLesson(previousLevel.examLesson!);
                  }}
                  className="duo-btn-wine w-full px-4 py-3 text-xs font-extrabold uppercase tracking-wide inline-flex items-center justify-center gap-1.5"
                >
                  <GraduationCap size={17} weight="fill" />
                  Fazer Prova Oficial {previousLevel.cefr} → {activeLevel.cefr} agora!
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ETAPAS COMPLETAS DO NÍVEL ATUAL NO CAMINHO SINUOSO EM S */}
            {activeLevel.studyUnits.map((unit, unitIndex) => {
              const theme = UNIT_THEMES[unitIndex % UNIT_THEMES.length]!;
              const masteredInUnit = unit.lessons.filter(
                (l) => (completedMap[l.id]?.bestAccuracy ?? 0) >= LESSON_MASTERY_THRESHOLD,
              ).length;
              const unitCompleted = masteredInUnit === unit.lessons.length;

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

              const companionSide: 'left' | 'right' = unitIndex % 2 === 0 ? 'right' : 'left';
              const companionRowIndex = Math.min(2, Math.max(0, pathItems.length - 2));

              return (
                <section key={unit.id} className="space-y-6">
                  {/* BANNER DA ETAPA COM FOCO GRAMATICAL */}
                  <div
                    className="rounded-[22px] p-5 text-white border-2 border-b-[6px] flex items-center justify-between gap-4 shadow-xs"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/85">
                        NÍVEL {activeLevel.cefr} · ETAPA {unitIndex + 1} DE {activeLevel.studyUnits.length} ·{' '}
                        {masteredInUnit}/{unit.lessons.length} DOMINADAS
                      </div>
                      <h2 className="font-display text-xl sm:text-2xl leading-tight mt-0.5">
                        {unit.titlePt}
                      </h2>
                      {unit.grammarFocusPt && (
                        <div className="text-[11px] font-bold text-white/90 mt-1">
                          📚 {unit.grammarFocusPt}
                        </div>
                      )}
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
                      const offset =
                        WINDING_OFFSETS[(stepIdx + unitIndex * 2) % WINDING_OFFSETS.length] ?? 0;

                      const showCompanionHere = stepIdx === companionRowIndex;

                      if (item.kind === 'chest') {
                        const isOpen = Boolean(openedChests[item.id]);
                        const isCelebrating = chestCelebration === item.id;
                        return (
                          <div key={item.id} className="relative flex items-center justify-center w-full">
                            <div className="relative" style={{ transform: `translateX(${offset}px)` }}>
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
                                aria-label={`Prêmio da Etapa ${unitIndex + 1}`}
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
                              {item.unlocked
                                ? `Etapa ${unitIndex + 1} dominada! 🏆`
                                : `Prêmio da Etapa ${unitIndex + 1}`}
                            </span>
                          </div>
                        );
                      }

                      // NÓ DE LIÇÃO
                      const { lesson } = item;
                      const done = completedMap[lesson.id];
                      const mastered = Boolean(done && done.bestAccuracy >= LESSON_MASTERY_THRESHOLD);
                      const isCurrent = nextLesson?.id === lesson.id;
                      const isSelected = selectedLessonId === lesson.id;

                      const nodeBg = mastered ? '#F4B400' : isCurrent ? theme.bg : '#FFFFFF';
                      const nodeBorder = mastered ? '#C98A00' : isCurrent ? theme.border : '#D9CCBC';
                      const nodeIconColor = mastered || isCurrent ? '#FFFFFF' : theme.bg;

                      return (
                        <div key={lesson.id} className="relative flex flex-col items-center w-full">
                          {showCompanionHere && !isCurrent && (
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 z-10 ${
                                companionSide === 'right' ? 'right-2 sm:right-6' : 'left-2 sm:left-6'
                              }`}
                            >
                              <InteractiveCast
                                character={theme.cast}
                                size={96}
                                mood="idle"
                                customPhrase={
                                  user.activeLanguage === 'ko'
                                    ? '안녕하세요! Vamos lá! 🧩'
                                    : `Foco no Nível ${activeLevel.cefr}! ⭐`
                                }
                              />
                            </div>
                          )}

                          <div
                            className="relative flex flex-col items-center"
                            style={{ transform: `translateX(${offset}px)` }}
                          >
                            {isCurrent && (
                              <motion.div
                                key={`${lesson.id}-${petWalkingOnPath ? 'walk' : 'stand'}`}
                                initial={
                                  petWalkingOnPath
                                    ? { y: -115, x: offset > 0 ? -70 : 70, opacity: 0.95 }
                                    : false
                                }
                                animate={{ y: 0, x: 0, opacity: 1 }}
                                transition={{ duration: 1.45, ease: 'easeInOut' }}
                                className={`absolute top-1/2 -translate-y-1/2 z-30 ${
                                  offset >= 0 ? '-left-[104px]' : '-right-[104px]'
                                }`}
                              >
                                <div className="relative flex flex-col items-center">
                                  <ConfettiBurst active={petArrivedCheer} />
                                  {(petWalkingOnPath || petArrivedCheer) && (
                                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-full bg-white border-2 border-[var(--na-burgundy)] text-[10px] font-extrabold text-[var(--na-burgundy)] shadow-xs">
                                      {petWalkingOnPath ? '🐾 Andando...' : 'Cheguei! Vamos! 🎉'}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playTapSound();
                                      onOpenPetPicker();
                                    }}
                                    aria-label={`Bichinho ${pet.name}`}
                                    className="cursor-pointer"
                                  >
                                    <PetSprite
                                      species={pet.species}
                                      mood={petPathMood}
                                      size={88}
                                      facingLeft={offset < 0}
                                    />
                                  </button>
                                </div>
                              </motion.div>
                            )}

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
                                  setSelectedLessonId((prev) => (prev === lesson.id ? null : lesson.id));
                                }}
                                aria-label={lesson.titlePt}
                                className="duo-path-node"
                                style={{
                                  backgroundColor: nodeBg,
                                  borderColor: nodeBorder,
                                  color: nodeIconColor,
                                }}
                              >
                                {mastered ? (
                                  <Check size={34} weight="bold" />
                                ) : (
                                  <Star size={34} weight="fill" />
                                )}
                              </button>
                            </div>

                            <span className="mt-1.5 max-w-[155px] text-center text-xs font-extrabold text-[var(--na-ink)] leading-tight">
                              {lesson.titlePt}
                            </span>
                            {done && (
                              <span
                                className={`text-[10px] font-extrabold mt-0.5 ${
                                  mastered ? 'text-[var(--na-success-dark)]' : 'text-[var(--na-flame)]'
                                }`}
                              >
                                {mastered
                                  ? `✓ Melhor: ${done.bestAccuracy}%`
                                  : `Feita: ${done.bestAccuracy}% (meta ≥ ${LESSON_MASTERY_THRESHOLD}%)`}
                              </span>
                            )}
                          </div>

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
                                  NÍVEL {lesson.cefr} · {lesson.exercises.length} DESAFIOS ·{' '}
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
                                {done
                                  ? `PRATICAR DE NOVO (+${lesson.xpReward} PEÇAS 🧩)`
                                  : `COMEÇAR (+${lesson.xpReward} PEÇAS 🧩)`}
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

            {/* CARD FINAL DO NÍVEL: PROVA OFICIAL DE PASSAGEM DE NÍVEL (LIBERA APÓS CONCLUIR TODAS AS ETAPAS!) */}
            {activeLevel.examLesson && (
              <section
                className="rounded-[26px] p-6 border-2 border-b-[7px] space-y-4 shadow-sm"
                style={{
                  backgroundColor: activeLevel.examPassed
                    ? '#E2F9EB'
                    : activeLevel.examReady
                      ? '#FFF6D6'
                      : '#F7F1E8',
                  borderColor: activeLevel.examPassed
                    ? '#1D8A45'
                    : activeLevel.examReady
                      ? '#C98A00'
                      : '#D4C5B2',
                }}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white border-b-4"
                    style={{
                      backgroundColor: activeLevel.examPassed
                        ? '#2CB65E'
                        : activeLevel.examReady
                          ? '#C12B5B'
                          : '#9E8F7E',
                      borderColor: activeLevel.examPassed
                        ? '#1D8A45'
                        : activeLevel.examReady
                          ? '#7A1436'
                          : '#7C6E5F',
                    }}
                  >
                    {activeLevel.examPassed ? (
                      <Crown size={30} weight="fill" />
                    ) : activeLevel.examReady ? (
                      <GraduationCap size={30} weight="fill" />
                    ) : (
                      <LockSimple size={28} weight="fill" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                      style={{
                        color: activeLevel.examPassed
                          ? '#1D8A45'
                          : activeLevel.examReady
                            ? '#8A6010'
                            : '#7A6C5D',
                      }}
                    >
                      {activeLevel.examPassed
                        ? `✓ APROVADO COM ${activeLevel.examBestAccuracy}%!`
                        : activeLevel.examReady
                          ? `🎉 LIBERADA! PROVA OFICIAL · MÍNIMO ${activeLevel.examLesson.passingAccuracy ?? 80}%`
                          : `🔒 BLOQUEADA · CONCLUA TODAS AS ETAPAS DO ${activeLevel.cefr}`}
                    </div>
                    <h3 className="font-display text-2xl text-[var(--na-ink)] leading-tight mt-0.5">
                      {activeLevel.examUnit?.titlePt ?? activeLevel.examLesson.titlePt}
                    </h3>
                    <p className="text-xs font-semibold text-[var(--na-muted)] mt-1 leading-relaxed">
                      {activeLevel.examUnit?.descriptionPt}
                    </p>
                  </div>
                </div>

                {!activeLevel.examReady && !activeLevel.examPassed && (
                  <div className="p-3.5 rounded-2xl bg-white border-2 border-[var(--na-border)] text-xs space-y-2">
                    <div className="font-extrabold text-[var(--na-ink)]">
                      📋 Para desbloquear a Prova Oficial do Nível {activeLevel.cefr}, complete e domine todas as atividades com ≥ {LESSON_MASTERY_THRESHOLD}%:
                    </div>
                    <div className="h-3 rounded-full bg-[var(--na-sand)] overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(activeLevel.masteredStudyLessons > 0 ? 8 : 0, levelPct)}%`,
                          backgroundColor: activeLevel.meta.accentBg,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-[var(--na-muted)]">
                      <span>
                        Dominadas: {activeLevel.masteredStudyLessons}/{activeLevel.totalStudyLessons}
                      </span>
                      <span className="text-[var(--na-burgundy)]">
                        Faltam {activeLevel.totalStudyLessons - activeLevel.masteredStudyLessons} atividade(s)
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  {activeLevel.examReady || activeLevel.examPassed ? (
                    <button
                      type="button"
                      onClick={() => {
                        void hapticTap();
                        playTapSound();
                        onStartLesson(activeLevel.examLesson!);
                      }}
                      className={`${
                        activeLevel.examPassed ? 'duo-btn-emerald' : 'duo-btn-wine'
                      } flex-1 text-sm uppercase tracking-wide flex items-center justify-center gap-2`}
                    >
                      <GraduationCap size={19} weight="fill" />
                      {activeLevel.examPassed
                        ? 'REFAZER PROVA PARA TREINAR'
                        : activeLevel.nextCefr
                          ? `FAZER PROVA ${activeLevel.cefr} → ${activeLevel.nextCefr}`
                          : `FAZER EXAME FINAL ${activeLevel.cefr}`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void hapticTap();
                        playTapSound();
                        if (nextLesson && !nextLesson.isLevelExam) {
                          onStartLesson(nextLesson);
                        }
                      }}
                      className="duo-btn-teal flex-1 text-sm uppercase tracking-wide flex items-center justify-center gap-2"
                    >
                      <Play size={18} weight="fill" />
                      ESTUDAR PRÓXIMA ATIVIDADE DO {activeLevel.cefr}
                    </button>
                  )}

                  {activeLevel.examPassed && activeLevel.nextCefr && (
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setSelectedCefr(activeLevel.nextCefr!);
                      }}
                      className="duo-btn-teal px-5 text-sm uppercase tracking-wide"
                    >
                      IR PARA O {activeLevel.nextCefr} →
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* PAINEL LATERAL DIREITO (DESKTOP) */}
      <aside className="hidden lg:flex lg:flex-col w-80 shrink-0 sticky top-6 space-y-4">
        {/* Card Meu Bichinho */}
        <div className="duo-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-[var(--na-ink)]">Meu Bichinho</h3>
            <span className="text-xs font-extrabold text-[var(--na-burgundy)] inline-flex items-center gap-1">
              <Heart size={15} weight="fill" /> {pet.happiness}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PetSprite species={pet.species} mood={petPathMood} size={74} />
            <div className="flex-1 space-y-1.5">
              <div className="text-sm font-extrabold text-[var(--na-ink)]">{pet.name}</div>
              <div className="h-3.5 rounded-full bg-[var(--na-sand)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[var(--na-success)] transition-all duration-500"
                  style={{ width: `${pet.happiness}%` }}
                />
              </div>
              <div className="text-[11px] font-bold text-[var(--na-muted)]">
                Acerte atividades para deixá-lo super feliz!
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onOpenPetPicker();
            }}
            className="duo-btn-gold w-full min-h-[44px] text-xs uppercase tracking-wide"
          >
            FAZER CARINHO / TROCAR BICHINHO
          </button>
        </div>

        {/* Card Lembretes Diários Motivacionais com o Dino */}
        <ReminderCard petName={pet.name} compact />

        {/* Card Foco Diário */}
        <div className="duo-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-[var(--na-ink)]">Foco de hoje</h3>
            <span className="text-xs font-extrabold text-[var(--na-flame)] inline-flex items-center gap-1">
              <Fire size={16} weight="fill" /> {user.streakDays}d no ritmo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PuzzleMascot mood={dailyPct >= 100 ? 'celebrate' : 'happy'} size={62} />
            <div className="flex-1 space-y-1.5">
              <div className="text-xs font-extrabold text-[var(--na-ink)]">
                Junte {dailyGoalXp} Peças 🧩 hoje!
              </div>
              <div className="h-4 rounded-full bg-[var(--na-sand)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[var(--na-gold)] transition-all duration-500"
                  style={{ width: `${Math.max(12, dailyPct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card Letras / Sons */}
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

        {/* Card Conversa com IA */}
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

      {/* MODAL DO GUIA DA ETAPA */}
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
                  Nível {guideUnit.cefr} · Guia da Etapa
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

            {guideUnit.grammarFocusPt && (
              <div className="p-3.5 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] text-xs font-extrabold text-[var(--na-teal-dark)]">
                📚 Foco desta etapa: {guideUnit.grammarFocusPt}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[var(--na-gold-soft)] border-2 border-[var(--na-gold)] text-sm font-semibold text-[#5a3b00] leading-relaxed">
              💡 <strong>Dica do {pet.name}: </strong>
              {guideUnit.culturalNotePt}
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                Aula da Etapa — Frases, pronúncia e dicas reais (toque para ouvir normal ou devagar!):
              </div>
              {guideUnit.lessons
                .flatMap((l) => l.exercises.filter((e) => e.type !== 'match_pairs'))
                .map((ex) => (
                  <div
                    key={ex.id}
                    className="w-full p-3.5 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold text-base text-[var(--na-ink)]">
                          {ex.targetText}
                        </div>
                        {ex.reading && (
                          <div className="font-mono-code text-xs font-bold text-[var(--na-teal)]">
                            {ex.reading}
                          </div>
                        )}
                        {ex.ipaOrPhoneticBr && (
                          <div className="text-[11px] font-bold text-[var(--na-burgundy)]">
                            Como ler: {ex.ipaOrPhoneticBr}
                          </div>
                        )}
                        <div className="text-xs font-semibold text-[var(--na-muted)]">
                          {ex.translationPt}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            playTapSound();
                            speakText(ex.targetText, user.activeLanguage, 0.92);
                          }}
                          aria-label="Ouvir normal"
                          className="w-9 h-9 rounded-xl bg-[var(--na-teal)] text-white flex items-center justify-center"
                        >
                          <SpeakerHigh size={17} weight="fill" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playTapSound();
                            speakText(ex.targetText, user.activeLanguage, 0.65);
                          }}
                          aria-label="Ouvir devagar"
                          className="w-9 h-9 rounded-xl bg-white border-2 border-[var(--na-border)] text-sm flex items-center justify-center"
                        >
                          🐢
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--na-ink)]/85 bg-white/80 px-2.5 py-1.5 rounded-xl border border-[var(--na-border)]">
                      💡 {ex.brazilianTipPt}
                    </div>
                  </div>
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
