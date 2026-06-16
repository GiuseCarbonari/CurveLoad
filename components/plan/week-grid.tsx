"use client";

import { useState } from "react";

import type { BuiltSession } from "@/lib/planner/build-week";
import type { DayKey } from "@/lib/planner/session-selector";

/**
 * Griglia settimanale (design Limina). Lista verticale di 7 card con
 * border-left colorato per tipo. Click → accordion con dettaglio seduta
 * e bottone "Non posso allenarmi questo giorno".
 */

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_SHORT: Record<DayKey, string> = {
  mon: "Lun", tue: "Mar", wed: "Mer", thu: "Gio",
  fri: "Ven", sat: "Sab", sun: "Dom",
};

type Tone = "hard" | "medium" | "easy" | "rest";

function sessionTone(s: BuiltSession): Tone {
  if (s.rest) return "rest";
  if (s.is_hard) return "hard";
  // heuristica: Z1/Z2 → easy, else → medium
  const zone = s.power_target_zone ?? "";
  if (zone.includes("Z1") || zone.includes("Z2")) return "easy";
  return "medium";
}

const TONE_CONFIG: Record<Tone, {
  accentBorder: string;
  icon: string;
  kindLabel: string;
  chipBg: string;
  chipText: string;
  cardBg: string;
}> = {
  hard: {
    accentBorder: "border-l-ready-skip",
    icon: "▲",
    kindLabel: "Duro",
    chipBg: "bg-ready-skip/[0.12]",
    chipText: "text-[#eda7a0]",
    cardBg: "bg-gradient-to-br from-[#222b3d]/50 to-[#0e121b]/40",
  },
  medium: {
    accentBorder: "border-l-brand",
    icon: "◆",
    kindLabel: "Medio",
    chipBg: "bg-brand-dim",
    chipText: "text-brand-hover",
    cardBg: "bg-gradient-to-br from-[#222b3d]/50 to-[#0e121b]/40",
  },
  easy: {
    accentBorder: "border-l-accent2",
    icon: "〜",
    kindLabel: "Facile",
    chipBg: "bg-accent2-dim",
    chipText: "text-accent2-hover",
    cardBg: "bg-gradient-to-br from-[#222b3d]/50 to-[#0e121b]/40",
  },
  rest: {
    accentBorder: "border-l-border",
    icon: "○",
    kindLabel: "Riposo",
    chipBg: "bg-white/[0.05]",
    chipText: "text-muted",
    cardBg: "bg-transparent",
  },
};

const READINESS_BADGE: Record<string, { label: string; classes: string }> = {
  GO: { label: "GO", classes: "border-ready-go-border text-ready-go" },
  MODIFY: { label: "MODIFY", classes: "border-ready-modify-border text-ready-modify" },
  SKIP: { label: "SKIP", classes: "border-ready-skip-border text-ready-skip" },
};

