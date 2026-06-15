"use client";

import { useState } from "react";

import type { BuiltSession } from "@/lib/planner/build-week";
import type { DayKey } from "@/lib/planner/session-selector";

/**
 * Griglia settimanale (M6). Una card per giorno: rosso = seduta dura,
 * verde = facile/recupero, grigio = riposo. Click → espande il dettaglio
 * completo (§15.4: struttura, target, note coach, alternativa di fatica).
 * Il giorno di oggi è evidenziato con la readiness GO/MODIFY/SKIP.
 *
 * Componente di sola presentazione: non calcola e non chiama API.
 */

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_SHORT: Record<DayKey, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mer",
  thu: "Gio",
  fri: "Ven",
  sat: "Sab",
  sun: "Dom",
};

const READINESS_STYLE: Record<string, { label: string; classes: string }> = {
  GO: { label: "GO", classes: "border-ready-go-border text-ready-go" },
  MODIFY: { label: "MODIFY", classes: "border-ready-modify-border text-ready-modify" },
  SKIP: { label: "SKIP", classes: "border-ready-skip-border text-ready-skip" },
};

function cardTone(session: BuiltSession): string {
  if (session.rest) return "border-border bg-surface-2";
  if (session.is_hard) return "border-border border-l-[3px] border-l-amber bg-surface";
  return "border-border bg-surface";
}

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
  /** Sessioni con date < lockedBefore sono immutabili (passate/completate). */
  lockedBefore?: string;
  /** Callback "Non posso questo giorno": (date, day) => void */
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {DAY_ORDER.map((day) => {
          const session = byDay.get(day);
          if (!session) return null;
          const isToday = day === todayKey;
          const isOpen = expanded === day;
          const readiness =
            isToday && todayReadiness
              ? READINESS_STYLE[todayReadiness]
              : null;
          const isLocked =
            session.rest ||
            (lockedBefore != null && session.date < lockedBefore);
          const canBlock = !isLocked && onBlockDay != null;

          return (
            <div
              key={day}
              className={`flex flex-col rounded-[11px] border p-3 text-sm ${cardTone(session)} ${
                isToday ? "ring-2 ring-amber" : ""
              } ${isOpen ? "lg:col-span-7" : ""}`}
            >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{DAY_SHORT[day]}</span>
              {readiness && (
                <span className={`rounded-[7px] border bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold ${readiness.classes}`}>
                  {readiness.label}
                </span>
              )}
            </div>

            {session.rest ? (
              <p className="mt-1 text-muted">Riposo</p>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : day)}
                className="mt-1 flex flex-1 flex-col items-start gap-1 text-left"
              >
                <span className="font-medium">
                  {session.library_id}
                </span>
                <span className="text-xs text-muted">
                  {session.estimated_duration_min != null ? `${session.estimated_duration_min}′ · ` : ""}
                  {session.power_target_zone}
                </span>
                <span className="line-clamp-3 text-xs text-secondary">{session.session_objective}</span>
                <span className="mt-auto text-[11px] text-amber underline">
                  {isOpen ? "chiudi" : "dettaglio"}
                </span>
              </button>
            )}

            {canBlock && (
              <button
                type="button"
                onClick={() => onBlockDay!(session.date, day)}
                className="mt-2 min-h-10 self-start text-[11px] text-muted underline hover:text-ready-skip"
              >
                Non posso questo giorno
              </button>
            )}

            {isOpen && !session.rest && (
              <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                <p className="font-semibold">{session.title}</p>
                <DetailRow label="Obiettivo" value={session.session_objective} />
                <DetailRow label="Struttura" value={session.interval_structure} />
                <DetailRow
                  label="Target"
                  value={`Potenza ${session.power_target_zone ?? "—"} · FC ${session.hr_target_zone ?? "—"} · ${session.rpe_target ?? "—"}`}
                />
                <DetailRow label="Note coach" value={session.coach_notes} />
                <DetailRow label="Perché questa seduta" value={session.session_rationale} />
                {session.fatigue_alternative_library_id && (
                  <DetailRow
                    label="Se sei affaticato"
                    value={`Ripiega su ${session.fatigue_alternative_library_id}`}
                  />
                )}
                {session.frameworks_cited.length > 0 && (
                  <p className="pt-1 text-[11px] text-muted">
                    Riferimenti: {session.frameworks_cited.join(" · ")}
                  </p>
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
    <p>
      <span className="font-medium text-muted">{label}: </span>
      {value}
    </p>
  );
}
