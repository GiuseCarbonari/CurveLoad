/**
 * Libreria delle scuole di coaching — dati congelati, nessun I/O, nessuna AI.
 *
 * La ricerca vera (metodologia, fonti lette, dove le scuole sono d'accordo e
 * dove litigano) sta in docs/COACHING_SCHOOLS.md. Qui c'è solo la versione che
 * serve al codice: il testo che entra nel prompt della filosofia e l'unico
 * campo che pilota il motore (`asse_intensita` → athlete_profiles.stile_allenamento
 * → scelta della seduta dura in lib/planner/session-selector.ts).
 *
 * Perché congelata e non cercata a runtime: il layer AI gira su Groq, che non
 * naviga sul web. Una scuola "ricordata" dal modello sarebbe inventata; questa
 * è letta da fonti reali una volta sola.
 */

/** Asse di distribuzione dell'intensità. Sottoinsieme di STILE_OPTIONS (senza "mixed"). */
export type IntensityAxis = "polarized" | "pyramidal" | "threshold";

/**
 * Tratti usati SOLO dal suggeritore qui sotto, per l'atleta che non conosce
 * nessun coach. Ognuno è raggiungibile da una risposta dell'intervista: se se ne
 * aggiunge uno che nessuna risposta produce, resta inerte.
 */
export type SchoolTrait =
  | "dati"
  | "sensazioni"
  | "struttura"
  | "flessibilita"
  | "carico_alto"
  | "recupero";

export interface CoachingSchool {
  id: string;
  nome: string;
  /** 2-3 frasi: è il materiale che l'AI può citare nella filosofia. */
  metodo: string;
  asse_intensita: IntensityAxis;
  tratti: SchoolTrait[];
  /** Le stesse fonti elencate in docs/COACHING_SCHOOLS.md. */
  fonti: string[];
}

