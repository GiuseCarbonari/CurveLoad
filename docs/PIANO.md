# CurveLoad 2.0 — versione personale + beta amichevole, predisposta multiutente

## Come lavoriamo insieme (regole fisse, valgono per OGNI sessione)

Giuseppe NON è un programmatore e non ha mai fatto nulla del genere. Quindi:

1. **Spiegazioni da ragazzino di dieci anni.** Prima di ogni passo, Claude
   spiega COSA stiamo facendo e PERCHÉ, con parole semplici e un'analogia se
   serve. Niente sigle non spiegate. Il codice lo scrive Claude; a Giuseppe
   restano solo le azioni che può fare solo lui (creare account, cliccare,
   incollare chiavi, guardare il risultato).
2. **Verifica prima della procedura.** Quando un passo richiede azioni di
   Giuseppe su siti esterni (console Anthropic, Vercel, Supabase...), Claude
   PRIMA verifica che la procedura sia corretta e attuale (web search /
   documentazione, non memoria), POI la propone passo-passo.
3. **Un passo per sessione.** Si lavora sulla checklist qui sotto, un passo
   alla volta. Fine passo → Claude: (a) segna il passo come fatto in questo
   file, (b) aggiorna la memoria di progetto con lo stato, (c) dice a
   Giuseppe che si può chiudere la sessione. Sessioni corte = meno token.
4. **Ogni passo si chiude verificato**: test verdi + una prova che Giuseppe
   può vedere coi suoi occhi nel browser.

## Stato avanzamento (checklist — aggiornare a ogni passo completato)

- [x] **Passo 0 — Layer AI base nel codice** (fatto 2026-07-31: bottone
      "Spiega il mio profilo", 245 test verdi)
- [x] **Passo 0.b — Trasloco** (fatto 2026-07-31: piano in docs/PIANO.md, progetto copiato in curveload/, test verdi nella copia):
      1. salvare questo piano in `C:\Users\CARBO\Documents\coach-ia\docs\PIANO.md`;
      2. copiare l'intera cartella `coach-ia` in una cartella di lavoro NUOVA:
         proposta `C:\Users\CARBO\Documents\curveload` (la copia porta con sé
         anche le modifiche F1 non ancora committate e la storia git);
      3. da qui in poi si lavora SOLO in `curveload/` — `coach-ia` e
         `Giuse OS/command-center` restano intatti come backup, non si toccano più;
      4. aggiornare la memoria di progetto (nuova cartella, metodo di lavoro,
         stato checklist) e chiudere la sessione. Le prossime sessioni si
         aprono con Claude Code DENTRO `curveload/`.
- [x] **Passo 1 — La chiave di Giuseppe** (fatto 2026-07-31: provider AI =
      Groq free tier al posto di Anthropic, "fase più gratis possibile" —
      layer AI adattato in `lib/ai/groq.ts`; chiave in `.env.local` come
      `GROQ_API_KEY`; primo commento AI vero generato su dati reali,
      `audit_logs.payload.unexpected_numbers: []`, 245 test verdi)
- [x] **Passo 2 — Portafoglio chiavi dei tester (BYOK)** (fatto 2026-07-31:
      migration 020 `users.groq_key_encrypted`, `lib/ai/resolve-key.ts`
      [chiave utente → fallback, senza consumare il fallback su chiave utente
      401], card "API key Groq" in `/settings/profile` scrittura-only,
      `/api/settings/groq-key` POST/DELETE, `aiEnabled` ora vero anche con
      sola chiave propria, 248 test verdi — verificato da Giuseppe nel browser)
- [x] **Passo 3 — Porta d'ingresso della beta** (fatto 2026-07-31: allowlist
      `BETA_ALLOWED_EMAILS` in `.env.local` [carbonarigiuseppe95, cesarialessandro001,
      dadocola99, mattifagio9 @gmail.com], `lib/auth/beta-allowlist.ts`
      [`isEmailAllowed`, fail-closed se la variabile manca], registrazione
      spostata da `/api/auth/signup` [prima parlava con Supabase direttamente
      dal client] — email fuori lista bloccata con 403 prima di creare
      l'utente, 254 test verdi. Region Supabase verificata: **eu-west-3
      (Paris)**, dentro UE. Verificato da Giuseppe nel browser: email non in
      lista → messaggio "Questa beta è ad invito…")
- [x] **Passo 4 — Il cervello che vede tutto (context assembler)** (fatto
      2026-07-31: `lib/ai/context.ts` — `condenseContext` pura +
      `assembleAthleteContext` I/O; fascicolo = dossier ripulito dai campi
      vuoti + condizione dall'ultimo mirror [prontezza oggi, CTL/ATL, FTP,
      peso, qualità dati, attività ultimi 14 giorni cap 20] + ultime 10
      `coach_decisions`; memoria coach rimandata al Passo 5. Integrato in
      `buildProfileExplainPrompt(profile, context)` — i numeri del contesto
      entrano in `allowedNumbers` — e in `explain-io.ts`, che logga
      `context_sections` in `audit_logs`. 263 test verdi. Verificato da
      Giuseppe nel browser: il commento cita obiettivo CP 263→280 W e gara
      target Esatrail Super Hero, dati che vivono solo nel dossier)
