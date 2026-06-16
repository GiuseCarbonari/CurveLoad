# Handoff: Limina — App Coach IA Endurance

## Overview
Limina è una web app (React/Next.js + Tailwind) per atleti endurance/MTB amatoriali evoluti.
Genera piani di allenamento settimanali deterministici (protocollo "Section 11") a partire dai
dati sincronizzati da **Intervals.icu** (CTL/ATL/TSB/ACWR, HRV, potenza, attività).

Principio centrale del prodotto: **nessuna sincronizzazione automatica in background**. Ogni
aggiornamento (dati Intervals, generazione piano, calibrazione) parte da un'azione manuale
dell'utente. Di conseguenza l'UI deve sempre:
- mostrare **quando** i dati sono stati aggiornati l'ultima volta (in alto a destra di ogni schermata);
- mettere l'**azione di refresh come primo elemento in alto**, mai in un menu;
- segnalare in modo non ansiogeno i dati "stantii" (badge ambra, non rosso);
- gestire esplicitamente gli stati **in sync** (spinner/skeleton) ed **errore** (token scaduto → riconnetti).

## About the Design Files
I file in questo bundle sono **riferimenti di design realizzati in HTML** — prototipi che mostrano
aspetto e comportamento desiderati, **non codice di produzione da copiare direttamente**.
Il compito è **ricreare questi design nell'ambiente del codebase Limina** (React/Next.js + Tailwind),
usando i pattern e le librerie già stabiliti nel progetto. Gli HTML usano un piccolo runtime di
componenti ("DCLogic") solo per la demo: ignoralo e reimplementa la logica con React
(useState/useEffect, o lo state manager del progetto).

I file `.dc.html` si aprono in un browser. Per leggerne il sorgente, guarda il markup tra `<x-dc>...</x-dc>`
(template) e la classe `class Component extends DCLogic` (logica/stato) in fondo al file.

## Fidelity
**High-fidelity (hifi).** Colori, tipografia, spaziature, raggi e interazioni sono finali.
Ricrea la UI in modo fedele al pixel usando le librerie/pattern del codebase. I valori esatti
sono nella sezione Design Tokens.

---

## Design Tokens

Mappano 1:1 su `tailwind.config.js → theme.extend`.

### Colori
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#090C13` | Sfondo app (mobile). Esplorazioni/desktop: `#06080D` |
| `surface` | `#11151E` | Superficie base |
| `surface-2` | `#161B26` | Superficie elevata |
| `card-grad` | `linear-gradient(160deg, rgba(34,43,61,0.5), rgba(14,18,27,0.4))` | Riempimento card glass |
| `hairline` | `rgba(255,255,255,0.08)` | Bordi sottili |
| `accent` (blue) | `#5B8DEF` | Accento primario, azioni, "oggi" |
| `accent-2` (teal) | `#7FC8C0` | Accento secondario, etichette sezione |
| `ring-grad` | `linear-gradient(135deg,#5B8DEF,#7FC8C0)` | Stroke anelli |
| `go` | `#46B88A` | Readiness GO, stato calibrato, delta positivo |
| `modify` | `#E0A83E` | MODIFY, dati stantii, warning |
| `skip` | `#D9665B` | SKIP, errore |
| `text` | `#EAEEF6` | Testo primario |
| `text-2` | `#AAB3C2` | Testo secondario |
| `text-3` / muted | `#707A8A` | Caption, etichette |
| muted-2 | `#5C6470` | Etichette più deboli |

Colori "soft" derivati (riempimenti badge): stessa hue a `0.12–0.16` alpha; bordi a `0.30–0.45` alpha;
testo del badge a versione chiara della hue (es. GO testo `#7FE0B3`, MODIFY `#F0C878`, SKIP `#ED8A82`).

### Tipografia
- `font-serif`: **Newsreader** (Google Fonts) — titoli e numeri hero. Pesi 400/500.
- `font-sans`: **Syne** (Google Fonts) — corpo, etichette, UI. Pesi 400/500/600/700.
- I numeri usano `font-variant-numeric: tabular-nums`.

