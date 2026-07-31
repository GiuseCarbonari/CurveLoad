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
- [ ] **Passo 6 — Le altre due narrative**: commento readiness del giorno
      (`ai_comment_oggi`) e commento percorso (`ai_comment_percorso`)
- [ ] **Passo 7 — Vestito nuovo**: design del command center (colori, vetro,
      tipografia) dentro CurveLoad
- [ ] **Passo 8 — Il calendario della stagione (macrociclo)**: blocchi
      base→build→taper da oggi alla gara
- [ ] **Passo 9 — Modulo Corsa, parte 1**: dati e motore (CS/D′ dalle curve
      di passo)
- [ ] **Passo 10 — Modulo Corsa, parte 2**: libreria sedute corsa + planner
      che sceglie per sport
- [ ] **Passo 11 — Chat col coach**: la chat che vede tutto il tuo quadro
- [ ] **Passo 12 — Onboarding a chiacchierata**: il questionario diventa una
      conversazione (+ filosofia di coaching nel dossier)
- [ ] **Passo 13 — Il coach che si sveglia da solo (cron)**: sync notturno +
      brief mattutino via email
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
