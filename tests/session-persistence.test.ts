import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRememberAccessToCookieOptions,
  shouldRememberAccess,
} from "../lib/supabase/session-persistence";

test("remember access is enabled by default and when explicitly selected", () => {
  assert.equal(shouldRememberAccess(undefined), true);
  assert.equal(shouldRememberAccess("1"), true);
  assert.equal(shouldRememberAccess("0"), false);
});

test("session-only access removes cookie expiry", () => {
  assert.deepEqual(
    applyRememberAccessToCookieOptions(
      {
        path: "/",
        sameSite: "lax",
        maxAge: 123,
        expires: new Date("2030-01-01T00:00:00.000Z"),
      },
      false
    ),
    {
      path: "/",
      sameSite: "lax",
    }
  );
});

test("persistent access keeps expiry and logout can still delete cookies", () => {
  const persistent = { path: "/", maxAge: 123 };
  const removal = { path: "/", maxAge: 0 };

  assert.equal(
    applyRememberAccessToCookieOptions(persistent, true),
    persistent
  );
  assert.equal(applyRememberAccessToCookieOptions(removal, false), removal);
});
