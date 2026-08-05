import assert from "node:assert/strict";
import { test } from "node:test";

import { computeReadiness, computeRiHistory, type ReadinessInputDay } from "../lib/readiness";
import { wellnessOf } from "../lib/intervals/sync";
import type { WellnessDay } from "../lib/intervals-client";
import {
  computeRecoveryCalibration,
  recoveryInputsFromPreferences,
  EMPTY_RECOVERY_INPUTS,
  type RecoveryInputs,
} from "../lib/recovery/baselines";

/**
 * Il contratto di questo modulo è: o le soglie sono davvero personali, o non
 * ci sono affatto e si torna a quelle fisse. Una via di mezzo — soglie
 * "personali" stimate su quattro giorni — sarebbe peggio di entrambe.
 */

/** Serie di giorni con HRV/FC riposo controllati; l'ultimo è "oggi". */
function series(
  count: number,
  fn: (i: number) => Partial<ReadinessInputDay> = () => ({})
): ReadinessInputDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    ctl: 60,
    atl: 60,
    restingHR: 48,
    hrv: 70,
    sleepSecs: 8 * 3600,
    ...fn(i),
  }));
}

const inputs = (o: Partial<RecoveryInputs> = {}): RecoveryInputs => ({
  ...EMPTY_RECOVERY_INPUTS,
  ...o,
});

test("rodaggio: storia corta → nessuna soglia personale, si resta su quelle fisse", () => {
  const cal = computeRecoveryCalibration(series(5), "rmssd", inputs());
  assert.equal(cal.hrvSignal, null);
  assert.equal(cal.rhrThresholds, null);
  assert.equal(cal.sleepThresholds.amberBelow, 7);
  assert.equal(cal.acwrThresholds.amber, 1.3);
});

test("compliance bassa: <3 misure HRV negli ultimi 7 giorni → nessuna soglia HRV personale", () => {
  // 30 giorni di storico pieno, ma nell'ultima settimana solo 2 misure.
  const days = series(30, (i) => (i >= 23 && i < 28 ? { hrv: null } : {}));
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.equal(cal.hrvSignal, null);
  assert.match(cal.pending.join(" "), /servono 3 misure/);
  // Le soglie FC riposo però restano calcolabili: sono indipendenti.
  assert.ok(cal.rhrThresholds);
});

test("storico sufficiente: HRV dentro il proprio range → verde, non allarmi", () => {
  // Oscillazione naturale ±3ms attorno a 70: nessun giorno è "anomalo".
  const days = series(30, (i) => ({ hrv: 70 + (i % 3) - 1 }));
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.ok(cal.hrvSignal);
  assert.equal(cal.hrvSignal.status, "green");
  assert.equal(cal.hrvSignal.belowNormal, false);
});

test("HRV: media mobile 7g ben sotto il range personale → rosso", () => {
  const days = series(30, (i) => ({
    hrv: i < 23 ? 70 + (i % 3) - 1 : 45, // ultima settimana crollata
  }));
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.ok(cal.hrvSignal);
  assert.equal(cal.hrvSignal.status, "red");
  assert.equal(cal.hrvSignal.belowNormal, true);
});

test("HRV: un calo che le soglie fisse chiamerebbero ambra, ma è dentro la TUA oscillazione, resta verde", () => {
  // Atleta molto variabile (50-90ms). Media 7g a ~63: −11% sulla media
  // storica farebbe scattare la vecchia soglia del 10%, ma è dentro ±1 SD.
  const days = series(30, (i) =>
    i < 23 ? { hrv: [50, 90, 60, 85, 55, 80, 70][i % 7] } : { hrv: 63 }
  );
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.ok(cal.hrvSignal);
  assert.equal(cal.hrvSignal.status, "green");
});

test("marker precoce: CV che collassa mentre la media scende → avviso, mai uno stop", () => {
  const days = series(30, (i) =>
    i < 23
      ? { hrv: [50, 90, 60, 85, 55, 80, 70][i % 7] } // molto variabile
      : { hrv: 66 } // piatto e sotto la media storica (~70)
  );
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.ok(cal.earlyWarning);
  assert.match(cal.earlyWarning, /appiattita/);

  // L'avviso non tocca la decisione: la ladder resta libera di dire GO.
  const result = computeReadiness(days.at(-1)!, days.slice(-8, -1), {
    calibration: cal,
  });
  assert.equal(result.decision, "GO");
  assert.equal(result.earlyWarning, cal.earlyWarning);
});

test("chi non traccia l'HRV: il segnale sparisce, non viene resuscitato dal carry-forward", () => {
  const days = series(30);
  const cal = computeRecoveryCalibration(
    days,
    "rmssd",
    inputs({ traccia_hrv: "no" })
  );
  assert.equal(cal.suppressHrv, true);
  assert.equal(cal.hrvSignal, null);

  const result = computeReadiness(days.at(-1)!, days.slice(-8, -1), {
    calibration: cal,
    lastKnownHrv: { value: 70, date: "2026-05-01" },
  });
  const hrv = result.signals.find((s) => s.name === "hrv");
  assert.equal(hrv?.status, "unavailable");
  assert.match(hrv?.detail ?? "", /non tracciata/);
  // Senza HRV non può esistere un Recovery Index.
  assert.equal(result.signals.find((s) => s.name === "ri")?.value, null);
});

