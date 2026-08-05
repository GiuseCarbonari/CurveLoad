import assert from "node:assert/strict";
import { test } from "node:test";

import { buildReviewPrompt, type ReviewPromptInput } from "../lib/ai/review-prompt";

function baseInput(overrides: Partial<ReviewPromptInput> = {}): ReviewPromptInput {
  return {
    week: { weekStart: "2026-07-27", weekEnd: "2026-08-02" },
    plan: {
      phase: "recovery",
      hardPlanned: 1,
      isDeload: false,
      phaseReason: "Fase recovery: settimana di scarico dopo il blocco.",
      mesocycleReason: null,
    },
    actual: {
      activityCount: 3,
      totalMovingMin: 163,
      totalDistanceKm: 45.2,
      totalElevationM: 546,
      totalLoad: 180,
      bySport: { bike: 3, run: 0, other: 0 },
    },
    execution: [
      {
        date: "2026-07-27",
        day: "mon",
        planned: {
          title: "Lunedì — Fondo",
          is_hard: false,
          sport: "MTB",
          estimated_duration_min: 60,
          session_objective: "Base",
          library_id: "AE-1",
        },
        status: "eseguita",
        completion: { percent: 95, label: "✓ 95%", source: "intervals" },
        activity: { id: 1, type: "MountainBikeRide", moving_time: 3600 },
        dataUnavailable: null,
      },
    ],
    feel: {
      energia: 3,
      sonno: 3,
      dolori: 1,
      stress: 3,
      motivazione: 3,
      sedute_migliori: null,
      sedute_peggiori: null,
      note: null,
    },
    divergences: [],
    trends: [],
    efficiencyTrend: null,
    context: null,
    ...overrides,
  };
}

test("buildReviewPrompt: include il JSON della settimana nell'user message", () => {
  const prompt = buildReviewPrompt(baseInput());
  assert.match(prompt.user, /"dal": "2026-07-27"/);
  assert.match(prompt.system, /NOTE_COACH/);
});

test("buildReviewPrompt: allowedNumbers include i numeri strutturati", () => {
  const prompt = buildReviewPrompt(baseInput());
  assert.ok(prompt.allowedNumbers.includes(163));
  assert.ok(prompt.allowedNumbers.includes(546));
  assert.ok(prompt.allowedNumbers.includes(95));
});

test("buildReviewPrompt: allowedNumbers include i numeri dentro le divergenze (prosa)", () => {
  const prompt = buildReviewPrompt(
    baseInput({
      divergences: [
        { code: "energia_alta_acwr_alto", text: "Energia alta, ma ACWR 1.42 è sopra soglia." },
      ],
    })
  );
  assert.ok(prompt.allowedNumbers.includes(1.42));
});

test("buildReviewPrompt: piano null non fa esplodere la costruzione", () => {
  const prompt = buildReviewPrompt(baseInput({ plan: null }));
  assert.match(prompt.user, /"piano": null/);
});

test("buildReviewPrompt: include i conteggi pronti (mai una percentuale da ricalcolare)", () => {
  const prompt = buildReviewPrompt(
    baseInput({
      execution: [
        ...baseInput().execution,
        {
          date: "2026-07-28",
          day: "tue",
          planned: {
            title: "Martedì — VO2max",
            is_hard: true,
            sport: "MTB",
            estimated_duration_min: 70,
            session_objective: "VO2max",
            library_id: "VO2-1",
          },
          status: "saltata",
          completion: null,
          activity: null,
          dataUnavailable: null,
        },
      ],
    })
  );
  assert.match(prompt.user, /"sedute": \{\s*"pianificate": 2,\s*"eseguite": 1,\s*"parziali": 0,\s*"saltate": 1,\s*"extra": 0\s*\}/);
  assert.match(prompt.system, /non dividere né calcolare MAI una percentuale nuova/);
});
