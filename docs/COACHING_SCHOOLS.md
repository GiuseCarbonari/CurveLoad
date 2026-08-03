# Le scuole di coaching — libreria di riferimento

**Cos'è questo file.** Otto scuole di allenamento endurance reali, studiate una
volta sola con ricerca vera sul web e congelate qui. Serve perché **l'app non può
fare ricerca**: il layer AI gira su Groq, che non naviga. Senza questo file il
coach potrebbe solo inventarsi delle generalità sui grandi allenatori — che è
esattamente quello che la regola "No Virtual Math" vieta per i numeri, e che vale
uguale per i nomi propri.

**Chi lo usa.** [`lib/coaching/schools.ts`](../lib/coaching/schools.ts) ne tiene la
versione corta e leggibile dal codice (id, nome, metodo in 2-3 frasi, asse di
intensità, fonti). Il testo lungo qui sotto è per gli umani: chi aggiorna la
libreria, e chiunque voglia sapere da dove viene una raccomandazione.

**Onestà delle fonti.** Ogni scuola elenca le pagine effettivamente lette. Dove le
fonti lette **non** coprono un aspetto (tipicamente alimentazione e lato mentale,
di cui si parla molto meno che di allenamento), è scritto «non coperto» invece di
riempire il buco a occhio. Non è pigrizia: una filosofia costruita su dettagli
inventati è peggio di una filosofia più corta.

**Data della ricerca:** 3 agosto 2026.

---

## 1. Stephen Seiler — il modello polarizzato (80/20)

**Chi.** Fisiologo dell'esercizio, Università di Agder (Norvegia). Non è un
allenatore: è il ricercatore che ha *misurato* cosa facevano davvero gli atleti di
resistenza d'élite (ciclismo, canottaggio, corsa, sci di fondo) e ha scoperto un
pattern ricorrente. Questo è un punto importante della sua stessa posizione: il
modello descrive quello che funziona, non è un'opinione di coaching.

**Come costruisce la stagione.** Non prescrive una periodizzazione: prescrive una
*distribuzione*. Circa l'80% del tempo di allenamento sotto la prima soglia
(conversazionale), circa il 20% sopra la seconda, e pochissimo in mezzo. Il modello
a tre zone è definito dalle due soglie ventilatorie/lattacide, non dalle zone a
5-7 livelli dei ciclocomputer.

**Volume vs intensità.** Il volume sta tutto in basso; l'intensità è rara e vera.
La sua critica alla zona centrale è netta, e cita un allenatore norvegese: *«We do
not train at medium-hard intensity. It's too much pain for too little gain.»* Il
bersaglio dichiarato è anche la **monotonia**: sottoporre l'atleta ogni giorno a
uno stress simile.

**Seduta firma — 4×8 minuti.** È l'unico caso in questa libreria in cui la seduta
firma nasce da uno studio controllato dell'autore stesso. Seiler et al. (2013)
hanno confrontato per 7 settimane, su 35 ciclisti allenati, tre protocolli da 2
sedute/settimana: 4×4, 4×8 e 4×16 minuti. **Il 4×8 ha vinto su tutti e tre gli
indicatori** (VO₂peak, potenza al VO₂peak, potenza a 4 mM di lattato): +11,4% di
VO₂peak contro +5,5% del 4×4, +5,6% del 4×16 e +4,2% del gruppo solo-facile. La
spiegazione che ne dà: il 4×4 viene quasi sempre partito troppo forte e finisce in
sedute fallite, il 4×16 scivola giù di intensità da solo, l'8 minuti è la durata
in cui si accumula tempo vero ad alta intensità reggendo l'intensità fino in fondo.

**Recupero.** Le sedute facili devono restare *sotto il radar dello stress* — se il
facile non è abbastanza facile, il duro non può essere abbastanza duro. È il
meccanismo con cui l'80/20 si autoprotegge.

**Alimentazione, lato mentale.** Non coperti dalle fonti lette.

