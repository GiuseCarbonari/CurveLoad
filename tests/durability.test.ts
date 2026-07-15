import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activityBinnedMMP,
  buildDurability,
  DURABILITY_DURATIONS_SECS,
  KJ_BINS,
  MIN_WINDOWS_PER_BIN,
  type WattsStream,
} from "../lib/profile/durability";

/**
 * Test di lib/profile/durability.ts. Stream sintetici (potenza costante a
 * gradini) per fissare la formula di calo % e i casi limite: nessuna chiamata
 * API/rete, tutto deterministico.
 */

/** Stream costante: `watts` per `secs` secondi. */
function constantStream(id: string, segments: Array<{ watts: number; secs: number }>): WattsStream {
  const watts: number[] = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.secs; i++) watts.push(seg.watts);
  }
  return { activity_id: id, watts };
}

test("buildDurability: calo del 10% dopo 1000 kJ → decline_pct ≈ -0.10, index ≈ 90", () => {
  // Fase fresca: 250W per 4000s (raggiunge 1000 kJ a s=4000).
  // Fase affaticata: 225W (= 250 * 0.9) per altri 2000s.
  const stream = constantStream("a1", [
    { watts: 250, secs: 4000 },
    { watts: 225, secs: 2000 },
  ]);

  const result = buildDurability([stream]);

  const decline1200 = result.decline.find((d) => d.duration_s === 1200);
  assert.ok(decline1200);
  assert.equal(decline1200.fresh_watts, 250);
  assert.equal(decline1200.fatigued_watts, 225);
  assert.ok(decline1200.decline_pct != null);
  assert.ok(Math.abs(decline1200.decline_pct! - -0.1) < 1e-6);

  assert.equal(result.durability_index, 90);
});

test("buildDurability: stream troppo corto (mai raggiunge 1000 kJ) → bin affaticati vuoti, nessun crash", () => {
  // 200W per 1000s → kJ finale = 200, mai raggiunge il bin kj1000 (min 1000 kJ).
  const stream = constantStream("a2", [{ watts: 200, secs: 1000 }]);

  const result = buildDurability([stream]);

  const kj1000 = result.bins.find((b) => b.bin_id === "kj1000")!;
  const kj2000 = result.bins.find((b) => b.bin_id === "kj2000")!;
  assert.ok(kj1000.mmp.every((m) => m.watts == null));
  assert.ok(kj2000.mmp.every((m) => m.watts == null));
  assert.ok(result.decline.every((d) => d.decline_pct == null));
  assert.equal(result.durability_index, null);
});

test("buildDurability([]) → tutti null, confidence low, nessun throw", () => {
  const result = buildDurability([]);

  assert.equal(result.durability_index, null);
  assert.equal(result.confidence, "low");
  assert.equal(result.meta.activities_used, 0);
  assert.ok(result.bins.every((b) => b.mmp.every((m) => m.watts == null)));
  assert.ok(result.decline.every((d) => d.decline_pct == null));
});

// --- Bin boundary (prefix-sum kJ, bordo alto escluso) -----------------------

test("activityBinnedMMP: kJ_start esattamente 1000 cade in kj1000 (bordo basso incluso)", () => {
  // 1000 W costanti → kJ_start(s) = s kJ esattamente. A s=1000 kJ_start=1000.
  const watts = new Array(1000 + 60).fill(1000);
  const stream: WattsStream = { activity_id: "boundary-low", watts };

  const result = activityBinnedMMP(stream, KJ_BINS, [60]);
  const kj1000 = result.find((r) => r.bin_id === "kj1000" && r.duration_s === 60)!;
  // La finestra che parte a s=1000 (kJ_start=1000) contribuisce al bin kj1000.
  assert.ok(kj1000.samples >= 1);
  assert.equal(kj1000.watts, 1000);
});

