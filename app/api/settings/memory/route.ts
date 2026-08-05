import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/settings/memory?id=… — cancella una nota del taccuino coach.
 *
 * Perché esiste: fino al 2026-08-05 `athlete_memory` era scritta dall'LLM e
 * non cancellabile da nessuna parte. Una nota su un infortunio restava nel
 * contesto di ogni prompt per sempre, anche dopo che l'atleta aveva svuotato
 * il campo corrispondente nel dossier — con dati sanitari non è un fastidio,
 * è il diritto di rettifica.
 *
 * La migration 021 dà ad athlete_memory la sola policy select-own (pattern
 * "scritture solo service role"), quindi la cancellazione passa dal client
 * admin. L'identità è verificata prima, e il filtro user_id è nella query:
 * un id altrui non cancella niente invece di cancellare la riga sbagliata.
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
    .from("athlete_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("Cancellazione nota coach fallita:", error.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
