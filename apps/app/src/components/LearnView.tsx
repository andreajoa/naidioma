import { motion } from 'motion/react';
import {
  BookOpenText,
  CheckCircle,
  Clock,
  Fire,
  Microphone,
  Play,
  Sparkle,
  Star,
} from '@phosphor-icons/react';
import { LANGUAGE_LIST, type LanguageCode, type Lesson } from '@naidioma/shared';
import type { CourseDetailResponse, UserProfile } from '../lib/api';
import { hapticTap } from '../lib/native';

interface LearnViewProps {
  user: UserProfile;
  courseDetail: CourseDetailResponse | null;
  loading: boolean;
  onSelectLanguage: (lang: LanguageCode) => void;
  onStartLesson: (lesson: Lesson) => void;
  onGoToConversation: () => void;
  onGoToReview: () => void;
}

const SKILL_LABELS: Array<{ key: keyof CourseDetailResponse['progress']['skills']; label: string }> = [
  { key: 'speaking', label: 'Fala' },
  { key: 'listening', label: 'Escuta' },
  { key: 'reading', label: 'Leitura' },
  { key: 'writing', label: 'Escrita' },
  { key: 'vocabulary', label: 'Vocabulário' },
];

export function LearnView({
  user,
  courseDetail,
  loading,
  onSelectLanguage,
  onStartLesson,
  onGoToConversation,
  onGoToReview,
}: LearnViewProps) {
  const course = courseDetail?.course;
  const completedMap = courseDetail?.progress.completedLessons ?? {};
  const skills = courseDetail?.progress.skills ?? {
    speaking: 10,
    listening: 10,
    reading: 10,
    writing: 10,
    vocabulary: 10,
  };

  // Pick next uncompleted lesson (or first lesson if all completed)
  const allLessons: Lesson[] = course?.units.flatMap((u) => u.lessons) ?? [];
  const nextLesson =
    allLessons.find((lesson) => !completedMap[lesson.id]) ?? allLessons[0] ?? null;

  return (
    <div className="space-y-6 pb-8">
      {/* Horizontal 8-language pill switcher */}
      <section aria-label="Escolher idioma">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--na-muted)]">
            Seus 8 idiomas disponíveis
          </h2>
          <span className="text-xs font-semibold text-[var(--na-teal)]">
            Troque a qualquer momento
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {LANGUAGE_LIST.map((lang) => {
            const active = user.activeLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  void hapticTap();
                  onSelectLanguage(lang.code);
                }}
                className={`snap-start shrink-0 min-h-[46px] px-4 rounded-full border text-sm font-bold flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)] shadow-xs'
                    : 'bg-[var(--na-ivory)] text-[var(--na-ink)] border-[var(--na-border)] hover:border-[var(--na-gold)]'
                }`}
              >
                <span className="font-mono-code text-xs opacity-75">{lang.isoBadge}</span>
                <span>{lang.code === 'en' ? 'Inglês BR' : lang.namePt.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Loading skeleton */}
      {loading || !course ? (
        <div className="space-y-4">
          <div className="h-44 rounded-[18px] bg-[var(--na-sand)] animate-pulse" />
          <div className="h-32 rounded-[16px] bg-[var(--na-sand)] animate-pulse" />
        </div>
      ) : (
        <>
          {/* Hero 1-tap Next Action Card */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] bg-[var(--na-wine)] text-[var(--na-ivory)] p-6 sm:p-7 border border-[var(--na-wine-deep)] relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2.5 max-w-xl">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e9d1c0]">
                  <Sparkle size={14} weight="fill" />
                  {course.meta.namePt} · {course.meta.nativeName}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl leading-[1.08] font-normal">
                  {nextLesson ? nextLesson.titlePt : 'Continue praticando hoje'}
                </h1>
                <p className="text-sm text-[#e8d9d0] leading-relaxed">
                  {course.meta.brazilianFocusNote}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                {nextLesson && (
                  <button
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      onStartLesson(nextLesson);
                    }}
                    className="min-h-[52px] px-6 rounded-[14px] bg-[var(--na-cream)] text-[var(--na-wine-deep)] font-bold text-sm flex items-center justify-center gap-2 border-b-4 border-[var(--na-gold)] active:translate-y-[2px] transition-all"
                  >
                    <Play size={18} weight="fill" />
                    Iniciar lição ({nextLesson.durationMinutes} min)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    onGoToConversation();
                  }}
                  className="min-h-[46px] px-5 rounded-[14px] bg-white/10 hover:bg-white/15 text-[var(--na-ivory)] font-semibold text-sm flex items-center justify-center gap-2 border border-white/20"
                >
                  <Microphone size={18} weight="duotone" />
                  Treinar fala com IA
                </button>
              </div>
            </div>
          </motion.section>

          {/* Quick Status Strip (Streak + FSRS due + Goal) */}
          <section className="grid grid-cols-3 gap-3">
            <div className="surface-card p-3.5 sm:p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[var(--na-sand)] text-[var(--na-burgundy)] flex items-center justify-center shrink-0">
                <Fire size={22} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-none">{user.streakDays}d</div>
                <div className="text-[11px] text-[var(--na-muted)] truncate mt-0.5">Ofensiva</div>
              </div>
            </div>

            <div className="surface-card p-3.5 sm:p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[var(--na-sand)] text-[var(--na-gold)] flex items-center justify-center shrink-0">
                <Star size={22} weight="fill" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-none">{user.xpTotal}</div>
                <div className="text-[11px] text-[var(--na-muted)] truncate mt-0.5">XP total</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void hapticTap();
                onGoToReview();
              }}
              className="surface-card p-3.5 sm:p-4 flex items-center gap-3 text-left hover:border-[var(--na-teal)] transition-colors"
            >
              <div className="w-10 h-10 rounded-[12px] bg-[var(--na-teal)]/12 text-[var(--na-teal)] flex items-center justify-center shrink-0">
                <BookOpenText size={22} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-none">
                  {courseDetail.progress.dueReviewsCount}
                </div>
                <div className="text-[11px] text-[var(--na-muted)] truncate mt-0.5">
                  Revisão FSRS
                </div>
              </div>
            </button>
          </section>

          {/* Editorial Units & Lessons Path */}
          <section className="space-y-6">
            {course.units.map((unit) => (
              <div key={unit.id} className="surface-card overflow-hidden">
                <div className="p-5 sm:p-6 bg-[var(--na-sand)]/65 border-b border-[var(--na-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-code text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--na-ivory)] border border-[var(--na-border)] text-[var(--na-burgundy)]">
                      Unidade {unit.order} · Nível {unit.cefr}
                    </span>
                    <span className="text-xs font-semibold text-[var(--na-muted)]">
                      {unit.lessons.filter((l) => Boolean(completedMap[l.id])).length}/
                      {unit.lessons.length} concluídas
                    </span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl text-[var(--na-ink)] mt-2.5">
                    {unit.titlePt}
                  </h2>
                  <p className="text-sm text-[var(--na-muted)] mt-1 leading-relaxed">
                    {unit.descriptionPt}
                  </p>
                  <div className="mt-3 p-3 rounded-[12px] bg-[var(--na-ivory)] border border-[var(--na-border)] text-xs text-[var(--na-ink)] leading-relaxed">
                    <strong className="text-[var(--na-teal)]">Dica cultural BR: </strong>
                    {unit.culturalNotePt}
                  </div>
                </div>

                <div className="divide-y divide-[var(--na-border)]">
                  {unit.lessons.map((lesson) => {
                    const done = completedMap[lesson.id];
                    return (
                      <div
                        key={lesson.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--na-cream)]/60 transition-colors"
                      >
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 font-bold text-sm border ${
                              done
                                ? 'bg-[var(--na-success-soft)] text-[var(--na-success)] border-[var(--na-success)]/30'
                                : 'bg-[var(--na-cream)] text-[var(--na-burgundy)] border-[var(--na-border)]'
                            }`}
                          >
                            {done ? (
                              <CheckCircle size={22} weight="fill" />
                            ) : (
                              <span>{lesson.order}</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-[var(--na-ink)] leading-snug">
                              {lesson.titlePt}
                            </h3>
                            <p className="text-xs text-[var(--na-muted)] mt-0.5">
                              {lesson.subtitlePt}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-semibold text-[var(--na-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <Clock size={13} /> {lesson.durationMinutes} min
                              </span>
                              <span>+{lesson.xpReward} XP</span>
                              <span>{lesson.exercises.length} desafios</span>
                              {done && (
                                <span className="text-[var(--na-success)]">
                                  Melhor precisão: {done.bestAccuracy}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void hapticTap();
                            onStartLesson(lesson);
                          }}
                          className={`shrink-0 px-5 ${
                            done ? 'btn-tactile-secondary' : 'btn-tactile-primary'
                          } text-sm flex items-center justify-center gap-2`}
                        >
                          <Play size={16} weight="fill" />
                          {done ? 'Praticar de novo' : 'Começar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* 5-Dimension Mastery Card */}
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-2xl text-[var(--na-ink)]">
                  Maestria em {course.meta.namePt}
                </h2>
                <p className="text-xs text-[var(--na-muted)]">
                  Evolui automaticamente a cada lição e treino de voz
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
              {SKILL_LABELS.map((item) => {
                const value = skills[item.key];
                return (
                  <div key={item.key} className="p-3 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)]">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span>{item.label}</span>
                      <span className="text-[var(--na-burgundy)]">{value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--na-sand-dark)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--na-burgundy)] transition-all duration-500"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
