import assert from "node:assert/strict";
import { test } from "node:test";

import { hasHealthNote } from "../lib/planner/health-flag";

test("hasHealthNote: true con un solo campo pieno", () => {
  assert.equal(hasHealthNote({ dolore_attuale: "ginocchio destro" }), true);
  assert.equal(hasHealthNote({ farmaci_integratori: "ibuprofene" }), true);
  assert.equal(hasHealthNote({ limiti_principali: "schiena" }), true);
});

test("hasHealthNote: false con tutti vuoti/spazi/null", () => {
  assert.equal(hasHealthNote({}), false);
  assert.equal(
    hasHealthNote({
      dolore_attuale: null,
      farmaci_integratori: null,
      limiti_principali: null,
    }),
    false
  );
  assert.equal(
    hasHealthNote({
      dolore_attuale: "",
      farmaci_integratori: "   ",
      limiti_principali: undefined,
    }),
    false
  );
});