export const COACHING_SCHOOLS: CoachingSchool[] = [
  {
    id: "seiler",
    nome: "Stephen Seiler — il modello polarizzato (80/20)",
    metodo:
      "Circa l'80% del tempo di allenamento sotto la prima soglia e il 20% sopra la seconda, con la zona centrale quasi vuota: «troppo dolore per troppo poco». Il facile deve restare davvero facile, altrimenti il duro non può essere abbastanza duro. La sua seduta di riferimento è il 4×8 minuti, che in uno studio controllato su 7 settimane ha battuto sia il 4×4 sia il 4×16.",
    asse_intensita: "polarized",
    tratti: ["dati", "recupero", "flessibilita"],
    fonti: [
      "https://www.fasttalklabs.com/pathways/polarized-training/",
      "https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1600-0838.2011.01351.x",
      "https://roadmancycling.com/blog/stephen-seiler-research-polarised-training-lessons",
    ],
  },
  {
    id: "san_millan",
    nome: "Iñigo San Millán — la Zona 2 metabolica",
    metodo:
      "La Zona 2 è l'intensità che stimola al massimo i mitocondri e l'ossidazione dei grassi, appena sotto la salita del lattato. Prescrive una dose, non un calendario: minimo 60 minuti per seduta perché l'adattamento parta, 300-400 minuti a settimana in totale. Tutto il resto del lavoro è raro e molto duro.",
    asse_intensita: "polarized",
    tratti: ["dati", "recupero"],
    fonti: [
      "https://peterattiamd.com/inigosanmillan/",
      "https://peterattiamd.com/inigosanmillan2/",
      "https://www.highnorth.co.uk/articles/zone-2-training-inigo-san-millan",
    ],
  },
  {
    id: "friel",
    nome: "Joe Friel — il Training Bible e il recupero individuale",
    metodo:
      "Piano annuale a periodi (Base → Build → Peak → Gara → Transizione), ma la vera firma è il microciclo tarato sul recupero della persona invece che sulla settimana di 7 giorni: per molti atleti senior propone un ciclo di 9 giorni con le dure ogni terzo giorno, e settimana di scarico ogni 3 settimane invece che ogni 4 dopo i 50 anni. Il recupero è il segreto, non l'allenamento.",
    asse_intensita: "pyramidal",
    tratti: ["struttura", "recupero"],
    fonti: [
      "https://joefrieltraining.com/aging-designing-a-microcycle-to-match-your-recovery/",
      "https://joefrieltraining.com/aging-customizing-the-build-period/",
      "https://www.trainingpeaks.com/blog/periodization-and-mixed-training/",
    ],
  },
  {
    id: "coggan_overton",
    nome: "Coggan & Allen / Overton — la scuola della potenza e del sweet spot",
    metodo:
      "È la scuola che ha reso normali FTP, zone di potenza e TSS. Il sweet spot (84-97% dell'FTP) nasce dall'incrocio tra la curva del beneficio e quella dello stress: la fascia di massimo rendimento per il tempo speso, pensata per chi ha poche ore. Riempie deliberatamente la zona centrale che il modello polarizzato lascia vuota.",
    asse_intensita: "threshold",
    tratti: ["dati", "struttura", "carico_alto"],
    fonti: [
      "https://fascatcoaching.com/blogs/training-tips/sweet-spot-training/",
      "https://fascatcoaching.com/blogs/training-tips/yt-how-i-invented-sweet-spot-training-AD32o8/",
      "https://velo.outsideonline.com/road/road-training/which-will-make-you-faster-sweet-spot-or-threshold-workouts/",
    ],
  },
  {
    id: "lydiard",
    nome: "Arthur Lydiard — la base aerobica e le quattro fasi",
    metodo:
      "Quattro fasi in sequenza: base aerobica lunghissima (rallentando tutte le corse per accumulare chilometri in fretta), quattro settimane di colline come ponte, poi lavoro anaerobico in pista, infine affilatura. Il contributo non sono le sedute ma l'orchestrazione: sistemi energetici diversi migliorano a velocità diverse e vanno fatti culminare insieme il giorno della gara.",
    asse_intensita: "pyramidal",
    tratti: ["sensazioni", "flessibilita"],
    fonti: [
      "https://www.scienceofrunning.com/2016/11/arthur-lydiard-the-father-of-modern-training.html",
      "https://www.sweatelite.co/lydiard-fundamentals-part-3-hill-resistance-training/",
      "https://www.championseverywhere.com/wp-content/uploads/2017/07/lydiardiowa99.pdf",
    ],
  },
  {
    id: "canova",
    nome: "Renato Canova — il ritmo specifico",
    metodo:
      "Ogni andatura è una percentuale del ritmo gara, non una zona fisiologica: rigenerante 70-80%, aerobico 85-93%, specifico 98-105%. Il periodo specifico dura 10 settimane e diventa «matematico»: comanda il ritmo preciso, non la sensazione. Rifiuta esplicitamente i salti grandi del modello polarizzato — servono «tante piccole scale» di ritmi adiacenti — e parte subito veloce estendendo la durata, invece di aggiungere velocità a un lungo già lungo.",
    asse_intensita: "threshold",
    tratti: ["dati", "struttura", "carico_alto"],
    fonti: [
      "https://runningwritings.com/2023/07/renato-canova-marathon-training-lecture.html",
      "https://runningwritings.com/2024/05/renato-canova-marathon-training-emile-cairess.html",
      "https://runningscience.co.za/wp-content/uploads/2017/01/The-Methods-of-Renato-Canova.pdf",
    ],
  },
  {
    id: "daniels",
    nome: "Jack Daniels — il VDOT e i cinque ritmi",
    metodo:
      "Un solo numero misurato da una gara reale (il VDOT) genera per tabella tutti i ritmi di allenamento: E facile, M maratona, T soglia, I intervalli, R ripetute. Distribuzione dichiarata: 70-80% in E, 10-15% in M+T, 10-15% in I+R. Vicino all'80/20 come proporzioni, ma con la fetta di mezzo deliberata invece che vuota.",
    asse_intensita: "pyramidal",
    tratti: ["dati", "struttura"],
    fonti: [
      "https://fellrnr.com/wiki/Jack_Daniels_Running_Formula",
      "https://yourcoach.substack.com/p/jack-daniels-and-the-training-formula",
      "https://denstarfitness.com/jack-daniels-running-formula/",
    ],
  },
  {
    id: "hansons",
    nome: "Hansons — la fatica cumulativa",
    metodo:
      "Il corpo non distingue se la fatica arriva da un lungo unico o da più corse ravvicinate. Sei giorni di corsa, tre dei quali «di sostanza» (velocità/forza, ritmo gara, lungo), senza mai recuperare del tutto: si arriva a ogni seduta con le gambe già stanche. Nessuna corsa supera le 16 miglia — il piano insegna a correre gli ULTIMI 16 miglia della maratona, non i primi.",
    asse_intensita: "pyramidal",
    tratti: ["carico_alto", "struttura"],
    fonti: [
      "https://marathonhandbook.com/hansons-marathon-method/",
      "https://runculture.com/learn/running-methods/hansons/",
      "https://www.goodreads.com/book/show/13592481-hansons-marathon-method",
    ],
  },
];