**Fonti lette.**
- Fast Talk Labs — *Complete Guide to Polarized Training with Dr. Stephen Seiler*: https://www.fasttalklabs.com/pathways/polarized-training/
- Seiler S., Jøranson K., Olesen B.V., Hetlelid K.J. (2013), *Adaptations to aerobic interval training: interactive effects of exercise intensity and total work duration*, Scandinavian Journal of Medicine & Science in Sports: https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1600-0838.2011.01351.x
- Roadman Cycling — *Stephen Seiler Research: What I Learned Reading Every Paper*: https://roadmancycling.com/blog/stephen-seiler-research-polarised-training-lessons

**Asse di intensità:** `polarized`.

---

## 2. Joe Friel — il Training Bible e l'atleta che invecchia

**Chi.** Allenatore e autore di *The Cyclist's Training Bible* e *The Triathlete's
Training Bible*, co-fondatore di TrainingPeaks. È la fonte da cui vengono metà dei
concetti che CurveLoad usa già (piano annuale, CTL/ATL/TSB via TrainingPeaks).

**Come costruisce la stagione.** Piano annuale (Annual Training Plan) con 1-3
macrocicli, ciascuno diviso in periodi Base → Build → Peak → Race → Transition. È
la periodizzazione classica: prima si costruisce il generale, poi si va verso lo
specifico di gara.

**Il pezzo davvero suo: il microciclo tarato sul recupero, non sul calendario.**
Friel è l'unico in questa libreria che dice esplicitamente che la settimana di 7
giorni è una convenzione sociale, non fisiologica. Per molti atleti senior
propone un **microciclo di 9 giorni** con le sedute dure ai giorni 1, 4 e 7 —
*ogni terzo giorno*, cioè due giorni pieni di recupero tra una dura e l'altra — e
aggiunge che per alcuni due giorni non bastano e ne servono tre. Sul mesociclo:
nei suoi piani per gli over 50 la settimana di scarico arriva **ogni 3 settimane**
invece che ogni 4.

**Volume vs intensità.** Nessun rapporto fisso dichiarato nelle fonti lette: la
variabile che governa tutto è quanto in fretta *quell'* atleta recupera. La sua
frase chiave sul tema è che il recupero è probabilmente il segreto dell'atleta
anziano che vuole conservare o migliorare la prestazione.

**Sedute firma.** Non una seduta specifica: la sua firma è la struttura (il
microciclo e il piano annuale), non il singolo allenamento.

**Recupero.** È il centro del sistema, vedi sopra.

**Alimentazione, lato mentale.** Non coperti dalle fonti lette.

**Fonti lette.**
- Joe Friel — *Aging: Designing a Microcycle to Match Your Recovery*: https://joefrieltraining.com/aging-designing-a-microcycle-to-match-your-recovery/
- Joe Friel — *Aging: Customizing the Build Period*: https://joefrieltraining.com/aging-customizing-the-build-period/
- TrainingPeaks — *Periodization and Mixed Training*: https://www.trainingpeaks.com/blog/periodization-and-mixed-training/

**Asse di intensità:** `pyramidal`.

---

## 3. Iñigo San Millán — la Zona 2 metabolica

**Chi.** Fisiologo, Università del Colorado; ha lavorato con Tadej Pogačar alla UAE
Team Emirates. La sua notorietà fuori dal ciclismo viene dal legame che stabilisce
tra allenamento in Zona 2 e salute metabolica (funzione mitocondriale, ossidazione
dei grassi).

**Come costruisce la stagione.** Le fonti lette non descrivono una periodizzazione:
descrivono una **dose settimanale**. È una differenza di natura rispetto a Friel o
Lydiard — San Millán prescrive un ingrediente, non un calendario.

