import { useEffect, useState } from 'react';
import {
  Clock,
  DeviceMobile,
  EnvelopeSimple,
  Fire,
  GlobeHemisphereWest,
  GraduationCap,
  MapPin,
  WhatsappLogo,
  X,
} from '@phosphor-icons/react';
import { api, type AdminUserDetailResponse } from '../../lib/api';
import {
  CEFR_BADGE_STYLES,
  EVENT_LABEL_PT,
  SCREEN_LABEL_PT,
  formatDateTimeBr,
  formatDuration,
  formatRelativeBr,
} from './formatters';

interface UserDossierDrawerProps {
  adminToken: string;
  userId: string;
  onClose: () => void;
}

export function UserDossierDrawer({ adminToken, userId, onClose }: UserDossierDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminUserDetailResponse | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void api
      .adminGetDashboardUserDetail(adminToken, userId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Erro ao carregar perfil.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adminToken, userId]);

  const p = data?.profile;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45">
      <button
        type="button"
        aria-label="Fechar painel lateral"
        className="fixed inset-0 w-full h-full bg-transparent border-0 cursor-default"
        onClick={onClose}
      />
      <aside
        aria-label="Dossiê completo do perfil"
        className="relative z-10 w-full max-w-2xl bg-[#FFFDF9] border-l-2 border-[#E5D8C8] h-full overflow-y-auto p-6 space-y-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5D8C8]">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9A1B45]">
              Dossiê Individual do Perfil
            </div>
            <h2 className="font-display text-2xl text-[#1E1A1D] mt-1">
              {p?.displayName ?? 'Carregando...'}
            </h2>
            {p && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--na-muted)] mt-1">
                <span className="inline-flex items-center gap-1 font-mono-code">
                  <EnvelopeSimple size={14} weight="bold" /> {p.email}
                </span>
                {p.whatsapp && (
                  <span className="inline-flex items-center gap-1 font-mono-code">
                    <WhatsappLogo size={14} weight="bold" /> {p.whatsapp}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar dossiê"
            className="w-10 h-10 border border-[#E5D8C8] bg-white hover:bg-[#F7EFE4] flex items-center justify-center text-[#1E1A1D] shrink-0"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center text-sm font-semibold text-[var(--na-muted)]">
            Carregando histórico completo do perfil...
          </div>
        )}

        {error && (
          <div className="p-4 border border-[#E04338] bg-[#FFECEB] text-xs font-bold text-[#B02B22]">
            {error}
          </div>
        )}

        {data && p && (
          <>
            {/* Top summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 bg-white border border-[#E5D8C8]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                  Tempo no App
                </div>
                <div className="font-mono-code text-xl font-extrabold text-[#9A1B45] mt-1">
                  {formatDuration(p.totalTimeSeconds)}
                </div>
                <div className="text-[11px] text-[var(--na-muted)]">
                  {p.sessionsCount} sessões (méd. {formatDuration(p.avgSessionSeconds)})
                </div>
              </div>

              <div className="p-3.5 bg-white border border-[#E5D8C8]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                  Nível Atual
                </div>
                <div className="font-mono-code text-xl font-extrabold text-[#1496B0] mt-1">
                  {p.activeCefr} · {p.activeLevelProgressPct}%
                </div>
                <div className="text-[11px] text-[var(--na-muted)]">{p.activeLanguageNamePt}</div>
              </div>

              <div className="p-3.5 bg-white border border-[#E5D8C8]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                  Lições &amp; Precisão
                </div>
                <div className="font-mono-code text-xl font-extrabold text-[#1D8A45] mt-1">
                  {p.lessonsCompleted}
                </div>
                <div className="text-[11px] text-[var(--na-muted)]">
                  Média {p.averageAccuracy}% · {p.examsPassed} exame(s)
                </div>
              </div>

              <div className="p-3.5 bg-white border border-[#E5D8C8]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
                  Ofensiva &amp; IA
                </div>
                <div className="font-mono-code text-xl font-extrabold text-[#C98A00] mt-1 flex items-center gap-1">
                  <Fire size={18} weight="fill" className="text-[#F26522]" /> {p.streakDays}d
                </div>
                <div className="text-[11px] text-[var(--na-muted)]">
                  {p.aiTurnsTotal} turnos IA · {p.xpTotal} XP
                </div>
              </div>
            </div>

            {/* Location & Device metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white border border-[#E5D8C8] text-xs">
              <div className="space-y-1.5">
                <div className="font-extrabold uppercase tracking-wider text-[10px] text-[var(--na-muted)] flex items-center gap-1">
                  <MapPin size={13} weight="bold" /> Localização &amp; Origem
                </div>
                <div className="font-bold text-[#1E1A1D]">{p.locationLabel}</div>
                <div className="text-[var(--na-muted)]">
                  Fonte: {p.locationSource ?? 'automática'} · Origem:{' '}
                  <span className="font-mono-code">{p.leadSource}</span>
                  {p.utmCampaign ? ` (${p.utmCampaign})` : ''}
                </div>
                <div className="text-[var(--na-muted)]">
                  Cadastro: {formatDateTimeBr(p.createdAt)} · Último acesso:{' '}
                  <strong>{formatRelativeBr(p.lastActiveAt)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-extrabold uppercase tracking-wider text-[10px] text-[var(--na-muted)] flex items-center gap-1">
                  <DeviceMobile size={13} weight="bold" /> Dispositivo &amp; Acessibilidade
                </div>
                <div className="font-bold text-[#1E1A1D]">
                  {(p.lastPlatform ?? 'web').toUpperCase()} · {p.lastDeviceType ?? '—'} ·{' '}
                  {p.lastOs ?? '—'} ({p.lastBrowser ?? '—'})
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 border border-[#E5D8C8] bg-[#FFFBF5] font-bold">
                    PWA: {p.pwaInstalled ? 'Instalado' : 'Navegador'}
                  </span>
                  <span className="px-2 py-0.5 border border-[#E5D8C8] bg-[#FFFBF5] font-bold">
                    Modo Calmo: {p.calmModeEnabled ? 'ON' : 'OFF'}
                  </span>
                  <span className="px-2 py-0.5 border border-[#E5D8C8] bg-[#FFFBF5] font-bold">
                    Meta: {p.dailyGoalMinutes} min/dia
                  </span>
                </div>
              </div>
            </div>

            {/* Languages Studied & CEFR levels */}
            <section className="space-y-2.5">
              <h3 className="font-display text-base text-[#1E1A1D] flex items-center gap-2">
                <GlobeHemisphereWest size={18} weight="bold" className="text-[#1496B0]" />
                Idiomas Estudados &amp; Nível CEFR
              </h3>
              <div className="space-y-2">
                {p.languagesStudied.map((lang) => {
                  const badge = CEFR_BADGE_STYLES[lang.currentCefr] ?? CEFR_BADGE_STYLES.A1!;
                  const skill = data.skillsByLanguage.find((s) => s.language === lang.language);
                  return (
                    <div
                      key={lang.language}
                      className="p-4 bg-white border border-[#E5D8C8] space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#1E1A1D]">
                            {lang.languageNamePt}
                          </span>
                          {lang.isActive && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-[#9A1B45] text-white">
                              Idioma Ativo
                            </span>
                          )}
                          <span
                            className="font-mono-code text-[11px] font-extrabold px-2 py-0.5 border"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            Nível {lang.currentCefr} ({lang.levelProgressPct}%)
                          </span>
                        </div>
                        <span className="font-mono-code text-xs text-[var(--na-muted)]">
                          {lang.completedLessons}/{lang.totalCourseLessons} lições · precisão{' '}
                          {lang.averageAccuracy}% · {formatDuration(lang.studySeconds)}
                        </span>
                      </div>

                      <div className="h-2 bg-[#F2E9DD] w-full">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(lang.levelProgressPct, lang.completedLessons > 0 ? 5 : 0)}%`,
                            backgroundColor: badge.border,
                          }}
                        />
                      </div>

                      {skill && (
                        <div className="grid grid-cols-5 gap-2 pt-1 text-[11px]">
                          {[
                            ['Fala', skill.speaking],
                            ['Escuta', skill.listening],
                            ['Leitura', skill.reading],
                            ['Escrita', skill.writing],
                            ['Vocab.', skill.vocabulary],
                          ].map(([label, val]) => (
                            <div key={String(label)} className="bg-[#FFFBF5] border border-[#EFE5D8] p-1.5 text-center">
                              <div className="text-[10px] text-[var(--na-muted)] font-bold">{label}</div>
                              <div className="font-mono-code font-extrabold text-[#1E1A1D]">{val}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Time by screen */}
            {Object.keys(data.screenTimeSeconds).length > 0 && (
              <section className="space-y-2.5">
                <h3 className="font-display text-base text-[#1E1A1D] flex items-center gap-2">
                  <Clock size={18} weight="bold" className="text-[#9A1B45]" />
                  Tempo de Uso por Área do App
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(data.screenTimeSeconds)
                    .sort((a, b) => b[1] - a[1])
                    .map(([screen, secs]) => (
                      <div key={screen} className="p-3 bg-white border border-[#E5D8C8]">
                        <div className="text-[11px] font-bold text-[var(--na-muted)]">
                          {SCREEN_LABEL_PT[screen] ?? screen}
                        </div>
                        <div className="font-mono-code text-base font-extrabold text-[#1E1A1D] mt-0.5">
                          {formatDuration(secs)}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Recent lessons */}
            <section className="space-y-2.5">
              <h3 className="font-display text-base text-[#1E1A1D] flex items-center gap-2">
                <GraduationCap size={18} weight="bold" className="text-[#1D8A45]" />
                Lições Recentes ({data.recentLessons.length})
              </h3>
              {data.recentLessons.length === 0 ? (
                <div className="p-4 bg-white border border-[#E5D8C8] text-xs text-[var(--na-muted)]">
                  Este perfil ainda não concluiu nenhuma lição.
                </div>
              ) : (
                <div className="border border-[#E5D8C8] bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5D8C8] bg-[#FAF4EC] text-[10px] uppercase text-[var(--na-muted)]">
                        <th className="py-2 px-3">Lição</th>
                        <th className="py-2 px-2">Nível</th>
                        <th className="py-2 px-2">Precisão</th>
                        <th className="py-2 px-2">Tempo</th>
                        <th className="py-2 px-3">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE5D8]">
                      {data.recentLessons.slice(0, 15).map((l) => (
                        <tr key={l.lessonId}>
                          <td className="py-2 px-3 font-semibold text-[#1E1A1D]">
                            {l.titlePt}
                            <span className="ml-1.5 text-[10px] font-mono-code uppercase text-[var(--na-muted)]">
                              {l.language}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono-code font-bold">{l.cefr}</td>
                          <td className="py-2 px-2 font-mono-code font-bold">
                            <span
                              className={
                                l.bestAccuracy < 70
                                  ? 'text-[#B02B22]'
                                  : l.bestAccuracy >= 90
                                    ? 'text-[#1D8A45]'
                                    : 'text-[#1E1A1D]'
                              }
                            >
                              {l.bestAccuracy}%
                            </span>
                            {l.completedCount > 1 && (
                              <span className="text-[10px] text-[var(--na-muted)] ml-1">
                                ({l.completedCount}x)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 font-mono-code">
                            {formatDuration(l.totalDurationSeconds)}
                          </td>
                          <td className="py-2 px-3 font-mono-code text-[11px] text-[var(--na-muted)]">
                            {formatDateTimeBr(l.completedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent sessions */}
            <section className="space-y-2.5">
              <h3 className="font-display text-base text-[#1E1A1D]">
                Histórico de Sessões ({data.recentSessions.length})
              </h3>
              {data.recentSessions.length === 0 ? (
                <div className="p-4 bg-white border border-[#E5D8C8] text-xs text-[var(--na-muted)]">
                  Sem sessões registradas após ativação da telemetria.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data.recentSessions.slice(0, 12).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-white border border-[#E5D8C8] flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono-code font-bold text-[#1E1A1D]">
                          {formatDateTimeBr(s.startedAt)}
                        </span>
                        <span className="mx-2 text-[#D5C6B4]">|</span>
                        <span className="font-semibold text-[#1496B0]">{s.locationLabel}</span>
                        <span className="mx-2 text-[#D5C6B4]">|</span>
                        <span className="text-[var(--na-muted)]">
                          {s.platform} · {s.os ?? '—'} · {s.browser ?? '—'} · entrada{' '}
                          <code className="font-mono-code">{s.entryPath}</code>
                        </span>
                      </div>
                      <span className="font-mono-code font-extrabold text-[#9A1B45]">
                        {formatDuration(s.durationSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent events */}
            {data.recentEvents.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-display text-base text-[#1E1A1D]">Eventos Recentes</h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.recentEvents.slice(0, 18).map((ev) => (
                    <span
                      key={ev.id}
                      className="text-[11px] px-2.5 py-1 bg-white border border-[#E5D8C8] text-[#1E1A1D]"
                    >
                      <strong>{EVENT_LABEL_PT[ev.eventType] ?? ev.eventType}</strong>
                      {ev.language ? ` (${ev.language.toUpperCase()})` : ''}
                      {ev.valueNum !== null ? ` · ${ev.valueNum}` : ''}
                      <span className="text-[var(--na-muted)] ml-1 font-mono-code">
                        {formatRelativeBr(ev.createdAt)}
                      </span>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
