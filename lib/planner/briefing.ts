/**
 * Briefing pre-piano (Passo 10.5) — funzione PURA, nessun I/O.
 *
 * Il tutorial che Giuseppe seguiva chiede di raccontare cosa dicono i dati
 * PRIMA del piano. Il motore quelle frasi le scrive già dentro
 * validation_metadata (phase_reason, mesocycle_reason) e dentro il mirror
 * (CTL/ATL/readiness): qui le si mette solo in fila, senza ricalcolare nulla
 * (regola "No Virtual Math" — ACWR = atl/ctl è la stessa lettura semplice
 * che fa già app/api/planner/generate/route.ts).
 *
 * Ogni riga è opzionale: un piano vecchio senza mesocycle_reason (pre-Passo 8)
 * mostra solo le righe che ha, mai una riga inventata per riempire.
 */

export interface BriefingMeta {
  phase_reason?: string | null;
  mesocycle_reason?: string | null;
  phase_alignment_reason?: string | null;
}

export interface BriefingWellness {
  ctl: number | null;
  atl: number | null;
}

export function buildBriefing(
  meta: BriefingMeta | null,
  wellnessLast: BriefingWellness | null,
  readinessDecision: "GO" | "MODIFY" | "SKIP" | null,
  daysToEvent: number | null
): string[] {
  const lines: string[] = [];

  // Riga 1 — condizione: CTL/ACWR/prontezza, solo se c'è almeno un dato.
  const ctl = wellnessLast?.ctl ?? null;
  const atl = wellnessLast?.atl ?? null;
  const acwr = ctl != null && atl != null && ctl !== 0 ? Number((atl / ctl).toFixed(2)) : null;
  const condizioneParts: string[] = [];
  if (ctl != null) condizioneParts.push(`CTL ${Math.round(ctl)}`);
  if (acwr != null) condizioneParts.push(`ACWR ${acwr.toFixed(2)}`);
  if (readinessDecision != null) condizioneParts.push(`prontezza ${readinessDecision}`);
  if (condizioneParts.length > 0) lines.push(condizioneParts.join(" · "));

  // Riga 2 — fase (perché questa fase, eventuale disallineamento col macrociclo).
  if (meta?.phase_reason) lines.push(meta.phase_reason);
  if (meta?.phase_alignment_reason) lines.push(meta.phase_alignment_reason);

  // Riga 3 — mesociclo (posizione nel blocco 3:1, volume target).
  if (meta?.mesocycle_reason) lines.push(meta.mesocycle_reason);

  // Riga 4 — countdown gara, solo se impostata.
  if (daysToEvent != null && daysToEvent >= 0) {
    lines.push(`Gara tra ${daysToEvent} giorni.`);
  }

  return lines;
}
