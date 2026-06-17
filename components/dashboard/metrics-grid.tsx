"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MetricCard } from "@/components/dashboard/metric-card";
import {
  HRV_PROTOCOL_LABELS,
  type HrvMeasurement,
  type HrvProtocol,
} from "@/lib/hrv";
import { cn } from "@/lib/utils";

export interface SimpleMetric {
  key: string;
  label: string;
  acronym: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaClassName?: string;
  deltaDirection?: "up" | "down" | "flat";
  deltaTone?: "positive" | "negative" | "neutral";
  tooltip: string;
}

function formatWellnessDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

function measurementRecency(measurement: HrvMeasurement, currentDate: string | null): string {
  return measurement.date === currentDate
    ? "oggi"
    : `ultima misura ${formatWellnessDate(measurement.date)}`;
}

function HrvCard({
  open,
  onToggle,
  initialProtocol,
  currentDate,
  rmssd,
  sdnn,
}: {
  open: boolean;
  onToggle: () => void;
  initialProtocol: HrvProtocol;
  currentDate: string | null;
  rmssd: HrvMeasurement | null;
  sdnn: HrvMeasurement | null;
}) {
  const router = useRouter();
  const [protocol, setProtocol] = useState(initialProtocol);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const measurement = protocol === "sdnn" ? sdnn : rmssd;

  async function selectProtocol(nextProtocol: HrvProtocol) {
    if (nextProtocol === protocol || saving) return;
    const previous = protocol;
    setProtocol(nextProtocol);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/hrv-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: nextProtocol }),
      });
      if (!response.ok) {
        setProtocol(previous);
        setError("Salvataggio non riuscito");
        return;
      }
      router.refresh();
    } catch {
      setProtocol(previous);
      setError("Errore di rete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MetricCard
      label="Variabilità FC"
      acronym="HRV"
      open={open}
      onToggle={onToggle}
      tooltip="Variabilità del battito. Entro ±10% della baseline = recuperato; in calo marcato = fatica."
      value={
        measurement ? (
          measurement.value.toFixed(0)
        ) : (
          <span className="text-muted">—</span>
        )
      }
      delta={
        measurement
          ? measurementRecency(measurement, currentDate)
          : "nessun dato 30gg"
      }
      footer={
        <div className="mt-2.5">
          <div className="grid grid-cols-2 rounded-lg border border-border bg-base p-0.5">
            {(["rmssd", "sdnn"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={protocol === option}
                disabled={saving}
                onClick={() => void selectProtocol(option)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                  protocol === option
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground",
                  saving && "cursor-wait opacity-70"
                )}
              >
                {HRV_PROTOCOL_LABELS[option]}
              </button>
            ))}
          </div>
          {error && <p className="mt-1.5 text-[11px] text-ready-skip">{error}</p>}
        </div>
      }
    />
  );
}

export function MetricsGrid({
  metrics,
  hrv,
}: {
  metrics: SimpleMetric[];
  hrv: {
    initialProtocol: HrvProtocol;
    currentDate: string | null;
    rmssd: HrvMeasurement | null;
    sdnn: HrvMeasurement | null;
  };
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = (key: string) =>
    setOpenKey((current) => (current === key ? null : key));

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.key}
          label={metric.label}
          acronym={metric.acronym}
          value={metric.value}
          delta={metric.delta}
          deltaClassName={metric.deltaClassName}
          deltaDirection={metric.deltaDirection}
          deltaTone={metric.deltaTone}
          tooltip={metric.tooltip}
          open={openKey === metric.key}
          onToggle={() => toggle(metric.key)}
        />
      ))}
      <HrvCard
        open={openKey === "hrv"}
        onToggle={() => toggle("hrv")}
        initialProtocol={hrv.initialProtocol}
        currentDate={hrv.currentDate}
        rmssd={hrv.rmssd}
        sdnn={hrv.sdnn}
      />
    </div>
  );
}