- [x] **Passo 5 — La memoria del coach** (fatto 2026-07-31: migration 021
      `athlete_memory` [memory_type in allowlist preferenza/infortunio/
      traguardo/osservazione, nota text ≤300, source, RLS select-own, unique
      (user_id, nota) per dedup]; `lib/ai/coach-memory.ts` `extractCoachNotes`
      pura — l'LLM emette una riga `NOTE_COACH: [...]` in coda al commento,
      il codice la stacca e valida: output vincolato, mai scrittura libera
      nel DB; sezione `memoria` (cap 20) nel fascicolo di `lib/ai/context.ts`;
      prompt profilo chiede 0-2 note NUOVE senza ripetere memoria/dossier;
      explain-io salva con ON CONFLICT DO NOTHING e logga
      `coach_notes_saved/discarded` in audit_logs; card "📝 Taccuino del
      coach" in /profile. 273 test verdi. Verificato da Giuseppe nel browser:
      prima nota reale «tenere d'occhio i carichi di allenamento per evitare
      di esacerbare i fastidi alla schiena»)
- [x] **Passo 6 — Le altre due narrative** (fatto 2026-08-01: stesso pattern
      di explain-io/Passo 0, due copie — prompt builder puro + orchestratore
      I/O + route sottile + bottone manuale ciascuno (come il commento
      profilo: si generano solo su click, non in automatico):
      - **Oggi** (`ai_comment_oggi`): `lib/ai/oggi-explain-prompt.ts` legge
        `mirror.readiness_today` (decisione, segnali, motivi) già calcolato
        dal sync — non ricalcola nulla; `lib/dashboard/explain-oggi-io.ts`;
        `/api/dashboard/explain-oggi`; bottone "💬 Spiega la mia giornata"
        sotto il ReadinessHero in `/dashboard`.
      - **Percorso** (`ai_comment_percorso`): `lib/ai/percorso-explain-prompt.ts`
        legge `gap_analysis` + `event_terrain` + `race_estimate` (limitatori,
        salite, pacing) già salvati da `/api/profile/gap-analysis`;
        `lib/profile/explain-percorso-io.ts`; `/api/profile/explain-percorso`;
        bottone "💬 Spiega il percorso" in `/terrain` (route-card-stack.tsx).
      - Entrambi i prompt builder estendono la raccolta `allowedNumbers` del
        check anti-invenzione anche ai numeri dentro le stringhe (non solo i
        campi numerici strutturati), perché qui l'input contiene prosa già
        scritta dal motore (es. "HRV ↓12% vs baseline").
      - **Bug preso in verifica**: il commento percorso si tagliava a metà
        frase — `maxTokens: 500` non bastava per due paragrafi densi in
        italiano (più token per parola dell'inglese). Alzato a 800 (stesso
        budget del commento profilo).
      - 281 test verdi (+8: tests/oggi-explain-prompt.test.ts,
        tests/percorso-explain-prompt.test.ts), tsc/lint/build puliti.
        Verificato da Giuseppe nel browser su entrambi.
      - **Deliberatamente fuori scope**: il taccuino del coach (NOTE_COACH,
        Passo 5) resta collegato solo al commento profilo — oggi/percorso
        non scrivono ancora in `athlete_memory`. Riaprire se Giuseppe lo
        chiede esplicitamente.)
- [x] **Passo 7 — Vestito nuovo** (fatto 2026-08-01: palette, vetro e
      tipografia del command center portati in CurveLoad. Token colore
      rifatti in `app/globals.css` [salvia/lime chiaro, inchiostro/lime scuro],
      carattere unico Manrope, scala raggi 14/20/28/999px, helper `token()`
      in `tailwind.config.ts` [senza, i modificatori di opacità tipo
      `bg-brand/40` non generavano NESSUNA regola CSS — bug trovato in
      verifica], intestazione condivisa in `AppHeader` [badge cerchio pieno
      inchiostro+lime, prima duplicata a mano in 2 pagine] e tab in basso
      ridisegnata come dock a pillola di vetro [`bottom-tab-bar.tsx`, stesso
      schema del selettore Panoramica/Carico/Coach del command center — voce
      attiva = riquadro pieno sollevato, non più rettangolo tinto].
      281 test verdi, tsc/lint/build puliti. Verificato da Giuseppe nel
      browser su login, dashboard, piano, percorso, impostazioni e tema
      chiaro/scuro.)
- [x] **Passo 8 — Il calendario della stagione (macrociclo)** (fatto
      2026-08-02: `lib/planner/macrocycle.ts` puro — `computeMacrocycle`
      alloca all'indietro dalla gara i blocchi base→build→peak→taper
      (taper 14gg, picco 29gg, build 8 sett., confini identici a quelli
      di `detectPhase` per costruzione). `phase-detector.ts` aggiunge
      `alignPhase`: riconcilia fase pianificata (macrociclo) e rilevata
      (dati) — recovery e finestra di gara (taper/peak) vincono sempre
      sul calendario, il macrociclo decide solo base↔build. Cablato in
      `/api/planner/generate` (fase allineata in tutta la pipeline +
      campi di allineamento in `validation_metadata`) e in `/plan` con
      la nuova card «La stagione» (`season-card.tsx`, Server Component,
      stati vuoto/gara passata/blocchi, date con anno solo se diverso da
      quello corrente). 296 test verdi (+15: `tests/macrocycle.test.ts`),
      tsc/lint/build puliti. Verificato da Giuseppe nel browser su `/plan`:
      card coi blocchi reali, stato vuoto/gara passata cambiando la data in
      `/settings/profile`, riga di confronto dopo «Rigenera».)
