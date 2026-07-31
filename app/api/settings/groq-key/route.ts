import { NextResponse, type NextRequest } from "next/server";

import { encryptToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * /api/settings/groq-key — chiave Groq personale dell'utente (Passo 2, BYOK).
 *
 * POST: cifra e salva. DELETE: rimuove (torna al fallback del server).
 * Scrittura col client UTENTE (RLS "users_update_own", stesso pattern di
 * /api/onboarding/save per la tabella users) — mai col service role, la
 * chiave in chiaro arriva solo da qui, non deve mai passare per codice che
 * bypassa RLS senza motivo. Il valore cifrato non viene mai restituito.
 */

const MAX_KEY_LENGTH = 200;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey || apiKey.length > MAX_KEY_LENGTH) {
    return NextResponse.json({ success: false, error: "invalid_key" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update({ groq_key_encrypted: encryptToken(apiKey) })
    .eq("id", user.id);
  if (error) {
    console.error("Salvataggio chiave Groq fallito:", error.message);
    return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
  }

  await createAdminClient().from("audit_logs").insert({
    user_id: user.id,
    action: "settings.groq_key_saved",
    source: "settings",
    payload: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("users")
    .update({ groq_key_encrypted: null })
    .eq("id", user.id);
  if (error) {
    console.error("Rimozione chiave Groq fallita:", error.message);
    return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
  }

  await createAdminClient().from("audit_logs").insert({
    user_id: user.id,
    action: "settings.groq_key_removed",
    source: "settings",
    payload: {},
  });

  return NextResponse.json({ success: true });
}
