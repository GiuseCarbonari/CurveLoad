import { NextResponse, type NextRequest } from "next/server";

import { DOSSIER_COLUMNS, type DossierColumn } from "@/lib/onboarding/dossier";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/save — persiste uno step dell'onboarding (PRD §12).
 *
 * Ogni step del wizard salva qui, così chiudere a metà non perde dati. Scrive
 * col client UTENTE (RLS: l'utente possiede la propria riga users e
 * athlete_profiles). Tre pezzi indipendenti, tutti opzionali nel body:
 *  - consent: aggiorna users.gdpr_consent (+ consensi granulari) — step 3;
 *  - profile: patch del dossier (solo colonne whitelisted) — step 5/6;
 *  - step/complete: avanzamento wizard e chiusura — onboarding_completed
 *    diventa true SOLO con complete (step 7).
 */

interface SaveBody {
  step?: number;
  consent?: boolean;
  complete?: boolean;
  profile?: Record<string, unknown>;
}

const ALLOWED = new Set<string>(DOSSIER_COLUMNS);

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

  const body = (await request.json().catch(() => null)) as SaveBody | null;
  if (!body) {
    return NextResponse.json(
      { success: false, error: "bad_request" },
      { status: 400 }
    );
  }

  // --- Consenso privacy (step 3) ---------------------------------------------
  if (body.consent === true) {
    const { error } = await supabase
      .from("users")
      .update({
        gdpr_consent: true,
        // Il testo del consenso copre dati di allenamento e benessere +
        // trattamento per piani personalizzati: alziamo anche i consensi
        // granulari già previsti dallo schema (§24.2).
        consent_health_data: true,
        consent_ai_processing: true,
      })
      .eq("id", user.id);
    if (error) {
      console.error("Salvataggio consenso fallito:", error.message);
      return NextResponse.json(
        { success: false, error: "internal_error" },
        { status: 500 }
      );
    }
  }

  // --- Patch dossier + stato wizard ------------------------------------------
  const patch: Record<string, unknown> = { user_id: user.id };

  if (body.profile) {
    for (const [key, value] of Object.entries(body.profile)) {
      if (ALLOWED.has(key)) patch[key as DossierColumn] = value;
    }
  }

  if (typeof body.step === "number" && body.step >= 0 && body.step <= 7) {
    patch.onboarding_step = body.step;
  }
  if (body.complete === true) {
    patch.onboarding_completed = true;
  }

  // Scrivi solo se c'è qualcosa oltre a user_id (lo step "solo consenso" no).
  if (Object.keys(patch).length > 1) {
    const { error } = await supabase
      .from("athlete_profiles")
      .upsert(patch, { onConflict: "user_id" });
    if (error) {
      console.error("Salvataggio dossier fallito:", error.message);
      return NextResponse.json(
        { success: false, error: "internal_error" },
        { status: 500 }
      );
    }
  }

  if (body.complete === true) {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "onboarding.completed",
      source: "onboarding",
      payload: {},
    });
  }

  return NextResponse.json({ success: true });
}
