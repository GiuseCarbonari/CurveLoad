export type HrvProtocol = "rmssd" | "sdnn";

export const DEFAULT_HRV_PROTOCOL: HrvProtocol = "rmssd";

export const HRV_PROTOCOL_LABELS: Record<HrvProtocol, string> = {
  rmssd: "rMSSD",
  sdnn: "SDNN",
};

interface HrvValues {
  hrv?: number | null;
  hrvSDNN?: number | null;
}

interface DatedHrvValues extends HrvValues {
  date: string;
}

export interface HrvMeasurement {
  value: number;
  date: string;
}

export function normalizeHrvProtocol(value: unknown): HrvProtocol {
  return value === "sdnn" ? "sdnn" : DEFAULT_HRV_PROTOCOL;
}

export function hrvProtocolFromPreferences(
  preferences: unknown
): HrvProtocol {
  if (
    preferences != null &&
    typeof preferences === "object" &&
    !Array.isArray(preferences)
  ) {
    return normalizeHrvProtocol(
      (preferences as Record<string, unknown>).hrv_protocol
    );
  }
  return DEFAULT_HRV_PROTOCOL;
}

export function hrvValue(
  values: HrvValues | null | undefined,
  protocol: HrvProtocol
): number | null {
  if (!values) return null;
  return protocol === "sdnn"
    ? values.hrvSDNN ?? null
    : values.hrv ?? null;
}

export function latestHrvMeasurement(
  days: DatedHrvValues[],
  protocol: HrvProtocol
): HrvMeasurement | null {
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const value = hrvValue(days[index], protocol);
    if (value != null) {
      return { value, date: days[index].date };
    }
  }
  return null;
}
