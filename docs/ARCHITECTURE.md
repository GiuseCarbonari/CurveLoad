# Architettura — Coach IA Endurance

> Documento creato in Milestone 0. Descrive il flusso end-to-end del sistema.
> Riferimenti: [PRD.md](PRD.md) (§8 architettura, §20 modello dati, §27 milestone)
> e [SECTION_11.md](SECTION_11.md) (protocollo 11 A/B/C).

## Principio fondante

**Section 11 è il motore, Coach IA è il prodotto.**

La scienza sportiva, le soglie, la logica decisionale e le metriche derivate
vivono in `SECTION_11.md` + `sync.py`. L'app **non ricalcola nulla** (regola
"No Virtual Math", Section 11 A): autentica l'utente, orchestra la pipeline,
legge gli output pre-calcolati, li presenta e scrive sul calendario di
Intervals.icu. L'AI produce solo narrativa e selezione vincolata — mai numeri,
mai la decisione Go/Modify/Skip.

## Flusso end-to-end

```
┌─────────────┐   1. OAuth    ┌──────────────┐
│   Atleta    │ ────────────► │ Intervals.icu │
└─────┬───────┘               └──────┬───────┘
      │                              │ 2. sync.py (Section 11)
      │                              ▼
      │                  ┌───────────────────────────┐
      │                  │  Mirror JSON Tier-1       │
      │                  │  latest.json   history.json│
      │                  │  intervals.json routes.json│
      │                  └──────┬────────────────────┘
      │                         │ 3. snapshot (read-only)
      │                         ▼
      │              ┌──────────────────────┐
      │              │  Scheda Atleta        │
      │              │  (dossier + profilo   │
      │              │   fenotipo, PRD §33)  │
      │              └──────┬───────────────┘
      │                     │ 4. readiness letta da latest.json
      │                     ▼
      │              ┌──────────────────────┐
      │ 6. dashboard │  Programma Section 11 │
      │ ◄────────────│  (Workout Library +   │
      │              │   Validator 11 C)     │
      │              └──────┬───────────────┘
      │                     │ 5. push autorizzato
      │                     ▼
      │              ┌──────────────────────┐
      └─────────────►│ Calendario Intervals  │
                     └──────────────────────┘
```

In formula (PRD §8):

> OAuth Intervals.icu → `sync.py` Section 11 → mirror JSON Tier-1 →
> Scheda Atleta (§33) + Readiness Dashboard → Programma Personalizzato
> Section 11 → Validator 11 C → Utente + Calendario Intervals

## Le tappe del flusso

### 1. OAuth Intervals.icu (Milestone 1)

L'utente si autentica con il proprio account Intervals.icu (prerequisito:
deve già esistere). L'app richiede solo gli scope minimi (PRD §9.4): lettura
attività/wellness/calendario/soglie, scrittura calendario. I token sono
cifrati a livello applicativo (chiave `TOKEN_ENCRYPTION_KEY`) prima del
salvataggio in `intervals_connections`. Gli endpoint OAuth verranno
implementati solo dopo verifica congiunta della documentazione Intervals
(regola ferma n. 6).

### 2. Sync → mirror JSON (Milestone 2)

`sync.py` (riusato da Section 11, non riscritto) legge i dati da
Intervals.icu e produce il **mirror JSON Tier-1**:

