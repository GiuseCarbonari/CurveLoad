# Intervals.icu — endpoint e fatti verificati

> Registro previsto dal PRD §31. **Regola ferma n. 6:** nessun endpoint
> Intervals.icu può essere chiamato dal codice se non è elencato qui come
> verificato. Ogni nuova verifica congiunta va aggiunta a questo file.

## OAuth (verificati — Milestone 1, fonte: documentazione ufficiale intervals.icu)

| Cosa | Valore |
|---|---|
| Authorize | `GET https://intervals.icu/oauth/authorize` |
| Token | `POST https://intervals.icu/api/oauth/token` (form data, solo server-side) |
| Scope richiesti | `ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:READ` |
| Redirect URI (dev) | `http://localhost:3000/api/auth/intervals/callback` |
| Token response | `{ access_token, scope, athlete: { id, name } }` |

**Fatti chiave:**

- **Non esistono refresh token.** L'access token è permanente: per questo
  va cifrato a riposo (AES-256-GCM, vedi `lib/crypto.ts`) — un token
  compromesso non scade mai da solo.
- **Athlete ID `"0"`** indica l'atleta del token corrente in qualsiasi
  endpoint API.

## Endpoint dati (verificati — Milestone 2)

Autenticazione: header `Authorization: Bearer <access_token_decifrato>`.
Athlete ID `"0"` = atleta del token corrente.

### `GET /api/v1/athlete/0`

Profilo atleta: `weight`, `resting_hr`, `zones`, FTP nel campo `icu_ftp`
**oppure** `threshold_power` (gestire entrambi con fallback).

### `GET /api/v1/athlete/0/wellness?oldest=YYYY-MM-DD&newest=YYYY-MM-DD&fields=...`

Campi richiesti:
`id,ctl,atl,rampRate,weight,restingHR,hrv,sleepSecs,soreness,fatigue,mood`

- `ctl` e `atl` sono **pre-calcolati da Intervals**: si leggono, non si
  ricalcolano.
- `TSB = ctl − atl` e `ACWR = atl / ctl` sono semplici sottrazioni/rapporti
  sui valori letti, non derivazioni.
- Il campo HRV può chiamarsi `hrv` **o** `hrv_rmssd`: gestire entrambi con
  fallback.
- `id` è la data del giorno (`YYYY-MM-DD`).

### `GET /api/v1/athlete/0/activities?oldest=YYYY-MM-DD&fields=...`

Campi richiesti:
`id,name,type,start_date_local,moving_time,distance,icu_training_load,icu_weighted_avg_watts,average_heartrate,perceived_exertion,sport_type`

## Endpoint power profile (verificati — Milestone 3, via ispezione reale)

### `GET /api/v1/athlete/0/power-curves.json?type=Ride&curves=42d,90d,1y,all`

Risposta: `{ list: [curva_42d, curva_90d, curva_1y] }`. Ogni curva:

| Campo | Contenuto |
|---|---|
| `id`, `label`, `days` | identificatore finestra (`"42d"`, `"90d"`, `"1y"`) |
| `weight` | peso usato per i W/kg della curva |
| `secs[]` | durate in secondi (da 1s fino alle ore) |
| `values[]` | watt MMP, **stesso indice** di `secs[]` |
| `watts_per_kg[]` | W/kg, stesso indice |
| `powerModels[]` | `MS_2P {criticalPower, wPrime, ftp}` · `MORTON_3P {criticalPower, wPrime, pMax, ftp}` ← **primario** · `FFT_CURVES`/`ECP` |
| `vo2max_5m` | stima VO2max da best 5min |
| `mapPlot` | `{map, mapWatts, mapSecs}` — **spesso 0, non affidabile** |

**Regole di lettura (No Virtual Math):**

- CP e W′ si **leggono** dal modello `MORTON_3P` (fallback `MS_2P` se
  assente), mai ricalcolati con un fit nostro.
- `pMax` (Morton 3P) = potenza neuromuscolare di picco.
- Peso: `curve.weight`, fallback `icu_weight` del profilo.
- `secs[]`/`values[]`/`watts_per_kg[]` sono paralleli: per la MMP a una
  durata si trova l'indice in `secs[]` e si leggono gli altri due array
  allo stesso indice.
