# Da dove vengono le soglie del controllo di prontezza

Ogni numero che decide GO / MODIFY / SKIP viene da qualche parte. Questa pagina
dice da dove, e **soprattutto dove quella fonte è debole**: una soglia usata
senza conoscerne i limiti è più pericolosa di nessuna soglia, perché sembra
oggettiva.

Codice: `lib/readiness.ts` (la ladder P0–P3, invariata) e
`lib/recovery/baselines.ts` (le soglie personali che la ladder usa).

---

## 1. Carico acuto vs cronico (ACWR)

**Cosa facciamo.** `ACWR = ATL / CTL`, entrambi **letti** dal wellness di
Intervals.icu, mai ricalcolati. Ambra a 1.3, rosso a 1.5 (1.2 / 1.4 per chi
dichiara infortuni ricorrenti). Accanto al rapporto mostriamo sempre ATL e CTL
separati.

**Da dove viene.** L'idea della "finestra dolce" del rapporto acuto:cronico e
le soglie 1.3/1.5 nascono con Gabbett, *The training—injury prevention paradox*,
BJSM 2016;50(5):273-280.

**Dove è debole — e va detto.**

1. **Accoppiamento matematico.** Il denominatore contiene il numeratore: la
   correlazione col rischio si gonfia da sola. Lolli et al., *The
   acute-to-chronic workload ratio: an inaccurate scaling index for an
   unnecessary normalisation process?*, BJSM 2019;53(24):1510-1512.
2. **Il rapporto nasconde chi si sta muovendo.** Un 1.4 può voler dire "carico
   recente alto" o "condizione di fondo crollata": due situazioni opposte, stesso
   numero. Impellizzeri, Tenan, Kempton, Novak, Coutts, *Acute:Chronic Workload
   Ratio: Conceptual Issues and Fundamental Pitfalls*, IJSPP 2020;15(6):907-913.
   → **per questo il dettaglio del segnale riporta sempre ATL e CTL in chiaro.**
3. **La letteratura recente ne chiede l'abbandono.** Impellizzeri et al., *What
   Role Do Chronic Workloads Play in the Acute to Chronic Workload Ratio? Time to
   Dismiss ACWR and Its Underlying Theory*, Sports Medicine 2021;51:581-592.
4. **Le soglie 1.3/1.5 vengono da un'altra scala.** In letteratura il rapporto è
   tipicamente 7:28 giorni a **media mobile**; ATL/CTL di Intervals è 7:42 a
   **media esponenziale** (Williams, West, Cross, Stokes, *Better way to determine
   the acute:chronic workload ratio?*, BJSM 2017;51(3):209-210, sostiene che
   l'esponenziale sia fisiologicamente più sensato — ma resta una scala diversa
   da quella su cui le soglie sono state tarate).

**Come lo trattiamo di conseguenza.** L'ACWR è un **indicatore di variazione di
carico**, non una misura di rischio di infortunio, e nella ladder non è mai
l'unico motivo di uno SKIP a priorità 0. Il linguaggio verso l'atleta dice
"sovraccarico", mai "ti farai male".

---

## 2. HRV

**Cosa facciamo** (`computeRecoveryCalibration`):

| Scelta | Perché |
|---|---|
| Si lavora su `ln(rMSSD)`, non sul valore grezzo | rMSSD ha distribuzione log-normale: una variazione percentuale sul grezzo sovrastima i cali |
| Il segnale è la **media mobile a 7 giorni**, non il valore di oggi | il dato giornaliero oscilla troppo per decidere qualcosa da solo |
| Il "normale" è **media ±1 SD del periodo precedente dell'atleta** | una soglia universale del −10% non sa niente di quanto oscilli questo atleta |
| Rosso a −1.5 SD, oppure a −1 SD per due giorni di fila | un giorno solo sotto il normale è rumore, due sono un segnale |
| Servono ≥3 misure negli ultimi 7 giorni | sotto quella compliance la media non regge |
| Servono ≥14 misure nel periodo di riferimento | sotto, media e SD personali sono rumore travestito da precisione |

**Fonti.** Plews, Laursen, Stanley, Kilding, Buchheit, *Training adaptation and
heart rate variability in elite endurance athletes: opening the door to effective
monitoring*, Sports Medicine 2013;43(9):773-781 (media mobile 7 giorni, scala
logaritmica). Plews, Laursen, Le Meur, Hausswirth, Kilding, Buchheit,
*Monitoring training with heart rate-variability: how much compliance is needed
for valid assessment?*, IJSPP 2014;9(5):783-790 (le 3 misure a settimana).

**Marker precoce — il CV che collassa.** Quando la variabilità
giorno-per-giorno si appiattisce *mentre* la media scende, è il quadro descritto
nell'avvicinamento al non-functional overreaching: Plews, Laursen, Kilding,
Buchheit, *Heart rate variability in elite triathletes, is variation in
variability the key to effective training? A case comparison*, European Journal
of Applied Physiology 2012;112(11):3729-3741. In CurveLoad genera un **avviso**
(`earlyWarning`), **mai** uno stop: è un pattern osservato su casi singoli, non
una regola decisionale validata.

**Perché la finestra wellness è di 60 giorni.** Il riferimento personale sono i
giorni scaricati meno la finestra mobile di 7. Con i 30 giorni iniziali il
riferimento era di ~23 giorni: per arrivare a 14 misure servivano **4 misure a
settimana**, mentre la soglia di validità qui sopra è 3. Chi misurava 3 volte a
settimana — cioè chi rispettava esattamente la raccomandazione — non otteneva
**mai** le soglie personali, e nessuno glielo diceva. Con 60 giorni il
riferimento è di ~53 giorni e 3 misure/settimana bastano.

