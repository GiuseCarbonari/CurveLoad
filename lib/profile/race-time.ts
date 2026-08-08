/**
 * Tempo di gara "mm:ss" o "h:mm:ss" <-> secondi interi.
 *
 * Serve sia al form di inserimento gara (Sessione 1) sia al motore Riegel
 * (Sessione 2): un solo posto che sa come un umano scrive un tempo di gara.
 * Parsing tollerante ma mai un numero indovinato — input non riconosciuto o
 * fuori range (minuti/secondi >= 60) torna null, non un tentativo migliore.
 */
export function parseRaceTime(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d{1,2}$/.test(p))) return null;

  const nums = parts.map(Number);
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m >= 60 || s >= 60) return null;

  const totalSeconds = h * 3600 + m * 60 + s;
  return totalSeconds > 0 ? totalSeconds : null;
}

/** Arrotonda i secondi TOTALI prima di scomporli (stesso motivo di formatPace: evita "4:60"). */
export function formatRaceTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