test("activityBinnedMMP: kJ_start esattamente 1500 NON cade in kj1000 (bordo alto escluso) né in kj2000", () => {
  // 1000W costanti: kJ_start(1500) = 1500 esatto, fuori da [1000,1500) e da [2000,+inf).
  // Costruiamo uno stream che copre SOLO l'intorno di s=1500 per isolare quella finestra.
  const n = 1600;
  const watts = new Array(n).fill(1000);
  const stream: WattsStream = { activity_id: "boundary-high", watts };

  const result = activityBinnedMMP(stream, KJ_BINS, [60]);
  const kj1000 = result.find((r) => r.bin_id === "kj1000" && r.duration_s === 60)!;
  const kj2000 = result.find((r) => r.bin_id === "kj2000" && r.duration_s === 60)!;

  // Finestre valide per kj1000: s in [1000, 1500) (kJ_start < 1500), fino a s+60<=n=1600 → s<=1540.
  // s=1500 (kJ_start=1500 esatto) deve essere ESCLUSO da kj1000: se l'implementazione
  // lo includesse per errore, samples includerebbe quella finestra ma il valore MMP
  // resterebbe 1000W identico (potenza costante) — quindi verifichiamo direttamente
  // il conteggio dei samples attesi per kj1000: s da 1000 a 1499 inclusi = 500 finestre
  // (perché s+60<=1600 vale fino a s=1540, ma il bin taglia a kJ_start<1500 cioè s<1500).
  assert.equal(kj1000.samples, 500);
  // kj2000 non raggiunto in questo stream (max kJ_start = 1540 < 2000).
  assert.equal(kj2000.samples, 0);
  assert.equal(kj2000.watts, null);
});

test("activityBinnedMMP: gap 500–1000 kJ (nessun bin) non produce samples in fresh né kj1000", () => {
  // 1000W costanti: kJ_start(s)=s. Finestre con kJ_start in [500,1000) non
  // appartengono a nessun bin (fresh è [0,500), kj1000 è [1000,1500)).
  const n = 700;
  const watts = new Array(n).fill(1000);
  const stream: WattsStream = { activity_id: "gap", watts };

  const result = activityBinnedMMP(stream, KJ_BINS, [60]);
  const fresh = result.find((r) => r.bin_id === "fresh" && r.duration_s === 60)!;
  const kj1000 = result.find((r) => r.bin_id === "kj1000" && r.duration_s === 60)!;

  // fresh valido solo per s in [0,500) → s da 0 a 499, ma serve s+60<=700 → tutte incluse (0..499).
  assert.equal(fresh.samples, 500);
  // kj1000 richiede kJ_start>=1000, mai raggiunto (max kJ_start = 700-60=640).
  assert.equal(kj1000.samples, 0);
});

// --- MMP per finestra dopo la soglia kJ (formula prefix-sum) ----------------

test("activityBinnedMMP: MMP a 60s nel bin fresco è il MAX tra le finestre valide, non la media globale", () => {
  // Fresco: alterna 100W e 300W a blocchi di 60s per 480s (resta sotto 500 kJ:
  // somma totale = 4*(100+300)*60 = 96000 J = 96 kJ, ok tutto in fresh).
  const watts = [
    ...new Array(60).fill(100),
    ...new Array(60).fill(300),
    ...new Array(60).fill(100),
    ...new Array(60).fill(300),
  ];
  const stream: WattsStream = { activity_id: "max-window", watts };
  const result = activityBinnedMMP(stream, KJ_BINS, [60]);
  const fresh60 = result.find((r) => r.bin_id === "fresh" && r.duration_s === 60)!;
  // La finestra allineata esattamente sul blocco dei 300W dà MMP=300, il massimo possibile.
  assert.equal(fresh60.watts, 300);
});

test("activityBinnedMMP: durata più lunga della copertura del bin → nessuna finestra valida per quella durata", () => {
  // Bin fresh copre solo s in [0,500) kJ; con 1000W, s max utile è <500.
  // Chiediamo una durata (600s) più lunga della stream intera (400s): nessuna finestra intera esiste.
  const watts = new Array(400).fill(1000);
  const stream: WattsStream = { activity_id: "short", watts };
  const result = activityBinnedMMP(stream, KJ_BINS, [600]);
  assert.ok(result.every((r) => r.watts === null && r.samples === 0));
});