test("sonno: chi dorme 6h di suo non prende ambra a 6h", () => {
  const days = series(30, () => ({ sleepSecs: 6 * 3600 }));
  const cal = computeRecoveryCalibration(
    days,
    "rmssd",
    inputs()
  );
  assert.equal(cal.sleepThresholds.amberBelow, 5);

  const result = computeReadiness(days.at(-1)!, days.slice(-8, -1), {
    calibration: cal,
  });
  assert.equal(result.signals.find((s) => s.name === "sleep")?.status, "green");

  // Senza la risposta, le stesse 6 ore restano ambra (soglia fissa a 7h).
  const fixed = computeReadiness(days.at(-1)!, days.slice(-8, -1));
  assert.equal(fixed.signals.find((s) => s.name === "sleep")?.status, "amber");
});

test("sonno: la soglia esce dalla mediana misurata, non da una dichiarazione", () => {
  const days = series(30, () => ({ sleepSecs: 6.5 * 3600 }));
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.equal(cal.sleepThresholds.amberBelow, 5.5);
  assert.match(
    cal.applied.find((n: string) => n.startsWith("Soglie sonno")) ?? "",
    /misurate \(mediana 6\.5h\)/
  );

  const result = computeReadiness(days.at(-1)!, days.slice(-8, -1), {
    calibration: cal,
  });
  assert.equal(result.signals.find((s) => s.name === "sleep")?.status, "green");
});

test("chi non misura il sonno non perde niente togliendo il campo dichiarato", () => {
  // È la ragione per cui la domanda sulle ore tipiche è stata rimossa: senza
  // notti misurate il segnale sonno è "non disponibile" a prescindere, quindi
  // nessuna soglia — personale o dichiarata — verrebbe mai applicata.
  const days = series(30, () => ({ sleepSecs: null }));
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.equal(cal.sleepThresholds.amberBelow, 7);
  assert.ok(!cal.applied.some((n: string) => n.startsWith("Soglie sonno")));

  const result = computeReadiness(days.at(-1)!, days.slice(-8, -1), {
    calibration: cal,
  });
  assert.equal(
    result.signals.find((s) => s.name === "sleep")?.status,
    "unavailable"
  );
});

test("sonno: poche notti misurate → soglie standard, ma scritto in chiaro", () => {
  const days = series(30, (i) => ({ sleepSecs: i >= 27 ? 7 * 3600 : null }));
  const cal = computeRecoveryCalibration(days, "rmssd", inputs());
  assert.equal(cal.sleepThresholds.amberBelow, 7);
  assert.match(cal.pending.join(" "), /servono 7 notti misurate, ne hai 3/);
});

test("le note raccontano le soglie DEFINITIVE, non quelle prima degli aggiustamenti", () => {
  // Notti tipiche 7h → 6.0/5.0, ma lo stress alto alza l'ambra a 6.5: la nota
  // deve dire 6.5, altrimenti mostra un numero che il motore non usa.
  const cal = computeRecoveryCalibration(
    series(30, () => ({ sleepSecs: 7 * 3600 })),
    "rmssd",
    inputs({ stress_vita: 5 })
  );
  assert.equal(cal.sleepThresholds.amberBelow, 6.5);
  const nota = cal.applied.find((n: string) => n.startsWith("Soglie sonno"));
  assert.ok(nota, "manca la nota sul sonno");
  assert.match(nota, /6\.5h/);
  assert.ok(!nota.includes("6.0h"), `la nota mostra la soglia pre-stress: ${nota}`);

  // Stesso principio sul carico: 1.3 − 0.05 = 1.25.
  assert.equal(cal.acwrThresholds.amber, 1.25);
  assert.ok(cal.applied.some((n: string) => n.includes("1.25")));
});

test("infortuni ricorrenti: ACWR 1.25 diventa MODIFY, senza la dichiarazione resta GO", () => {
  const cal = computeRecoveryCalibration(
    series(30),
    "rmssd",
    inputs({ infortuni_ricorrenti: true })
  );
  assert.equal(cal.acwrThresholds.amber, 1.2);

  const today: ReadinessInputDay = {
    date: "2026-06-30",
    ctl: 100,
    atl: 125, // ACWR 1.25
    restingHR: 48,
    hrv: 70,
    sleepSecs: 8 * 3600,
  };
  const history = series(7);
  assert.equal(
    computeReadiness(today, history, { calibration: cal }).decision,
    "MODIFY"
  );
  assert.equal(computeReadiness(today, history).decision, "GO");
});