**Volume vs intensità.** La Zona 2 è definita come l'intensità che stimola al
massimo la funzione mitocondriale, appena sotto la salita significativa del
lattato; il punto centrale della zona è tipicamente dove si trova il FatMax.
Numeri dichiarati: **minimo 60 minuti** per seduta perché l'adattamento parta, e
**300-400 minuti a settimana** di Zona 2 — più del doppio della raccomandazione
standard CDC/AHA/NHS di 150 minuti di attività moderata.

**Seduta firma.** La seduta È il metodo: 60-90 minuti continui in Zona 2, senza
strappi, ripetuti più volte a settimana.

**Cosa cerca.** Tre effetti dichiarati: migliorare la capacità di ossidare i
grassi, migliorare la funzione mitocondriale, migliorare il trasporto del lattato
tra le fibre.

**Recupero, alimentazione, lato mentale.** Non coperti dalle fonti lette in modo
prescrittivo (il tema metabolico tocca la nutrizione, ma come fisiologia, non come
protocollo di gara).

**Fonti lette.**
- Peter Attia MD — *#85: Iñigo San Millán, Ph.D.: Zone 2 Training and Metabolic Health*: https://peterattiamd.com/inigosanmillan/
- Peter Attia MD — *#201: Deep dive back into Zone 2, Pt. 2*: https://peterattiamd.com/inigosanmillan2/
- TrainingPeaks — *Zone 2 Biochemistry for Biomechanical Energy with Iñigo San Millán*: https://www.trainingpeaks.com/coach-blog/zone-2-biochemistry-biomechanical-energy-inigo-san-millan/
- High North Performance — *Zone 2 Training and Lactate: Dissecting Inigo San Millan's Advice*: https://www.highnorth.co.uk/articles/zone-2-training-inigo-san-millan

**Asse di intensità:** `polarized` (moltissimo facile, il resto molto duro; il
centro resta vuoto).

---

## 4. Coggan & Allen / Overton — la scuola della potenza e il sweet spot

**Chi.** Andrew Coggan (fisiologo) e Hunter Allen, autori di *Training and Racing
with a Power Meter*: sono loro ad aver reso normale allenarsi su FTP, zone di
potenza, TSS e Performance Management Chart — l'impianto su cui CurveLoad già
poggia. Il *sweet spot* in senso stretto lo ha battezzato **Frank Overton**
(FasCat Coaching) nel gennaio 2005, lavorando proprio con Coggan e altri alla
validazione della Performance Management Chart.

**Come nasce il sweet spot.** Coggan aveva disegnato due curve sovrapposte:
beneficio dell'allenamento e stress fisiologico. All'incrocio tra le due hanno
cerchiato una fascia — **84-97% dell'FTP** — che Overton ha chiamato *sweet spot*:
la zona di massimo rendimento per il tempo speso, tra una Z2 alta e una Z4 bassa.

**Come costruisce la stagione.** Il principio è il rendimento per ora disponibile:
per l'amatore con poche ore, il sweet spot dà più adattamento a parità di tempo e
con un costo di recupero che consente di ripeterlo spesso. Da qui la fama di
"scuola del sweet spot" per i piani invernali.

**Volume vs intensità.** È la scuola più esplicitamente **anti-polarizzata** nella
pratica: riempie deliberatamente la zona che Seiler chiama "troppo dolore per
troppo poco".

**Seduta firma.** Blocchi sostenuti in sweet spot (nella libreria di CurveLoad:
`SS-1`, `SS-5`), e più in generale la prescrizione a watt anziché a sensazione.

**Recupero.** Governato dai numeri: TSB / Performance Management Chart.

**Alimentazione, lato mentale.** Non coperti dalle fonti lette.

**Fonti lette.**
- FasCat Coaching — *Sweet Spot Training: The Complete Guide from the Coach Who Invented It*: https://fascatcoaching.com/blogs/training-tips/sweet-spot-training/
- FasCat Coaching — *How I Invented Sweet Spot Training*: https://fascatcoaching.com/blogs/training-tips/yt-how-i-invented-sweet-spot-training-AD32o8/
- Velo (Outside) — *Which will make you faster: Sweet spot or threshold workouts?*: https://velo.outsideonline.com/road/road-training/which-will-make-you-faster-sweet-spot-or-threshold-workouts/

