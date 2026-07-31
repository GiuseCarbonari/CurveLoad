import assert from "node:assert/strict";
import { test } from "node:test";

import { pickApiKey } from "../lib/ai/resolve-key";

test("pickApiKey: chiave utente vince sul fallback", () => {
  const resolved = pickApiKey("chiave-utente", "chiave-fallback");
  assert.deepEqual(resolved, { apiKey: "chiave-utente", source: "user" });
});

test("pickApiKey: senza chiave utente usa il fallback", () => {
  const resolved = pickApiKey(null, "chiave-fallback");
  assert.deepEqual(resolved, { apiKey: "chiave-fallback", source: "fallback" });
});

test("pickApiKey: nessuna delle due -> null", () => {
  assert.equal(pickApiKey(null, null), null);
});
