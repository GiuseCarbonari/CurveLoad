# CurveLoad — Design System "Command Center"

Direzione visiva attuale (Passo 7, 2026-08-01): **salvia + lime, vetro bianco
latte, un solo carattere (Manrope)**. Portata dai token del command center
(`Giuse OS/command-center/src/style.css`).

**La fonte unica dei valori è [`app/globals.css`](../app/globals.css)**
(blocchi `:root` per il chiaro e `.dark` per lo scuro). Questo file spiega
*perché* i token sono quelli e come si usano; se i due divergono, vince il CSS.

## 1. Principio

- **Chiaro di default.** Il command center è un tema chiaro: fondo salvia con
  aloni lime e panna, non bianco piatto. Lo scuro è la stessa identità
  invertita (fondo inchiostro), non un secondo design.
- **Inchiostro + lime = identità.** La coppia del command center: pill scura
  con testo lime, o lime pieno con testo inchiostro.
- **Il lime non è mai testo sul chiaro.** Troppo pallido: sul tema chiaro
  `--brand` è l'oliva scuro leggibile e il lime torna come `--brand-on` (il
  testo *sopra* il riempimento). Sullo scuro i ruoli si invertono da soli.
- **Verde/giallo/rosso readiness restano stati funzionali**, mai decorazione.
- **Vetro sobrio:** blur forte, bordi chiari sottili, ombre lunghe e morbide.
  Niente neon.

## 2. Palette

Nomi = token CSS. Gli unici hex "crudi" del sistema sono `--lime`, `--sage`,
`--ink`; tutto il resto ne deriva o è definito per tema.

### Sfondi

| Token | Chiaro | Scuro |
|---|---|---|
| `--bg-base` | `#c3c8bc` (salvia) | `#0d0f0a` (inchiostro) |
| `--bg-surface` | `rgba(255,255,255,.62)` | `rgba(244,245,240,.06)` |
| `--bg-surface-2` | `rgba(255,255,255,.42)` | `rgba(244,245,240,.10)` |
| `--bg-border` | `rgba(20,21,15,.10)` | `rgba(255,255,255,.10)` |
| `--bg-glow` | aloni lime/panna/salvia | stessi aloni, molto tenui |

### Vetro

| Token | Chiaro | Scuro |
|---|---|---|
| `--glass-bg` | `linear-gradient(160deg, rgba(255,255,255,.55), rgba(255,255,255,.28))` | `linear-gradient(155deg, rgba(28,31,22,.88), rgba(18,20,14,.68))` |
| `--glass-border` | `rgba(255,255,255,.60)` | `rgba(255,255,255,.14)` |
| `--glass-shadow` | `0 22px 44px -26px rgba(28,33,22,.4)` + inset chiaro | `0 26px 50px -28px rgba(10,12,6,.6)` + inset chiaro |

### Testo

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--text-primary` | `#14150f` | `#f4f5f0` | titoli, numeri |
| `--text-secondary` | `#3d4438` | `#c6cdba` | testo corpo |
| `--text-muted` | `#5c6356` | `#9aa38a` | label e metadati |
| `--text-faint` | `#757c6e` | `#767f68` | hint e assi grafici |

### Identità

| Token | Chiaro | Scuro |
|---|---|---|
| `--brand` | `#4c5520` (oliva) | `#dff24b` (lime) |
| `--brand-hover` | `#3f4718` | `#e9f77a` |
| `--brand-dim` | `rgba(76,85,32,.14)` | `rgba(223,242,75,.16)` |
| `--brand-on` | `#dff24b` (lime) | `#14150f` (inchiostro) |
| `--accent-2` | `#6c7a2e` | `#9fab95` (salvia) |
| `--accent-2-dim` | `rgba(223,242,75,.38)` | `rgba(159,171,149,.16)` |

`--amber*` e `--accent-blue*` restano come alias di `--brand*`: nomi legacy di
componenti non ancora rinominati, non colori a sé.

### Readiness

| Stato | Chiaro | Scuro |
|---|---|---|
| GO | `#156544` | `#46b88a` |
| MODIFY | `#7a5108` | `#e0a83e` |
| SKIP | `#a8321f` | `#d9665b` |

Sul chiaro sono scuri perché devono restare leggibili **come testo** su vetro
bianco. Per il caso opposto — testo *sopra* un riempimento pieno di readiness
— esiste `--ready-on` (bianco sul chiaro, inchiostro sullo scuro), stesso
ruolo di `--brand-on`.

### Zone allenamento

`--zone-z1..z5`: scala funzionale propria, sempre etichettata. Definita per
tema in `globals.css`.

## 3. Tipografia

**Un solo carattere: Manrope** (`--font-manrope`, caricato in
`app/layout.tsx`).

Le utility Tailwind `font-serif` / `font-display` / `font-data` **non**
indicano più un graziato: indicano il ruolo (titoli, numeri) e puntano tutte a
Manrope. I nomi sono rimasti per non toccare ~40 punti di chiamata.

- Numeri principali: 28-50px, peso 700-800, `letter-spacing: -.02em`,
  `tabular-nums` (le colonne non ballano quando il valore cambia).
- Label tecniche: 10-12px, maiuscolo, `letter-spacing .06em-.14em`.

## 4. Componenti

- **Raggi:** `rounded-card` = 28px (card grandi), `rounded-metric` = 20px
  (metriche, riquadri interni), `--radius` = 16px (base shadcn), `999px` per
  le pill. Usare questi, non valori letterali.
- **Card di vetro:** classe `.panel` (o `.glass` / `.metric-card`) — prendono
  `--glass-bg`, `--glass-border`, `--glass-shadow` e il blur.
- **CTA primaria:** `bg-brand text-brand-on` — la pill inchiostro/lime del
  command center.
- **Orb readiness:** decisione al centro, chip Forma/Fatica/Freschezza.
- **Header:** sticky, vetro, con l'interruttore chiaro/scuro.

## 5. Regole

- Non inventare token fuori da `globals.css`. Niente hex scritti nei
  componenti: le uniche eccezioni ammesse sono i colori di marchi esterni
  (il rosso Intervals.icu in `push-button.tsx`), le serie dei grafici e i
  colori della mappa.
- I modificatori di opacità (`bg-brand/40`) funzionano grazie all'helper
  `token()` in `tailwind.config.ts`: senza, Tailwind **non genera nessuna
  regola** per quelle classi e l'elemento resta senza sfondo.
- Readiness sempre più importante di ogni altro dato.
- Non usare rosso/giallo/verde readiness come decorazione generica.
- Le animazioni devono rispettare `prefers-reduced-motion`.
- Mantieni contrasto alto e tap target almeno 40px.
