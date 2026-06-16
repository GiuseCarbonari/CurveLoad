"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { IntervalsWorkoutEvent } from "@/lib/planner/intervals-workout-format";

interface PreviewResponse {
  success: boolean;
  message?: string;
  events?: IntervalsWorkoutEvent[];
}

interface PushError {
  uid: string;
  name: string;
  message: string;
}

interface CommitResponse {
  success: boolean;
  message?: string;
  push_errors?: PushError[];
  reconnect_required?: boolean;
}

function formatEventDate(startDateLocal: string): string {
  return new Date(startDateLocal).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function typeLabel(type: IntervalsWorkoutEvent["type"]): string {
  if (type === "MountainBikeRide") return "MTB";
  if (type === "VirtualRide") return "Indoor";
  return "Ciclismo";
}

export function PushButton({
  pushedAt,
  canWriteCalendar,
}: {
  pushedAt: string | null;
  canWriteCalendar: boolean;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<IntervalsWorkoutEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushErrors, setPushErrors] = useState<PushError[]>([]);
  const [success, setSuccess] = useState(false);

  async function openPreview() {
    setLoadingPreview(true);
    setError(null);
    setPushErrors([]);
    setSuccess(false);
    try {
      const response = await fetch("/api/planner/push?mode=preview", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as PreviewResponse | null;
      if (!response.ok || !body?.events) {
        setError(body?.message ?? "Anteprima non disponibile");
        return;
      }
      setEvents(body.events);
      setModalOpen(true);
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function commitPush() {
    setCommitting(true);
    setError(null);
    setPushErrors([]);
    try {
      const response = await fetch("/api/planner/push?mode=commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const body = (await response.json().catch(() => null)) as CommitResponse | null;
      if (!response.ok || !body?.success) {
        setError(body?.message ?? "Invio non riuscito");
        setPushErrors(body?.push_errors ?? []);
        return;
      }
      setModalOpen(false);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setCommitting(false);
    }
  }

  if (!canWriteCalendar) {
    return (
      <div className="flex flex-1 flex-col gap-1">
        <a
          href="/api/auth/intervals/login"
          className="flex w-full flex-col items-center justify-center rounded-[14px] border border-accent2/30 bg-accent2-dim px-3 py-2 text-center text-[11px] font-semibold text-accent2"
        >
          ↗ Invia a Intervals
          <span className="text-[9.5px] font-normal text-accent2/70">riconnetti prima</span>
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => void openPreview()}
          disabled={loadingPreview || committing}
          className="flex w-full flex-col items-center justify-center rounded-[14px] border border-accent2/55 bg-gradient-to-r from-accent2/[0.22] to-accent2/[0.08] px-3 py-2.5 text-[13.5px] font-bold text-[#bfeee8] transition-opacity disabled:opacity-70"
        >
          {loadingPreview ? "…" : "↗ Invia a Intervals"}
          <span className="text-[9.5px] font-normal text-accent2/80">richiede conferma</span>
        </button>
        {success && (
          <span className="text-center text-[11px] text-ready-go">
            ✓ Inviata ·{" "}
            <a
              className="underline"
              href="https://intervals.icu/calendar"
              target="_blank"
              rel="noreferrer"
            >
              Apri calendario
            </a>
          </span>
        )}
        {!modalOpen && error && (
          <span className="text-center text-[11px] text-ready-skip">{error}</span>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-base/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-modal-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface">
            <div className="border-b p-5">
              <h2 id="push-modal-title" className="text-lg font-semibold">
                Conferma invio a Intervals.icu
              </h2>
              <p className="mt-2 text-sm text-secondary">
                Questi allenamenti verranno aggiunti al tuo calendario Intervals.icu
                e sincronizzati sul tuo dispositivo. Gli allenamenti già inviati
                per questa settimana verranno aggiornati, non duplicati.
              </p>
            </div>

            <div className="space-y-3 overflow-y-auto p-5">
              {events.map((event) => (
                <article key={event.uid} className="rounded-[11px] border border-border bg-surface-2 p-4">
                  <h3 className="font-medium">
                    {formatEventDate(event.start_date_local)} · {event.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {Math.round(event.moving_time / 60)} min · {typeLabel(event.type)}
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {event.description}
                  </pre>
                </article>
              ))}

              {error && (
                <div className="rounded-[11px] border border-ready-skip-border bg-surface p-3 text-sm text-ready-skip">
                  <p>{error}</p>
                  {pushErrors.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {pushErrors.map((pushError) => (
                        <li key={pushError.uid}>
                          {pushError.name}: {pushError.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={committing}
              >
                Annulla
              </Button>
              <Button onClick={() => void commitPush()} disabled={committing}>
                {committing ? "Invio..." : "Conferma e invia"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