È un errore istruttivo: la finestra era stata giudicata sufficiente guardando i
dati di chi misura tutti i giorni. Le soglie di un'app multiutente vanno provate
sull'utente meno diligente, non su quello che la sta scrivendo.

---

## 3. FC a riposo

**Cosa facciamo.** Media personale su ~29 giorni; ambra oltre `media + 1 SD`,
rosso oltre `media + 2 SD`, con pavimenti di +2 e +4 bpm.

**Perché i pavimenti.** Con una FC riposo molto costante 1 SD può valere meno di
un battito, e ogni singolo giorno diventerebbe ambra. È la manopola di
calibrazione: il corpo non è il modello.

**Il riporto della misura mancante.** Se oggi HRV o FC a riposo non ci sono, si
usa l'ultima nota — ma solo **entro 7 giorni**. Oltre, il valore non descrive
più lo stato attuale e un "non disponibile" onesto vale più di un numero vecchio
spacciato per attuale. (Prima di questo limite la ricerca spazzolava l'intera
finestra: allargandola da 30 a 60 giorni avrebbe iniziato a ripescare misure
vecchie il doppio.)

**Perché non +3/+5 fissi.** Il +5 bpm è la regola pratica classica (compare
anche nel tooltip in dashboard) ma è una media di popolazione: chi oscilla di
suo di 6 bpm sarebbe rosso a caso, chi oscilla di 1 non sarebbe rosso mai.

---

## 4. Sonno

**Cosa facciamo.** Ambra sotto `tipiche − 1h`, rosso sotto `tipiche − 2h`, dove
"tipiche" è la **mediana delle notti misurate** su almeno 7 notti. Con meno di
così si resta su 7h / 5h e la dashboard lo scrive.

**Perché non lo chiediamo all'atleta.** All'inizio c'era una domanda "quante ore
dormi di solito". È stata tolta, e la ragione è istruttiva: le ore auto-riferite
sono tra le stime peggio calibrate che una persona dia di sé, quindi quando le
notti misurate ci sono devono vincere loro — chi dichiara 8 ore e ne dorme 6,5
prenderebbe ambra ogni singola notte. Ma quando le notti misurate **non** ci
sono, `sleepSecs` è null, il segnale sonno è "non disponibile" e nessuna soglia
viene applicata a niente. Cioè: il valore dichiarato o veniva scavalcato, o era
inutile. Un campo il cui contenuto non è mai usato è peggio di un campo assente,
perché fa credere all'atleta che la sua risposta conti.

Regola generale che ne discende, valida per tutta l'intervista: **si chiede solo
quello che Intervals non sa già.**

**Perché non un valore assoluto.** Le 8 ore sono una raccomandazione di
popolazione, non la norma di una persona. Per il recupero conta lo
**scostamento dal proprio normale**.

---

## 5. Stress di vita e altre risposte dell'atleta

Stress dichiarato ≥4/5 stringe di un gradino le soglie di carico e alza quella
del sonno. Gli infortuni ricorrenti abbassano le soglie ACWR a 1.2/1.4.

**Perché pesarle.** Nel consenso congiunto ECSS/ACSM lo stress non-sportivo è
un fattore riconosciuto nello sviluppo dell'overreaching e dell'overtraining:
Meeusen et al., *Prevention, diagnosis and treatment of the overtraining
syndrome: joint consensus statement of the ECSS and ACSM*, Medicine & Science
in Sports & Exercise 2013;45(1):186-205.

**E non sono un ripiego.** Le misure soggettive auto-riportate reggono il
confronto con quelle oggettive nel monitoraggio della risposta all'allenamento:
Saw, Main, Gastin, *Monitoring the athlete training response: subjective
self-reported measures trump commonly used objective measures: a systematic
review*, BJSM 2016;50(5):281-291. Lo stesso principio è già in casa: il
questionario "sensazioni" della review settimanale (`lib/review/feel.ts`) è
imparentato con l'indice a 4 voci — sonno, stress, fatica, dolori muscolari —
di Hooper & Mackinnon, *Monitoring overtraining in athletes*, Sports Medicine
1995;20(5):321-327.

---

## 6. Quando tutto questo NON si applica

Il calibratore torna soglie nulle e la readiness usa i numeri fissi di sempre
quando: lo storico è più corto di 14 misure, la compliance è sotto 3
misure/settimana, la SD del riferimento è zero, o l'atleta ha dichiarato di non
tracciare l'HRV. Un rodaggio onesto vale più di una personalizzazione inventata
su quattro giorni di dati.

**E lo deve dire.** Restare in silenzio sulle soglie generiche è il modo più
facile per far credere a un utente che l'app si stia adattando a lui mentre non
lo sta facendo. Perciò le note del calibratore sono divise in due:

- `pending` — *«servono 3 misure negli ultimi 7 giorni, ne hai 1»*: transitorio
  e azionabile, sparisce da solo quando i dati arrivano → si mostra in
  dashboard, sotto la readiness;
- `applied` — *«soglie HRV personali su 24 misure di storico»*: permanente, si
  legge una volta e non cambia più → vive nella card in impostazioni.

Mescolarle vorrebbe dire far leggere ogni giorno una riga che non cambia mai,
cioè insegnare all'atleta a non leggerla — e con lei sparirebbe dalla vista
anche quella che conta.

---

## 7. Cosa questo sistema non è

Non è uno strumento diagnostico e non stima una probabilità di infortunio.
Produce un consiglio di allenamento — allenati forte, allenati piano, riposa —
a partire da dati che l'atleta ha già scelto di raccogliere. Un dolore che non
passa, una FC a riposo alta per giorni senza carico, o un malessere vero sono
cose da portare a un medico, non a un'app.