Scala:
| Ruolo | Dimensione / peso / famiglia |
|---|---|
| hero number | 46–62px / 500 / serif |
| display | 42px / 500 / serif |
| h1 schermata | 30–32px / 500 / serif |
| h2 | 24–30px / 400–500 / serif |
| body L | 17px / 600 / sans |
| body | 14–15px / 400 / sans |
| label | 11–13px / 600 / sans, `letter-spacing:0.12–0.16em`, `text-transform:uppercase` |
| caption | 11–12px / 400 / sans |

### Raggi (borderRadius)
`md 14px · lg 18px · xl 20px · 2xl 24px · full 999px`. Card metrica 16px, card grandi 18–24px, pill/badge 999px, bottoni 12–15px.

### Spacing
Base 4px. Valori ricorrenti: 6/8/10/12/14/16/18/22/26px. Padding card 14–18px (mobile), 22–30px (sezioni grandi). Gap griglie 8–18px.

### Ombre / glow
- Card "oggi" (giorno corrente): `0 0 0 1px rgba(91,141,239,0.2), 0 12px 30px rgba(91,141,239,0.14)`.
- Bottone primario blu: `0 10px 26px rgba(91,141,239,0.30)`.
- Stroke anello: `drop-shadow(0 0 9px rgba(<accent>,0.5))`.
- Glow dot stato: `0 0 12–14px <color>`.

### Anelli / indicatori
SVG `viewBox 0 0 200 200`, due `<circle>` concentrici r≈84:
track `stroke rgba(255,255,255,0.07)`, progress `stroke url(#grad)` con `stroke-linecap:round`,
`stroke-dasharray` = `circonferenza_visibile rimanente` (2πr ≈ 528; es. 78% ≈ `412 528`),
ruotato `-90deg` per partire in alto. Numero/etichetta serif centrati in overlay assoluto.

---

## Screens / Views

Tutte le schermate condividono un **layout costante** (requisito "card memorizzabili"):
- riga header: **titolo a sinistra**, **"Aggiornato · <timestamp>" in alto a destra** con dot di stato colorato;
- subito sotto, **azione principale di refresh** a tutta larghezza (o coppia di azioni nel Piano);
- contenuto in singola colonna, scroll verticale;
- **bottom tab bar** fissa: Oggi · Piano · Profilo · Impostazioni.

Container mobile primario: 390px di larghezza (iPhone). Deve restare leggibile su desktop
(centrare la colonna, max-width ~640px, o layout a colonne dove sensato).

### 1. Oggi (Dashboard)
- **Purpose**: decisione del giorno — allenarsi o no.
- **Layout**: header → bottone "Aggiorna dati" → hero readiness ring → card seduta di oggi →
  griglia 2 colonne di 6 metriche → grafico trend 30gg.
- **Componenti**:
  - *Hero readiness*: card con bordo/glow nella hue dello stato. Anello (vedi sopra) con al centro
    label qualitativa serif (**GO** / **MODIFY** / **SKIP**) + numero 0–100 + "su 100". Sotto, frase coach.
    Stato esempio: GO, 78. Colori da `go/modify/skip`.
  - *Card seduta di oggi*: accento blu, etichetta "Seduta di oggi", chip "Medio · Z4", titolo serif
    ("Soglia 3×12′"), riga meta (durata / watt / zona), bottone "Vedi struttura completa".
  - *Metriche* (6): CTL "Forma fisica", ATL "Fatica recente", TSB "Freschezza", ACWR "Equilibrio carico",
    RHR "FC a riposo", HRV "Variabilità FC". Ogni card: label semplice + acronimo + valore serif + delta vs 7gg.
    Icona **ⓘ** in alto a destra apre un **tooltip** inline (testo glossario). Vedi copy sotto.
  - *Trend chart*: SVG area (CTL, fill gradient blu) + linea tratteggiata teal (ACWR), legenda in alto.

### 2. Piano settimanale
- **Purpose**: colpo d'occhio sulla settimana; espandere una seduta; gestire un giorno non disponibile;
  rigenerare e inviare a Intervals.