/**
 * I disaccordi VERI tra scuole, presi uno a uno dalla tabella «Dove litigano
 * davvero» di docs/COACHING_SCHOOLS.md. Sono qui e non solo nel doc perché
 * senza questi il modello non sa dove le scuole si contraddicono: chiedergli
 * di scegliere una posizione senza dargli il contrasto significa fargliela
 * inventare.
 */
export interface SchoolDisagreement {
  /** I due id in contrasto. */
  tra: [string, string];
  /** Il punto in una frase, con le due posizioni. */
  punto: string;
}

export const DISAGREEMENTS: SchoolDisagreement[] = [
  {
    tra: ["seiler", "coggan_overton"],
    punto:
      "La zona centrale: per Seiler è da evitare («troppo dolore per troppo poco»), per Coggan/Overton il sweet spot (84-97% FTP) è il punto di massimo rendimento per il tempo speso.",
  },
  {
    tra: ["san_millan", "coggan_overton"],
    punto:
      "Dove si costruisce il motore: San Millán dice sotto, in Zona 2 pura e per tante ore; Coggan/Overton dicono nella fascia sweet spot, perché rende di più a parità di tempo.",
  },
  {
    tra: ["seiler", "canova"],
    punto:
      "Quanto distanziare le andature: Seiler polarizza e lascia il centro vuoto, Canova rifiuta i salti grandi e vuole «tante piccole scale» di ritmi adiacenti per collegare le velocità.",
  },
  {
    tra: ["lydiard", "hansons"],
    punto:
      "Il lungo: Lydiard lo vuole lunghissimo come base di tutto, gli Hansons non superano mai le 16 miglia e costruiscono la fatica accumulando giorni.",
  },
  {
    tra: ["canova", "hansons"],
    punto:
      "Il lungo: Canova arriva a 30-32 km gran parte a ritmo gara, gli Hansons tappano a 16 miglia perché il corpo non distingue da dove viene la fatica.",
  },
  {
    tra: ["daniels", "lydiard"],
    punto:
      "Chi comanda: Daniels calibra tutto su un numero misurato in gara (il VDOT), Lydiard va a sensazione e mette il cronometro dopo.",
  },
  {
    tra: ["coggan_overton", "lydiard"],
    punto:
      "Chi comanda: Coggan prescrive a watt (FTP, TSS), Lydiard corre «dentro sé stesso» e diffida del numero.",
  },
  {
    tra: ["san_millan", "lydiard"],
    punto:
      "Chi comanda: San Millán vuole il lattato misurato in laboratorio, Lydiard la sensazione sul campo.",
  },
  {
    tra: ["friel", "hansons"],
    punto:
      "Il recupero: Friel lo allunga e lo taglia sulla persona (microciclo di 9 giorni, scarico ogni 3 settimane dopo i 50), gli Hansons lo lasciano deliberatamente incompleto — è il meccanismo del metodo.",
  },
  {
    tra: ["lydiard", "canova"],
    punto:
      "Quanto volume serve: per Lydiard il volume è la base di tutto (fino a 160 km/settimana), il Canova moderno ne toglie (160-190 invece dei 290+ degli anni '90) perché il recupero attorno alle sedute specifiche vale più dei chilometri.",
  },
];

