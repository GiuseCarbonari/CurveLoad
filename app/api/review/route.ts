import { NextResponse } from "next/server";

import { generateWeeklyReview } from "@/lib/review/review-io";
import type { FeelAnswers } from "@/lib/review/feel";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/review — genera la review della settimana appena chiusa dalle
 * risposte del questionario. Route sottile sul modello di
 * /api/profile/philosophy: verifica l'identità e delega a
 * generateWeeklyReview() (lib/review/review-io.ts).
 */

export const dynamic = "force-dynamic";

const SCALE = new Set([1, 2, 3, 4, 5]);
const MAX_TEXT_CHARS = 500;

function parseScale(value: unknown): (1 | 2 | 3 | 4 | 5) | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && SCALE.has(n) ? (n as 1 | 2 | 3 | 4 | 5) : null;
}

function parseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_TEXT_CHARS) : null;
}

function parseFeel(body: unknown): FeelAnswers | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const energia = parseScale(b.energia);
  const sonno = parseScale(b.sonno);
  const dolori = parseScale(b.dolori);
  const stress = parseScale(b.stress);
  const motivazione = parseScale(b.motivazione);
  if (energia == null || sonno == null || dolori == null || stress == null || motivazione == null) {
    return null;
  }
  return {
    energia,
    sonno,
    dolori,
    stress,
    motivazione,
    sedute_migliori: parseText(b.sedute_migliori),
    sedute_peggiori: parseText(b.sedute_peggiori),
    note: parseText(b.note),
  };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized", message: "Non autenticato" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const feel = parseFeel(body);
  if (!feel) {
    return NextResponse.json(
      {
        success: false,
        error: "invalid_body",
        message: "Rispondi a tutte le domande (scala 1-5) prima di generare la review.",
      },
      { status: 400 }
    );
  }

  const result = await generateWeeklyReview(user.id, feel);

  if (result.ok) {
    return NextResponse.json({ success: true, week_start: result.weekStart });
  }

  switch (result.reason) {
    case "not_connected":
      return NextResponse.json(
        {
          success: false,
          error: "not_connected",
          message: "Collega prima Intervals.icu in Impostazioni.",
        },
        { status: 409 }
      );
    case "no_snapshot":
      return NextResponse.json(
        {
          success: false,
          error: "no_snapshot",
          message: "Nessun dato sincronizzato: premi «Aggiorna dati» in Oggi prima di generare la review.",
        },
        { status: 409 }
      );
    case "no_api_key":
      return NextResponse.json(
        {
          success: false,
          error: "no_api_key",
          message: "Commento AI non configurato su questo server.",
        },
        { status: 409 }
      );
    case "invalid_user_key":
      return NextResponse.json(
        {
          success: false,
          error: "invalid_user_key",
          message: "La tua API key Groq non è valida: controllala nelle impostazioni.",
        },
        { status: 409 }
      );
    case "ai_error":
      return NextResponse.json(
        {
          success: false,
          error: "ai_error",
          message: "Generazione della review fallita, riprova tra poco.",
        },
        { status: 502 }
      );
    default:
      return NextResponse.json(
        { success: false, error: "internal_error", message: "Errore interno, riprova" },
        { status: 500 }
      );
  }
}