**Asse di intensità:** `threshold`.

---

## 5. Arthur Lydiard — la base aerobica e le quattro fasi

**Chi.** Allenatore neozelandese (1917-2004), il "padre dell'allenamento moderno"
per il mezzofondo e il fondo. Da lui viene l'idea stessa di *periodizzazione a
fasi* che tutti gli altri hanno poi riscritto.

**Come costruisce la stagione.** Quattro fasi in sequenza, ognuna che prepara la
successiva:
1. **Base aerobica** — chilometraggio alto (fino a 160 km/settimana per gli élite,
   64-112 per gli amatori), quasi tutto aerobico. Il suo trucco dichiarato per
   arrivarci in fretta: rallentare *tutte* le corse all'inizio.
2. **Colline (hill resistance)** — circa 4 settimane. È il ponte tra aerobico e
   anaerobico: rinforza la muscolatura (in particolare le fibre veloci alattacide)
   preparando il corpo alle sedute in pista, senza ancora entrare nel lavoro
   anaerobico prolungato.
3. **Anaerobica / velocità** — intervalli in pista, tolleranza al lattato.
4. **Coordinazione / affilatura** — si mettono insieme i pezzi perché arrivino al
   picco nello stesso momento.

**Volume vs intensità.** Volume prima di tutto, e per molto tempo. Nota critica
che le fonti moderne fanno: buona parte del "facile" di Lydiard era in realtà
aerobico **alto**, spesso vicino alla soglia — non il piano piano di oggi.

**Il vero contributo.** Non le singole sedute, ma l'orchestrazione: sistemi
energetici diversi rispondono a velocità diverse, e il mestiere sta nel farli
culminare insieme il giorno della gara.

**Recupero, alimentazione, lato mentale.** Non coperti dalle fonti lette.

**Fonti lette.**
- Science of Running (Steve Magness) — *Arthur Lydiard: The Father of Modern Training*: https://www.scienceofrunning.com/2016/11/arthur-lydiard-the-father-of-modern-training.html
- Sweat Elite — *Arthur Lydiard Method Summarised: Hill Resistance Training (Part 3)*: https://www.sweatelite.co/lydiard-fundamentals-part-3-hill-resistance-training/
- *The Lydiard Training System for Middle and Long Distance Runners* (lezione, Iowa 1999, PDF): https://www.championseverywhere.com/wp-content/uploads/2017/07/lydiardiowa99.pdf

**Asse di intensità:** `pyramidal`.

---

## 6. Renato Canova — il ritmo specifico

**Chi.** Allenatore italiano, ha guidato campioni del mondo e olimpici di maratona
soprattutto in Kenya. È la scuola più *matematica* delle otto — e quella con la
posizione più esplicitamente contraria a Seiler.

**Come costruisce la stagione.** Quattro periodi:
- **Transizione (4 settimane)** — corse facili non più lunghe di un'ora, circuiti
  di forza.
- **Generale (4 settimane)** — resistenza generale, fartlek, forza con sprint
  brevissimi (10-12 secondi a velocità massima).
- **Fondamentale (6 settimane)** — le qualità si sviluppano *separate*: lunghi,
  continui a ritmo maratona, circuiti. Alla fine di questo periodo l'atleta non è
  pronto per la gara: è pronto per *iniziare* il periodo specifico.
- **Specifico (10 settimane)** — tutto si integra in simulazioni di gara. Qui il
  suo allenamento diventa, parole sue, «matematico»: comanda il carico esterno (il
  ritmo preciso), non più la sensazione.

**Volume vs intensità: le percentuali del ritmo gara.** Ogni andatura è definita
come percentuale del ritmo maratona (MP), non come zona fisiologica:
- rigenerante 70-80% MP · facile 60-80% MP
- soglia/aerobico 85-93% MP
- **specifico 98-105% MP** — il cuore del metodo
- supramassimale >105% MP, a supporto dell'economia di corsa

