import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/auth/beta-allowlist";
import { createClient } from "@/lib/supabase/server";

/**
 * /api/auth/signup — porta d'ingresso della beta (Passo 3).
 *
 * La registrazione passa da qui (non più dal client direttamente a
 * Supabase) così l'allowlist BETA_ALLOWED_EMAILS, che vive solo lato
 * server, può bloccare le email non invitate PRIMA che l'utente venga
 * creato.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }

  if (!isEmailAllowed(email, process.env.BETA_ALLOWED_EMAILS)) {
    return NextResponse.json({ success: false, error: "not_invited" }, { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return NextResponse.json(
      { success: false, error: "supabase_error", message: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, needsEmailConfirmation: !data.session });
}