test("avvertenza personale: compare solo quando il segnale che la riguarda non è verde", () => {
  const cal = computeRecoveryCalibration(
    series(30),
    "rmssd",
    inputs({ stile_strafare: "volume_troppo_in_fretta" })
  );
  const base = { date: "2026-06-30", restingHR: 48, hrv: 70, sleepSecs: 8 * 3600 };

  const carico = computeReadiness(
    { ...base, ctl: 100, atl: 140 }, // ACWR 1.4 → ambra
    series(7),
    { calibration: cal }
  );
  assert.ok(carico.reasons.some((r) => r.includes("volume troppo in fretta")));

  const normale = computeReadiness({ ...base, ctl: 100, atl: 100 }, series(7), {
    calibration: cal,
  });
  assert.ok(!normale.reasons.some((r) => r.includes("volume troppo in fretta")));
});

test("computeRiHistory: la regola 'RI < 0.7 per 2+ giorni' ora può davvero scattare", () => {
  // 7 giorni normali, poi 3 giorni con HRV crollata e FC riposo alta.
  const days = series(20, (i) =>
    i >= 17 ? { hrv: 40, restingHR: 60 } : {}
  );
  const riHistory = computeRiHistory(days, "rmssd");
  const below = riHistory.filter((v) => v != null && v < 0.7).length;
  assert.ok(below >= 2, `attesi 2+ giorni sotto 0.7, trovati ${below}`);

  const result = computeReadiness(days.at(-1)!, days.slice(-8, -1), {
    riHistory,
  });
  assert.equal(result.decision, "SKIP");

  // Senza la serie (il bug di prima) la stessa situazione non scattava a P1.
  const senzaSerie = computeReadiness(days.at(-1)!, days.slice(-8, -1));
  assert.notEqual(senzaSerie.priority, 1);
});

test("chi misura l'HRV 3 volte a settimana arriva alle soglie personali", () => {
  // È la compliance minima valida secondo Plews 2014, e con la vecchia
  // finestra a 30 giorni non ci arrivava MAI: il riferimento era di 24 giorni,
  // cioè ~10 misure, sotto le 14 richieste. Con 60 giorni ce la fa.
  const treAllaSettimana = (i: number) =>
    [0, 2, 4].includes(i % 7) ? { hrv: 70 + (i % 5) - 2 } : { hrv: null };

  const a30giorni = computeRecoveryCalibration(
    series(31, treAllaSettimana),
    "rmssd",
    inputs()
  );
  assert.equal(a30giorni.hrvSignal, null, "con 30 giorni non ce la faceva");

  const a60giorni = computeRecoveryCalibration(
    series(61, treAllaSettimana),
    "rmssd",
    inputs()
  );
  assert.ok(a60giorni.hrvSignal, "con 60 giorni le soglie devono diventare sue");
  assert.ok(a60giorni.applied.some((n: string) => n.includes("Soglie HRV personali")));
  assert.equal(a60giorni.pending.length, 0);
});

test("chi non ha ancora storico lo legge scritto, invece di restare al buio", () => {
  const cal = computeRecoveryCalibration(series(5), "rmssd", inputs());
  // Transitorie: spariranno da sole → vanno in dashboard.
  assert.ok(cal.pending.some((n: string) => n.includes("HRV")));
  assert.ok(cal.pending.some((n: string) => n.includes("FC riposo")));
  // Niente da raccontare fra le permanenti: nessuna soglia è ancora sua.
  assert.equal(cal.applied.length, 0);
});

test("wellnessOf legge anche gli snapshot vecchi, senza far esplodere la pagina", () => {
  const giorno: WellnessDay = {
    date: "2026-06-01",
    ctl: 60,
    atl: 60,
    rampRate: null,
    weight: null,
    restingHR: 48,
    hrv: 70,
    hrvSDNN: null,
    sleepSecs: 8 * 3600,
    soreness: null,
    fatigue: null,
    mood: null,
  };
  assert.deepEqual(wellnessOf({ wellness: [giorno] }), [giorno]);
  // Snapshot salvato prima del passaggio a 60 giorni: deve ancora leggersi.
  assert.deepEqual(wellnessOf({ wellness_30d: [giorno] }), [giorno]);
  assert.deepEqual(wellnessOf(null), []);
  assert.deepEqual(wellnessOf({}), []);
});

test("preferenze corrotte non stringono mai una soglia per sbaglio", () => {
  const parsed = recoveryInputsFromPreferences({
    recovery: {
      traccia_hrv: "forse",
      stress_vita: 12,
      infortuni_ricorrenti: "sì", // non un booleano
      stile_strafare: "qualcos_altro",
    },
  });
  assert.deepEqual(parsed, EMPTY_RECOVERY_INPUTS);
  assert.deepEqual(recoveryInputsFromPreferences(null), EMPTY_RECOVERY_INPUTS);
  assert.deepEqual(
    recoveryInputsFromPreferences({ hrv_protocol: "sdnn" }),
    EMPTY_RECOVERY_INPUTS
  );
});
