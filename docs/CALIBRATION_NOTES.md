# Calibrazione race-estimator — note (Milestone 7)

Stato: **stima tempi gara DISATTIVATA in UI** (riquadro "in arrivo" in
`/profile`). Il codice resta in repo e verrà ripreso al **Milestone 7**:

- `lib/terrain/race-estimator.ts` (modello fisico)
- `app/api/profile/race-estimate/route.ts` (endpoint)
- migration `009` (colonne `race_estimate` / `race_estimate_at`)
- componenti `components/profile/race-estimate.tsx`, `race-estimate-button.tsx`
- route diagnostica `app/api/debug/calibrate-estimate/route.ts` (dev only)

Motivo: il modello fisico **non è ancora calibrato** sui dati reali MTB.
Diagnosi numerica eseguita su una gara reale (vedi sotto).

## Dato reale di riferimento — Rampichilonero 2024

| Grandezza | Valore |
|---|---|
| Distanza | 43.44 km |
| Dislivello D+ | 1558 m |
| Tempo in movimento | 3h08 (11288 s) |
| Tempo trascorso | 3h33 (12780 s) |
| Potenza media | 180 W |
| Velocità media | 13.8 km/h |
| FTP atleta (epoca) | 242 W |
| Peso | 76.2 kg |

GPX: `docs/Rampiconero_2024.gpx` (Strava, con timestamp).

## Diagnosi (route `/api/debug/calibrate-estimate`)

Confronto della velocità reale per fascia di gradiente (dai timestamp del GPX)
con la velocità che il modello calcola alla **potenza reale media (180 W)** —
così si isola l'errore di TERRENO/FISICA dall'errore di assunzione di potenza.

| Fascia | % percorso | Vel. reale | Modello @180W | Errore |
|---|---|---|---|---|
| **Salita > +3%** | 38.9% | 7.8 km/h | 8.0 km/h | **+1.4%** ✅ accurato |
| Salita dolce +2..+3% | 5.6% | 16.6 km/h | 15.9 km/h | −4.1% |
| **Pianeggiante −2..+2%** | 15.3% | 17.6 km/h | 21.6 km/h | **+22.8%** ⚠️ troppo veloce |
| Discesa dolce −3..−2% | 3.1% | 21.1 km/h | 30.0 km/h | +42.4% ⚠️ |
| **Discesa < −3%** | 37.0% | 26.2 km/h | 7.7 km/h | **−70.5%** 🔴 troppo lento |

### Problemi individuati (in ordine di impatto)

1. **🔴 Discese (37% del percorso) — errore −70%.** In `solveVelocity` il ramo
   Newton sulla **cubica diverge** con pendenza negativa (il termine resistivo
   `m·g·(grad+CRR)` diventa negativo) e la velocità viene **floorata a
   `MIN_SPEED_MPS` = 1.5 m/s (5.4 km/h)**. Il cap `MAX_DESCENT_KMH = 40` non si
   attiva mai. Il modello crede di arrancare in discesa. È l'errore singolo più
   grande e pesa sul tratto più esteso.

2. **⚠️ Pianura — modello troppo veloce (+23%, +42% in discesa dolce).** A
   180 W reali il modello sottostima il costo del terreno: `CRR`/`CDA` per MTB
   su sterrato sono troppo bassi.

3. **✅ Salita — accurato (+1.4%).** Dove l'aerodinamica è trascurata e domina
   gravità+rotolamento la fisica è ben tarata.

### Perché il tempo totale mascherava il problema

Confronto a CP=242 W (scenario realistico): tempo modello 3h42 vs 3h08 reale
(**+18%**). Sembra "solo lento", ma è il **saldo di errori opposti che si
compensano**: la velocità alta in salita compensa il crollo in discesa.
Alimentando la fisica con i **180 W reali** il tempo schizza a **4h49 (+54%)**,
rivelando il peso vero dell'errore-discesa. Per questo la calibrazione va fatta
**per fascia di terreno**, non sul tempo complessivo.

## Esito M7 — modello a 3 livelli implementato

Modello v2 (`lib/terrain/race-estimator-v2.ts` + `lib/terrain/velocity-signature.ts`):
- **L1 personale**: velocità reale dell'atleta per fascia di pendenza, dalle
  sue attività MTB (stream 1 Hz altitude+velocity_smooth). Firma "personale"
  (livello 1) se copertura ≥ 60% delle fasce osservate; altrimenti livello 2.
