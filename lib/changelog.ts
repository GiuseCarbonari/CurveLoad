export const APP_VERSION = "1.21.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: { type: "new" | "fix" | "improve"; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.21.0",
    date: "8 ago 2026",
    title: "Le previsioni Riegel",
    items: [
      { type: "new", text: "Se corri, il percorso mostra ora una vera previsione di gara con la formula di Riegel, calcolata dai risultati che hai registrato: standard, e — con due gare su distanze diverse — anche il tuo esponente personale, con un avviso se le tue gare sono state disperse (allenamento/pacing diversi, non un errore)" },
      { type: "improve", text: "La pagina del percorso, per chi corre, mostra ora zone di passo e predizioni (dalla curva di allenamento) accanto alle previsioni Riegel (dalle gare vere) invece della mappa generica e del messaggio «non ci sono ancora» — se le due stime divergono di oltre l'8% te lo dice, invece di sceglierne una in silenzio" },
      { type: "improve", text: "La card del profilo per chi corre ora mostra solo il dato di fitness (velocità critica) con un link al pacing vero, invece di ripetere le stesse tabelle in due posti" },
      { type: "fix", text: "Il bottone «Scheda telaio (PDF)» — geometria bici — non compare più per chi corre" },
    ],
  },
  {
    version: "1.20.0",
    date: "8 ago 2026",
    title: "Le tue gare",
    items: [
      { type: "new", text: "Se corri, in Impostazioni trovi «Le tue gare»: registra i risultati delle gare che hai già fatto (data, distanza, tempo, quanto ti sentivi allenato). Serviranno alle previsioni con la formula di Riegel, in arrivo — con due gare su distanze diverse il coach potrà stimare il tuo esponente personale invece di quello medio" },
      { type: "improve", text: "La pagina Impostazioni non è più una fila di schede separate: dossier, come recuperi, le tue gare, gli appunti del coach, il testo del coach e la chiave Groq sono ora un'unica lista, tutte con lo stesso stile a fisarmonica" },
    ],
  },
  {
    version: "1.19.0",
    date: "5 ago 2026",
    title: "Le soglie diventano le tue",
    items: [
      { type: "new", text: "In Impostazioni trovi «Come recuperi»: se misuri l'HRV, quanto stress hai fuori dallo sport, se hai infortuni che tendono a tornare e come ti capita di esagerare. Le risposte tarano il controllo di prontezza sui tuoi numeri invece che su medie generiche" },
      { type: "improve", text: "L'HRV non viene più giudicata sul valore di oggi contro la media della settimana, ma sulla media degli ultimi 7 giorni confrontata con il TUO range normale: molti meno allarmi inutili per chi ha un'HRV naturalmente ballerina" },
      { type: "improve", text: "Stessa cosa per la frequenza cardiaca a riposo: il confronto è con la tua media, non con i +5 battiti uguali per tutti. E se dormi di tuo 6 ore, 6 ore non sono più un avviso" },
      { type: "new", text: "Quando la variabilità della tua HRV si appiattisce mentre la media scende — il segnale che precede il sovraccarico — la scheda Oggi te lo dice prima che diventi un problema, senza per questo fermarti" },
      { type: "fix", text: "La regola «indice di recupero basso per due giorni di fila» non è mai scattata finora: mancava lo storico giornaliero che serve a rilevarla. Ora c'è" },
      { type: "improve", text: "Accanto al rapporto di carico (ACWR) ora vedi anche i due numeri che lo compongono: da solo quel rapporto non dice se a muoversi è il carico recente o la condizione di fondo" },
      { type: "fix", text: "Chi misura l'HRV tre volte a settimana non arrivava mai alle soglie personali: servivano più dati di quanti la finestra ne scaricasse. Ora la storia considerata è di 60 giorni invece di 30" },
      { type: "improve", text: "Le ore di sonno tipiche le decidono le tue notti misurate su Intervals.icu: la domanda su quanto dormi di solito è stata tolta, perché o veniva scavalcata dal dato vero o non serviva a niente" },
      { type: "fix", text: "Se oggi manca la misura di HRV o FC a riposo, l'app usa l'ultima disponibile solo se è degli ultimi 7 giorni: prima poteva ripescarne una di settimane prima e mostrarla come se fosse di oggi" },
      { type: "fix", text: "Il commento del coach attribuiva all'HRV il valore della frequenza cardiaca a riposo, e scriveva i carichi con sei decimali («un CTL di 36.21359»). Ora cita i numeri arrotondati e ognuno con la sua etichetta" },
      { type: "fix", text: "Il grafico «andamento 6 settimane» ne copriva cinque scarse: mancava un punto agli estremi" },
      { type: "new", text: "In Impostazioni trovi «Cosa si ricorda il coach»: le note che ha scritto su di te leggendo i tuoi dati, con un pulsante per toglierle. Prima entravano in ogni suo commento e non c'era modo né di vederle né di cancellarle — così il coach poteva continuare a nominare un problema che avevi già tolto dal profilo" },
      { type: "fix", text: "Il coach non scrive più note di tipo «osservazione»: erano quasi tutte lui che si ripeteva il compito («monitorare lo stress dell'atleta»), e rileggendole ogni volta se le riscriveva in parafrasi all'infinito. Ora ricorda solo fatti: preferenze, infortuni, obiettivi" },
      { type: "new", text: "Il pulsante «Riscrivi la filosofia» ora è anche in Impostazioni, accanto alle risposte che la rendono obsoleta: la filosofia è scritta una volta e non si aggiorna da sola" },
      { type: "improve", text: "Sotto la prontezza resta solo quello che ti manca perché le soglie diventino tue («servono 3 misure, ne hai 1»); le soglie già attive si leggono in Impostazioni, dove non diventano una riga che smetti di guardare" },
    ],
  },
  {
    version: "1.18.0",
    date: "5 ago 2026",
    title: "Chiudi la settimana",
    items: [
      { type: "new", text: "Nuova pagina Review: chiude la settimana appena finita confrontando quello che era previsto con quello che hai fatto davvero, chiede come ti sei sentito (energia, sonno, dolori, stress, motivazione) e confronta sensazioni e dati — dove non coincidono, te lo dice" },
      { type: "new", text: "La review guarda anche se le uscite facili erano davvero facili (tempo sopra la soglia aerobica) e se una seduta lunga o dura ha tenuto fino alla fine (deriva del battito rispetto allo sforzo)" },
      { type: "new", text: "Se un'attività arriva da Strava, Intervals.icu non ne fornisce i dati: la review ora lo segnala chiaramente invece di farla sembrare una seduta saltata" },
      { type: "fix", text: "Il tuo FTP e le tue zone di frequenza cardiaca ora arrivano correttamente da Intervals.icu — un errore nella lettura del profilo li mostrava come mancanti anche quando erano impostati" },
    ],
  },
  {
    version: "1.17.0",
    date: "5 ago 2026",
    title: "Il perché di ogni seduta",
    items: [
      { type: "new", text: "Sopra la settimana ora trovi un breve riepilogo di cosa dicono i tuoi dati prima del piano: CTL, ACWR, prontezza, la fase in cui sei e perché, quanto vale il volume di questa settimana nel blocco 3:1" },
      { type: "new", text: "Aprendo una seduta dura, oltre alla nota del coach ora vedi anche il motivo per cui è stata scelta proprio quella per te questa settimana — se colpisce un limitatore del tuo percorso, lo dice" },
    ],
  },
  {
    version: "1.16.0",
    date: "4 ago 2026",
    title: "Sedute vere per chi corre",
    items: [
      { type: "new", text: "Chi ha scelto Corsa ora riceve settimane di allenamento vere — corsa facile, ripetute, lungo, prove a passo gara — invece del messaggio «modulo non disponibile» di prima" },
      { type: "new", text: "Quando l'app conosce la tua velocità critica (dalle corse sincronizzate su Intervals.icu), le sedute mostrano anche il passo target in minuti al km, non solo la zona" },
      { type: "improve", text: "Le sedute di corsa inviate a Intervals.icu ora descrivono il passo giusto, invece di mostrare per errore un target in watt pensato per la bici" },
    ],
  },
  {
    version: "1.15.0",
    date: "3 ago 2026",
    title: "Corsa o ciclismo, fin dal primo passo",
    items: [
      { type: "new", text: "L'onboarding ora chiede subito se fai Ciclismo o Corsa: chi corre non vede più domande su FTP o potenza, e la scheda «Oggi» mostra un indicatore di efficienza calcolato sul passo invece che sui watt" },
      { type: "new", text: "Nella scheda profilo, chi corre trova le zone di passo e le previsioni sui 1-3-5-10 km calcolate dalla propria velocità critica, al posto delle card sulla potenza che non lo riguardano" },
      { type: "improve", text: "La pagina Percorso, per chi corre, non mostra più limitatori in W/kg o riferimenti a uscite in bici pensati per chi pedala" },
      { type: "improve", text: "Tolte dall'onboarding tredici domande che venivano salvate ma non usate da nessuna parte dell'app (altezza, peso, FTP indoor, soglie di frequenza cardiaca, tipo di ciclocomputer e attrezzatura)" },
      { type: "fix", text: "Chi chiudeva l'onboarding a metà riprendeva sempre dal passo 7 invece che da dove aveva lasciato davvero" },
      { type: "fix", text: "Chi corre e basta ora riesce a costruire il proprio profilo (prima l'app si fermava cercando prima i dati della bici) e vede comunque il commento del coach e il taccuino, che prima sparivano per lui" },
    ],
  },
  {
    version: "1.14.1",
    date: "3 ago 2026",
    title: "La filosofia si schiera",
    items: [
      { type: "fix", text: "Quando scegli scuole che sono davvero in disaccordo tra loro (es. Seiler contro Coggan sulla zona centrale), la tua filosofia ora dice esplicitamente quale segue per te e perché, invece di elencarle una dopo l'altra senza mai farle scontrare" },
      { type: "fix", text: "Il paragrafo su «chi sei come atleta» ora confronta davvero quello che hai dichiarato con quello che mostrano i tuoi dati, invece di limitarsi a ripetere il dossier" },
    ],
  },
  {
    version: "1.14.0",
    date: "3 ago 2026",
    title: "La tua filosofia di coaching",
    items: [
      { type: "new", text: "Nelle impostazioni c'è una sezione nuova, «La tua filosofia»: sette domande su come vuoi essere allenato (struttura o libertà, dati o sensazioni, come reagisci ai blocchi duri, cosa ti piace e cosa detesti) e otto scuole di allenamento vere tra cui scegliere — da Seiler a Canova, da Lydiard a Coggan. Se non ne conosci nessuna, le scegliamo noi dalle tue risposte" },
      { type: "new", text: "Nella scheda atleta il bottone «Scrivi la mia filosofia» mette insieme le tue risposte, i tuoi dati reali e le scuole scelte, e scrive il patto tra te e il tuo coach: chi sei come atleta, da chi prendiamo e perché, come ti alleniamo, come ti parliamo" },
      { type: "improve", text: "Le scuole che scegli cambiano davvero il piano, non solo le parole: con un'impostazione polarizzata la seduta dura di base diventa gli intervalli lunghi di Seiler invece del sweet spot; con la scuola della soglia si va diretti a FTP. Le regole di sicurezza (distanza tra le sedute dure, readiness, limitatori) restano sopra a tutto" },
      { type: "improve", text: "Tutti i commenti del coach — profilo, giornata, percorso — ora parlano con il tono che hai scelto" },
    ],
  },
  {
    version: "1.13.0",
    date: "2 ago 2026",
    title: "Mappa più semplice",
    items: [
      { type: "improve", text: "Due viste invece di tre: «Satellite» mostra già strade, sentieri e nomi dei luoghi, quindi la vista «Ibrida» separata non serviva più ed è stata tolta" },
    ],
  },
  {
    version: "1.12.0",
    date: "2 ago 2026",
    title: "La mappa del percorso, più utile",
    items: [
      { type: "new", text: "La vista «Ibrida» ora mostra strade, sentieri e nomi dei luoghi presi da OpenStreetMap sopra la foto satellitare: prima comparivano solo i comuni principali, in montagna quasi nulla" },
      { type: "improve", text: "Mappa più bassa nella pagina Percorso: prima occupava quasi tutto lo schermo e scorrere col pollice al centro trascinava la mappa invece della pagina, rendendo faticoso arrivare a Limitatori e Stima" },
    ],
  },
  {
    version: "1.11.0",
    date: "2 ago 2026",
    title: "La readiness apre la giornata",
    items: [
      { type: "new", text: "La schermata Oggi ora si apre con la readiness: una frase diretta ti dice subito cosa fare («Oggi è meglio fermarsi», «Esegui la seduta prevista»...), il saluto è integrato, i motivi restano sempre leggibili sotto — niente più numeri o anelli da interpretare" },
    ],
  },
  {
    version: "1.10.0",
    date: "2 ago 2026",
    title: "Il calendario della stagione",
    items: [
      { type: "new", text: "Nuova card «La stagione» nella pagina Piano: divide il tempo che ti separa dalla gara in blocchi Base, Build, Picco e Taper, con le date di ciascuno e il blocco in cui ti trovi oggi evidenziato" },
      { type: "new", text: "Il piano ti dice anche se sei in linea con il calendario della stagione o in ritardo, confrontando la fase prevista con quella che i tuoi dati reali indicano" },
    ],
  },
  {
    version: "1.9.1",
    date: "2 ago 2026",
    title: "Mappa del percorso più leggibile",
    items: [
      { type: "fix", text: "La finestra «Analizza/Rianalizza evento» non si sovrappone più ai controlli della mappa (satellite/mappa/ibrida, GPS): ora si apre come pannello centrato e ben distinto" },
      { type: "improve", text: "Controlli sopra la mappa (satellite/mappa/ibrida, GPS) più leggibili: sfondo davvero opaco invece che quasi trasparente" },
    ],
  },
  {
    version: "1.9.0",
    date: "18 lug 2026",
    title: "Scheda telaio per la gara",
    items: [
      { type: "new", text: "Nuovo PDF scaricabile dalla pagina Percorso, formato adesivo da tubo del telaio (6×10 cm): profilo altimetrico e tabella delle salite con orario di passaggio e potenza target, colorate per livello di difficoltà. Disponibile solo dopo la calibrazione, per numeri sempre affidabili" },
    ],
  },
  {
    version: "1.8.0",
    date: "18 lug 2026",
    title: "CurveLoad si dedica solo al ciclismo",
    items: [
      { type: "improve", text: "L'app ora si concentra esclusivamente sul ciclismo: rimossi il profilo e la libreria allenamenti dedicati alla corsa" },
    ],
  },
  {
    version: "1.7.0",
    date: "16 lug 2026",
    title: "Percorso in 3D, GPS live e piano più attento a te",
    items: [
      { type: "new", text: "Mappa del percorso in 3D fotorealistica, con vista satellite e tracciato colorato per pendenza" },
      { type: "new", text: "Posizione GPS in tempo reale sulla mappa mentre pedali o corri" },
      { type: "new", text: "Scheda percorso ridisegnata a schermo intero, scorrevole a card: mappa, limitatori di gara, stima tempo" },
      { type: "new", text: "Analisi di durabilità: come cala la tua potenza quando sei affaticato, non solo da fresco" },
      { type: "new", text: "Trend dell'efficienza aerobica (rapporto potenza/frequenza cardiaca) in dashboard" },
      { type: "new", text: "Se compili una nota di salute nel profilo, le sedute dure del piano mostrano un avviso — il piano non le riduce da solo, decidi tu" },
      { type: "improve", text: "Se non hai ancora abbastanza dati per stimare la tua soglia di potenza (FTP), l'app usa il valore che hai dichiarato in Impostazioni, finché non ha una stima migliore" },
    ],
  },
  {
    version: "1.4.0",
    date: "25 giu 2026",
    title: "Soglia: secondo modello a confronto",
    items: [
      {
        type: "new",
        text: "Nella scheda atleta, accanto alla tua potenza di soglia (CP) ora compare la stima di un secondo modello (power-law), quello usato anche da strumenti come AnalyzeMe — appare solo quando i due numeri differiscono in modo percepibile",
      },
      {
        type: "improve",
        text: "Quando i modelli divergono, il tooltip «?» spiega quale guardare: il modello principale può abbassare la soglia se hai uno sprint molto forte, mentre la power-law pesa di più gli sforzi da 5 a 60 minuti",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "24 giu 2026",
    title: "Piano più intelligente: recupero, progressione e scarico",
    items: [
      { type: "new", text: "Recupero seduta saltata: se hai perso un allenamento duro, l'app lo recupera nel giorno migliore — non te lo incastra a forza quando non sei pronto, e ti avvisa del rischio" },
      { type: "new", text: "Progressione automatica: quando completi un formato (es. 4×4), la settimana dopo aumenta gradualmente — prima la durata, poi riduce il recupero, infine l'intensità" },
      { type: "new", text: "Settimane di scarico automatiche: ogni 4ª settimana il volume cala per farti assorbire il carico, secondo il ciclo 3:1" },
      { type: "new", text: "Volume progressivo nel blocco: il carico cresce gradualmente nelle 3 settimane di build prima dello scarico" },
      { type: "improve", text: "Ordine delle sedute dure più sensato: VO₂max e soglia prima del lavoro a sweet-spot quando sono ravvicinate" },
      { type: "fix", text: "Rigenera non sovrascrive più il lavoro già fatto né i giorni bloccati" },
      { type: "fix", text: "La seduta recuperata su oggi non viene più cancellata da una rigenerazione successiva" },
    ],
  },
  {
    version: "1.2.0",
    date: "24 giu 2026",
    title: "Profilo corsa: Critical Speed e D′",
    items: [
      { type: "new", text: "Profilo dedicato per i runner: Critical Speed (CS) e D′ letti dalla tua curva pace su Intervals.icu" },
      { type: "new", text: "Predizioni gara da 400 m alla 50 km, con il modello fisiologico giusto per ogni distanza" },
      { type: "new", text: "Zone di passo, domini d'intensità, LT1 stimato e indice di resistenza alla fatica" },
      { type: "improve", text: "La scheda atleta si adatta allo sport: i ciclisti vedono CP/W′, i runner CS/D′" },
    ],
  },
  {
    version: "1.1.0",
    date: "23 giu 2026",
    title: "Tour guidato e sessione persistente",
    items: [
      { type: "new", text: "Tour interattivo al primo accesso: ti guida attraverso dashboard, piano e profilo" },
      { type: "new", text: "Accesso persistente — puoi scegliere «Ricordami» nel login per non inserire la password ogni volta" },
      { type: "new", text: "Pagina di registrazione: avviso sui prerequisiti (account Intervals.icu e dispositivi collegati)" },
      { type: "improve", text: "Il tour viene mostrato una sola volta per account, non per dispositivo" },
    ],
  },
];

export const LATEST = CHANGELOG[0];
