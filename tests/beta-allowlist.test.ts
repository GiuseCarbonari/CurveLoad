import assert from "node:assert/strict";
import { test } from "node:test";

import { isEmailAllowed } from "../lib/auth/beta-allowlist";

test("isEmailAllowed: email in lista -> true", () => {
  assert.equal(
    isEmailAllowed("giuseppe@example.com", "giuseppe@example.com,amico@example.com"),
    true
  );
});

test("isEmailAllowed: email non in lista -> false", () => {
  assert.equal(isEmailAllowed("estraneo@example.com", "giuseppe@example.com"), false);
});

test("isEmailAllowed: confronto case-insensitive e con spazi attorno alle virgole", () => {
  assert.equal(
    isEmailAllowed("Giuseppe@Example.com", " giuseppe@example.com , amico@example.com "),
    true
  );
});

test("isEmailAllowed: variabile d'ambiente assente -> nessuno passa (fail closed)", () => {
  assert.equal(isEmailAllowed("giuseppe@example.com", undefined), false);
});

test("isEmailAllowed: variabile d'ambiente vuota -> nessuno passa", () => {
  assert.equal(isEmailAllowed("giuseppe@example.com", ""), false);
});

test("isEmailAllowed: email vuota -> false anche con lista popolata", () => {
  assert.equal(isEmailAllowed("", "giuseppe@example.com"), false);
});
