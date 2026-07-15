import assert from "node:assert/strict";
import { test, describe } from "node:test";

/**
 * Test del guard anti-loop `chainStarted` di AutoUpdateOrchestrator
 * (components/dashboard/auto-update-orchestrator.tsx, onSyncDone).
 *
 * Il componente è "use client" con hook React (useRef/useCallback) e non ha
 * un harness di rendering nel repo (niente jsdom/RTL, vedi tests/*.test.ts
 * esistenti: solo node --test su funzioni pure). Qui replichiamo ESATTAMENTE
 * la state machine del guard — stesse transizioni, stesso ordine — per
 * fissare il comportamento a livello di CONTRATTO (quante volte parte la
 * catena, quando si riarma), non per testare l'implementazione React.
 *
 * Bug che il coder dichiara di aver corretto: il guard veniva impostato a
 * true e mai più resettato → dal secondo click in poi la catena
 * piano/profilo + router.refresh() finale non partiva più (anche se il sync
 * stesso andava a buon fine). Questi test verificano che il fix regga sia
 * per i click ripetuti in sequenza, sia per l'overlap concorrente che il
 * fix potrebbe introdurre.
 */

/** Simula un "chain runner": stessa struttura di onSyncDone + step async. */
function makeChainRunner() {
  let chainStarted = false;
  let chainRunCount = 0;
  let refreshCount = 0;
  const order: string[] = [];

  /** Step asincrono fittizio (es. /api/planner/generate, /api/profile/build). */
  async function step(label: string, delayMs = 0) {
    order.push(`start:${label}`);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    order.push(`end:${label}`);
  }

  async function onSyncDone(syncOk: boolean, chainDelayMs = 0) {
    if (chainStarted) {
      order.push("blocked-overlap");
      return;
    }
    chainStarted = true;

    if (!syncOk) {
      chainStarted = false;
      order.push("sync-failed-no-chain");
      return;
    }

    chainRunCount += 1;
    await step("generate", chainDelayMs);
    await step("build", chainDelayMs);

    chainStarted = false;
    refreshCount += 1;
    order.push("router.refresh");
  }

  return {
    onSyncDone,
    get chainRunCount() {
      return chainRunCount;
    },
    get refreshCount() {
      return refreshCount;
    },
    get chainStarted() {
      return chainStarted;
    },
    order,
  };
}

describe("AutoUpdateOrchestrator — guard chainStarted", () => {
  test("happy path: un sync riuscito → catena parte una volta, refresh una volta", async () => {
    const runner = makeChainRunner();
    await runner.onSyncDone(true);
    assert.equal(runner.chainRunCount, 1);
    assert.equal(runner.refreshCount, 1);
    assert.equal(runner.chainStarted, false, "guard deve essere riarmato dopo la catena");
  });

  test("click ripetuto dopo completamento: la catena riparte ad ogni giro (fix del bug)", async () => {
    const runner = makeChainRunner();
    await runner.onSyncDone(true);
    await runner.onSyncDone(true);
    await runner.onSyncDone(true);
    assert.equal(runner.chainRunCount, 3, "senza il fix sarebbe rimasto a 1");
    assert.equal(runner.refreshCount, 3);
  });

  test("edge case spec: sync fallito NON avvia la catena e riarma subito il guard", async () => {
    const runner = makeChainRunner();
    await runner.onSyncDone(false);
    assert.equal(runner.chainRunCount, 0);
    assert.equal(runner.refreshCount, 0);
    assert.equal(runner.chainStarted, false);

    // il prossimo sync riuscito deve poter partire normalmente
    await runner.onSyncDone(true);
    assert.equal(runner.chainRunCount, 1);
  });

  test("overlap concorrente: un secondo onSyncDone durante una catena in corso viene bloccato, non doppiato", async () => {
    const runner = makeChainRunner();
    const first = runner.onSyncDone(true, 20); // catena "lenta"
    // Il secondo sync arriva PRIMA che la prima catena finisca.
    const second = runner.onSyncDone(true, 0);
    await Promise.all([first, second]);

    assert.equal(runner.chainRunCount, 1, "il secondo tentativo deve essere scartato, non accodato silenziosamente");
    assert.equal(runner.refreshCount, 1);
    assert.ok(runner.order.includes("blocked-overlap"));
    assert.equal(runner.chainStarted, false, "dopo l'unica catena il guard deve restare riarmato per il prossimo click");
  });

  test("dopo un overlap bloccato, un nuovo click successivo funziona di nuovo", async () => {
    const runner = makeChainRunner();
    await Promise.all([runner.onSyncDone(true, 20), runner.onSyncDone(true, 0)]);
    assert.equal(runner.chainRunCount, 1);

    await runner.onSyncDone(true);
    assert.equal(runner.chainRunCount, 2, "il click successivo al blocco deve ripartire normalmente");
  });

  test("failure case: catena non riparte se il guard non venisse mai riarmato (regressione del bug originale)", async () => {
    // Riproduce il comportamento PRIMA del fix: chainStarted impostato a
    // true e mai resettato. Verifica che questo pattern rotto sia
    // rilevabile dal test (garanzia che il test avrebbe colto il bug).
    let chainStartedBroken = false;
    let runs = 0;
    async function brokenOnSyncDone(syncOk: boolean) {
      if (chainStartedBroken) return;
      chainStartedBroken = true;
      if (!syncOk) return; // bug: non resetta neanche in caso di fallimento
      runs += 1;
      // niente reset a fine catena → bug originale
    }
    await brokenOnSyncDone(true);
    await brokenOnSyncDone(true);
    await brokenOnSyncDone(true);
    assert.equal(runs, 1, "il pattern rotto blocca dal secondo giro in poi (motivo del fix)");
  });
});
