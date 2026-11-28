import { useState } from 'react';
import { formatShortDateBr } from './formatters';

interface TimelinePoint {
  date: string;
  sessions: number;
  uniqueVisitors: number;
  signups: number;
  lessons: number;
  minutes: number;
}

export function TimelineChart({ data }: { data: TimelinePoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-xs text-[var(--na-muted)]">
        Sem dados no período selecionado.
      </div>
    );
  }

  const width = 680;
  const height = 220;
  const padL = 34;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxPrimary = Math.max(
    4,
    ...data.map((d) => Math.max(d.sessions, d.lessons, d.signups)),
  );
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const sessionPoints = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + chartH - (d.sessions / maxPrimary) * chartH;
    return { x, y, d };
  });

  const lessonPoints = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + chartH - (d.lessons / maxPrimary) * chartH;
    return { x, y, d };
  });

  const sessionPath = sessionPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const sessionArea = `${sessionPath} L ${sessionPoints[sessionPoints.length - 1]!.x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${padL} ${(padT + chartH).toFixed(1)} Z`;

  const lessonPath = lessonPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;
  const tickIndices =
    data.length <= 7
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5), Math.floor(data.length * 0.75), data.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[var(--na-wine)]">
            <span className="w-3 h-1.5 bg-[#9A1B45] inline-block" /> Acessos (sessões)
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--na-teal-dark)]">
            <span className="w-3 h-1.5 bg-[#1496B0] inline-block" /> Lições concluídas
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#1D8A45]">
            <span className="w-2.5 h-2.5 bg-[#2CB65E] inline-block" /> Novos cadastros
          </span>
        </div>
        {hovered && (
          <div className="font-mono-code text-[11px] bg-[#FFF6E9] border border-[#E5D8C8] px-2.5 py-1 text-[#1E1A1D]">
            <strong>{formatShortDateBr(hovered.date)}</strong> · {hovered.sessions} sessões ·{' '}
            {hovered.signups} cadastros · {hovered.lessons} lições · {hovered.minutes} min
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-56 select-none"
        role="img"
        aria-label="Evolução diária de acessos, cadastros e lições"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padT + chartH * (1 - ratio);
          const labelVal = Math.round(maxPrimary * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#EFE5D8"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="#7A7278"
                fontFamily="JetBrains Mono, monospace"
              >
                {labelVal}
              </text>
            </g>
          );
        })}

        {/* Area under sessions */}
        <path d={sessionArea} fill="#9A1B45" opacity="0.10" />

        {/* Signups vertical bars */}
        {data.map((d, i) => {
          if (d.signups <= 0) return null;
          const barW = Math.max(4, Math.min(12, chartW / Math.max(data.length, 10) - 3));
          const x = padL + i * stepX - barW / 2;
          const barH = Math.max(3, (d.signups / maxPrimary) * chartH);
          return (
            <rect
              key={`signup-${d.date}`}
              x={x}
              y={padT + chartH - barH}
              width={barW}
              height={barH}
              fill="#2CB65E"
              opacity="0.72"
            />
          );
        })}

        {/* Lessons line */}
        <path
          d={lessonPath}
          fill="none"
          stroke="#1496B0"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Sessions line */}
        <path
          d={sessionPath}
          fill="none"
          stroke="#9A1B45"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        {/* Interactive hover hit zones */}
        {sessionPoints.map((p, i) => (
          <g key={p.d.date} onMouseEnter={() => setHoveredIdx(i)}>
            {hoveredIdx === i && (
              <line
                x1={p.x}
                x2={p.x}
                y1={padT}
                y2={padT + chartH}
                stroke="#9A1B45"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 4.5 : 2.2}
              fill="#9A1B45"
            />
            <rect
              x={p.x - Math.max(8, stepX / 2)}
              y={padT}
              width={Math.max(16, stepX)}
              height={chartH}
              fill="transparent"
            />
          </g>
        ))}

        {/* X axis ticks */}
        {tickIndices.map((idx) => {
          const pt = sessionPoints[idx];
          if (!pt) return null;
          return (
            <text
              key={`tick-${idx}`}
              x={pt.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#7A7278"
              fontFamily="JetBrains Mono, monospace"
            >
              {formatShortDateBr(pt.d.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function HourlyBarChart({
  data,
}: {
  data: Array<{ hour: number; sessions: number; minutes: number }>;
}) {
  const maxVal = Math.max(1, ...data.map((d) => d.sessions));
  const peak = data.reduce((best, cur) => (cur.sessions > best.sessions ? cur : best), data[0]!);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--na-muted)] font-semibold">Horário de Brasília (UTC-3)</span>
        {peak && peak.sessions > 0 && (
          <span className="font-mono-code text-[11px] font-bold px-2 py-0.5 bg-[#FFF0E6] text-[#A83A08] border border-[#F26522]/40">
            Pico: {String(peak.hour).padStart(2, '0')}h ({peak.sessions} acessos)
          </span>
        )}
      </div>

      <div className="grid grid-cols-24 gap-1 items-end h-28 pt-2">
        {data.map((slot) => {
          const pct = Math.max(slot.sessions > 0 ? 10 : 3, Math.round((slot.sessions / maxVal) * 100));
          const isPeak = peak && slot.hour === peak.hour && slot.sessions > 0;
          return (
            <div
              key={slot.hour}
              className="flex flex-col items-center justify-end h-full group relative"
              title={`${String(slot.hour).padStart(2, '0')}h: ${slot.sessions} sessões · ${slot.minutes} min`}
            >
              <div
                className="w-full transition-all"
                style={{
                  height: `${pct}%`,
                  backgroundColor: isPeak
                    ? '#C12B5B'
                    : slot.sessions > 0
                      ? '#1496B0'
                      : '#EAE0D2',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between font-mono-code text-[10px] text-[var(--na-muted)]">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

export function HorizontalRankBars({
  items,
  color = '#9A1B45',
  emptyText = 'Sem dados registrados ainda.',
}: {
  items: Array<{ label: string; value: number; sublabel?: string; badge?: string }>;
  color?: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <div className="text-xs text-[var(--na-muted)] py-4">{emptyText}</div>;
  }

  const maxVal = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.max(item.value > 0 ? 4 : 0, Math.round((item.value / maxVal) * 100));
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#1E1A1D] truncate">{item.label}</span>
              <span className="font-mono-code font-bold text-[#1E1A1D] shrink-0">
                {item.badge ?? item.value}
                {item.sublabel && (
                  <span className="text-[11px] font-normal text-[var(--na-muted)] ml-1.5">
                    {item.sublabel}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 bg-[#F2E9DD] w-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FunnelChart({
  steps,
}: {
  steps: Array<{ step: string; count: number; pct: number }>;
}) {
  return (
    <div className="space-y-2.5">
      {steps.map((s, idx) => {
        const prev = idx > 0 ? steps[idx - 1] : null;
        const stepDrop =
          prev && prev.count > 0 ? Math.round(((prev.count - s.count) / prev.count) * 100) : null;
        const barColors = ['#9A1B45', '#B62453', '#C12B5B', '#1496B0', '#1EA4BE', '#2CB65E', '#1D8A45'];
        const barColor = barColors[idx % barColors.length]!;

        return (
          <div key={s.step} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#1E1A1D]">
                <span className="font-mono-code text-[var(--na-muted)] mr-1.5">{idx + 1}.</span>
                {s.step}
              </span>
              <div className="flex items-center gap-2 font-mono-code shrink-0">
                <span className="font-extrabold text-[#1E1A1D]">{s.count}</span>
                <span className="text-[11px] text-[var(--na-muted)]">({s.pct}%)</span>
                {stepDrop !== null && stepDrop > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#FFECEB] text-[#B02B22] font-bold">
                    -{stepDrop}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2.5 bg-[#F2E9DD] w-full">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${Math.max(s.count > 0 ? 3 : 0, s.pct)}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
