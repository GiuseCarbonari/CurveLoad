import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ completed: false });

  const { data } = await supabase
    .from("athlete_profiles")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
  return NextResponse.json({ completed: prefs.tour_completed === true });
}

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  const { data: profile } = await supabase
    .from("athlete_profiles")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  const existing =
    profile?.preferences != null &&
    typeof profile.preferences === "object" &&
    !Array.isArray(profile.preferences)
      ? (profile.preferences as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("athlete_profiles")
    .upsert(
      { user_id: user.id, preferences: { ...existing, tour_completed: true } },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ success: false }, { status: 500 });
  return NextResponse.json({ success: true });
}