Il volume moderno dei suoi maratoneti è 160-190 km/settimana, contro i 290+ degli
anni '90: meno chilometri per potersi permettere più modulazione e più recupero
attorno alle sedute specifiche.

**Sedute firma.**
- **Lungo specifico**: 30-32 km strutturati a ripetute decrescenti — 7-6-5-4-3-2 km
  in progressione di velocità, con 1 km di recupero all'80% MP in mezzo; 27 km dei
  32 sono a ritmo specifico.
- **Fartlek a recupero veloce**: 20×(1' forte / 1' più lento) dove il "lento" resta
  comunque veloce — si allena lo smaltimento del lattato per via aerobica. Una
  seduta tipo copre 19,2-19,3 km in un'ora.
- **Circuiti di forza-resistenza**: 400 m a ritmo maratona + 30" di balzi/skip,
  3-7 volte; oppure in collina 800-1000 m a ritmo maratona alternati a 6×60 m di
  sprint in salita, per 5 volte.

**Recupero.** Scala con lo specifico: dopo un 32 km di quel tipo servono 4-5 giorni
di corsa facile. Il recupero non è una percentuale fissa, è la conseguenza di
quanto è stata dura la seduta specifica.

**Il principio che lo mette contro Seiler.** Canova rifiuta esplicitamente la
polarizzazione con salti grandi tra le andature: servono «tante piccole scale» di
ritmi adiacenti per costruire i collegamenti fisiologici tra una velocità e
l'altra. E la sua idea guida — *extension of quality* — capovolge la tradizione:
non si parte da 30 km lenti aggiungendo pezzi a ritmo gara, si parte subito veloci
e si estende la durata.

**Alimentazione, lato mentale.** Non coperti dalle fonti lette.

**Fonti lette.**
- Running Writings (John Davis) — *The Keys to Marathon Training: Modern changes to Renato Canova's elite marathon training methods*: https://runningwritings.com/2023/07/renato-canova-marathon-training-lecture.html
- Running Writings — *Modern marathoning with Renato Canova: Analysis of Emile Cairess' training before the London Marathon*: https://runningwritings.com/2024/05/renato-canova-marathon-training-emile-cairess.html
- Running Writings — *Review and summary of «Marathon Training: A Scientific Approach» by Renato Canova*: https://runningwritings.com/2023/06/canova-marathon-book.html
- *Something New in Training: The Methods of Renato Canova* (2011, PDF): https://runningscience.co.za/wp-content/uploads/2017/01/The-Methods-of-Renato-Canova.pdf

**Asse di intensità:** `threshold`.

---

## 7. Jack Daniels — il VDOT e i cinque ritmi

**Chi.** Fisiologo dell'esercizio e due volte medagliato olimpico (pentathlon
moderno), autore di *Daniels' Running Formula*. È la scuola della **calibrazione
misurata**: ogni corridore ha un livello di forma oggettivamente misurabile e
l'allenamento si taglia su quello, non a occhio.

**Come costruisce la stagione.** Il VDOT — un VO₂max "aggiustato" ricavato da una
prestazione di gara reale, non da un test di laboratorio — genera per tabella
tutti i ritmi di allenamento. Cambia il VDOT, cambiano tutti i ritmi insieme.

**I cinque ritmi.**
- **E (Easy)** — il grosso del volume, recupero tra le ripetute, corpo dei lunghi.
- **M (Marathon)** — ritmo maratona previsto o reale.
- **T (Threshold)** — attorno alla soglia del lattato; è il ritmo di lavoro
  centrale della scuola.
- **I (Interval)** — stress massimo del sistema aerobico, tenuto poco, recuperi
  uguali al lavoro.
- **R (Repetition)** — più veloce ancora, anaerobico: meccanica ed economia di
  corsa.