- La MAP da `mapPlot` non è affidabile: come riserva anaerobica si usa
  **MPR = MSP − CP** (PRD §33 C.3, più pulita dell'APR su MAP).

### `GET /api/v1/athlete/0` (campi estesi verificati)

`icu_weight`, `icu_resting_hr`, `icu_date_of_birth`, `sex`.

## Endpoint eventi calendario (verificati — 13 giugno 2026, via inspect-events)

### `GET /api/v1/athlete/0/events?oldest=YYYY-MM-DD&newest=YYYY-MM-DD&category=RACE_A`

Risposta: **array** di eventi (non un oggetto wrapper). Campi chiave visti
sul caso reale (Esatrail Super Hero, id 115782549):

| Campo | Contenuto |
|---|---|
| `id` | number (id evento) |
| `name`, `category`, `type` | nome gara, `RACE_A`, sport (`MountainBikeRide`) |
| `start_date_local`, `end_date_local` | ISO senza timezone |
| `distance` | **metri** (88000 = 88 km) |
| `attachments` | array di `{ id: UUID, filename, mimetype, url }` |
| `icu_training_load`, `target`, `workout_doc`, … | presenti ma null su un evento gara |

**Download del GPX (verificato):** ogni `attachments[]` ha un campo **`url`**
(Google Cloud Storage **pubblico**). Il GPX si scarica con un `fetch` diretto
su `attachments[].url`, **senza autenticazione** e senza altri endpoint.

**Path di download allegato NON validi (tutti 404, verificati — non usare):**

- `GET /api/v1/athlete/0/events/{id}/file`
- `GET /api/v1/athlete/0/events/{id}/attachments/{uuid}`
- `GET /api/v1/athlete/0/events/{id}/attachment/{uuid}`

## Scrittura eventi calendario (verificata — Milestone 8)

### `POST /api/v1/athlete/0/events/bulk?upsert=true&upsertOnUid=true&updatePlanApplied=true`

Scope richiesto: `CALENDAR:WRITE`.

Body: array JSON di eventi workout.

| Campo | Valore |
|---|---|
| `uid` | stringa stabile, hash di `userId + date + library_id` |
| `external_id` | uguale a `uid`, stabile e posseduto dalla stessa app OAuth |
| `category` | `"WORKOUT"` |
| `start_date_local` | data/ora locale `YYYY-MM-DDTHH:MM:SS` |
| `name` | nome workout |
| `type` | `"Ride"` · `"VirtualRide"` · `"MountainBikeRide"` |
| `moving_time` | durata stimata in secondi |
| `description` | nota coach, framework e struttura workout Intervals |

Lo schema OpenAPI ufficiale distingue due modalità:

- `upsertOnUid=true` aggiorna un evento con lo stesso `uid`;
- `upsert=true` aggiorna per `external_id`, purché l'evento sia stato creato
  dalla stessa applicazione OAuth. Se presente, questa modalità prevale su
  `upsertOnUid`.

Il planner invia entrambi i campi con lo stesso valore stabile e usa entrambe
le query flag; la deduplicazione effettiva avviene quindi su `external_id`.
`updatePlanApplied=true` aggiorna il piano applicato.

**Probe reale del 14 giugno 2026:**

- due POST identici con solo `uid="test-dedup-001"` hanno prodotto **2**
  eventi. Intervals ha sostituito il valore ricevuto con UUID propri diversi
  e ha restituito `external_id=null`;
- due POST identici con `external_id="test-dedup-external-001"` e
  `upsert=true` hanno prodotto **1** evento;
- gli eventi test (id `116093415`, `116093416`, `116093418`) sono stati
  cancellati tutti con successo.

Conclusione: per gli eventi creati da questa app la chiave anti-duplicato
affidabile è `external_id` insieme a `upsert=true`.

### `DELETE /api/v1/athlete/0/events/{eventId}`

Endpoint ufficiale per cancellare un evento calendario. Usato solo dal probe
di sviluppo `/api/debug/inspect-events` per rimuovere gli eventi `TEST DEDUP`.

Sintassi workout verificata nel campo `description`:

```text
Warm-up
- 10m 50-60%

Main set
3x
- 15m 88-92%
- 5m 50%

Cool-down
- 10m 50%
```

Le percentuali sono riferite alla FTP. Mapping Section 11:

| Zona | Range FTP |
|---|---|
| Z1 | `50-60%` |
| Z2 | `60-75%` |
| Z3 (Sweet Spot) | `88-94%` |
| Z4 (soglia) | `95-105%` |
| Z5 (VO2) | `106-120%` |

La route applicativa usa `mode=preview` senza chiamate a Intervals.icu e
`mode=commit`, con conferma esplicita, per eseguire il solo bulk POST sopra.

## Workout Library — `library_id` per i coach_decisions (Milestone 6)

Il planner (`lib/planner/*`) seleziona le sedute SOLO da questi 26 template
(Section 11 B §8, fonte `docs/WORKOUT_REFERENCE.md` v0.6). Ogni
`coach_decisions.validation_metadata.library_id` e ogni `BuiltSession.library_id`
DEVE essere uno di questi ID stabili (catalogo tipizzato in
`lib/planner/workout-library.ts`, `VALID_LIBRARY_IDS`):

| Categoria | `library_id` (id YAML) |
|---|---|
| Endurance / Aerobico (1A) | `AE-1`, `AE-2`, `AE-3`, `AE-4`, `AE-5`, `AE-6`, `AE-7` |
| Tempo / Sweet Spot / Threshold (1B) | `SS-1`, `SS-2`, `SS-3`, `SS-4`, `SS-5`, `TH-1`, `TH-2` |
| VO₂max (1C) | `VO2-1`, `VO2-2`, `VO2-3`, `VO2-4`, `VO2-5` |
| Anaerobico / Neuromuscolare (1D) | `AN-1`, `AN-2`, `AN-3` |
| Mixed / Race-specific (1E) | `MIX-1`, `MIX-2` |
| Strength-Endurance — bassa cadenza (1F, opzionali) | `SE-1`, `SE-2` |

`is_hard_session` (per il conteggio §4 e lo spacing 48h §3.1) è quello del
blocco YAML: dure = `AE-6`, tutta la 1B, tutta la 1C, tutta la 1D, `MIX-1`,
`SE-1`, `SE-2`. NB: **`AE-6` (fast-finish) occupa uno slot di seduta dura**.

## Stream attività (verificato — Milestone 7, via /api/debug/inspect-events)

```
GET https://intervals.icu/api/v1/activity/{id}/streams.json
  ?types=altitude,velocity_smooth,latlng,watts
```

Risposta: **array di stream**, campionati a **1 Hz** (1 valore/secondo):

```jsonc
[
  { "type": "altitude",        "name": "...", "data": [number, ...] },
  { "type": "velocity_smooth", "name": "...", "data": [number, ...] },  // m/s
  { "type": "watts",           "name": "...", "data": [number, ...] },  // W (null/0 senza misuratore)
  { "type": "latlng",          "name": "...", "data": [lat, ...], "data2": [lon, ...] }
]
```

- `watts`: potenza in W (può essere null/0 se l'atleta non ha misuratore).
- `altitude`: quota in m. `velocity_smooth`: velocità in m/s.
- `latlng`: `data` = latitudini, `data2` = longitudini (array separati).

**PATH CORRETTO:** `/activity/{id}/streams.json` — **singolare, SENZA `athlete/0`**.
**PATH PLURALE** `/athlete/0/activities/{id}/streams` → **404, NON usare.**

Per la calibrazione stima tempi (M7) si chiedono solo
`types=altitude,velocity_smooth` (niente `watts`: non universale, non serve
alla velocità). Client: `IntervalsFetcher.getActivityStreams`.

## Dove vive il codice

- Costanti e tipi OAuth: `lib/intervals/config.ts`
- Client API dati: `lib/intervals-client.ts`
- Flusso OAuth: `app/api/auth/intervals/{login,callback,disconnect}/route.ts`
- Sync: `lib/intervals/sync.ts` + `app/api/sync/intervals/route.ts`
- Planner settimanale: `lib/planner/*` + `app/api/planner/{generate,push}/route.ts`
- Formatter workout Intervals: `lib/planner/intervals-workout-format.ts`
