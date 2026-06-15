# Scheda Atleta — contenuti tooltip + struttura commento AI

> Questo file fornisce i testi esatti dei tooltip (didattici, verificati) e la
> struttura del commento AI. I tooltip sono statici. Il commento AI è
> predisposto ora ma attivato solo quando l'utente inserisce la API key Anthropic.

---

## 1. Tooltip sui termini (statici, sempre visibili al passaggio del mouse / tap)

Ogni termine della scheda ha un'icona "?" che apre un tooltip. Testi esatti:

### Fenotipo
> **Che tipo di atleta sei.** Descrive la *forma* del tuo profilo di potenza:
> dove sei naturalmente forte. Non dipende dal tuo livello assoluto ma da come
> si distribuisce la tua potenza tra sforzi brevi e lunghi. I tipi principali:
> sprinter (esplosivo), puncheur (forte 1–3 min), passista/diesel (tiene a
> lungo), scalatore (alto W/kg in salita).

### Puncheur
> Atleta forte negli sforzi di 1–3 minuti e negli scatti ripetuti. La tua dote
> sono gli strappi e i cambi di ritmo, più che le salite lunghe a ritmo costante.

### CP — Critical Power
> **La potenza che puoi sostenere a lungo senza affondare.** È la soglia sopra
> la quale la fatica diventa rapidamente insostenibile. Indicatore chiave della
> tua capacità aerobica. Più è alta (in rapporto al peso), più reggi ritmi alti
> in salita e nelle lunghe. Calcolata da Intervals.icu col modello Morton 3P.

### W′ (W prime)
> **La tua "batteria" anaerobica.** L'energia totale che puoi spendere *sopra*
> la CP prima di esaurirti — negli scatti, negli sforzi brevi e intensi. Si
> misura in kilojoule (kJ). Una W′ alta significa che puoi fare più scatti, o
> scatti più potenti, prima di "andare in debito".

### W/kg
> **Watt per chilo di peso.** La potenza rapportata al tuo peso corporeo. È ciò
> che conta davvero in salita: due atleti con gli stessi watt ma peso diverso
> salgono a velocità diverse. Per questo il peso corretto è importante.

### RPP — Record Power Profile
> **La tua "carta d'identità" di potenza.** I tuoi massimi sforzi per ogni
> durata: quanto spingi al massimo per 5 secondi, 1 minuto, 5 minuti, 20 minuti,
> un'ora. Insieme disegnano la forma del tuo motore.

### MSP — Maximal Sprint Power
> La tua potenza di picco istantanea, lo sprint massimo. Qui letta dal valore
> pMax calcolato da Intervals.

### APR / MPR — Riserva anaerobica
> **Quanto "stacco" hai tra il tuo sprint massimo e la tua soglia.** Un valore
> alto = punta esplosiva marcata rispetto alla tua base aerobica. Calcolato come
> sprint massimo meno CP (versione MPR, più pulita quando la MAP non è
> affidabile).

### Confidenza
> **Quanto l'app si fida di questa lettura.** Alta = hai sforzi massimali recenti
> a tutte le durate chiave. Bassa = mancano dati (es. nessuno sforzo massimo
> recente a certe durate) e il quadro è parziale. Onestà prima di tutto: se è
> bassa, prendila come indicativa.

### Best 1y (colonna)
> Il tuo miglior valore nell'ultimo anno, accanto a quello attuale (90 giorni).
> Serve a vedere il *potenziale*: dove sei stato, quindi dove puoi tornare. Se
> l'attuale è molto sotto il Best 1y a una certa durata, lì hai margine di
> recupero.

### Soglie v0
> Le soglie che classificano il fenotipo sono una *prima versione* (euristiche),
> da affinare con l'esperienza. Indicano la direzione, non una verità assoluta.

---

## 2. Box "Come leggere questa scheda" (statico, sempre presente in cima)

Un riquadro fisso, collassabile, sopra le card:

> **Come leggere questa scheda**
> Questi numeri vengono letti direttamente dai tuoi allenamenti su Intervals.icu
> — non sono inventati né stimati dall'app. Raccontano due cose: *che tipo di
> atleta sei* (il fenotipo) e *quanto è grande il tuo motore* (CP, W/kg, RPP).
> Il **fenotipo** ti dice dove sei naturalmente forte. La **CP in W/kg** ti dice
> quanto reggi in salita e nelle lunghe. La colonna **Best 1y** ti mostra il tuo
> potenziale. Passa il mouse su ogni "?" per la spiegazione del singolo valore.

---

## 3. Commento AI (predisposto ora, attivo con API key)

### Comportamento
- Bottone "💬 Spiega il mio profilo" nella card fenotipo.
- Se nessuna API key configurata: bottone disabilitato con tooltip
  "Configura una API key Anthropic in Impostazioni per attivare il commento AI".
- Se key presente: al click chiama `/api/profile/explain`, che invia a Claude i
  valori GIÀ calcolati e riceve un commento in italiano.

### Regola ferma (No Virtual Math applicata al testo)
Il prompt all'AI deve essere esplicito: l'AI **non calcola, non stima, non
inventa numeri**. Riceve i valori del profilo e li **spiega e contestualizza**
soltanto. Ogni numero che cita deve essere uno di quelli passati nell'input.

### Input passato all'AI (solo dati già calcolati)
```json
{
  "fenotipo": { "primary": "...", "secondary": "...", "confidence": "...",
                "flatness": 0.0, "punch_ratio": 0.0, "apr_ratio": 0.0 },
  "cp_wprime": { "cp_w": 0, "cp_wkg": 0.0, "w_prime_kj": 0.0 },
  "rpp_current": [ {"label":"5s","watts":0,"wkg":0.0}, ... ],
  "rpp_best_1y": [ {"label":"5s","watts":0}, ... ],
  "weight_kg": 0.0, "weight_source": "..."
}
```

### Struttura del commento richiesta all'AI
Tre paragrafi brevi, linguaggio semplice, niente gergo non spiegato:
1. **Chi sei** — il fenotipo in parole povere, cosa sai fare bene.
2. **Punti di forza e debolezza** — leggendo RPP e il confronto con Best 1y,
   dove sei forte e dove hai margine, in modo concreto.
3. **Su cosa lavorare** — la direzione generale di miglioramento (senza
   prescrivere sedute: quello arriva dal planner Section 11).

### System prompt (bozza, da rifinire)
> Sei un assistente che spiega a un ciclista amatoriale il suo profilo di
> potenza, già calcolato da Intervals.icu. Non calcoli e non inventi numeri:
> usi solo quelli forniti. Parli italiano semplice, tono incoraggiante e
> concreto, senza gergo non spiegato. Non prescrivi allenamenti specifici.
> Massimo 3 paragrafi brevi.
