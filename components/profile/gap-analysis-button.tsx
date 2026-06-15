"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pannello "Analizza evento" (M5): apre la scelta della gara da analizzare.
 * Due modi, in tab:
 *  - "Da Intervals": lista delle gare RACE_A con GPX (GET), si sceglie e si
 *    avvia l'analisi su quella (POST { event_id });
 *  - "Carica GPX": drag & drop di un .gpx, inviato in multipart e parsato al
 *    volo lato server (non salvato).
 * Al successo ricarica i Server Component così la sezione si popola.
 */

interface EventOption {
  id: number | string;
  name: string | null;
  start_date_local: string | null;
  distance_km: number | null;
}

type Tab = "intervals" | "upload";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.slice(0, 10));
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export function GapAnalysisButton({ hasAnalysis }: { hasAnalysis: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("intervals");

  const [events, setEvents] = useState<EventOption[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPanel() {
    setOpen((v) => !v);
    if (events == null && !loadingEvents) {
      void loadEvents();
    }
  }

  async function loadEvents() {
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const response = await fetch("/api/profile/gap-analysis");
      const body = (await response.json().catch(() => null)) as {
        events?: EventOption[];
        error?: string;
      } | null;
      const list = body?.events ?? [];
      setEvents(list);
      if (list.length > 0) setSelectedId(String(list[0].id));
      if (body?.error === "not_connected") {
        setEventsError("Intervals non collegato: usa il caricamento file.");
      } else if (body?.error) {
        setEventsError("Lista eventi non disponibile: usa il caricamento file.");
      }
    } catch {
      setEvents([]);
      setEventsError("Errore di rete nel caricare gli eventi.");
    } finally {
      setLoadingEvents(false);
    }
  }

  async function runAnalysis(init: RequestInit) {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/gap-analysis", {
        method: "POST",
        ...init,
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "Analisi evento fallita");
        if (response.status === 401 && body?.error === "intervals_unauthorized") {
          router.refresh();
        }
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setAnalyzing(false);
    }
  }

  function analyzeEvent() {
    if (!selectedId) return;
    void runAnalysis({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: selectedId }),
    });
  }

  function analyzeFile() {
    if (!file) return;
    const fd = new FormData();
    fd.append("gpx", file);
    void runAnalysis({ body: fd });
  }

  function acceptFile(f: File | undefined | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".gpx")) {
      setError("Il file deve avere estensione .gpx");
      return;
    }
    setError(null);
    setFile(f);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant={hasAnalysis ? "outline" : "default"}
        size="sm"
        onClick={() => void openPanel()}
      >
        {hasAnalysis ? "Rianalizza evento" : "Analizza evento"}
      </Button>

      {open && (
        <div className="w-full max-w-md rounded-lg border bg-card p-4 text-left shadow-sm">
          {/* Tab */}
          <div className="mb-3 flex gap-1 rounded-md bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setTab("intervals")}
              className={cn(
                "flex-1 rounded px-2 py-1 transition-colors",
                tab === "intervals" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
              )}
            >
              Da Intervals
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={cn(
                "flex-1 rounded px-2 py-1 transition-colors",
                tab === "upload" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
              )}
            >
              Carica GPX
            </button>
          </div>

          {tab === "intervals" ? (
            <div className="flex flex-col gap-3">
              {loadingEvents ? (
                <p className="text-sm text-muted-foreground">Carico le gare…</p>
              ) : events && events.length > 0 ? (
                <>
                  <label className="text-sm font-medium">Gara da analizzare</label>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {events.map((e) => (
                      <option key={String(e.id)} value={String(e.id)}>
                        {e.name ?? "Gara"}
                        {e.start_date_local ? ` · ${formatDate(e.start_date_local)}` : ""}
                        {e.distance_km != null ? ` · ${e.distance_km} km` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={analyzeEvent}
                    disabled={analyzing || !selectedId}
                  >
                    {analyzing ? "Scarico e analizzo il percorso…" : "Analizza questa gara"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {eventsError ??
                    "Nessuna gara RACE_A con GPX trovata su Intervals. Usa il caricamento file."}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-input"
                )}
              >
                <p className="text-muted-foreground">
                  Trascina qui un file <span className="font-medium">.gpx</span>
                </p>
                <label className="cursor-pointer text-xs text-primary underline">
                  oppure scegli un file
                  <input
                    type="file"
                    accept=".gpx"
                    className="hidden"
                    onChange={(e) => acceptFile(e.target.files?.[0])}
                  />
                </label>
                {file && (
                  <p className="mt-1 text-xs font-medium">{file.name}</p>
                )}
              </div>
              <Button size="sm" onClick={analyzeFile} disabled={analyzing || !file}>
                {analyzing ? "Analizzo il percorso…" : "Analizza file"}
              </Button>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
