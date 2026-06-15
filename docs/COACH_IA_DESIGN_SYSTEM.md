# Coach IA — Design System (Light Premium / Petrolio)

Direzione visiva approvata: **light premium, identità blu petrolio, accento
rame caldo, colori semaforici per la readiness.**
Questo file è la fonte unica dei token. Ogni pagina deve derivare i colori da
qui, nessun valore inventato altrove.

---

## 1. Principio

- **Sfondo chiaro neutro**, non bianco puro su tutta la pagina. Il bianco è
  riservato alle superfici per rendere immediata la separazione dei contenuti.
- **Blu petrolio = identità e orientamento.** È usato per navigazione, focus,
  azioni primarie e codici visivi delle sezioni.
- **Rame = accento caldo.** È usato con parsimonia per dati chiave, grafici e
  dettagli editoriali. Mai per testo lungo o grandi superfici.
- **Verde / giallo / rosso = solo readiness e stati funzionali.** Il colore
  semaforico è informazione, non decorazione.
- **I dati sono i protagonisti.** Numeri grandi, alto contrasto, molto respiro.
  Niente glass effect, gradienti pesanti o ombre drammatiche.
- Coerenza totale tra le pagine: stesso header, stessi raggi, stessa spaziatura.

---

## 2. Palette (valori esatti)

### Sfondi
| Token | Valore | Uso |
|---|---|---|
| `bg-base` | `#F2F2F2` | sfondo pagina |
| `bg-surface` | `#FFFFFF` | card, pannelli, form |
| `bg-surface-2` | `#E7EEF2` | elementi attivi, hover, tab selezionato |
| `bg-border` | `#D5DEE3` | divisori e bordi interni |

### Testo
| Token | Valore | Uso |
|---|---|---|
| `text-primary` | `#183443` | titoli, numeri, testo principale |
| `text-secondary` | `#405966` | sottotitoli e testo corpo |
| `text-muted` | `#566B75` | label e metadati |
| `text-faint` | `#60717A` | hint, note e caption |

### Identità blu petrolio
| Token | Valore | Uso |
|---|---|---|
| `brand` | `#42708C` | navigazione, focus, azioni primarie |
| `brand-hover` | `#365F78` | hover su elementi brand |
| `brand-dim` | `rgba(66,112,140,.12)` | sfondo tenue per selezioni |
| `brand-on` | `#FFFFFF` | testo su fondo brand |

### Accento rame
| Token | Valore | Uso |
|---|---|---|
| `amber` | `#8C6746` | dati chiave, grafici, accenti |
| `amber-hover` | `#745238` | hover su elementi rame |
| `amber-dim` | `rgba(140,103,70,.12)` | sfondo tenue rame |
| `amber-on` | `#FFFFFF` | testo su fondo rame |

### Semaforico readiness (SOLO per stato)
| Stato | Colore | Bordo card | Uso |
|---|---|---|---|
| GO | `#117136` | `rgba(17,113,54,.28)` | readiness verde |
| MODIFY | `#925A06` | `rgba(146,90,6,.28)` | readiness gialla |
| SKIP | `#C92323` | `rgba(201,35,35,.28)` | readiness rossa |

Le card readiness mantengono una barra laterale di 3px del colore di stato e
un bordo sottile dello stesso colore semitrasparente.

---

## 3. Layout e forme

- Raggi: card grandi `16px`, card interne/metriche `11px`, bottoni `9px`,
  input `9px`.
- Spaziatura verticale: ritmo a `1rem / 1.25rem / 1.5rem / 1.75rem`.
- Padding card: `1.5rem` per le grandi, `0.9rem` per le metriche.
- Larghezza contenuto: max ~960px centrata su desktop, padding laterale mobile.
- Le superfici si distinguono tramite contrasto di fondo e bordi leggeri, non
  tramite ombre pesanti.

## 4. Tipografia

- Numeri e titoli: peso 500–700, `text-primary`.
- Readiness: 42px, peso 700, colore di stato.
- Metriche: valore 22px peso 500; label 11–12px `text-muted`.
- Corpo: 14px, `line-height` 1.6, `text-secondary`.
- Mai ALL CAPS se non per micro-label.

## 5. Componenti chiave

- **Bottone primario:** sfondo `brand`, testo `brand-on`, raggio 9px, hover
  `brand-hover`.
- **Bottone secondario:** trasparente, bordo `0.5px bg-border`, testo
  `text-secondary`, hover `bg-surface-2`.
- **Card metrica:** `bg-surface`, raggio 11px, label muted e valore grande.
- **Card readiness:** `bg-surface`, barra laterale e bordo nel colore di stato.
- **Riga lista:** nome `text-primary`, metadati `text-faint`, divisori
  `bg-border`.
- **Input/form:** `bg-surface`, bordo `bg-border`, testo `text-primary`, focus
  ring blu petrolio.
- **Tab toggle:** contenitore `bg-surface`, tab attivo `bg-surface-2`.

## 6. Regole ferme

- Il tema chiaro è il tema corrente. Nessun toggle in questo milestone.
- Il blu petrolio orienta e identifica, il rame evidenzia dati e grafici.
- Il colore semaforico non si usa mai fuori da readiness e stati funzionali.
- Niente gradienti, glass/blur, ombre colorate o neon.
- Contrasto AA minimo su tutto il testo.
- Accessibilità: focus visibile, `prefers-reduced-motion` rispettato, tap target
  almeno 40px.
- Ogni pagina riusa lo stesso header e lo stesso contenitore.