export function WeekGrid({
  sessions,
  todayKey,
  todayReadiness,
  pushedAt,
  lockedBefore,
  onBlockDay,
}: {
  sessions: BuiltSession[];
  todayKey: DayKey;
  todayReadiness: string | null;
  pushedAt: string | null;
  lockedBefore?: string;
  onBlockDay?: (date: string, day: DayKey) => void;
}) {
  const [expanded, setExpanded] = useState<DayKey | null>(null);

  const byDay = new Map<DayKey, BuiltSession>();
  for (const s of sessions) byDay.set(s.day as DayKey, s);

  return (
    <section className="space-y-2">
      {pushedAt && (
        <div className="flex justify-end">
          <span className="rounded-[9px] border border-ready-go-border bg-surface px-3 py-1 text-xs font-medium text-ready-go">
            Inviata il{" "}
            {new Date(pushedAt).toLocaleDateString("it-IT", {
              timeZone: "Europe/Rome",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-[9px]">
        {DAY_ORDER.map((day) => {
          const session = byDay.get(day);
          if (!session) return null;

          const isToday = day === todayKey;
          const isOpen = expanded === day;
          const tone = sessionTone(session);
          const cfg = TONE_CONFIG[tone];
          const readinessBadge =
            isToday && todayReadiness ? READINESS_BADGE[todayReadiness] : null;
          const isLocked =
            session.rest ||
            (lockedBefore != null && session.date < lockedBefore);
          const canBlock = !isLocked && onBlockDay != null;

          return (
            <div
              key={day}
              className={`overflow-hidden rounded-[15px] border border-l-[3px] ${cfg.accentBorder} ${cfg.cardBg} ${
                isToday
                  ? "border-brand/55 shadow-[0_0_0_1px_rgba(91,141,239,0.2),0_12px_30px_rgba(91,141,239,0.14)]"
                  : isOpen
                    ? "border-white/[0.16]"
                    : tone === "rest"
                      ? "border-dashed border-border"
                      : "border-border"
              }`}
            >
              {/* Card header — always visible */}
              <button
                type="button"
                onClick={() =>
                  !session.rest && setExpanded(isOpen ? null : day)
                }
                className="flex w-full cursor-pointer items-center gap-3 px-[15px] py-[14px] text-left"
                aria-expanded={isOpen}
              >
                {/* Date column */}
                <div className="w-8 shrink-0 text-center">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-muted">
                    {DAY_SHORT[day]}
                  </div>
                  <div className="font-serif text-[20px] leading-tight">
                    {new Date(`${session.date}T12:00:00`).getDate()}
                  </div>
                </div>

                {/* Session info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px]" style={{ color: tone === "rest" ? "#6b7585" : undefined }}>
                      {cfg.icon}
                    </span>
                    <span className="truncate font-serif text-[16px] leading-tight text-foreground">
                      {session.rest ? "Riposo" : session.title}
                    </span>
                  </div>
                  {!session.rest && (
                    <div className="mt-0.5 text-[11.5px] text-muted">
                      {session.estimated_duration_min != null
                        ? `${Math.floor(session.estimated_duration_min / 60)}h ${String(session.estimated_duration_min % 60).padStart(2, "0")}′ · `
                        : ""}
                      {session.power_target_zone ?? ""}
                    </div>
                  )}
                </div>

                {/* Right side: readiness badge or kind chip */}
                {readinessBadge ? (
                  <span
                    className={`shrink-0 rounded-full border bg-surface-2 px-2.5 py-1 text-[10px] font-bold ${readinessBadge.classes}`}
                  >
                    {readinessBadge.label}
                  </span>
                ) : (
                  !session.rest && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium ${cfg.chipBg} ${cfg.chipText}`}
                    >
                      {cfg.kindLabel}
                    </span>
                  )
                )}
              </button>

              {/* Expanded detail */}
              {isOpen && !session.rest && (
                <div className="border-t border-white/[0.06] px-[15px] pb-[15px] pt-[13px]">
                  <div className="space-y-3">
                    <DetailRow label="Obiettivo" value={session.session_objective} />
                    <DetailRow label="Struttura" value={session.interval_structure} />
                    {session.coach_notes && (
                      <div className="flex gap-2 rounded-xl border border-brand/[0.2] bg-brand/[0.08] px-3 py-2.5">
                        <span className="text-[13px] text-brand-hover">✎</span>
                        <p className="text-[12.5px] leading-relaxed text-secondary">
                          {session.coach_notes}
                        </p>
                      </div>
                    )}
                    {session.fatigue_alternative_library_id && (
                      <DetailRow
                        label="Se sei affaticato"
                        value={`Ripega su ${session.fatigue_alternative_library_id}`}
                      />
                    )}
                  </div>

                  {canBlock && (
                    <button
                      type="button"
                      onClick={() => onBlockDay!(session.date, day)}
                      className="mt-[13px] w-full rounded-xl border border-dashed border-ready-modify/50 bg-ready-modify/[0.06] px-3 py-2.5 text-[12.5px] font-semibold text-[#f0c878] transition-colors hover:bg-ready-modify/[0.10]"
                    >
                      Non posso allenarmi questo giorno
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-0.5 text-[13px] leading-relaxed text-secondary">{value}</div>
    </div>
  );
}
