/**
 * Taccuino del coach (PIANO.md Passo 5) — parte PURA dell'output vincolato.
 *
 * L'LLM non scrive mai nel DB direttamente: alla fine del commento emette una
 * riga `NOTE_COACH: [...]` con al più 2 note JSON. Qui la riga viene staccata
 * dal commento mostrato all'utente e ogni nota passa dal validatore (tipo in
 * allowlist, testo non vuoto, lunghezza cap): solo ciò che sopravvive arriva
 * all'INSERT in athlete_memory (explain-io.ts). Tutto ciò che non valida si
 * scarta e si conta — mai bloccare il commento per colpa del taccuino.
 */

/**
 * Allowlist dei tipi nota.
 *
 * `osservazione` è stato TOLTO il 2026-08-05 dopo aver guardato cosa ci
 * finiva davvero: su 12 note reali, 10 erano di quel tipo e nessuna era un
 * fatto sull'atleta — erano il modello che si ripeteva il compito
 * ("monitorare lo stress e la motivazione dell'atleta"). Peggio: essendo
 * rilette a ogni prompt si autoalimentavano, e il vincolo unique(user, nota)
 * non fermava le parafrasi. Restano i tre tipi che descrivono FATTI durevoli
 * e verificabili dall'atleta.
 *
 * Il CHECK della migration 021 accetta ancora il valore vecchio: le righe già
 * salvate restano leggibili e cancellabili dalla lista in impostazioni, ma
 * non entrano più nei prompt (vedi SUPPORTED filtro in lib/ai/context.ts) e
 * nessuna nuova ne viene scritta. Nessuna migration da lanciare a mano.
 */
export const MEMORY_TYPES = [
  "preferenza",
  "infortunio",
  "traguardo",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface CoachNote {
  tipo: MemoryType;
  nota: string;
}

export const NOTE_MARKER = "NOTE_COACH:";
export const MAX_NOTES = 3;
/** Cap identico al CHECK char_length della migration 021. */
export const MAX_NOTE_CHARS = 300;

export interface ExtractedNotes {
  /** Il commento da mostrare/salvare, senza la riga NOTE_COACH. */
  comment: string;
  notes: CoachNote[];
  /** Voci arrivate dall'LLM ma scartate dal validatore (per audit_logs). */
  discarded: number;
}

/**
 * Stacca la riga NOTE_COACH dal testo generato e valida le note.
 * Qualunque malformazione (marker assente, JSON rotto, non-array, tipi
 * sconosciuti) degrada a "nessuna nota", mai a un errore: il commento è il
 * prodotto, il taccuino è un bonus.
 */
export function extractCoachNotes(raw: string): ExtractedNotes {
  const markerIdx = raw.lastIndexOf(NOTE_MARKER);
  if (markerIdx === -1) {
    return { comment: raw.trim(), notes: [], discarded: 0 };
  }

  // Tutto ciò che segue il marker è il candidato JSON (copre anche il caso
  // in cui il modello manda l'array a capo); il commento è ciò che precede.
  const comment = raw.slice(0, markerIdx).trim();
  const jsonCandidate = raw.slice(markerIdx + NOTE_MARKER.length).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return { comment, notes: [], discarded: 0 };
  }
  if (!Array.isArray(parsed)) {
    return { comment, notes: [], discarded: 0 };
  }

  const notes: CoachNote[] = [];
  let discarded = 0;
  for (const item of parsed) {
    const tipo = (item as { tipo?: unknown })?.tipo;
    const nota = (item as { nota?: unknown })?.nota;
    const valid =
      typeof tipo === "string" &&
      (MEMORY_TYPES as readonly string[]).includes(tipo) &&
      typeof nota === "string" &&
      nota.trim().length > 0;
    if (!valid) {
      discarded++;
      continue;
    }
    if (notes.length >= MAX_NOTES) {
      discarded++;
      continue;
    }
    notes.push({
      tipo: tipo as MemoryType,
      nota: nota.trim().slice(0, MAX_NOTE_CHARS),
    });
  }

  return { comment, notes, discarded };
}
