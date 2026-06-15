# Coach IA - Piano redesign UI premium

> Stato: in esecuzione - Milestone P0 dashboard e P1 profilo completate  
> Riferimenti visivi: [Bevel Health](https://www.awwwards.com/sites/bevel-health) e [Aqryl Trading Analytics](https://www.awwwards.com/sites/aqryl-trading-analytics)  
> Fonte unica di palette, raggi e stati: [COACH_IA_DESIGN_SYSTEM.md](COACH_IA_DESIGN_SYSTEM.md)

## 1. Obiettivo

Evolvere l'interfaccia attuale da una sequenza di card coerenti ma ancora
uniformi a un prodotto più pulito, arioso e premium, in cui:

- la decisione quotidiana è immediatamente leggibile;
- i dati hanno una gerarchia chiara, non lo stesso peso visivo;
- le superfici organizzano il contenuto senza creare una griglia di scatole;
- l'ambra identifica il prodotto e guida l'attenzione senza dominare la pagina;
- ogni schermata comunica una sola priorità principale;
- desktop e mobile hanno composizioni intenzionali, non solo responsive.

Il redesign non modifica la logica applicativa, i dati mostrati o i token
approvati. Interviene su composizione, tipografia, densità, navigazione e
presentazione dei dati.

## 2. Interpretazione delle reference

### Da Bevel Health

- Una domanda principale per schermata: "come sto oggi?".
- Stato corrente dominante, seguito da spiegazione e azione.
- Tipografia ampia e leggibile, con poco rumore intorno ai valori.
- Linguaggio umano prima del dettaglio tecnico.
- Progressione verticale narrativa: stato, motivazione, dettaglio.

### Da Aqryl

- Dashboard analitiche ordinate per livelli di importanza.
- Dati complessi raccolti in pannelli ampi e continui.
- Tabelle, grafici e metriche con linee leggere e molto spazio.
- Navigazione sobria e presenza ridotta del chrome applicativo.
- Densità controllata: più informazioni non significa più elementi visivi.

### Sintesi per Coach IA

Direzione proposta:

- **70% Aqryl:** struttura, dashboard, tabelle, densità dei dati.
- **30% Bevel:** centralità della readiness, tono umano, ritmo editoriale.

Le reference sono una guida di composizione e gerarchia. Non vanno copiati
layout, asset, animazioni o componenti riconoscibili.

## 3. Principi di composizione

### 3.1 Una gerarchia in tre livelli

Ogni pagina deve distinguere chiaramente:

1. **Decisione o risultato principale**
2. **Contesto necessario per interpretarlo**
3. **Dettaglio consultabile**

Non più di un elemento per pagina deve avere il massimo peso visivo.

### 3.2 Meno card, più sezioni

Usare card solo quando il contenuto rappresenta:

- uno stato autonomo;
- un gruppo di dati con una relazione forte;
- un'azione circoscritta;
- un pannello espandibile.

Per il resto preferire:

- sezioni aperte;
- divisori sottili;
- righe dati;
- griglie interne senza bordo;
- spazio verticale.

### 3.3 Ambra come segnale

Usare `amber` per:

- CTA primaria;
- valore chiave della pagina;
- tab o voce attiva quando necessario;
- piccoli indicatori di selezione;
- elementi grafici principali.

Non usarla contemporaneamente su molti valori. In ogni viewport dovrebbe
esserci un solo punto ambra dominante, oltre al logo.

### 3.4 Semaforica confinata

GO, MODIFY e SKIP restano gli unici elementi che usano stabilmente verde,
giallo e rosso. Gli stessi colori possono comparire nei messaggi funzionali
associati a quello stato, ma non per:

- tipologie di allenamento;
- livelli di velocità;
- fasi del piano;
- categorie del percorso;
- decorazione di grafici.

## 4. Nuovo sistema di layout

### 4.1 Contenitore

- Conservare `max-width: 960px` come base.
- Consentire `1080-1120px` solo alle viste con tabelle o griglie settimanali.
- Padding mobile minimo `20px`.
- Spazio tra macro-sezioni: `32-48px`.
- Spazio interno ai gruppi: `16-24px`.

### 4.2 Header

Obiettivo: ridurre l'altezza percepita e lasciare più spazio al prodotto.

- Logo e nome a sinistra.
- Navigazione compatta a destra.
- Tab attivo indicato da superficie tenue o underline, non da un blocco pesante.
- Header non sticky nella prima iterazione.
- Azioni di account e disconnessione spostate fuori dal flusso principale.
- Su mobile: logo a sinistra, navigazione orizzontale compatta o barra inferiore.

### 4.3 Apertura pagina

Ogni pagina autenticata apre con:

- eyebrow opzionale;
- titolo breve;
- sottotitolo di una riga;
- una sola azione principale, allineata a destra su desktop.

Evitare breadcrumb e link "torna alla dashboard": la navigazione globale li
rende ridondanti.

## 5. Dashboard "Oggi"

La dashboard è la priorità P0 e definisce il linguaggio del prodotto.

### 5.1 Hero readiness

Trasformare la card readiness in un hero a due colonne.

Desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ OGGI                                      Confidenza alta    │
│                                                              │
│ GO                     Sei pronto per la seduta prevista.    │
│                        Nessun segnale critico rilevato.       │
│                                                              │
│                        [Apri il piano di oggi]                │
└──────────────────────────────────────────────────────────────┘
```

Mobile:

- stato in alto;
- frase principale subito sotto;
- segnali in elenco breve;
- CTA full width.

Interventi:

- readiness `48-56px` su desktop, `42-48px` su mobile;
- spiegazione in linguaggio naturale;
- massimo tre segnali visibili;
- segnali aggiuntivi dietro "Mostra dettagli";
- barra laterale semaforica conservata;
- niente altre metriche colorate nello stesso blocco.

### 5.2 Metric strip

Sostituire la griglia di sei card metriche con un'unica superficie continua:

```text
CTL 42     ATL 36     TSB +6     ACWR 0.94     HRV 61     RHR 48
```

- divisori verticali su desktop;
- griglia `2 x 3` su mobile;
- TSB unico valore ambra;
- label discrete;
- eventuale trend sotto il valore, quando disponibile;
- tooltip solo sui concetti non immediati.

### 5.3 Attività recenti

- Sezione aperta, non necessariamente racchiusa in una card.
- Mostrare tre attività, non cinque, nella vista iniziale.
- Riga più alta e leggibile.
- Durata o TSS come valore principale a destra, non entrambi in competizione.
- Link finale "Vedi tutte" solo quando esiste una destinazione reale.

### 5.4 Azioni secondarie

- "Aggiorna dati" resta nell'intestazione della pagina.
- "Disconnetti Intervals.icu" va in impostazioni o in fondo con trattamento faint.
- Warning Strava subito sotto l'intestazione, prima della readiness.

## 6. Profilo atleta

Obiettivo: trasformare una pagina lunga di card in un dossier leggibile per
capitoli.

### 6.1 Sommario iniziale

Creare un blocco iniziale con:

- fenotipo dominante;
- CP;
- W/kg;
- confidenza;
- data ultimo aggiornamento;
- azione "Aggiorna profilo".

Il fenotipo è il valore principale. CP e W/kg sono metriche di supporto.

### 6.2 Navigazione interna

Per desktop:

- indice sticky leggero oppure tab orizzontali;
- sezioni: `Sintesi`, `Potenza`, `Evento`, `Stima gara`.

Per mobile:

- accordion o select compatta;
- nessun pannello laterale.

### 6.3 Record Power Profile

- Tabella dentro una superficie ampia.
- Header tabella più tenue.
- Colonna corrente più leggibile.
- Miglior valore o valore chiave in ambra, non tutta la colonna.
- Su mobile: righe verticali o scroll orizzontale con prima colonna sticky.

### 6.4 Analisi evento

- Profilo altimetrico più alto e con maggiore respiro.
- Riepilogo evento sopra il grafico.
- Limitatori ordinati per severità.
- Dettagli metodologici chiusi di default.
- Badge del tipo di percorso neutri; nessuna semaforica decorativa.

### 6.5 Stima gara

- "Obiettivo realistico" come scenario dominante.
- Ottimistico e conservativo come valori laterali secondari.
- Evitare tre card identiche.

Desktop:

```text
Giornata perfetta      OBIETTIVO REALISTICO      Con imprevisti
4h 32m                 4h 48m                    5h 15m
```

Su mobile l'obiettivo realistico viene mostrato per primo.

## 7. Piano settimanale

Obiettivo: rendere la settimana leggibile come calendario, non come collezione
di sette card equivalenti.

### 7.1 Header piano

- Titolo settimana.
- Fase e volume come metadati.
- CTA primaria "Genera/Aggiorna settimana".
- Invio a Intervals come azione secondaria.

### 7.2 Griglia settimanale

Desktop:

- sette colonne solo sopra una larghezza minima adeguata;
- giorno, durata e tipo seduta immediatamente visibili;
- oggi evidenziato con ambra tenue;
- readiness mostrata soltanto sul giorno corrente;
- seduta dura indicata da accento ambra, non rosso;
- riposo con superficie più quieta.

Tablet:

- griglia a due colonne.

Mobile:

- timeline verticale per giorno;
- giorno corrente aperto di default;
- dettagli espandibili;
- tap target minimo `40px`.

### 7.3 Commento del coach

- Presentarlo come nota editoriale, non come card metrica.
- Larghezza di lettura contenuta.
- Eventuali riferimenti tecnici in un blocco separato e collassabile.

## 8. Onboarding e impostazioni

### 8.1 Onboarding

- Una domanda o gruppo concettuale per schermata.
- Larghezza del testo ridotta.
- Progress bar più sottile.
- CTA sempre nella stessa posizione.
- Campi facoltativi visivamente meno prominenti.
- Ridurre i chip simultanei quando diventano rumorosi.

### 8.2 Form profilo

- Sezioni ampie separate da spazio, non tutte dentro card equivalenti.
- Colonne solo per campi brevi e correlati.
- Barra di salvataggio sticky più discreta.
- Stato "Salvato" funzionale, breve e non permanente.

## 9. Componenti da introdurre

| Componente | Ruolo |
|---|---|
| `PageHeader` | Titolo, sottotitolo e azione principale coerenti |
| `SectionHeader` | Label, titolo opzionale e azione secondaria |
| `ReadinessHero` | Stato del giorno, spiegazione, segnali e CTA |
| `MetricStrip` | Metriche correlate in una superficie continua |
| `DataRow` | Riga standard per attività, dati e sessioni |
| `Stat` | Label, valore, unità e trend senza card obbligatoria |
| `EditorialNote` | Commento coach e contenuti esplicativi |
| `StatusNotice` | Errori, warning e success funzionali |
| `DisclosurePanel` | Dettagli tecnici espandibili |
| `MobileDayTimeline` | Rappresentazione mobile della settimana |

Prima di creare un componente, verificare che venga usato almeno in due punti o
che risolva una struttura complessa stabile.

## 10. Componenti da semplificare

- `panel`: non deve essere la risposta predefinita a ogni sezione.
- `metric-card`: sostituire con `Stat` dentro `MetricStrip` dove possibile.
- badge: ridurre varianti e colori.
- tooltip: usare solo quando una definizione breve evita testo permanente.
- bottoni outline: limitare il numero di CTA concorrenti nella stessa area.

## 11. Tipografia

Mantenere il font di sistema nella prima iterazione per evitare dipendenze e
variazioni di rendering. Migliorare prima:

- scala;
- peso;
- interlinea;
- larghezza di lettura;
- contrasto;
- spazio tra blocchi.

Scala proposta:

| Ruolo | Desktop | Mobile |
|---|---:|---:|
| Display readiness | `56px` | `46px` |
| Titolo pagina | `32px` | `28px` |
| Titolo sezione | `20px` | `18px` |
| Valore grande | `28-32px` | `26-30px` |
| Corpo | `14-15px` | `14px` |
| Micro-label | `11px` | `11px` |

Usare uppercase solo per micro-label. Evitare titoli lunghi completamente in
maiuscolo.

## 12. Movimento

Il movimento deve aiutare l'orientamento, non rendere l'app spettacolare.

Consentito:

- apertura disclosure `150-200ms`;
- cambio tab;
- feedback di pressione;
- skeleton o spinner per sincronizzazione;
- ingresso leggero di contenuti appena aggiornati.

Evitare:

- parallax;
- animazioni continue;
- contatori animati a ogni caricamento;
- glow;
- transizioni di grandi superfici;
- motion che ritarda la lettura.

Rispettare sempre `prefers-reduced-motion`.

## 13. Ordine di implementazione

### Milestone P0 - Fondazioni e dashboard

1. Introdurre `PageHeader`, `SectionHeader`, `Stat` e `MetricStrip`.
2. Alleggerire header e navigazione.
3. Trasformare readiness in `ReadinessHero`.
4. Unificare le metriche in una strip.
5. Alleggerire la lista attività.
6. Verificare desktop e mobile.

**Uscita P0:** la dashboard definisce il nuovo linguaggio visivo senza cambiare
alcun dato o comportamento.

### Milestone P1 - Profilo

1. Creare il sommario atleta.
2. Organizzare la pagina per capitoli.
3. Ridisegnare RPP e metriche CP/APR.
4. Rendere dominante lo scenario realistico.
5. Spostare metodologia e spiegazioni in disclosure.
6. Verificare tabelle e grafici su mobile.

### Milestone P1 - Piano

1. Ridisegnare header e metadati settimana.
2. Aggiornare la griglia desktop.
3. Introdurre timeline mobile.
4. Alleggerire commento coach e stati di push.
5. Uniformare modali e anteprime.

### Milestone P2 - Onboarding e rifinitura

1. Ridurre densità dei form.
2. Uniformare empty state, loading e notice.
3. Revisionare microcopy.
4. Consolidare componenti duplicati.
5. Rimuovere classi visuali obsolete.

## 14. Strategia tecnica

- Non modificare i token colore senza aggiornare il design system.
- Non introdurre una nuova libreria UI durante P0.
- Riutilizzare Tailwind e i componenti locali.
- Separare presentazione da fetching e logica server esistenti.
- Migrare una pagina alla volta.
- Evitare un'unica PR con tutto il redesign.
- Accompagnare ogni milestone con screenshot desktop e mobile.
- Controllare che le classi dinamiche Tailwind siano enumerabili in build.

Struttura indicativa:

```text
components/
  layout/
    app-header.tsx
    app-shell.tsx
    page-header.tsx
  ui/
    button.tsx
    data-row.tsx
    disclosure-panel.tsx
    metric-strip.tsx
    section-header.tsx
    stat.tsx
    status-notice.tsx
  dashboard/
    readiness-hero.tsx
```

## 15. Criteri di accettazione

### Gerarchia

- La priorità della pagina è riconoscibile entro tre secondi.
- Non esistono due CTA primarie nello stesso viewport.
- Non più di un valore principale è ambra per sezione.
- Le metriche secondarie non competono con readiness, fenotipo o obiettivo gara.

### Densità

- Almeno `32px` tra macro-sezioni.
- Nessuna pagina appare come una griglia continua di card equivalenti.
- Testi metodologici lunghi sono collassabili o separati dal flusso principale.
- Le righe dati mantengono scansione orizzontale chiara.

### Mobile

- Nessun overflow orizzontale involontario.
- Nessun controllo sotto `40px`.
- L'ordine mobile rispetta la priorità informativa.
- La settimana usa una timeline, non sette colonne compresse.
- Tabelle larghe hanno una strategia esplicita.

### Accessibilità

- Contrasto AA per tutto il testo.
- Focus visibile.
- Stato non comunicato solo dal colore.
- Label associate ai controlli.
- `prefers-reduced-motion` rispettato.
- Zoom browser al `200%` senza perdita di funzionalità.

### Qualità tecnica

- `npm test` passa.
- `npx tsc --noEmit` passa.
- `npm run build` passa.
- Nessun colore non-token nei componenti.
- Nessun cambiamento alla logica readiness o planner.

## 16. Mantieni, cambia, evita

| Mantieni | Cambia | Evita |
|---|---|---|
| Palette dark calda | Gerarchia tra sezioni | Nuovi colori decorativi |
| Ambra come brand | Card metriche in strip | Gradienti |
| Semaforica readiness | Readiness in hero | Glass e blur |
| Header condiviso | Peso visivo della nav | Ombre drammatiche |
| Contenitore centrale | Ritmo verticale | Card per ogni blocco |
| Logica dati attuale | Layout mobile del piano | Animazioni continue |
| Raggi approvati | Tabelle e grafici | Copia letterale delle reference |

## 17. Deliverable consigliati

Per ogni milestone:

1. screenshot "prima";
2. screenshot "dopo" desktop;
3. screenshot "dopo" mobile;
4. elenco componenti introdotti o rimossi;
5. verifica dei criteri di accettazione;
6. test, TypeScript e build;
7. commit isolato con scope UI.

## 18. Prima iterazione raccomandata

Iniziare solo dalla dashboard e limitare la prima iterazione a:

- header alleggerito;
- nuovo `PageHeader`;
- `ReadinessHero`;
- `MetricStrip`;
- attività recenti senza card pesante;
- migliore gestione delle azioni secondarie.

Questa iterazione permette di validare la direzione premium con un rischio
tecnico basso. Profilo e Piano potranno poi derivare dallo stesso linguaggio
senza introdurre un secondo redesign parallelo.
