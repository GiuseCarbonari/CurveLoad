const INTERVALS_API_BASE = "https://intervals.icu/api/v1";

interface ProbeEvent {
  uid: string;
  external_id?: string;
  category: "WORKOUT";
  start_date_local: string;
  name: string;
  type: "Ride";
  moving_time: number;
  description: string;
}

interface RawEvent {
  id?: number | string;
  uid?: string | null;
  external_id?: string | null;
  name?: string | null;
  start_date_local?: string | null;
}

interface ProbeEventSummary {
  id: number | string | null;
  uid: string | null;
  external_id: string | null;
  name: string | null;
  start_date_local: string | null;
}

interface CleanupResult {
  deleted_ids: Array<number | string>;
  failed_ids: Array<number | string>;
  manual_delete_ids: Array<number | string>;
}

export interface DedupProbeResult {
  date: string;
  uid_only: {
    uid: string;
    found_count: number;
    found_events: ProbeEventSummary[];
    cleanup: CleanupResult;
    error?: string;
  };
  external_id: {
    uid: string;
    found_count: number;
    found_events: ProbeEventSummary[];
    cleanup: CleanupResult;
    error?: string;
  };
}

function tomorrowInRome(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);
}

async function postBulk(
  accessToken: string,
  path: string,
  event: ProbeEvent
): Promise<void> {
  const response = await fetch(`${INTERVALS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([event]),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Dedup probe bulk POST: HTTP ${response.status}`);
  }
}

async function getWorkouts(
  accessToken: string,
  date: string
): Promise<RawEvent[]> {
  const url = new URL(`${INTERVALS_API_BASE}/athlete/0/events`);
  url.searchParams.set("oldest", date);
  url.searchParams.set("newest", date);
  url.searchParams.set("category", "WORKOUT");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Dedup probe GET events: HTTP ${response.status}`);
  }
  const body = (await response.json()) as unknown;
  return Array.isArray(body) ? (body as RawEvent[]) : [];
}

async function cleanupEvents(
  accessToken: string,
  events: RawEvent[]
): Promise<CleanupResult> {
  const ids = events
    .map((event) => event.id)
    .filter((id): id is number | string => id != null);
  const deletedIds: Array<number | string> = [];
  const failedIds: Array<number | string> = [];

  for (const id of ids) {
    const response = await fetch(
      `${INTERVALS_API_BASE}/athlete/0/events/${encodeURIComponent(String(id))}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (response.ok) deletedIds.push(id);
    else failedIds.push(id);
  }

  return {
    deleted_ids: deletedIds,
    failed_ids: failedIds,
    manual_delete_ids: [
      ...failedIds,
      ...events
        .filter((event) => event.id == null)
        .map((event) => event.uid ?? event.external_id ?? "id-sconosciuto"),
    ],
  };
}

function summarizeEvent(event: RawEvent): ProbeEventSummary {
  return {
    id: event.id ?? null,
    uid: event.uid ?? null,
    external_id: event.external_id ?? null,
    name: event.name ?? null,
    start_date_local: event.start_date_local ?? null,
  };
}

async function runCase(
  accessToken: string,
  date: string,
  event: ProbeEvent,
  path: string
) {
  let operationError: string | undefined;
  try {
    await postBulk(accessToken, path, event);
    await postBulk(accessToken, path, event);
  } catch (error) {
    operationError =
      error instanceof Error ? error.message : "Bulk POST fallito";
  }

  let matching: RawEvent[] = [];
  let cleanup: CleanupResult = {
    deleted_ids: [],
    failed_ids: [],
    manual_delete_ids: [],
  };
  try {
    const events = await getWorkouts(accessToken, date);
    matching = events.filter((candidate) => candidate.name === event.name);
    cleanup = await cleanupEvents(accessToken, matching);
  } catch (error) {
    const readError =
      error instanceof Error ? error.message : "GET/cleanup fallito";
    operationError = operationError
      ? `${operationError}; ${readError}`
      : readError;
  }

  return {
    uid: event.uid,
    found_count: matching.length,
    found_events: matching.map(summarizeEvent),
    cleanup,
    ...(operationError ? { error: operationError } : {}),
  };
}

/**
 * Crea due coppie di eventi temporanei:
 * 1) upsertOnUid con solo uid;
 * 2) upsert=true con uid ed external_id uguali.
 * Conta i risultati e prova sempre a cancellarli per id.
 */
export async function runDedupProbe(
  accessToken: string
): Promise<DedupProbeResult> {
  const date = tomorrowInRome();
  const baseEvent = {
    category: "WORKOUT" as const,
    start_date_local: `${date}T12:00:00`,
    type: "Ride" as const,
    moving_time: 600,
    description: "- 10m 50-60%",
  };

  const uidOnly = await runCase(
    accessToken,
    date,
    {
      ...baseEvent,
      uid: "test-dedup-001",
      name: "TEST DEDUP",
    },
    "/athlete/0/events/bulk?upsertOnUid=true&updatePlanApplied=true"
  );

  const externalId = await runCase(
    accessToken,
    date,
    {
      ...baseEvent,
      uid: "test-dedup-external-001",
      external_id: "test-dedup-external-001",
      name: "TEST DEDUP EXTERNAL",
    },
    "/athlete/0/events/bulk?upsert=true&upsertOnUid=true&updatePlanApplied=true"
  );

  return { date, uid_only: uidOnly, external_id: externalId };
}
