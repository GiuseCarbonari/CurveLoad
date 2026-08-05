import assert from "node:assert/strict";
import { test } from "node:test";

import { hardSessionTrend, type HardSessionTrendPoint } from "../lib/review/trends";

test("hardSessionTrend: null sotto 3 settimane con almeno una dura pianificata", () => {
  const points: HardSessionTrendPoint[] = [
    { weekStart: "2026-07-13", hardPlanned: 2, hardCompleted: 2 },
    { weekStart: "2026-07-20", hardPlanned: 2, hardCompleted: 1 },
  ];
  assert.equal(hardSessionTrend(points), null);
});

test("hardSessionTrend: settimane senza dure pianificate non contano per la soglia", () => {
  const points: HardSessionTrendPoint[] = [
    { weekStart: "2026-07-06", hardPlanned: 0, hardCompleted: 0 },
    { weekStart: "2026-07-13", hardPlanned: 2, hardCompleted: 2 },
    { weekStart: "2026-07-20", hardPlanned: 2, hardCompleted: 1 },
  ];
  assert.equal(hardSessionTrend(points), null);
});

test("hardSessionTrend: in calo quando la % completata scende abbastanza", () => {
  const points: HardSessionTrendPoint[] = [
    { weekStart: "2026-07-06", hardPlanned: 2, hardCompleted: 2 }, // 100%
    { weekStart: "2026-07-13", hardPlanned: 2, hardCompleted: 1 },
    { weekStart: "2026-07-20", hardPlanned: 2, hardCompleted: 1 }, // 50%
  ];
  const trend = hardSessionTrend(points);
  assert.ok(trend);
  assert.match(trend!.text, /in calo/);
  assert.match(trend!.text, /100%/);
  assert.match(trend!.text, /50%/);
});

test("hardSessionTrend: in miglioramento quando la % completata sale", () => {
  const points: HardSessionTrendPoint[] = [
    { weekStart: "2026-07-06", hardPlanned: 2, hardCompleted: 1 }, // 50%
    { weekStart: "2026-07-13", hardPlanned: 2, hardCompleted: 2 },
    { weekStart: "2026-07-20", hardPlanned: 2, hardCompleted: 2 }, // 100%
  ];
  const trend = hardSessionTrend(points);
  assert.ok(trend);
  assert.match(trend!.text, /in miglioramento/);
});

test("hardSessionTrend: variazione piccola non è una tendenza", () => {
  const smallDelta: HardSessionTrendPoint[] = [
    { weekStart: "2026-07-06", hardPlanned: 10, hardCompleted: 9 }, // 90%
    { weekStart: "2026-07-13", hardPlanned: 10, hardCompleted: 9 },
    { weekStart: "2026-07-20", hardPlanned: 10, hardCompleted: 8 }, // 80%
  ];
  assert.equal(hardSessionTrend(smallDelta), null);
});
