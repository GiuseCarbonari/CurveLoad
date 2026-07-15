"use client";

import { useState } from "react";

import type { EfficiencyTrend } from "@/lib/efficiency-trend";

const LINE_COLOR = "#6EA2FF"; // riuso di CHART_COLORS.ctl (condition-trend-chart.tsx)

const GRID_COLOR = "color-mix(in srgb, var(--foreground) 10%, transparent)";
const AXIS_COLOR = "color-mix(in srgb, var(--foreground) 16%, transparent)";

const BADGE_CLASS: Record<EfficiencyTrend["interpretation"], string> = {
  "in miglioramento": "text-ready-go",
  stabile: "text-secondary",
  "in calo": "text-ready-modify",
  "dati insufficienti": "text-secondary",
};

function toY(value: number, min: number, max: number) {
  if (max === min) return 72;
  return 124 - ((value - min) / (max - min)) * 98;
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  return points
    .map((point, index) => {
      if (index === 0) return `M${point.x},${point.y}`;
      const previous = points[index - 1];
      const next = points[index + 1] ?? point;
      const beforePrevious = points[index - 2] ?? previous;
      const cp1x = previous.x + (point.x - beforePrevious.x) / 6;
      const cp1y = previous.y + (point.y - beforePrevious.y) / 6;
      const cp2x = point.x - (next.x - previous.x) / 6;
      const cp2y = point.y - (next.y - previous.y) / 6;
      return `C${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
    })
    .join(" ");
}

export function EfficiencyTrendChart({ trend }: { trend: EfficiencyTrend }) {
  const points = trend.points;
  const [selected, setSelected] = useState(Math.max(0, points.length - 1));

  if (trend.interpretation === "dati insufficienti" || points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.efficiency);
  const min = Math.min(...values) - 0.05;
  const max = Math.max(...values) + 0.05;
  const xs = points.map((_, index) => 20 + (index * 300) / (points.length - 1));
  const linePoints = points.map((point, index) => ({
    x: xs[index],
    y: toY(point.efficiency, min, max),
  }));
  const selectedPoint = points[selected] ?? points.at(-1)!;
  const selectedX = xs[selected] ?? xs.at(-1)!;
  const selectedY = linePoints[selected]?.y ?? linePoints.at(-1)!.y;

  return (
    <section className="aurora-glass rounded-[28px] border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-accent2">
            Efficienza aerobica · {points.length} wk
          </p>
          <h2 className="font-display mt-1 text-[21px] font-semibold leading-tight text-foreground">
            Watt per battito
          </h2>
        </div>
        <span className="font-body hidden text-[10px] text-faint sm:inline">
          passa o tocca per esplorare
        </span>
      </div>

      <div className="relative">
        <div
          className="absolute top-2 z-10 -translate-x-1/2 rounded-full border border-border bg-surface/95 px-2.5 py-1 shadow-lg backdrop-blur-xl"
          style={{ left: `${(selectedX / 340) * 100}%` }}
        >
          <div className="font-display flex items-center gap-2 text-[13px] font-semibold leading-none tabular-nums">
            <span style={{ color: LINE_COLOR }}>{selectedPoint.efficiency.toFixed(2)} W/bpm</span>
          </div>
        </div>

        <svg viewBox="0 0 340 150" className="mt-3 block w-full">
          <defs>
            <linearGradient id="auroraEfficiencyArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.26" />
              <stop offset="55%" stopColor={LINE_COLOR} stopOpacity="0.08" />
              <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="20" y1="130" x2="320" y2="130" stroke={AXIS_COLOR} />
          {[40, 80, 120].map((y) => (
            <line key={y} x1="20" y1={y} x2="320" y2={y} stroke={GRID_COLOR} />
          ))}
          <path
            d={`${smoothPath(linePoints)} L320,130 L20,130 Z`}
            fill="url(#auroraEfficiencyArea)"
          />
          <path
            d={smoothPath(linePoints)}
            fill="none"
            stroke={LINE_COLOR}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.8"
          />
          <line
            x1={selectedX}
            y1="18"
            x2={selectedX}
            y2="130"
            stroke="color-mix(in srgb, var(--foreground) 30%, transparent)"
            strokeDasharray="3 3"
          />
          <circle cx={selectedX} cy={selectedY} r="4.2" fill={LINE_COLOR} stroke="var(--bg-surface)" strokeWidth="2" />
          {points.map((point, index) => (
            <rect
              key={point.weekStart}
              x={xs[index] - 26}
              y="14"
              width="52"
              height="116"
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelected(index)}
              onMouseEnter={() => setSelected(index)}
            />
          ))}
        </svg>
      </div>

      <div className="font-body mt-2 flex justify-between px-3 text-[9.5px] font-medium text-muted">
        {points.map((point) => (
          <span key={point.weekStart}>{point.label}</span>
        ))}
      </div>

      <div className="font-body mt-4 text-[11px] font-semibold text-secondary">
        <span className={BADGE_CLASS[trend.interpretation]}>
          {trend.interpretation.charAt(0).toUpperCase() + trend.interpretation.slice(1)}
        </span>
        <p className="mt-1 font-medium normal-case tracking-normal text-secondary">
          {trend.summary}
        </p>
      </div>
    </section>
  );
}