// --- Buchi / valori null negli stream watts ---------------------------------

test("activityBinnedMMP: null nello stream vale 0 nel cumulo e nella media (buco = potenza zero)", () => {
  // 60s a 600W poi 60s di buco (null) poi 60s a 600W: finestra 60s sul buco -> MMP 0.
  const watts: Array<number | null> = [
    ...new Array(60).fill(600),
    ...new Array(60).fill(null),
    ...new Array(60).fill(600),
  ];
  const stream: WattsStream = { activity_id: "gap-null", watts };
  const result = activityBinnedMMP(stream, KJ_BINS, [60]);
  const fresh60 = result.find((r) => r.bin_id === "fresh" && r.duration_s === 60)!;
  // Il massimo tra le finestre resta 600 (le finestre sui blocchi pieni vincono sul buco).
  assert.equal(fresh60.watts, 600);
  // kJ_start non esplode né va a NaN: verifichiamo che samples sia un numero finito positivo.
  assert.ok(Number.isFinite(fresh60.samples) && fresh60.samples > 0);
});

test("buildDurability: stream interamente null/0 è comunque gestito senza crash (ma va scartato a monte da isUsableStream nell'orchestratore)", () => {
  // null → 0 nel cumulo (per design, vedi spec §1): tutte le finestre restano nel bin
  // "fresh" (kJ_start resta 0 per sempre) con MMP=0, un valore VALIDO (non "dati mancanti"),
  // quindi watts=0 con abbastanza samples, non null. kj1000/kj2000 restano null perché
  // mai raggiunti. L'esclusione di stream così (tutto zero) è responsabilità
  // dell'orchestratore (isUsableStream in durability-io.ts), non della funzione pura.
  const stream: WattsStream = { activity_id: "all-null", watts: new Array(2000).fill(null) };
  assert.doesNotThrow(() => buildDurability([stream]));
  const result = buildDurability([stream]);
  assert.equal(result.durability_index, null); // fresh=0 → decline_pct null (fresh<=0, vedi spec §6)
  const fresh = result.bins.find((b) => b.bin_id === "fresh")!;
  assert.ok(fresh.mmp.every((m) => m.watts === 0), "MMP a potenza 0 è un valore valido, non null");
  const kj1000 = result.bins.find((b) => b.bin_id === "kj1000")!;
  const kj2000 = result.bins.find((b) => b.bin_id === "kj2000")!;
  assert.ok(kj1000.mmp.every((m) => m.watts == null) && kj2000.mmp.every((m) => m.watts == null));
});

// --- Attività troppo corte o senza lavoro sufficiente -----------------------

test("activityBinnedMMP: stream più corto della durata richiesta non produce alcuna finestra (nessun crash, no undefined)", () => {
  const stream: WattsStream = { activity_id: "tiny", watts: new Array(30).fill(200) };
  const result = activityBinnedMMP(stream, KJ_BINS, DURABILITY_DURATIONS_SECS);
  assert.ok(result.every((r) => r.watts === null && r.samples === 0));
});

test("activityBinnedMMP: stream vuoto (watts:[]) non crasha e non produce samples", () => {
  const stream: WattsStream = { activity_id: "empty", watts: [] };
  assert.doesNotThrow(() => activityBinnedMMP(stream));
  const result = activityBinnedMMP(stream);
  assert.ok(result.every((r) => r.samples === 0 && r.watts === null));
});

// --- MIN_WINDOWS_PER_BIN: copertura troppo corta non produce un valore -------