/**
 * I disaccordi INTERNI a un gruppo di scuole: solo quelli in cui entrambe le
 * parti sono tra quelle scelte, perché è lì che l'atleta ha davvero due
 * padroni che dicono cose opposte. Gruppo concorde ⇒ lista vuota, e chi
 * costruisce il prompt lo gestisce (non si forza un litigio che non c'è).
 */
export function disagreementsAmong(ids: string[]): SchoolDisagreement[] {
  const chosen = new Set(ids);
  return DISAGREEMENTS.filter((d) => chosen.has(d.tra[0]) && chosen.has(d.tra[1]));
}

/** Lookup per id. null se l'id non esiste (dato utente vecchio o corrotto). */
export function getSchool(id: string): CoachingSchool | null {
  return COACHING_SCHOOLS.find((s) => s.id === id) ?? null;
}

/** Scuole corrispondenti agli id dati, nell'ordine della libreria, ignote scartate. */
export function resolveSchools(ids: string[]): CoachingSchool[] {
  const wanted = new Set(ids);
  return COACHING_SCHOOLS.filter((s) => wanted.has(s.id));
}

/**
 * Asse prevalente delle scuole scelte → valore per `stile_allenamento`.
 * Pareggio o nessuna scuola ⇒ "mixed", che nel planner significa "come oggi".
 */
export function prevailingAxis(
  ids: string[]
): IntensityAxis | "mixed" {
  const schools = resolveSchools(ids);
  if (schools.length === 0) return "mixed";

  const counts: Record<string, number> = {};
  for (const s of schools) {
    counts[s.asse_intensita] = (counts[s.asse_intensita] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]) as Array<
    [IntensityAxis, number]
  >;
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return "mixed";
  return ranked[0][0];
}

/**
 * Risposte dell'intervista → tratti da cercare nelle scuole. Firma strutturale
 * (niente import da lib/onboarding/dossier.ts) per non creare un ciclo: è il
 * dossier a conoscere la libreria, non il contrario.
 */
export function traitsFromAnswers(answers: {
  blocchi_duri?: string;
  struttura?: string;
  dati_sensazioni?: string;
}): SchoolTrait[] {
  const traits: SchoolTrait[] = [];
  if (answers.dati_sensazioni === "dati") traits.push("dati");
  if (answers.dati_sensazioni === "sensazioni") traits.push("sensazioni");
  if (answers.struttura === "struttura") traits.push("struttura");
  if (answers.struttura === "flessibilita") traits.push("flessibilita");
  if (answers.blocchi_duri === "mi_caricano") traits.push("carico_alto");
  // Chi crolla dopo i blocchi duri e chi li evita cercano la stessa cosa: una
  // scuola che mette il recupero al centro.
  if (
    answers.blocchi_duri === "reggo_poi_crollo" ||
    answers.blocchi_duri === "li_evito"
  ) {
    traits.push("recupero");
  }
  return traits;
}

/**
 * Ramo "non conosco nessun coach": sceglie il codice, non l'AI.
 *
 * Punteggio: +2 se l'asse coincide con lo stile già dichiarato dall'atleta
 * (step Obiettivi del dossier), +1 per ogni tratto richiesto dalle risposte
 * dell'intervista. A parità vince l'ordine della libreria — deterministico,
 * stessi input ⇒ stesse scuole.
 */
export function suggestSchools(
  stile: string | null,
  tratti: SchoolTrait[],
  limit = 3
): CoachingSchool[] {
  const wanted = new Set(tratti);
  const scored = COACHING_SCHOOLS.map((school, index) => {
    let score = school.asse_intensita === stile ? 2 : 0;
    for (const t of school.tratti) if (wanted.has(t)) score += 1;
    return { school, score, index };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.school);
}