| File | Ruolo (gerarchia d'uso Section 11) |
|---|---|
| `latest.json` | **Sempre primario**: stato corrente, `readiness_decision`, `derived_metrics`, alerts |
| `history.json` | Solo contesto/trend |
| `intervals.json` | On-demand, per sessioni con `has_intervals`/`has_dfa` |
| `routes.json` | Terreno degli eventi target (read-only, base della gap analysis §33) |

Ogni sync salva uno snapshot immutabile in `athlete_metrics_snapshots`
(colonne JSONB), con il `data_quality_level` 0–4 (PRD §11). In onboarding il
**gate Strava** verifica che potenza/FC non arrivino spogliate (PRD §11):
controllo bloccante per i livelli ≥ 2.

### 3. Scheda atleta (Milestone 2–3)

Due componenti:

- **Dossier** (`athlete_profiles`): dati dichiarati dall'utente — obiettivi,
  disponibilità, attrezzatura, infortuni (PRD §12.2).
- **Profilo fenotipo** (PRD §33, motore `profile.py`): RPP, CP/W′, APR,
  archetipo, gap analysis vs evento target letta da `routes.json`. Anche qui:
  motore deterministico pre-calcola, l'AI legge e racconta.

### 4. Readiness e decisione Go/Modify/Skip (Milestone 3)

L'app **legge** l'oggetto `readiness_decision` da `latest.json`
(priority ladder P0–P3, Section 11 v11.13) e lo mostra in dashboard.
**Non lo ricalcola mai.** L'override Feel/RPE segue le regole del protocollo:
escalation sempre ammessa, de-escalation solo a P2 e motivata, P0/P1 non
override-abili. Ogni decisione mostrata è persistita in `coach_decisions`
con la copia letterale del `readiness_decision` letto.

### 5. Programma Section 11 (Milestone 4)

Il planner seleziona le sedute dalla **Workout Library** di Section 11 B §8
(`examples/workout-library/`) — mai generazione libera. La selezione è
guidata dai limitatori della scheda atleta (*cosa* allenare) entro i vincoli
di readiness e carico (*quando e quanto*). Il **Validator 11 C** controlla
ogni output e produce il `validation_metadata` (checklist 0–10,
`frameworks_cited`, confidence, missing_inputs), persistito in
`coach_decisions`. Se la validazione fallisce: rigenerazione o fallback
deterministico.

### 6. Scrittura sul calendario Intervals (Milestone 5)

Solo dopo conferma dell'utente, i workout validati vengono scritti sul
calendario Intervals.icu via API. Ogni scrittura è tracciata in `audit_logs`.

## Ruoli e confini (chi fa cosa)

| Componente | Responsabilità | NON fa |
|---|---|---|
| `sync.py` (Section 11) | Pre-calcola CTL/ATL/TSB/ACWR/RI, fasi, durabilità, `readiness_decision` | — |
| `profile.py` (§33) | Pre-calcola RPP, CP/W′, APR, fenotipo, gap analysis | parsing GPX, detection salite (legge `routes.json`) |
| App Next.js | Auth, orchestrazione, presentazione, persistenza, push calendario | ricalcolare metriche o decisioni |
| AI (LLM) | Narrativa, spiegazioni, selezione vincolata dalla library | inventare numeri, strutture seduta o decisioni |
| Validator 11 C | Conformità output, `validation_metadata` | — |

## Stack e struttura del repository

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Database/Auth:** Supabase (PostgreSQL con RLS + Supabase Auth)
- **Pipeline dati:** `sync.py` di Section 11 (worker Python, riuso — Milestone 2)
- **Deploy:** Vercel (app) + Supabase (db)

```
coach-ia/
├── app/                    # App Router: pagine e API routes
│   ├── layout.tsx
│   ├── page.tsx            # landing placeholder (Milestone 0)
│   └── globals.css
├── components/ui/          # componenti shadcn/ui
├── lib/
│   ├── supabase/           # client browser + server
│   └── utils.ts
├── supabase/
│   └── migrations/         # 001_initial.sql (schema PRD §20)
├── docs/
│   ├── PRD.md
│   ├── SECTION_11.md
│   └── ARCHITECTURE.md     # questo documento
└── .env.local              # placeholder (non committato)
```

## Modello dati (estratto — vedi migration 001)

| Tabella | Contenuto | Scrittura |
|---|---|---|
| `users` | estensione di auth.users: consensi GDPR, piano, timezone | server |
| `athlete_profiles` | dossier atleta (PRD §12.2) | utente |
| `intervals_connections` | token OAuth cifrati, scope, stato | solo server |
| `athlete_metrics_snapshots` | mirror JSON immutabile per sync | solo worker |
| `coach_decisions` | audit decisionale + `validation_metadata` 11 C | solo server |
| `audit_logs` | azioni di sistema (sync, push, consensi) | solo server |

RLS attiva su tutte le tabelle: dati art. 9 GDPR, isolamento per utente a
livello database (PRD §24.2 — Coach IA è titolare del trattamento; DPIA
obbligatoria prima del lancio pubblico).

## Regole ferme di implementazione

1. Un milestone alla volta, con conferma esplicita prima del successivo.
2. Ogni numero mostrato proviene dai dati Intervals.icu o dal mirror JSON.
3. `readiness_decision` si legge da `latest.json`, non si ricalcola.
4. I workout si selezionano dalla Workout Library Section 11.
5. Ogni funzione critica è commentata (cosa fa e perché).
6. Nessun endpoint Intervals.icu non verificato insieme.
