import { NextResponse, type NextRequest } from "next/server";

import {
  normalizeHrvProtocol,
  type HrvProtocol,
} from "@/lib/hrv";
import { syncIntervalsData } from "@/lib/intervals/sync";
import { createClient } from "@/lib/supabase/server";

interface HrvProtocolBody {
  protocol?: unknown;
}

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

  const body = (await request.json().catch(() => null)) as HrvProtocolBody | null;
  if (body?.protocol !== "rmssd" && body?.protocol !== "sdnn") {
    return NextResponse.json(
      { success: false, error: "invalid_protocol" },
      { status: 400 }
    );
  }
  const protocol: HrvProtocol = normalizeHrvProtocol(body.protocol);

  const { data: profile, error: readError } = await supabase
    .from("athlete_profiles")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    console.error("Lettura preferenze HRV fallita:", readError.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  const existingPreferences =
    profile?.preferences != null &&
    typeof profile.preferences === "object" &&
    !Array.isArray(profile.preferences)
      ? (profile.preferences as Record<string, unknown>)
      : {};

  const { error: saveError } = await supabase
    .from("athlete_profiles")
    .upsert(
      {
        user_id: user.id,
        preferences: {
          ...existingPreferences,
          hrv_protocol: protocol,
        },
      },
      { onConflict: "user_id" }
    );
  if (saveError) {
    console.error("Salvataggio preferenza HRV fallito:", saveError.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  // Rigenera lo snapshot affinché readiness e baseline usino subito il
  // protocollo selezionato. La preferenza resta salvata anche se Intervals
  // fosse temporaneamente non raggiungibile.
  const syncOutcome = await syncIntervalsData(user.id);

  return NextResponse.json({
    success: true,
    protocol,
    synced: syncOutcome.ok,
  });
}