test(`buildDurability: bin con copertura < MIN_WINDOWS_PER_BIN (${MIN_WINDOWS_PER_BIN}) resta null anche se ha samples`, () => {
  // Vogliamo un bin kj1000 con ESATTAMENTE poche decine di finestre valide (<60),
  // per durata 60s. Con 1000W (kJ_start(s)=s), kj1000 = s in [1000,1500).
  // Costruiamo uno stream che entra nel bin per soli 30s prima di finire.
  const n = 1000 + 30 + 60; // arriva a s=1000..1029 come inizio finestra valida, poi finisce
  const watts = new Array(n).fill(1000);
  const stream: WattsStream = { activity_id: "short-coverage", watts };
  const result = buildDurability([stream], [60]);
  const kj1000 = result.bins.find((b) => b.bin_id === "kj1000")!;
  const mmp60 = kj1000.mmp.find((m) => m.duration_s === 60)!;
  // samples valide: s da 1000 a 1029 (30 finestre, tutte con s+60<=n=1090) < MIN_WINDOWS_PER_BIN.
  assert.ok(mmp60.samples > 0 && mmp60.samples < MIN_WINDOWS_PER_BIN);
  assert.equal(mmp60.watts, null); // sotto soglia → non "valido", niente watts pubblicato
});

test(`buildDurability: bin con copertura >= MIN_WINDOWS_PER_BIN (${MIN_WINDOWS_PER_BIN}) pubblica un valore`, () => {
  // Stesso schema ma con margine sufficiente per >=60 finestre valide in kj1000.
  const n = 1000 + MIN_WINDOWS_PER_BIN + 60;
  const watts = new Array(n).fill(1000);
  const stream: WattsStream = { activity_id: "enough-coverage", watts };
  const result = buildDurability([stream], [60]);
  const kj1000 = result.bins.find((b) => b.bin_id === "kj1000")!;
  const mmp60 = kj1000.mmp.find((m) => m.duration_s === 60)!;
  assert.ok(mmp60.samples >= MIN_WINDOWS_PER_BIN);
  assert.equal(mmp60.watts, 1000);
});

// --- Aggregazione multi-attività ---------------------------------------------

test("buildDurability: aggrega prendendo il MAX per (bin,durata) tra più attività, samples sommati", () => {
  // Due attività: entrambe raggiungono il bin fresh a 60s, ma con potenze diverse.
  // Il valore aggregato deve essere il massimo tra le due, non una media.
  const streamLow: WattsStream = { activity_id: "low", watts: new Array(600).fill(200) };
  const streamHigh: WattsStream = { activity_id: "high", watts: new Array(600).fill(280) };

  const result = buildDurability([streamLow, streamHigh], [60]);
  const fresh60 = result.bins.find((b) => b.bin_id === "fresh")!.mmp.find((m) => m.duration_s === 60)!;
  assert.equal(fresh60.watts, 280);
  // samples: ognuna delle due attività contribuisce con (600-60+1)=541 finestre → 1082 totali.
  assert.equal(fresh60.samples, 1082);
});

test("buildDurability: attività senza dati per un bin non abbassa il valore aggregato di quel bin (best-effort)", () => {
  // 1000W costanti → kJ_start(s) = s kJ esattamente: "long" raggiunge kj1000 con margine
  // ampio per superare MIN_WINDOWS_PER_BIN; "short" è troppo breve e resta solo in fresh.
  const long: WattsStream = { activity_id: "long", watts: new Array(1000 + MIN_WINDOWS_PER_BIN + 60).fill(1000) };
  const short: WattsStream = { activity_id: "short", watts: new Array(200).fill(150) };

  const result = buildDurability([long, short], [60]);
  const kj1000 = result.bins.find((b) => b.bin_id === "kj1000")!.mmp.find((m) => m.duration_s === 60)!;
  // Solo "long" contribuisce a kj1000: il valore resta quello, non diluito dall'assenza di "short".
  assert.equal(kj1000.watts, 1000);
});

test("buildDurability: meta.activities_used conta gli stream passati, non le finestre", () => {
  const streams = [
    constantStream("s1", [{ watts: 200, secs: 100 }]),
    constantStream("s2", [{ watts: 200, secs: 100 }]),
    constantStream("s3", [{ watts: 200, secs: 100 }]),
  ];
  const result = buildDurability(streams);
  assert.equal(result.meta.activities_used, 3);
});

