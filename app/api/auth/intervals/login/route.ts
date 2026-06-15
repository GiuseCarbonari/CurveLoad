import crypto from "crypto";
import { NextResponse } from "next/server";

import {
  INTERVALS_AUTHORIZE_URL,
  INTERVALS_SCOPES,
  OAUTH_STATE_COOKIE,
} from "@/lib/intervals/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/intervals/login — avvia il flusso OAuth verso Intervals.icu.
 *
 * Cosa fa: genera uno state CSRF casuale, lo salva in un cookie httpOnly
 * e reindirizza l'utente alla consent page di Intervals.icu.
 *
 * Perché lo state: senza, un attaccante potrebbe forgiare un callback e
 * agganciare il PROPRIO account Intervals alla sessione della vittima
 * (login CSRF). Il callback accetta solo richieste il cui state coincide
 * col cookie emesso qui.
 */
export async function GET(request: Request) {
  // L'utente deve già avere una sessione Supabase: il callback dovrà
  // sapere a quale user_id agganciare la connessione Intervals.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomBytes(32).toString("hex");

  const authorizeUrl = new URL(INTERVALS_AUTHORIZE_URL);
  authorizeUrl.searchParams.set(
    "client_id",
    process.env.INTERVALS_OAUTH_CLIENT_ID!
  );
  authorizeUrl.searchParams.set(
    "redirect_uri",
    process.env.INTERVALS_REDIRECT_URI!
  );
  authorizeUrl.searchParams.set("scope", INTERVALS_SCOPES);
  authorizeUrl.searchParams.set("state", state);
  // Parametro standard OAuth2 (authorization code flow).
  authorizeUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(authorizeUrl);
  // httpOnly: lo state non deve essere leggibile da JS.
  // SameSite=Lax: il cookie viene inviato sul redirect top-level di ritorno
  // da intervals.icu, ma non su richieste cross-site forgiate.
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minuti: il consent flow non deve restare aperto a lungo
    path: "/",
  });
  return response;
}