- [x] **Passo 9 — Modulo Corsa, parte 1** (fatto 2026-08-03: dati e motore
      CS/D′ dalle curve di passo. Migration 022 ripristina
      `athlete_profiles.runner_profile_data` [annulla la 019, stesso
      statement della 015]. Nuovo `lib/profile/pace-profile.ts` — motore
      puro, file unico [primitive + `buildRunnerProfile`, decisione §1.2,
      qui non c'è nulla da aggregare come durability/route_settings]:
      regressione LINEARE `d = CS·t + D′` [CS in m/s, D′ in METRI, mai
      joule, mai `w_prime`] sulla finestra `[120,300,600,900]`s [2-15 min,
      diversa dalla power-law bici che va 5-60 min], `extractPaceProfile`
      nearest-match copiato riga per riga da `extractMMP`, guard di
      plausibilità velocità 0.5-12 m/s come rete di sicurezza contro unità
      sbagliate o dati sporchi. Cablato `getPaceCurves()` in
      `lib/intervals-client.ts`, ramo corsa fail-soft in
      `/api/profile/build` [`buildCyclist` rinominata `buildProfiles`,
      qualunque errore ingoiato senza mai far fallire il profilo bici,
      `runner_profile_data` entra nell'upsert SOLO se non null per non
      sovrascrivere un profilo corsa buono con un fallimento transitorio],
      card `<RunnerCard/>` sotto la Durabilità in `/profile` [ritorna null
      se non corri: zero rumore, zero routing per sport, nessun tocco al
      Passo 10], due voci di glossario `cs`/`dprime` [testi trascritti da
      `docs/scheda_atleta_tooltip_e_commento.md`]. Endpoint pace-curves
      verificato PARZIALMENTE prima di scrivere il fetch [percorso reale e
      unità m/s confermati da fonti indipendenti via probe 401, il nome
      del campo `values[]` è assunto per coerenza con power-curves.json ma
      non visto in una risposta autenticata reale — il guard di
      plausibilità copre l'eventuale errore, dettagli in
      `docs/INTERVALS_API_NOTES.md`]. Rete di sicurezza aggiuntiva (trovata
      in revisione): CS finale scartato se fuori 1.5-6.5 m/s [2:34/km-11:07/km],
      copre un errore di scala nelle unità [es. km/h scambiati per m/s] che
      il guard per-punto 0.5-12 m/s da solo non intercetta sempre. 311 test
      verdi [+15: `tests/pace-profile.test.ts`], tsc/lint/build puliti.
      Migration 022 applicata da Giuseppe nel SQL Editor Supabase. Verificato
      da Giuseppe nel browser su `/profile` dopo «Aggiorna profilo»: nessun
      account con corse sincronizzate ancora, quindi la verifica possibile
      oggi era "il ramo corsa non disturba il profilo bici" — confermato,
      tutto identico a prima. I numeri CS/D′ restano da vedere quando lui o
      un tester avrà corse vere su Intervals.)
- [x] **Passo 10 — Modulo Corsa, parte 2** (fatto 2026-08-04, via /ship —
      planner→coder→tester→reviewer, un giro di correzione post-review, poi
      verificato da Giuseppe nel browser): libreria sedute corsa + routing per
      sport nel planner. `lib/planner/run-workout-library.ts` (nuovo, 17
      template RA-1..6/RS-1..4/RV-1..3/RN-1..2/RR-1..2, recuperato dalla
      storia git pre-`bbcd7e4` e riallineato al tipo `WorkoutTemplate`
      condiviso con `workout-library.ts`, che ora unisce bici+corsa in
      `getTemplate()`/`VALID_LIBRARY_IDS`). `session-selector.ts`:
      `resolveSportModule` (sostituisce `isRunningOnlyDossier`) sceglie il
      catalogo giusto per sport, `MODULE_IDS` (ciclismo bit-per-bit identico a
      prima). Zone %CS: `runPaceTarget` in `build-week.ts` arricchisce le
      etichette di zona col passo derivato dal CS del Passo 9 (mai
      ricalcolato; etichetta secca senza CS, No Virtual Math). Push a
      Intervals.icu reso sport-aware (`intervals-workout-format.ts`: tipo
      evento "Run", niente sintassi %FTP per la corsa). `/api/planner/generate`
      non risponde più 409 per chi ha scelto Corsa. `tests/sport-boundary.test.ts`
      riscritto come test del confine per sport. 366 test verdi, tsc/lint/build
      puliti. La parte "onboarding Corsa/Ciclismo" era già stata fatta il
      2026-08-03 (commit `62b0a69`), fuori da questo giro.
      — **Bug reale trovato dal reviewer prima della chiusura**: `runPaceTarget`
      leggeva solo la PRIMA zona di un'etichetta a intervallo ("Z3–Z4",
      "Z1–Z2 → Z3" — la maggioranza dei template corsa emessi davvero),
      sottostimando il passo prescritto nelle sedute chiave (una soglia
      mostrava il passo di recupero). Corretto (prima occorrenza per il
      confine lento, ultima per il veloce) insieme a due asserzioni di test
      deboli che non coprivano il caso rotto.
      — **Non verificato con numeri reali**: nessun account di test ha ancora
      corse sincronizzate su Intervals, quindi Giuseppe ha verificato la
      struttura (sedute RA-/RS-/RV-/RN-/RR- al posto del 409, ritorno pulito a
      Ciclismo) ma non i minuti/km veri — stesso limite già noto dal Passo 9.
      — **Preferenza espressa da Giuseppe il 2026-08-03** per le stime di
      passo su un percorso (parte successiva, non fatta ora): motore basato
      sulla **firma di velocità personale** (riuso di
      `buildSignatureFromStreams` in `lib/terrain/velocity-signature.ts`,
      filtrando le corse invece delle uscite MTB — è già sport-agnostica
      dentro), NON il modello fisico semplice. Richiede corse vere
      sincronizzate per calibrarsi bene.
