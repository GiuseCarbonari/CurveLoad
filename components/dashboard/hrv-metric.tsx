"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MetricStat } from "@/components/ui/metric-stat";
import {
  HRV_PROTOCOL_LABELS,
  type HrvMeasurement,
  type HrvProtocol,
} from "@/lib/hrv";
import { cn } from "@/lib/utils";

function formatWellnessDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

function measurementRecency(
  measurement: HrvMeasurement,
  currentDate: string | null
): string {
  return measurement.date === currentDate
    ? "oggi"
    : `ultima misura ${formatWellnessDate(measurement.date)}`;
}

export function HrvMetric({
  initialProtocol,
  currentDate,
  rmssd,
  sdnn,
}: {
  initialProtocol: HrvProtocol;
  currentDate: string | null;
  rmssd: HrvMeasurement | null;
  sdnn: HrvMeasurement | null;
}) {
  const router = useRouter();
  const [protocol, setProtocol] = useState(initialProtocol);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setProtocol(initialProtocol);
  }, [initialProtocol]);

  const measurement = protocol === "sdnn" ? sdnn : rmssd;
  const protocolLabel = HRV_PROTOCOL_LABELS[protocol];

  async function selectProtocol(nextProtocol: HrvProtocol) {
    if (nextProtocol === protocol || saving) return;

    const previousProtocol = protocol;
    setProtocol(nextProtocol);
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/settings/hrv-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: nextProtocol }),
      });
      const body = (await response.json().catch(() => null)) as {
        synced?: boolean;
      } | null;
      if (!response.ok) {
        setProtocol(previousProtocol);
        setError("Salvataggio non riuscito");
        return;
      }
      if (body?.synced === false) {
        setNotice("Scelta salvata; readiness aggiornata al prossimo sync");
      }
      router.refresh();
    } catch {
      setProtocol(previousProtocol);
      setError("Errore di rete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MetricStat
      label="Variabilità cardiaca"
      acronym="HRV"
      tooltip="rMSSD e SDNN misurano entrambe la variabilità cardiaca con protocolli diversi. Seleziona quello prodotto dal tuo dispositivo: la scelta viene mantenuta e usata anche per la readiness."
      value={
        measurement ? (
          <span>{measurement.value.toFixed(0)}</span>
        ) : (
          <span title={`Nessun dato ${protocolLabel}`} className="text-muted">
            —
          </span>
        )
      }
      status={
        measurement
          ? `${protocolLabel} · ${measurementRecency(
              measurement,
              currentDate
            )}`
          : `Nessun dato ${protocolLabel} negli ultimi 30 giorni`
      }
      footer={
        <div className="mt-3">
          <div
            className="grid grid-cols-2 rounded-lg border border-border bg-base p-0.5"
            aria-label="Protocollo HRV"
          >
            {(["rmssd", "sdnn"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={protocol === option}
                disabled={saving}
                onClick={() => void selectProtocol(option)}
                className={cn(
                  "min-h-8 rounded-md px-2 text-[11px] font-medium transition-colors",
                  protocol === option
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                  saving && "cursor-wait opacity-70"
                )}
              >
                {HRV_PROTOCOL_LABELS[option]}
              </button>
            ))}
          </div>
          {error && (
            <p className="mt-1.5 text-[11px] text-destructive">{error}</p>
          )}
          {notice && (
            <p className="mt-1.5 text-[11px] leading-4 text-muted">{notice}</p>
          )}
        </div>
      }
    />
  );
}
