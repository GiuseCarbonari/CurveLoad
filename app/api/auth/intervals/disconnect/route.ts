import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/intervals/disconnect — scollega l'account Intervals.icu.
 *
 * Cosa fa: cancella la riga in intervals_connections (e con essa il token
 * cifrato) per l'utente autenticato, poi reindirizza a /connect.
 * La cancellazione usa il client dell'utente: la policy RLS
 * "connections_delete_own" consente di eliminare SOLO la propria riga,
 * quindi non serve il service role.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Non autenticato", { status: 401 });
  }

  const { error } = await supabase
    .from("intervals_connections")
    .delete()
    .eq("user_id", user.id);
  if (error) {
    console.error("Disconnessione Intervals fallita:", error.message);
    return new NextResponse("Disconnessione fallita", { status: 500 });
  }

  // Traccia l'evento di disconnessione (audit append-only, scrive il server).
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "intervals.disconnected",
    source: "app",
    payload: {},
  });

  // 303: dopo un POST il browser deve seguire il redirect con GET.
  return NextResponse.redirect(new URL("/connect", request.url), 303);
}