- **Rifinitura fuori passo, CHIUSA e verificata da Giuseppe nel browser
      (2026-08-05, commit `28d12c3`, v1.17.0):** briefing pre-piano + motivo
      di ogni seduta dura. Nata da un prompt di tutorial esterno ("dimmi cosa
      dicono i dati prima del piano, e perché ogni seduta") portato da
      Giuseppe: il motore calcolava già tutto (fase, mesociclo 3:1,
      `session_rationale` col limitatore colpito) ma non arrivava mai a
      schermo. `lib/planner/briefing.ts` (nuovo, puro) mette in fila
      `phase_reason`/`mesocycle_reason`/CTL-ACWR-prontezza già salvati in
      `weekly_plans.validation_metadata`; `week-grid.tsx` mostra
      `session_rationale` (già in `BuiltSession`, mai renderizzato) sotto le
      note del coach. Nessuna AI, nessuna migration. Deliberatamente NON
      fatto: narrativa AI del piano (rimossa apposta con `06e990e`), ricerca
      web sulla gara (Groq non naviga), "cosa non ti torna" (è il Passo 11).
- **Rifinitura fuori passo, CHIUSA (2026-08-05, v1.18.0):** review
      settimanale (`/review`). Nata da un prompt di tutorial esterno ("tira
      giù Strava, leggi training/plan.md, chiedimi come è andata, scrivi in
      reviews/") che Giuseppe ha chiesto di adattare a CurveLoad — adattato
      per intero: Intervals.icu al posto di Strava, `weekly_plans` al posto
      di `training/plan.md`, tabella Supabase (`weekly_reviews`, migration
      025) al posto di file `reviews/`. Motore puro in `lib/review/`
      (finestra settimana, riepilogo reale, abbinamento piano↔reale,
      decoupling e tempo sopra soglia facile dagli stream 1Hz, confronto
      sensazioni↔dati con regole deterministiche, tendenze fra le review
      passate) + `lib/ai/review-prompt.ts`/`lib/review/review-io.ts` (stesso
      pattern delle altre narrative AI: prompt puro + orchestratore I/O +
      route sottile). Questionario deterministico (`FeelForm`), non una chat
      — stessa scelta della filosofia di coaching. **Due bug reali corretti
      durante il lavoro:** 1) `lib/intervals/sync.ts` leggeva FTP/zone da
      campi del profilo che sulla risposta vera tornano `null` — i numeri
      veri stavano in `sportSettings[]` (verificato via probe sull'account
      reale), corretto con fallback; senza questo fix "le facili erano
      davvero facili" non era calcolabile. 2) Verificando il prompt con una
      chiamata Groq vera su un atleta finto (vedi memoria
      "verificare-prompt-ai-con-chiamata-reale"): il modello citava "dolori
      riferiti" tra le bandiere anche con `dolori: 1` (= nessun dolore nella
      scala 1-5) — i numeri grezzi delle sensazioni sono ambigui senza una
      legenda esplicita; aggiunta `sensazioni.legenda` al prompt, verificato
      che il difetto sparisce. Aggiunto anche `total_elevation_gain` a
      `ACTIVITY_FIELDS` (mancava, verificato via probe). Eliminato un
      doppione trovato en passant: la logica "compliance per data" viveva
      due volte quasi identica (`app/plan/page.tsx` e
      `app/api/planner/generate/route.ts`) — unificata in
      `lib/planner/compliance.ts`.
      — **Verificato da Giuseppe nel browser sulla review vera della
      settimana 27 luglio – 2 agosto**, con due bug in più trovati nell'uso
      reale (oltre ai due già corretti prima): una percentuale inventata dal
      modello ("60% del piano" invece del vero 3 sedute su 6 — fix: il
      motore ora passa i conteggi già pronti, mai lasciati calcolare) e
      un'attività reale di Giuseppe arrivata da Strava che Intervals.icu non
      restituisce via API (`source: "STRAVA"`, verificato in diretta
      sull'endpoint) — la review la segnalava come "saltata"/"non
      pianificata" invece di spiegare il vero motivo; aggiunto
      `SessionExecution.dataUnavailable`, etichetta dedicata nella UI,
      frasi precalcolate nel prompt. Migration 025 applicata da Giuseppe in
      Supabase. 429 test verdi (+63 sul totale pre-passo), tsc/lint/build
      puliti.
- [ ] **Passo 11 — Chat col coach**: la chat che vede tutto il tuo quadro
- [ ] **Passo 12 — Onboarding a chiacchierata**: il questionario diventa una
      conversazione (+ filosofia di coaching nel dossier)
      — **la seconda metà (filosofia di coaching) è FATTA e verificata da
      Giuseppe nel browser il 2026-08-03**, anticipata rispetto al passo:
      `docs/COACHING_SCHOOLS.md` (8 scuole reali con fonti lette davvero) +
      `lib/coaching/schools.ts`, migration 023, intervista deterministica
      (step 9 del wizard + gruppo in `/settings/profile`), leva vera sul
      planner (`stile_allenamento` → seduta dura in `session-selector.ts`) e
      sintesi AI in `/profile`. Resta da fare **solo la parte
      "a chiacchierata"**: il questionario che diventa conversazione.
      — **Revisione onboarding del 2026-08-03** (fuori passo, richiesta da
      Giuseppe): il wizard passa da 11 a 8 schermate (step 3→10). Rimossi 18
      campi senza alcun lettore verificato (altezza, peso, peso target, fase
      corrente, FTP indoor, FC max/soglia, LT1/LT2, ciclocomputer, misuratore
      potenza, fascia cardio, smartwatch, bici outdoor, piattaforma indoor) —
      quei numeri arrivano da Intervals.icu, già obbligatorio prima
      dell'onboarding. Attrezzatura (indoor/rulli) assorbita nello step "La
      tua settimana"; step "Come funziona" e "Inizia con CurveLoad" fusi in
      uno. `stile_allenamento` spostato accanto alle scuole (dove già veniva
      sovrascritto in silenzio) così la precedenza è visibile. Due bug
      corretti: il clamp di `onboarding_step` si era fermato alla vecchia
      versione a 7 step (chi chiudeva a metà retrocedeva), e "Indietro" non
      salvava le modifiche in corso. Migration `024_prune_dossier.sql` pronta
      (da lanciare in Supabase dopo il deploy). `npm test`/`tsc`/`lint`/`build`
      verdi; verifica nel browser da fare da Giuseppe (nuovo onboarding intero
      + `/settings/profile` + blocco corsa su "Genera settimana").
- [ ] **Passo 13 — Il coach che si sveglia da solo (cron)**: sync notturno +
      brief mattutino
      — **Sessione A (soglie personali + intervista) FATTA e verificata da
      Giuseppe nel browser il 2026-08-05** (v1.19.0), con due bug trovati
      proprio nella verifica: (a) il riquadro "Equilibrio carico" in dashboard
      si giudicava da solo con una soglia 1.3 riscritta a mano, che sarebbe
      divergita dal motore appena le soglie diventano personali — ora legge lo
      stato dal segnale readiness; (b) le note "da dove vengono le soglie"
      venivano scritte PRIMA dell'aggiustamento per stress alto, quindi
      mostravano 6.0h mentre il motore usava 6.5h — un numero mostrato diverso
      da quello usato. Corretti entrambi, con test di regressione. Nuovo
      `lib/recovery/baselines.ts` (puro): media mobile 7g di ln(rMSSD) contro
      il range personale ±1 SD invece del −10/−20% fisso, FC riposo su media
      personale ±SD con pavimenti in bpm, soglia sonno dalle ore dichiarate,
      ACWR conservativo per chi dichiara infortuni ricorrenti, marker precoce
      "collasso del CV" (avviso, mai stop). La ladder P0–P3 di `SECTION_11.md`
      **non è stata toccata**: senza storico sufficiente il calibratore torna
      soglie nulle e valgono i numeri fissi di prima. Fonti e limiti noti di
      ogni soglia in `docs/RECOVERY_SCIENCE.md` (incluso il fatto che l'ACWR è
      contestato in letteratura: Impellizzeri 2020/2021, Lolli 2019 — resta
      come indicatore di variazione di carico, mai come stima di rischio
      infortunio). **Bug trovato e corretto**: `extras.riHistory` non veniva
      mai passato da `sync.ts`, quindi la regola P1 "RI < 0.7 per 2+ giorni"
      era codice morto dall'inizio (nuova `computeRiHistory`). Intervista
      "Come recuperi" in `/settings/profile` — **niente migration**: le
      risposte stanno in `athlete_profiles.preferences.recovery`, stesso
      pattern di `hrv_protocol`, nessun passaggio manuale in Supabase.
      441 test verdi (+12), tsc/lint/build puliti.
      — **Correzione al vincolo cron scritto in P7**: "max 2 cron su Hobby"
      non è più vero (verificato sui doc Vercel il 2026-08-05: 100 cron per
      progetto su Hobby, minimo una volta al giorno, precisione ±59 min).
      Restiamo su una route sola per non duplicare auth e loop, ma per scelta.
      — **Email fuori dal passo**: Resend free invia dal sandbox
      `onboarding@resend.dev` solo all'indirizzo di registrazione; per i
      tester servirebbe un dominio verificato (rompe il vincolo €0). Il brief
      mattutino resta in-app finché non c'è un dominio.
      — **Passata multiutente del 2026-08-05** (richiesta da Giuseppe: "l'app
      la useranno molti utenti e tutti diversi tra loro"). Le soglie erano
      state giudicate guardando i dati di chi misura l'HRV tutti i giorni:
      **chi ne fa 3 a settimana — la compliance minima valida — non arrivava
      MAI alle soglie personali**, perché con la finestra a 30 giorni il
      periodo di riferimento era di ~23 giorni e servivano di fatto 4
      misure/settimana. Finestra wellness portata a **60 giorni**; per non
      spargere la compatibilità col nome vecchio della chiave in 13 file è
      stato introdotto `wellnessOf(mirror)` in `sync.ts`, unico punto che
      conosce la forma dello snapshot (i 22 accessi diretti a `wellness_30d`
      passano tutti da lì, e gli snapshot già salvati continuano a leggersi).
      Effetto collaterale gradito: il grafico "ANDAMENTO · 6 WK" chiedeva 42
      giorni e ne riceveva 30 — ora ne ha davvero 6, di settimane.
      Inoltre: **il sonno misurato batte quello dichiarato** (mediana su ≥14
      notti; chi dichiara 8h e ne dorme 6.5 prendeva ambra ogni notte), e le
      note sono divise in `pending` (transitorie e azionabili → dashboard) e
      `applied` (permanenti → card in impostazioni), perché una riga che non
      cambia mai insegna a non leggere quella riga.
      — **Potatura del 2026-08-05** (osservazione di Giuseppe guardando la
      card: "se legge da Intervals la voce si può togliere no?"). Tolta la
      domanda sulle ore di sonno tipiche: quando le notti misurate ci sono
      vince la mediana, e quando non ci sono `sleepSecs` è null, il segnale
      sonno è "non disponibile" e nessuna soglia viene applicata — il valore
      dichiarato o veniva scavalcato o era inutile. Soglia minima abbassata a
      7 notti così la fascia intermedia si chiude. Ne esce la regola per
      l'intervista: **si chiede solo quello che Intervals non sa già.**
      Nella stessa passata, regressione corretta: il carry-forward di HRV e FC
      a riposo spazzolava tutta la finestra, quindi allargandola a 60 giorni
      aveva iniziato a poter ripescare misure vecchie il doppio — ora è
      limitato a 7 giorni. E l'aggiustamento "mezz'ora in più per lo stress"
      si applica solo sopra una soglia personale: senza una notte tipica nota
      alzava la soglia standard in silenzio.
      — **Terza verifica browser (5 ago)**: il motore era corretto, il
      commento AI no. Due difetti, entrambi invisibili ai test strutturali e
      trovati solo guardando la schermata: `lib/ai/context.ts` passava ctl/atl
      grezzi ("un CTL di 36.21359"), e `oggi-explain-prompt.ts` passava per
      ogni segnale sia `valore` nudo sia `dettaglio` — il modello prendeva il
      59 della FC a riposo e lo chiamava HRV. Il check anti-numeri-inventati
      non poteva vederlo: 59 era un numero legittimo dell'input. Corretto
      togliendo il campo ridondante (il numero sta già nel `dettaglio` con la
      sua etichetta) più una riga di prompt che vieta di spostare cifre fra
      segnali. **Verificato con una chiamata Groq vera** (regola di progetto):
      il modello ora scrive "La tua HRV è di 63ms, che rientra nel tuo range
      normale". Corretto anche il grafico "6 WK", che con `slice(-6)` copriva
      34 giorni invece di 42.
      — **Taccuino del coach: anello chiuso (5 ago).** Giuseppe ha notato che
      il commento continuava a nominare un fastidio alla schiena dopo che
      aveva svuotato il campo nel dossier. Il dato NON era nel dossier
      (verificato: `dolore_attuale`, `infortuni_attuali`, `injury_periods`
      tutti vuoti): era in `athlete_memory`, scritta dall'LLM stesso, **senza
      nessuna UI per vederla o cancellarla**. Su dati sanitari non è un
      fastidio, è il diritto di rettifica. Peggio, era un anello che si
      autoalimentava: la nota entrava nel prompt → il modello la ripeteva nel
      commento → e ne scriveva un'altra su quella. Delle 12 righe reali,
      quattro erano la stessa frase parafrasata (`unique(user_id, nota)` ferma
      solo i duplicati esatti) e **10 su 12 erano di tipo `osservazione`,
      nessuna delle quali un fatto sull'atleta** ("monitorare lo stress e la
      motivazione dell'atleta" — il modello che si ripete il compito).
      Fatto: `osservazione` tolto dall'allowlist in `lib/ai/coach-memory.ts`
      (restano preferenza/infortunio/traguardo, cioè fatti verificabili);
      `lib/ai/context.ts` filtra i tipi non supportati, così le righe già
      salvate restano leggibili ma non rientrano nei prompt (nessuna migration
      da lanciare: il CHECK della 021 accetta ancora il valore vecchio);
      nuova `CoachMemoryList` in `/settings/profile` con cancellazione via
      `DELETE /api/settings/memory` (client admin + filtro `user_id`, perché
      la 021 dà solo la policy select-own). Le 3 righe su schiena/vertebra L2
      cancellate dal DB su richiesta: da 12 righe nel prompt a 2.
      Aggiunto anche il bottone "Riscrivi la filosofia" **in Impostazioni** —
      esisteva già ma solo in `/profile`, mentre le risposte che rendono la
      filosofia obsoleta si cambiano in Impostazioni; stesso componente
      (`components/profile/philosophy-button.tsx`), non una seconda copia.
      — **Debito noto, non fatto**: `stress_vita` e `infortuni_ricorrenti` non
      scadono. Uno risponde "stress 5" in un mese pesante e sei mesi dopo ha
      ancora le soglie strette senza saperlo. Serve almeno la data della
      risposta nella card e un promemoria dopo qualche mese. Rimandato
      d'accordo con Giuseppe a quando i tester saranno dentro con dati veri.
      — **Resta da fare (Sessione B)**: `lib/recovery/daily-check.ts` (il gate
      "vale la pena parlare?"), `app/api/cron/daily/route.ts` con
      `CRON_SECRET`, `crons` in `vercel.json`, banner flag in dashboard che
      legge `coach_decisions` (`decision_type='daily_readiness'` — la tabella
      esiste dalla migration 001 e non l'ha mai scritta nessuno), prune degli
      snapshot oltre i 90 giorni, e il promemoria review del lunedì.
- [ ] **Passo 14 — Deploy per i tester**: pubblicazione su Vercel + inviti

I passi grossi (9, 10, 12) possono spezzarsi in sotto-sessioni; la regola
resta: si chiude solo ciò che è verificato.

## Contesto

Revisione del 2026-07-31 (terza): niente passo commerciale — no commercialista,
no Merchant of Record, no lancio. Il progetto resta una **webapp personale**
che fonde Curveload (`C:\Users\CARBO\Documents\coach-ia`) con i pattern del
command center, **costruita pulita come multiutente**, e viene aperta a
**5-6 tester amici** oltre a Giuseppe. La parte business è parcheggiata in
appendice, non cancellata.

**Stato:** F1 (layer AI minimo) GIÀ COMPLETATA e verificata (245 test verdi):
`lib/ai/groq.ts` (era `lib/ai/anthropic.ts` — switch a Groq del 2026-07-31,
fase gratis; la versione Anthropic vive nella storia git),
`lib/ai/profile-explain-prompt.ts` (+ check anti-numeri-inventati),
`lib/profile/explain-io.ts`, `/api/profile/explain`, bottone in
`profile-tabs.tsx`, `.env.example`. Si attiva quando Giuseppe crea la
`GROQ_API_KEY`.

**Decisioni confermate:**
- Motore deterministico = autorità su numeri e Go/Modify/Skip; LLM = solo narrativa/spiegazione/selezione vincolata
- Modulo Corsa: si costruisce comunque (scelta esplicita di Giuseppe)
- **Chiavi AI: BYOK + fallback** — provider: **Groq free tier** (scelta
  2026-07-31, "fase più gratis possibile": modelli Llama, ~30 req/min e
  ~1.000 req/giorno per chiave, nessun training sui dati, Zero Data
  Retention attivabile; tornare ad Anthropic = riscrivere il solo
  `lib/ai/groq.ts`). Ogni tester può salvare la propria API key Groq
  (gratuita) nelle impostazioni; chi non ce l'ha usa la chiave di Giuseppe
  (l'invito alla beta È la sponsorizzazione). Abbonamenti Claude/ChatGPT:
  verificato, NON utilizzabili via app di terzi — solo API key.
- Dal command center migrano solo i pattern: design tokens
  (`command-center/src/style.css:1-29`), context assembler, flussi skill come
  automazioni. Niente grafo 3D, niente CLI spawn
- Intervals.icu resta l'hub dati (è il motore di calcolo, non solo trasporto);
  uso personale/gratuito = nessun permesso commerciale necessario

## Cosa significa "predisposta multiutente" (regole per ogni fase)

1. **Ogni nuova tabella nasce per-utente con RLS** (pattern migration 001).
2. **Nessun hardcoding single-user.** Il modello chiavi è già multiutente
   (BYOK per-user + fallback env); quando tornerà il commerciale, il fallback
   diventerà gated dal billing — un if, non una riscrittura.
3. **`users.plan_type` non si tocca**; il layer entitlements si scrive SOLO
   quando torna il commerciale.
4. **Niente tabelle/route di billing adesso** — sono nell'appendice.

## Costi (personale + 6 tester)

| Voce | Costo |
|---|---|
| Vercel Hobby | €0 — uso non commerciale consentito. Limite 2 cron job giornalieri → job accorpati in un'unica route (P7) |
| Supabase Free | €0 — il cron giornaliero tiene il progetto attivo; se auto-pausa comunque, upgrade a Pro solo allora |
| Groq API (free tier) | €0 — ~1.000 req/giorno sulla chiave di Giuseppe, condivise coi tester sponsorizzati; tester con chiave propria: gratis anche loro. Se i limiti stringessero: BYOK per tutti, o ritorno ad Anthropic (~€2-10/mese, un file da riscrivere) |
| **Totale** | **€0** |

## Fasi

**P0 — attivazione F1** *(azione di Giuseppe)*
Chiave gratuita da console.groq.com → `GROQ_API_KEY` in `.env.local` → click
su "💬 Spiega il mio profilo" con dati veri → leggere il commento e controllare
`audit_logs.payload.unexpected_numbers`.

**P1 — BYOK + accesso beta**
- Migration 020: colonna `groq_key_encrypted` (per-utente, cifrata col
  pattern esistente `lib/crypto.ts` — stesso usato per i token Intervals; mai
  loggata, mai restituita al client, RLS).
- Campo "API key Groq (opzionale, gratuita)" in `app/settings/profile/page.tsx` /
  `components/settings/dossier-form.tsx`: scrittura-only (mostra solo
  "configurata ✓ / rimuovi", mai il valore).
- `lib/ai/resolve-key.ts`: chiave utente → fallback `process.env.GROQ_API_KEY`.
  `explain-io.ts` (e ogni call site futuro) passa da qui. Errore chiave utente
  non valida (401 Groq) → messaggio chiaro "controlla la tua API key nelle
  impostazioni", senza consumare il fallback.
- **Gate d'invito:** allowlist email in env var (`BETA_ALLOWED_EMAILS`),
  verificata alla registrazione — senza, chiunque trovi l'URL si registra.
- **Verifica region Supabase EU** (dashboard, 5 minuti): dentro ci sono dati
  salute di persone vere. I consensi espliciti esistono già (onboarding step 3,
  `consent_health_data`/`consent_ai_processing`); basta una nota privacy onesta
  nella pagina di invito, niente apparato legale commerciale.

**P2 — Context assembler + memoria coach**
`lib/ai/context.ts`: impacchetta dossier (`athlete_profiles`), ultimo mirror
(`athlete_metrics_snapshots`), decisioni recenti (`coach_decisions`), memoria.
Migration 021: `athlete_memory` (user_id, RLS, JSONB, tipo, data) — le "note
del vault" in versione DB, scritte dall'LLM via output vincolato. Poi le altre
due narrative già predisposte dalla 017: `ai_comment_oggi` e
`ai_comment_percorso` — stesso pattern di explain-io, un prompt builder puro +
una route sottile ciascuna, cache per snapshot (rigenera solo su nuovo sync).

**P3 — Re-skin design** *(parallelizzabile con P2)*
Token del command center → `tailwind.config.ts` + `app/globals.css`: palette
sage/lime, glassmorphism, Manrope. Le strutture di pagina restano.

**P4 — Macrociclo prospettico**
`lib/planner/macrocycle.ts` — deterministico: da oggi alla gara target,
blocchi base→build→taper con date; `phase-detector.ts` esistente diventa il
check "sei dove dovresti essere". Parametrizza `build-week.ts`. Narrativa LLM
sopra, mai numeri.

**P5 — Modulo Corsa**
Migration 022: ripristino `runner_profile_data` (pattern 015; la 019 è
dichiarata reversibile) · motore CS/D′ da pace-curves Intervals · libreria
workout corsa (prefissi RA-/RS-/RV-/RN-/RR-, recuperabile da git pre-019) ·
routing per sport in `session-selector.ts` · zone %CS · trasformare
`tests/cycling-only.test.ts` nel test del confine: sport con modulo → library
validata; sport senza modulo → prescrizione narrativa LLM etichettata, mai
library fantasma.

**P6 — Onboarding conversazionale + chat coach**
UI chat unica per entrambi · onboarding: l'LLM conversa ed estrae i campi
strutturati salvandoli via `/api/onboarding/save` esistente + nuovi campi
dossier (filosofia di coaching, modelli di riferimento, preferenze narrative —
migration 023) · proposta macrociclo a fine onboarding · wizard esistente come
fallback · `/api/coach/chat` col context assembler e chiave da
`resolve-key.ts`. Prompt caching (prefisso stabile) per i costi — rilevante
solo se si tornerà a un provider a pagamento.

**P7 — Automazioni cron**
`vercel.json` crons (max 2 su Hobby → una route unica giornaliera: sync per
ogni utente attivo → rigenera narrative se `profile_data.meta.generated_at` è
cambiato [MAI `updated_at`: il trigger DB si auto-innesca] → di domenica anche
la weekly review → brief mattutino via Resend free tier). Route protetta con
`CRON_SECRET` (Bearer). Ogni utente gira sulla SUA chiave risolta.

Ordine: P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7. Ogni fase chiude con
`npm test` + `npx tsc --noEmit` verdi e una prova manuale in `npm run dev`.

## Verifica end-to-end

1. P0/P2: bottoni AI → commenti coerenti, solo numeri dell'input, righe
   `audit_logs` corrette, `profile_data` mai toccata.
2. P1: utente con chiave propria → usa la sua (verificare in console Anthropic
   di chi parte la chiamata); utente senza → fallback; chiave sbagliata →
   errore chiaro, non fallback silenzioso; email fuori allowlist → registrazione
   rifiutata; la chiave non compare MAI in risposte API o log.
3. P4: macrociclo per la gara target reale; phase-detector concorde.
4. P5: settimana con obiettivo corsa fittizio → sedute da library reale; sport
   senza modulo → mai un library_id.
5. P6: onboarding conversazionale da account di test → dossier identico a
   quello del wizard + campi filosofia.
6. P7: `curl` con `CRON_SECRET` → 200, narrative rigenerate una volta sola,
   nessun re-innesco al giro dopo.

## Appendice — parcheggiato (si riapre SOLO quando Giuseppe lo dice)

Non riproporre di iniziativa; aggiornare la memoria di progetto in tal senso
(commercializzazione rinviata sine die).

- Tier a pagamento Free/9€/19€, `lib/billing/entitlements.ts`, tabelle
  `subscriptions`/`billing_events`/`usage_counters`, webhook MoR, pagina pricing
- Merchant of Record (Paddle/Lemon Squeezy) e commercialista/P.IVA
- DPIA, DPA subprocessor, privacy policy/ToS commerciali, beta pubblica aperta
- Vercel Pro + Supabase Pro (necessari solo col commerciale)
- Contatto David Tinker per uso commerciale API — bozza parcheggiata in
  `docs/intervals-api-commercial-request.md`
- Quote/rate-limit per utente oltre i billing alert

Trigger di riapertura: Giuseppe dichiara di voler monetizzare → si ripristina
la versione commerciale del piano (v1 nella cronologia di questo file)
partendo da: MoR + Tinker + DPIA.
