/** True se l'atleta ha compilato una nota di salute (freno prudenziale). */
export function hasHealthNote(
  fields: { dolore_attuale?: string | null; farmaci_integratori?: string | null; limiti_principali?: string | null }
): boolean {
  return [fields.dolore_attuale, fields.farmaci_integratori, fields.limiti_principali].some(
    (v) => String(v ?? "").trim() !== ""
  );
}