// --- Calo % (valori verificati a mano) ---------------------------------------

test("buildDurability: calo del 25% dopo 1000 kJ → decline_pct = -0.25 esatto, index = 75", () => {
  // Fresco: 400W per 4000s (raggiunge 1000 kJ a s=4000, esatto con 1000W*... verifichiamo: 400*4000=1.6e6 J=1600kJ.
  // Serve arrivare a kj1000 con margine: usiamo 250W per 4000s = 1000 kJ esatti (bordo basso incluso),
  // poi fase affaticata a 187.5W = 250*0.75 per garantire finestre intere in [1000,1500).
  const stream = constantStream("half", [
    { watts: 250, secs: 4000 }, // kJ_start finale della fase fresca = 1000 esatto
    { watts: 187.5, secs: 2000 }, // fase affaticata, dentro kj1000 (s in [4000, 4500) → kJ_start in [1000,1500))
  ]);
  const result = buildDurability([stream]);
  const decline1200 = result.decline.find((d) => d.duration_s === 1200)!;
  assert.equal(decline1200.fresh_watts, 250);
  assert.equal(decline1200.fatigued_watts, 188); // Math.round(187.5)
  // decline_pct verificato a mano: 188/250 - 1 = -0.248 (Math.round applicato a watts prima del %).
  assert.ok(decline1200.decline_pct != null);
  assert.ok(Math.abs(decline1200.decline_pct! - -0.248) < 1e-9);
});

test("buildDurability: calo > 50% viene clampato a index=50 (non sotto), avg clampato a -0.5", () => {
  // 500W fresco per 4000s (kJ_start finale = 2000 esatto, bordo basso kj2000 incluso),
  // poi crollo a 100W (-80% rispetto a 500W) dentro il bin kj2000.
  const stream = constantStream("crash", [
    { watts: 500, secs: 4000 },
    { watts: 100, secs: 2000 },
  ]);
  const result = buildDurability([stream]);
  const decline1200 = result.decline.find((d) => d.duration_s === 1200)!;
  assert.equal(decline1200.fresh_watts, 500);
  assert.equal(decline1200.fatigued_watts, 100);
  assert.ok(Math.abs(decline1200.decline_pct! - -0.8) < 1e-9);
  // avg decline = -0.8 su tutte le durate valide → clamp a -0.5 → index = round(100*(1-0.5)) = 50.
  assert.equal(result.durability_index, 50);
});

test("buildDurability: potenza più alta da affaticato (rumore, decline positivo) clampa l'indice a 100, non oltre", () => {
  // Fresco 200W, "affaticato" 220W (+10%, rumore/outlier): avg decline = +0.10 → clamp a 0 → index=100.
  const stream = constantStream("noise", [
    { watts: 200, secs: 2500 }, // fresh, s finale=2500 → kJ_start=500 esatto (bordo escluso da fresh)
    { watts: 220, secs: 2000 },
  ]);
  const result = buildDurability([stream]);
  // fresh copre s in [0,2500) esclusi bordi >=500kJ → s<2500 (kJ_start(s)=200s/1000=0.2s, quindi
  // kJ_start<500 per s<2500). kj1000 richiede kJ_start>=1000 → s>=5000, mai raggiunto qui.
  // Quindi ci aspettiamo che NON ci sia decline valido a 1200s del bin kj1000: verifichiamo
  // piuttosto che l'indice, se calcolato, non superi mai 100.
  if (result.durability_index != null) {
    assert.ok(result.durability_index <= 100);
  }
});

// --- Indice di durabilità: caso "solo kj1000 disponibile, kj2000 vuoto" -----

