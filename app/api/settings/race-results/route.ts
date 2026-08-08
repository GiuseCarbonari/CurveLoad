import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseRaceTime } from "@/lib/profile/race-time";

const LIVELLO_VALUES = ["ben_allenato", "nella_media", "sottopreparato"] as const;
type Livello = (typeof LIVELLO_VALUES)[number];

/**
 * POST /api/settings/race-results — registra un risultato di gara passato.
 *
 * `race_results` (migration 026) ha RLS select-own: la scrittura passa da
 * qui col client admin, dopo aver verificato l'identità e validato il body —
 * stesso pattern di /api/settings/memory. `tempo_finale_s` e
 * `stima_orologio_s` arrivano dal client come stringa "mm:ss"/"h:mm:ss" e si
 * convertono con parseRaceTime: un formato non riconosciuto è un errore
 * dell'utente (400), mai un tempo indovinato salvato lo stesso.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const { nome, data, distanza_km, tempo_finale, livello_preparazione, note, stima_orologio } =
    body as Record<string, unknown>;

  const dataStr = typeof data === "string" ? data.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    return NextResponse.json(
      { success: false, error: "invalid_data" },
      { status: 400 }
    );
  }

  const distanzaKm = typeof distanza_km === "number" ? distanza_km : Number(distanza_km);
  if (!Number.isFinite(distanzaKm) || distanzaKm <= 0) {
    return NextResponse.json(
      { success: false, error: "invalid_distanza_km" },
      { status: 400 }
    );
  }

  const tempoFinaleS = parseRaceTime(typeof tempo_finale === "string" ? tempo_finale : "");
  if (tempoFinaleS == null) {
    return NextResponse.json(
      { success: false, error: "invalid_tempo_finale" },
      { status: 400 }
    );
  }

  const livello =
    typeof livello_preparazione === "string" &&
    (LIVELLO_VALUES as readonly string[]).includes(livello_preparazione)
      ? (livello_preparazione as Livello)
      : null;

  const stimaOrologioS =
    typeof stima_orologio === "string" && stima_orologio.trim() !== ""
      ? parseRaceTime(stima_orologio)
      : null;

  const { error } = await createAdminClient().from("race_results").insert({
    user_id: user.id,
    nome: typeof nome === "string" && nome.trim() !== "" ? nome.trim() : null,
    data: dataStr,
    distanza_km: distanzaKm,
    tempo_finale_s: tempoFinaleS,
    livello_preparazione: livello,
    note: typeof note === "string" && note.trim() !== "" ? note.trim() : null,
    stima_orologio_s: stimaOrologioS,
  });
  if (error) {
    // Doppio invio (stessa data+distanza) urta l'unique index: errore chiaro
    // invece di un 500 generico.
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, error: "duplicate" },
        { status: 409 }
      );
    }
    console.error("Salvataggio risultato gara fallito:", error.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/settings/race-results?id=… — rimuove un risultato inserito
 * per errore. Stesso pattern di /api/settings/memory: RLS è select-own,
 * quindi la cancellazione passa dal client admin con il filtro user_id nella
 * query, non solo nell'id.
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "missing_id" },
      { status: 400 }
    );
  }

  const { error } = await createAdminClient()
    .from("race_results")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("Cancellazione risultato gara fallita:", error.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