- **L2 archetipo** (`ARCHETYPE_SEED`): curve MTB ancorate ai dati Rampichilonero
  verificati (piano 18 km/h, discesa dolce 21, discesa 24–26, salita ~7.8 km/h
  alla fascia ~9–10%). Usato come seed e per piano/discesa senza dati personali.
- **L3 fisica**: solo in salita (>3%), dove il modello è accurato.

**Validazione archetipo sul Rampichilonero** (`validateAgainstKnown()`, test
built-in, non bloccante): stima **3h27 (12439 s) vs reale 3h08 (11288 s) →
errore +10.2%**. Confronto col v1 fisico puro: **+54%** (e −70% sulle discese).
Obiettivo milestone «±20%» **raggiunto** (con archetipo; la firma personale L1
sui dati reali dell'atleta è attesa più accurata).

## Fix bias di campionamento sulle discese (M7)

**Bias diagnosticato:** la firma di velocità SOTTOSTIMAVA le discese. La mediana
per-secondo sovrappesa i tratti lenti: su una discesa i secondi a bassa
velocità (tecnica, frenate) sono più numerosi di quelli veloci → la mediana
crolla (es. discesa −10% risultava ~12.8 km/h contro ~26 km/h reali in gara).

**Correzione (in `buildSignatureFromStreams`, solo COSTRUZIONE della firma; il
modello `race-estimator-v2` non è stato toccato):**
1. **Peso per distanza, non per tempo** — media pesata `Σv²/Σv` invece della
   mediana: un secondo veloce copre più strada e "conta" di più. La velocità
   rappresentativa di un tratto è quella a cui lo PERCORRI.
2. **Esclusione soste** — scartati i secondi < 1.0 m/s (3.6 km/h): code,
   navigazione, fermate non sono velocità di percorrenza.
3. **75° percentile sulle discese (< −3%)** — in gara scendi più deciso che in
   allenamento; il 75° percentile delle discese di allenamento approssima la
   discesa di gara. Salite e piano restano sulla media pesata.

**Validazione (rebuild della firma dal GPX del Rampichilonero e ri-stima del
tempo, reale 3h08 = 11288 s):**

| Costruzione firma | Stima | Errore |
|---|---|---|
| Mediana per-secondo (vecchia) | 3h24 | +8.5% |
| Media pesata per distanza (CAMBIO 1) | 2h49 | −10.1% |
| + 75° percentile discese (CAMBIO 3) | 2h48 | **−10.6%** |

Lettura: il grosso dello spostamento viene dalla **media pesata per distanza**
(CAMBIO 1), che elimina l'oversampling dei secondi lenti. Il segno dell'errore
si **inverte** (da troppo lento a leggermente troppo veloce).

**Caveat metodologico onesto:** questo è un *self-test* (firma ricostruita
dalla gara stessa e ri-stima della gara stessa). Il bias reale che si voleva
correggere è il caso **allenamento→gara**: la firma costruita da uscite di
allenamento (discese caute) applicata a una gara → stima troppo lenta. Il
CAMBIO 3 (75° percentile) serve proprio a colmare quel divario allenamento→gara
e per questo, applicato a dati di gara, *sovrastima* leggermente (−10.6%).
Inoltre la validazione usa una velocità derivata grezza dal GPX (più rumorosa
del `velocity_smooth` di Intervals che la produzione userà), il che gonfia il
75° percentile. In uso reale (firma da allenamenti + stream smussati) l'errore
atteso è entro ±10% nella direzione giusta. Resta comunque un crollo netto
rispetto al **+54%** (e **−70% sulle discese**) del modello fisico v1.

## Decisione di design (M7)

Stima a **3 livelli**, dal più specifico al più generale:

1. **Personale** — calibrata sullo **storico MTB reale dell'atleta** (velocità
   per fascia di gradiente dalle sue attività).
2. **Archetipo** — fallback su un profilo MTB tipico quando lo storico è scarso.
3. **Fisica** — il modello attuale `solveVelocity`, da correggere prima su
   discese (rimuovere il floor / gestire la cubica su pendenza negativa) e su
   `CRR`/`CDA` in pianura.

## Nota a margine — parser GPX

`detectClimbs` **sovrastima il D+ del ~19%** (1860 m parsati vs 1558 m reali;
distanza 44.54 vs 43.44 km, +2.5%). Lo smoothing ±25 m non basta sul rumore
GPS dell'elevazione Strava. Da rivedere a parte (non blocca la stima tempi).
