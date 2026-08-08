import assert from "node:assert/strict";
import { test } from "node:test";

import { formatRaceTime, parseRaceTime } from "../lib/profile/race-time";

test("parseRaceTime: mm:ss e h:mm:ss validi", () => {
  assert.equal(parseRaceTime("42:15"), 42 * 60 + 15);
  assert.equal(parseRaceTime("1:32:10"), 3600 + 32 * 60 + 10);
  assert.equal(parseRaceTime(" 5:09 "), 5 * 60 + 9);
});

test("parseRaceTime: input non validi tornano null, mai un numero indovinato", () => {
  assert.equal(parseRaceTime(""), null);
  assert.equal(parseRaceTime("abc"), null);
  assert.equal(parseRaceTime("42"), null); // manca il separatore
  assert.equal(parseRaceTime("42:60"), null); // secondi fuori range
  assert.equal(parseRaceTime("1:60:00"), null); // minuti fuori range
  assert.equal(parseRaceTime("0:00"), null); // zero non è un tempo di gara
  assert.equal(parseRaceTime("1:2:3:4"), null); // troppi segmenti
});

test("formatRaceTime: round-trip con parseRaceTime", () => {
  assert.equal(formatRaceTime(42 * 60 + 15), "42:15");
  assert.equal(formatRaceTime(3600 + 32 * 60 + 10), "1:32:10");
  assert.equal(formatRaceTime(null), "—");
  assert.equal(formatRaceTime(0), "—");
});