**Volume vs intensità.** Distribuzione dichiarata: **70-80% E**, 10-15% M+T,
10-15% I+R. Numericamente è vicina all'80/20 di Seiler, ma con una differenza
sostanziale: la fetta di mezzo (M e T) esiste ed è deliberata, non è un buco.

**Recupero, alimentazione, lato mentale.** Non coperti dalle fonti lette.

**Fonti lette.**
- Fellrnr — *Jack Daniels' Running Formula* (sintesi del metodo e delle tabelle): https://fellrnr.com/wiki/Jack_Daniels_Running_Formula
- *Jack Daniels and the "training formula"* (John Lofranco): https://yourcoach.substack.com/p/jack-daniels-and-the-training-formula
- *Jack Daniels' Running Formula: VDOT and the 5 Training Paces Explained*: https://denstarfitness.com/jack-daniels-running-formula/

**Asse di intensità:** `pyramidal`.

---

## 8. Hansons (Keith & Kevin Hanson) — la fatica cumulativa

**Chi.** Fratelli allenatori del Michigan, Hansons-Brooks Distance Project; il
metodo è scritto da Luke Humphrey in *Hansons Marathon Method*, sottotitolato «A
Renegade Path to Your Fastest Marathon». Il sottotitolo è programmatico: è la
scuola che contraddice apertamente l'ortodossia del lungo da 32 km.

**L'idea centrale.** **Fatica cumulativa**: il corpo non distingue se la fatica
arriva da un lungo unico o da diverse corse più brevi ravvicinate. Da qui tutto il
resto.

**Come costruisce la settimana.** Sei giorni di corsa. Tre sono facili, tre sono
**SOS** (*Something Of Substance*): velocità/forza, tempo a ritmo gara, e il lungo.
Non si recupera mai del tutto tra un SOS e l'altro — è voluto: si arriva a ogni
seduta, lungo compreso, con le gambe già stanche, perché è così che si sta negli
ultimi chilometri di una maratona.

**Il lungo tappato a 16 miglia (~26 km).** Nessuna corsa del piano supera le 16
miglia. La frase con cui lo difendono: il piano ti insegna a correre *gli ultimi*
16 miglia della maratona, quelli in cui la gente crolla — non i primi.

**Volume vs intensità.** Chilometraggio alto distribuito su sei giorni, invece che
concentrato in un lungo eroico settimanale.

**Recupero.** Deliberatamente incompleto. È l'opposto esatto del microciclo di
Friel.

**Alimentazione, lato mentale.** Non coperti dalle fonti lette; il lato mentale è
implicito nel metodo (abituarsi a lavorare stanchi) ma non è prescritto come tale.

**Fonti lette.**
- Marathon Handbook — *The Hansons Marathon Method: Pros, Cons + Does It Work?*: https://marathonhandbook.com/hansons-marathon-method/
- Run Culture — *Hanson's marathon training method: cumulative fatigue*: https://runculture.com/learn/running-methods/hansons/
- Luke Humphrey, *Hansons Marathon Method: A Renegade Path to Your Fastest Marathon* (scheda del libro): https://www.goodreads.com/book/show/13592481-hansons-marathon-method

**Asse di intensità:** `pyramidal`.

---

## Dove sono d'accordo

Su queste quattro cose otto scuole molto diverse dicono la stessa cosa — ed è
il motivo per cui il motore deterministico di CurveLoad può restare uno solo,
qualunque filosofia scelga l'atleta:

1. **La maggior parte del lavoro è facile.** Seiler ~80% del tempo, Daniels 70-80%
   in E, San Millán 300-400 min/settimana in Z2, Lydiard una base enorme, Canova
   rigeneranti al 70-80% del ritmo gara. Cambia il *nome* della zona, non la
   proporzione.