- **Layout**: header → **due azioni distinte**: "⟳ Rigenera" (secondaria, blu tenue) e
  "↗ Invia a Intervals" (primaria teal, con sottotesto "richiede conferma") → 3 totali (ore/TSS/intense)
  → card narrativa "La logica della settimana" → lista 7 giorni.
- **Card giorno** (varianti per tipo, **non blocco di colore pieno**): bordo sottile + **border-left 3px**
  colorato per tipo + icona; data serif + titolo + durata + chip "tipo · zona".
  - hard `#D9665B` ▲ · medium `#5B8DEF` ◆ · easy `#7FC8C0` 〜 · rest = bordo tratteggiato, no riempimento ○.
  - **oggi**: bordo blu pieno + glow (vedi ombre), dot blu pulsante.
  - Tap → espande: Obiettivo, Struttura, Nota coach (callout blu), bottone "Non posso allenarmi questo giorno".
  - Quel bottone apre l'**anteprima ridistribuzione** (card ambra) con righe spostamento + "TSS invariato"
    e azioni Annulla / Conferma.

### 3. Profilo atleta
- **Purpose**: il "motore" dell'atleta + analisi gara.
- **Layout**: header → banner **calibrazione** (3 stati) → hero potenza (CP) → 2 mini-card (W′, Potenza max) →
  tabella **RPP** → pannello **Analisi evento**.
- **Componenti**:
  - *Calibrazione*: card colorata per stato — non calibrato (`skip`), valori medi (`modify`),
    sui tuoi dati (`go`). Mostra label + dot + bottone "Calibra dai tuoi dati".
  - *Hero CP*: numero serif grande (298 W) + W/kg + sottotitolo **fenotipo** in serif italic
    ("Diesel con punta esplosiva"). ⓘ tooltip.
  - *RPP*: tabella scannerizzabile (Durata / Watt / W/kg / affidabilità). Pallino verde = affidabile,
    `◐` ambra = sforzo non massimale. Header riga con label uppercase.
  - *Analisi evento*: titolo gara serif + meta (km / D+ / salite) → **profilo altimetrico SVG** con
    fasce rosse sulle salite → tabella salite con categoria (HC / Cat1–4) → card **limitatori**
    (border-left colorato) con "leva di allenamento" suggerita.

### 4. Onboarding (wizard 5 step)
- **Purpose**: consenso + dossier + obiettivi + disponibilità + sync/build.
- **Layout**: progress bar in alto ("Step n di 5" + barra gradient) → titolo step serif → corpo →
  footer con "Indietro" / "Continua" (ultimo step: "Apri la dashboard").