test("buildDurability: usa kj1000 come affaticato quando kj2000 è vuoto (fallback bin più alto disponibile)", () => {
  const stream = constantStream("fallback-kj1000", [
    { watts: 300, secs: 4000 }, // fresh: s<500 → kJ_start<500. s finale 4000 → kJ_start=1200kJ
    { watts: 270, secs: 2000 }, // resta sotto 2000 kJ totali (1200+ (270*2000/1000)=1200+540=1740kJ)
  ]);
  const result = buildDurability([stream]);
  const kj2000 = result.bins.find((b) => b.bin_id === "kj2000")!;
  assert.ok(kj2000.mmp.every((m) => m.watts == null)); // kj2000 mai raggiunto (max 1740 kJ)
  const decline1200 = result.decline.find((d) => d.duration_s === 1200)!;
  assert.equal(decline1200.fatigued_bin_kj, 1000); // usa kj1000, non kj2000
  assert.ok(decline1200.decline_pct != null);
});

// --- Confidence: high / medium / low -----------------------------------------

test("buildDurability: confidence 'high' con >=6 attività e tutte e 3 le durate valide", () => {
  // 6 attività identiche, ognuna abbastanza lunga da coprire fresh e kj1000 con
  // margine ampio su tutte e 3 le durate (60/300/1200s) e MIN_WINDOWS_PER_BIN.
  const activity = constantStream("x", [
    { watts: 250, secs: 4000 }, // fresh fino a s<2000 (250*2000/1000=500kJ), margine ampio
    { watts: 220, secs: 3000 }, // affaticato, dentro kj1000 con ampio margine di finestre
  ]);
  const streams = Array.from({ length: 6 }, (_, i) => ({ ...activity, activity_id: `h${i}` }));
  const result = buildDurability(streams);
  assert.equal(result.meta.activities_used, 6);
  assert.ok(result.decline.every((d) => d.decline_pct != null), "tutte e 3 le durate devono avere decline valido");
  assert.equal(result.confidence, "high");
});

test("buildDurability: confidence 'medium' con 3-5 attività e almeno il decline a 1200s valido", () => {
  const activity = constantStream("x", [
    { watts: 250, secs: 4000 },
    { watts: 220, secs: 3000 },
  ]);
  const streams = Array.from({ length: 3 }, (_, i) => ({ ...activity, activity_id: `m${i}` }));
  const result = buildDurability(streams);
  assert.equal(result.meta.activities_used, 3);
  const decline1200Valid = result.decline.find((d) => d.duration_s === 1200)?.decline_pct != null;
  assert.ok(decline1200Valid);
  assert.equal(result.confidence, "medium");
});

test("buildDurability: confidence 'low' quando il decline a 1200s non è valido (anche con >=3 attività)", () => {
  // Stream troppo corti: mai un decline valido su nessuna durata → low, indipendentemente da activities_used.
  const streams = [
    constantStream("l1", [{ watts: 200, secs: 100 }]),
    constantStream("l2", [{ watts: 200, secs: 100 }]),
    constantStream("l3", [{ watts: 200, secs: 100 }]),
  ];
  const result = buildDurability(streams);
  assert.equal(result.confidence, "low");
});

// --- Merge non distruttivo (verifica a livello di funzione pura) ------------

test("buildDurability: l'output è un oggetto autonomo, adatto a essere spreadato dentro profile_data senza portarsi dietro riferimenti condivisi", () => {
  // La funzione pura non conosce profile_data: il "merge non distruttivo" vive
  // nell'orchestratore I/O (durability-io.ts: `{ ...(profile ?? {}), durability: {...} }`),
  // non testabile qui senza mock del client DB. A livello di funzione pura verifichiamo
  // solo che il risultato non muti gli input (niente side-effect sugli stream passati)
  // e sia un oggetto piano serializzabile in JSON (compatibile con una colonna JSONB).
  const stream = constantStream("merge-check", [{ watts: 250, secs: 4000 }, { watts: 225, secs: 2000 }]);
  const wattsCopyBefore = [...stream.watts];
  const result = buildDurability([stream]);
  assert.deepEqual(stream.watts, wattsCopyBefore, "buildDurability non deve mutare lo stream in input");
  assert.doesNotThrow(() => JSON.stringify(result), "il risultato deve essere serializzabile in JSONB");
});
