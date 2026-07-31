import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_NOTE_CHARS,
  NOTE_MARKER,
  extractCoachNotes,
} from "../lib/ai/coach-memory";

/**
 * Test del validatore "output vincolato" del taccuino del coach (Passo 5):
 * la riga NOTE_COACH si stacca dal commento e solo le note valide passano.
 */

const COMMENT = "Primo paragrafo.\n\nSecondo paragrafo.\n\nTerzo paragrafo.";

test("extractCoachNotes: riga NOTE_COACH staccata e note valide estratte", () => {
  const raw = `${COMMENT}\n${NOTE_MARKER} [{"tipo": "osservazione", "nota": "Cala sui 5min rispetto all'anno scorso"}, {"tipo": "traguardo", "nota": "Nuovo record sui 5s"}]`;
  const { comment, notes, discarded } = extractCoachNotes(raw);
  assert.equal(comment, COMMENT);
  assert.deepEqual(notes, [
    { tipo: "osservazione", nota: "Cala sui 5min rispetto all'anno scorso" },
    { tipo: "traguardo", nota: "Nuovo record sui 5s" },
  ]);
  assert.equal(discarded, 0);
});

test("extractCoachNotes: marker assente -> commento intatto, zero note", () => {
  const { comment, notes, discarded } = extractCoachNotes(`${COMMENT}\n`);
  assert.equal(comment, COMMENT);
  assert.deepEqual(notes, []);
  assert.equal(discarded, 0);
});

test("extractCoachNotes: array vuoto -> zero note, commento pulito", () => {
  const { comment, notes } = extractCoachNotes(`${COMMENT}\n${NOTE_MARKER} []`);
  assert.equal(comment, COMMENT);
  assert.deepEqual(notes, []);
});

test("extractCoachNotes: JSON rotto -> il marker sparisce comunque dal commento", () => {
  const { comment, notes } = extractCoachNotes(
    `${COMMENT}\n${NOTE_MARKER} [{"tipo": "osserv`
  );
  assert.equal(comment, COMMENT);
  assert.deepEqual(notes, []);
});

test("extractCoachNotes: JSON non-array -> zero note", () => {
  const { notes } = extractCoachNotes(
    `${COMMENT}\n${NOTE_MARKER} {"tipo": "osservazione", "nota": "x"}`
  );
  assert.deepEqual(notes, []);
});

test("extractCoachNotes: tipo fuori allowlist o nota vuota -> scartate e contate", () => {
  const raw = `${COMMENT}\n${NOTE_MARKER} [{"tipo": "segreto", "nota": "x"}, {"tipo": "preferenza", "nota": "  "}, {"tipo": "preferenza", "nota": "Preferisce le salite lunghe"}]`;
  const { notes, discarded } = extractCoachNotes(raw);
  assert.deepEqual(notes, [
    { tipo: "preferenza", nota: "Preferisce le salite lunghe" },
  ]);
  assert.equal(discarded, 2);
});

test("extractCoachNotes: cap a 3 note, le eccedenti contate come scartate", () => {
  const items = Array.from({ length: 5 }, (_, i) =>
    JSON.stringify({ tipo: "osservazione", nota: `Nota ${i}` })
  ).join(", ");
  const { notes, discarded } = extractCoachNotes(
    `${COMMENT}\n${NOTE_MARKER} [${items}]`
  );
  assert.equal(notes.length, 3);
  assert.equal(discarded, 2);
});

test("extractCoachNotes: nota troppo lunga troncata al cap della migration", () => {
  const long = "x".repeat(MAX_NOTE_CHARS + 50);
  const { notes } = extractCoachNotes(
    `${COMMENT}\n${NOTE_MARKER} [{"tipo": "infortunio", "nota": "${long}"}]`
  );
  assert.equal(notes[0].nota.length, MAX_NOTE_CHARS);
});

test("extractCoachNotes: array JSON a capo dopo il marker viene parsato", () => {
  const raw = `${COMMENT}\n${NOTE_MARKER}\n[{"tipo": "traguardo",\n"nota": "CP in crescita"}]`;
  const { comment, notes } = extractCoachNotes(raw);
  assert.equal(comment, COMMENT);
  assert.deepEqual(notes, [{ tipo: "traguardo", nota: "CP in crescita" }]);
});