- **Step**: 0 GDPR (consensi, wordmark Limina in apertura) · 1 Dossier (nome/età/peso/disciplina) ·
  2 Obiettivi (gara target, obiettivo principale) · 3 Disponibilità (giorni allenabili, ore, attrezzatura) ·
  4 Sync+build (checklist con spinner sull'ultimo: "Genero la prima settimana… protocollo Section 11").

### 5. Impostazioni / dossier editabile
- **Purpose**: stessi campi dell'onboarding, in versione editabile.
- **Layout**: header → card connessione Intervals (stato sync + "Riconnetti") → gruppi di righe editabili
  (Anagrafica, Gara e obiettivi, Disponibilità, Giorni vincolati) ognuna con matita ✎ → bottone
  "Esporta o cancella i miei dati" (rosso tenue, in fondo).

---

## Interactions & Behavior

### State machine "dati" (trasversale a tutte le schermate)
Quattro stati: `fresh | stale | syncing | error`. Influenzano timestamp, dot di stato, e il bottone refresh.

| Stato | Timestamp | Dot/testo | Bottone refresh |
|---|---|---|---|
| `fresh` | "adesso" | verde `#46B88A` / `#7FE0B3` | blu gradient, "⟳ Aggiorna dati" |
| `stale` | "1 g fa · ieri 09:10" | ambra `#E0A83E` / `#F0C878` | ambra gradient, "⟳ Aggiorna dati" |
| `syncing` | "in corso…" | blu / `#9FBCF5` | disabilitato, spinner, "Sincronizzo…" |
| `error` | "sync fallita" | rosso `#D9665B` / `#ED8A82` | rosso gradient, "↻ Riconnetti Intervals.icu" + riga avviso "Token scaduto" |

- Click su refresh: `→ syncing`; dopo ~1.9s `→ fresh` (in produzione: chiamata reale a Intervals, con timeout/errore reali).
- Durante `syncing`: hero e griglia metriche mostrano **skeleton shimmer** (gradient animato 1.4s).
- Lo stato `stale` deve attivarsi automaticamente quando `now - lastSync > 24–48h`.

### Altre interazioni
- **Tooltip metriche/glossario**: toggle on/off al tap su ⓘ; uno solo aperto per volta. Inline (non popover) su mobile.
- **Card giorno**: tap espande/contrae il dettaglio (accordion, uno aperto consigliato). Reset della ridistribuzione quando si cambia giorno.
- **Ridistribuzione**: "Non posso allenarmi" → mostra anteprima → Conferma/Annulla la chiude.
- **Invia a Intervals**: azione "pubblica" → deve richiedere conferma esplicita (modale) prima dell'invio.
- **Onboarding**: Continua/Indietro avanzano `obStep` 0..4; barra progress = `(step+1)/5`.
- **Transizioni**: barra progress `width 0.4s ease`; spinner `rotate 0.7–0.8s linear infinite`; shimmer skeleton.
- **Navigazione**: tab bar + (nella demo) pill in alto cambiano `screen`. Cambio schermata resetta i tooltip aperti.

## State Management
Variabili minime (nella demo sono nello state del componente):
- `screen`: `today | plan | profile | onboarding | settings`
- `data`: `fresh | stale | syncing | error` (+ `lastSyncAt` timestamp reale)
- `openTooltip`: chiave metrica aperta | null
- `openDay`: indice giorno espanso | -1
- `redistribute`: bool (anteprima aperta)
- `calib`: `none | partial | full`
- `obStep`: 0..4
- Dati: profilo atleta, settimana (7 giorni), metriche, RPP, evento — da API/Intervals.icu.

Data fetching: tutto on-demand su azione utente. Esporre `lastSyncAt` e calcolare la staleness lato UI.

## Design Tokens → riferimento file
Vedi `Moodboard e Tokens.dc.html` per palette, tipografia, anelli e l'anatomia/varianti di tutti i componenti chiave
(card metrica + tooltip + empty state, bottone refresh nei 4 stati, badge di stato, card giorno hard/easy/rest/oggi).

## Assets
- **Font**: Newsreader + Syne via Google Fonts (`<link>` già nei file).
- **Icone**: attualmente glifi unicode/SVG inline placeholder (◎ ▦ ◭ ⚙ ⟳ ↗ ✎ ▲ ◆ 〜 ○ ⓘ). Sostituire con
  un set icone del codebase (es. Lucide/Phosphor) mantenendo peso/dimensione coerenti.
- **Logo Limina**: ancora in esplorazione (non incluso nel bundle, non finalizzato). Wordmark placeholder
  corrente nell'app = anello aperto (eco del readiness ring) + "Limina" in Newsreader, visibile
  nell'onboarding (step 0) e nell'header della Dashboard. Direzione in valutazione: l'anello che
  disegna una **L**. Usare il placeholder finché il marchio definitivo non è pronto.
- **Grafici/altimetria**: SVG generati a mano come placeholder; in produzione usare dati reali (libreria grafici del codebase).
- Nessun'immagine raster.

## Files (in questo bundle)
- `Coach IA - App.dc.html` — **app completa interattiva**, le 5 schermate + state machine refresh. Sorgente di verità per layout e comportamento.
- `Moodboard e Tokens.dc.html` — direzione visiva, palette, tipografia, tokens, anatomia componenti.
> Nota: i `.dc.html` contengono un piccolo runtime di demo. Reimplementa la logica in React;
> usa gli HTML solo come riferimento visivo e comportamentale.