2. **Le sedute dure sono poche e vanno protette.** Nessuna scuola prescrive più di
   2-3 sedute dure a settimana. Le regole ferme di CurveLoad (max 2 dure con ≤10h
   settimanali, 3 sopra; 48h di distanza) non contraddicono nessuna delle otto.
3. **La specificità cresce avvicinandosi alla gara.** Lydiard con le fasi, Canova
   col periodo specifico, Friel col Build→Peak, Daniels con le fasi finali: tutti
   convergono sullo stesso movimento generale→specifico.
4. **Il carico deve variare.** Che sia la monotonia di Seiler, lo scarico ogni 3-4
   settimane di Friel o la modulazione di Canova, nessuno propone settimane tutte
   uguali.

## Dove litigano davvero

Questi sono disaccordi veri, non sfumature. Sono anche il motivo per cui ha senso
che l'atleta *scelga* una scuola invece di ricevere una media di tutte.

| Questione | Una parte | L'altra |
|---|---|---|
| **La zona centrale (sweet spot / soglia)** | Seiler: da evitare, «troppo dolore per troppo poco». San Millán: sta sopra la Z2, quindi non è il posto dove costruire | Overton/Coggan: quella fascia (84-97% FTP) È il punto di massimo rendimento per il tempo speso. Ci hanno costruito sopra una scuola intera |
| **Salti grandi o piccoli tra le andature** | Seiler: polarizzare, lasciare il centro vuoto | Canova: rifiuta i salti grandi, servono «tante piccole scale» di ritmi adiacenti per collegare le velocità |
| **Il lungo** | Lydiard e Canova: lungo lunghissimo, e per Canova anche veloce (30-32 km, gran parte a ritmo specifico) | Hansons: **mai** oltre 16 miglia. La fatica la costruisci accumulando giorni, non allungando la corsa |
| **Chi comanda: il numero o la sensazione** | Daniels (VDOT da una gara reale), Coggan (FTP e TSS), San Millán (lattato in laboratorio) | Lydiard: sensazione e corsa "dentro sé stessi", il cronometro viene dopo |
| **Il recupero** | Friel: più recupero, e taratura individuale — microciclo di 9 giorni, scarico ogni 3 settimane dopo i 50 | Hansons: recupero deliberatamente **incompleto**, è il meccanismo del metodo |
| **Quanto volume serve davvero** | Lydiard: fino a 160 km/settimana, il volume è la base di tutto | Canova moderno: 160-190 km invece dei 290+ degli anni '90, perché il recupero attorno alle sedute specifiche vale più dei chilometri in più |

## Come questo si traduce in CurveLoad

L'unico campo che il codice ricava da questa libreria è `asse_intensita`, che
alimenta `athlete_profiles.stile_allenamento` e da lì la scelta della seduta dura
principale in [`lib/planner/session-selector.ts`](../lib/planner/session-selector.ts).

| Scuola | `asse_intensita` |
|---|---|
| Seiler | `polarized` |
| San Millán | `polarized` |
| Friel | `pyramidal` |
| Lydiard | `pyramidal` |
| Daniels | `pyramidal` |
| Hansons | `pyramidal` |
| Coggan / Allen / Overton | `threshold` |
| Canova | `threshold` |

Tutto il resto — sedute firma, filosofia del recupero, tono — resta **prosa**: entra
nel prompt della filosofia come materiale da citare, non come parametro del motore.
È deliberato: il motore deterministico resta l'autorità sui numeri e sulle
decisioni Go/Modify/Skip (regola ferma di `docs/PIANO.md`), la scuola cambia il
*colore* del piano, non le sue regole di sicurezza.

## Come si aggiorna

Aggiungere una scuola vuol dire: (1) una sezione qui con le fonti **lette davvero**,
(2) una riga in `lib/coaching/schools.ts`, (3) i test in
`tests/coaching-schools.test.ts` continuano a passare da soli (id unico, ≥2 fonti,
asse nell'allowlist). Non aggiungere una scuola di cui non si sono lette le fonti:
il valore di questo file è esattamente che non è inventato.
