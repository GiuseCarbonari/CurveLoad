import assert from "node:assert/strict";
import { test } from "node:test";

import { findSportSettings } from "../lib/intervals/sync";

/**
 * findSportSettings: le zone/FTP reali dell'atleta vivono in
 * sportSettings[], non nei campi top-level del profilo (verificato via
 * probe reale, docs/INTERVALS_API_NOTES.md).
 */

test("findSportSettings: trova il gruppo Ride", () => {
  const profile = {
    sportSettings: [
      { types: ["Ride", "VirtualRide", "MountainBikeRide"], ftp: 245, lthr: 161, max_hr: 190, hr_zones: [129, 143, 150, 160, 164, 169, 190] },
      { types: ["Run", "TrailRun"], ftp: null, lthr: 171, max_hr: 188, hr_zones: [144, 152, 161, 170, 175, 180, 188] },
    ],
  };
  const bike = findSportSettings(profile, "Ride");
  assert.equal(bike?.ftp, 245);
  assert.equal(bike?.lthr, 161);
  assert.deepEqual(bike?.hr_zones, [129, 143, 150, 160, 164, 169, 190]);

  const run = findSportSettings(profile, "Run");
  assert.equal(run?.ftp, null);
  assert.equal(run?.lthr, 171);
});

test("findSportSettings: null se sportSettings assente o non è un array", () => {
  assert.equal(findSportSettings({}, "Ride"), null);
  assert.equal(findSportSettings({ sportSettings: "boh" }, "Ride"), null);
});

test("findSportSettings: null se nessun gruppo copre il tipo richiesto", () => {
  const profile = { sportSettings: [{ types: ["Swim"], ftp: null, lthr: 171, max_hr: 188, hr_zones: null }] };
  assert.equal(findSportSettings(profile, "Ride"), null);
});

test("findSportSettings: ignora voci malformate nell'array", () => {
  const profile = { sportSettings: [null, { noTypes: true }, { types: ["Ride"], ftp: 200 }] };
  const bike = findSportSettings(profile, "Ride");
  assert.equal(bike?.ftp, 200);
});
