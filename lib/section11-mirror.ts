import { readFile } from "node:fs/promises";

type Section11Latest = Record<string, unknown>;

export interface Section11RecoveryInputs {
  recoveryIndex: number | null;
  source: string | null;
}

function formatSource(template: string, userId: string): string {
  return template.replaceAll("{userId}", userId);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getPath(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return current;
}

function riFromSignal(signal: unknown): number | null {
  const record = asRecord(signal);
  if (!record) return numberFrom(signal);

  for (const key of ["value", "raw", "current", "ri", "recovery_index"]) {
    const value = numberFrom(record[key]);
    if (value != null) return value;
  }

  return null;
}

export function extractRecoveryIndexFromLatest(
  latest: Section11Latest
): number | null {
  const signalRi = getPath(latest, ["readiness_decision", "signals", "ri"]);
  const fromSignal = riFromSignal(signalRi);
  if (fromSignal != null) return fromSignal;

  const candidates = [
    ["derived_metrics", "recovery_index"],
    ["derived_metrics", "ri"],
    ["current_status", "recovery_index"],
    ["current_status", "ri"],
    ["current_status", "current_metrics", "recovery_index"],
    ["current_status", "current_metrics", "ri"],
    ["readiness", "recovery_index"],
    ["readiness", "ri"],
  ];

  for (const path of candidates) {
    const value = numberFrom(getPath(latest, path));
    if (value != null) return value;
  }

  return null;
}

async function readJsonFromPath(pathTemplate: string, userId: string) {
  const source = formatSource(pathTemplate, userId);
  const content = await readFile(source, "utf8");
  return { source, data: JSON.parse(content) as Section11Latest };
}

async function readJsonFromUrl(urlTemplate: string, userId: string) {
  const source = formatSource(urlTemplate, userId);
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return { source, data: (await response.json()) as Section11Latest };
}

export async function readSection11RecoveryInputs(
  userId: string
): Promise<Section11RecoveryInputs> {
  const path = process.env.SECTION11_LATEST_JSON_PATH;
  const url = process.env.SECTION11_LATEST_JSON_URL;

  if (!path && !url) {
    return { recoveryIndex: null, source: null };
  }

  try {
    const latest = path
      ? await readJsonFromPath(path, userId)
      : await readJsonFromUrl(url!, userId);

    return {
      recoveryIndex: extractRecoveryIndexFromLatest(latest.data),
      source: latest.source,
    };
  } catch (error) {
    console.error(
      "Lettura mirror Section 11 fallita:",
      error instanceof Error ? error.message : error
    );
    return { recoveryIndex: null, source: path ? formatSource(path, userId) : url ?? null };
  }
}
