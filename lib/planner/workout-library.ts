/**
 * Catalogo Workout Library (Section 11 B §8, docs/WORKOUT_REFERENCE.md v0.6) —
 * dato PURO, nessuna logica. È l'UNICA fonte dei `library_id`: ogni seduta
 * generata dal planner DEVE riferire un `id` presente qui (regola ferma
 * "no session structures absent from the Reference Library", §8).
 *
 * I campi `id`, `domain`, `is_hard_session`, `work_minutes`,
 * `est_total_minutes` sono trascritti ESATTI dai blocchi YAML del documento.
 * `structure`, `zones`, `coaching_notes`, `select_when` sono trascritti dai
 * campi testuali; `title`, `rpe`, `hr_target` sono etichette derivate dal
 * dominio (dichiarate, non inventate come numeri fisiologici).
 *
 * NB: se WORKOUT_REFERENCE.md cambia, va aggiornato qui — i test verificano
 * che i `library_id` usati dal selector esistano in questo catalogo.
 */

export type WorkoutDomain =
  | "endurance"
  | "tempo"
  | "sweet_spot"
  | "threshold"
  | "vo2max"
  | "anaerobic"
  | "race_specific"
  | "strength_endurance";

export interface WorkoutTemplate {
  id: string;
  title: string;
  domain: WorkoutDomain;
  is_hard_session: boolean;
  work_minutes: number;
  est_total_minutes: number;
  /** Zona di potenza target (testo dal campo Zones del template). */
  zones: string;
  /** Target potenza compatto per la UI/coach_notes. */
  power_target_zone: string;
  /** Target HR indicativo (derivato dal dominio; le zone vere sono su Intervals). */
  hr_target_zone: string;
  /** RPE target indicativo (derivato dal dominio / note del template). */
  rpe_target: string;
  structure: string;
  duration_label: string;
  coaching_notes: string;
  select_when: string;
  optional?: boolean;
}

/**
 * I 26 template della libreria v0.6. Ordine come nel documento (1A→1F).
 */
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // --- 1A. Aerobic / Endurance (Z1–Z2) --------------------------------------
  {
    id: "AE-1",
    title: "Endurance steady (breve)",
    domain: "endurance",
    is_hard_session: false,
    work_minutes: 75,
    est_total_minutes: 75,
    zones: "Z2 (upper Z1 accettabile nelle settimane di recupero)",
    power_target_zone: "Z2",
    hr_target_zone: "Z2 (aerobico)",
    rpe_target: "RPE 3–4",
    structure: "Pedalata continua",
    duration_label: "60–90 min",
    coaching_notes:
      "Sforzo costante. Cadenza 85–95 rpm. La FC deve restare stabile o derivare poco (<5% sulla seduta).",
    select_when: "Mantenimento aerobico infrasettimanale, fatica moderata o tempo limitato.",
  },
  {
    id: "AE-2",
    title: "Endurance steady (media)",
    domain: "endurance",
    is_hard_session: false,
    work_minutes: 120,
    est_total_minutes: 120,
    zones: "Z2",
    power_target_zone: "Z2",
    hr_target_zone: "Z2 (aerobico)",
    rpe_target: "RPE 3–4",
    structure: "Pedalata continua",
    duration_label: "90–150 min",
    coaching_notes:
      "Seduta chiave per il volume aerobico. Monitora il cardiac drift: se la FC deriva >8% a potenza stabile, segnala un problema di durabilità.",
    select_when: "Giornata endurance standard in fase Base o Build.",
  },
  {
    id: "AE-3",
    title: "Lungo di durabilità",
    domain: "endurance",
    is_hard_session: false,
    work_minutes: 180,
    est_total_minutes: 180,
    zones: "Z1–Z2 (prevalentemente Z2, Z1 nei primi 15–20 min)",
    power_target_zone: "Z1–Z2",
    hr_target_zone: "Z1–Z2 (aerobico)",
    rpe_target: "RPE 3–5",
    structure: "Pedalata continua con eventuali blocchi Z2-alto negli ultimi 30 min",
    duration_label: "150–240+ min",
    coaching_notes:
      "È il lungo settimanale (Section 11 B §4). Gli sforzi Z2-alti di fine ride costruiscono durabilità sotto fatica. Strategia di rifornimento critica oltre le 2h.",
    select_when: "Slot del lungo settimanale. Richiede recupero adeguato (RI ≥ 0.8).",
  },
  {
    id: "AE-4",
    title: "Recupero attivo",
    domain: "endurance",
    is_hard_session: false,
    work_minutes: 45,
    est_total_minutes: 45,
    zones: "Solo Z1",
    power_target_zone: "Z1",
    hr_target_zone: "Z1 (molto facile)",
    rpe_target: "RPE 1–2",
    structure: "Pedalata continua, molto facile",
    duration_label: "30–60 min",
    coaching_notes:
      "Davvero facile. Se è difficile restare in Z1, riduci la durata invece di alzare l'intensità. Può essere sostituita da riposo completo se RI < 0.7.",
    select_when: "Giorno dopo una seduta dura, fatica elevata o carico cumulativo alto.",
  },
  {
    id: "AE-5",
    title: "Cadenza / tecnica",
    domain: "endurance",
    is_hard_session: false,
    work_minutes: 65,
    est_total_minutes: 65,
    zones: "Z1–Z2",
    power_target_zone: "Z1–Z2",
    hr_target_zone: "Z1–Z2",
    rpe_target: "RPE 3–4",
    structure:
      "4–6 × 5 min di drill a gamba singola o alta cadenza (100–110 rpm) in potenza Z2, con 3 min facili tra i blocchi",
    duration_label: "60–75 min totali",
    coaching_notes:
      "Il focus è l'efficienza neuromuscolare, non la potenza. Mantieni lo sforzo conversazionale.",
    select_when: "Varietà in fase Base o quando le metriche di pedalata indicano margini di efficienza.",
  },
  {
    id: "AE-6",
    title: "Endurance a finale veloce (fast-finish)",
    domain: "endurance",
    is_hard_session: true,
    work_minutes: 140,
    est_total_minutes: 140,
    zones: "Z1–Z2 per i primi 60–120 min, poi Z3 costante negli ultimi 30–45 min",
    power_target_zone: "Z1–Z2 → Z3 finale",
    hr_target_zone: "Z2 → Z3",
    rpe_target: "RPE 4 → 6–7 nel finale",
    structure: "Lungo continuo con un deliberato aumento d'intensità nel blocco finale",
    duration_label: "120–165 min totali",
    coaching_notes:
      "Il finale in Z3 colpisce la durabilità sotto fatica accumulata: l'atleta deve sostenere potenza tempo con glicogeno basso e cardiac drift. È più dura di AE-3 e conta nel tempo Z3+ per la TID. Rifornimento critico. Occupa uno slot di seduta dura.",
    select_when:
      "Fase Base tardiva e Build, soprattutto per gran fondo, eventi lunghi di salita o gare dove lo sforzo decisivo arriva sotto fatica. Richiede RI ≥ 0.8.",
  },
  {
    id: "AE-7",
    title: "Endurance progressiva",
    domain: "endurance",
    is_hard_session: false,
    work_minutes: 120,
    est_total_minutes: 120,
    zones: "Inizio Z2-medio, fine Z2-alto/Z3-basso, step ogni 30–45 min",
    power_target_zone: "Z2 progressivo → Z3-basso",
    hr_target_zone: "Z2 → Z3-basso",
    rpe_target: "RPE 4–6",
    structure: "Ride continuo con 2–3 step di potenza (es. 3 × 40 min a target Z2 crescenti)",
    duration_label: "90–150 min totali",
    coaching_notes:
      "Stimolo di durabilità più gentile di AE-6. La progressione è sottile, la seduta resta aerobica. Monitora il rapporto FC:potenza tra gli step.",
    select_when:
      "Quando vuoi stress di durabilità senza un finale Z3: giornate a readiness moderata, o come passo prima di introdurre AE-6.",
  },
  // --- 1B. Tempo / Sweet Spot / Threshold (Z3–Z4) ---------------------------
  {
    id: "SS-1",
    title: "Sweet Spot sostenuto",
    domain: "sweet_spot",
    is_hard_session: true,
    work_minutes: 65,
    est_total_minutes: 95,
    zones: "Z4 (Sweet Spot — da Z3-alto a Z4-basso secondo il modello di zone)",
    power_target_zone: "Sweet Spot (Z3-alto/Z4-basso)",
    hr_target_zone: "Z3–Z4",
    rpe_target: "RPE 7–8",
    structure: "2–3 × 15–20 min, con 5 min Z1 di recupero tra i blocchi",
    duration_label: "55–80 min di lavoro",
    coaching_notes:
      "Sweet spot classico. Potenza costante in ogni blocco. RPE 7–8/10. Se non reggi il target per l'intero intervallo, riduci la durata invece di aggiungere blocchi.",
    select_when: "Slot di seduta strutturata in Build. Formato sweet spot di default.",
  },
  {
    id: "SS-2",
    title: "Sweet Spot progressivo",
    domain: "sweet_spot",
    is_hard_session: true,
    work_minutes: 62,
    est_total_minutes: 92,
    zones: "Z4",
    power_target_zone: "Sweet Spot (Z4)",
    hr_target_zone: "Z3–Z4",
    rpe_target: "RPE 7–8",
    structure: "3 blocchi a durata crescente: 12 → 15 → 20 min, con 5 min Z1 tra i blocchi",
    duration_label: "60–65 min di lavoro",
    coaching_notes:
      "La durata crescente dà un vantaggio psicologico di pacing. Se fallisci l'ultimo blocco la seduta ha comunque valore. Utile per costruire fiducia.",
    select_when: "Inizio fase Build, o al rientro da uno scarico per ricostruire tolleranza a soglia.",
  },
  {
    id: "SS-3",
    title: "Over-Under",
    domain: "sweet_spot",
    is_hard_session: true,
    work_minutes: 52,
    est_total_minutes: 82,
    zones: "Alternanza Z4 (under) e Z5-basso (over)",
    power_target_zone: "Z4 / Z5-basso (alternati)",
    hr_target_zone: "Z4",
    rpe_target: "RPE 8",
    structure: "3–4 × 8–10 min. Dentro ogni blocco: 2 min Z4 / 1 min Z5-basso, ripetuti. 5 min Z1 tra i blocchi.",
    duration_label: "45–60 min di lavoro",
    coaching_notes:
      "Sviluppa la clearance del lattato a soglia. Gli 'over' devono essere scomodi ma sostenibili: se scoppi, gli over sono troppo alti. Riduci l'intensità degli over prima del numero di blocchi.",
    select_when: "Build medio-tardiva. Richiede buona tolleranza a soglia (prima sii a posto con SS-1).",
  },
  {
    id: "SS-4",
    title: "Tempo intervals (variante a intensità ridotta)",
    domain: "tempo",
    is_hard_session: true,
    work_minutes: 80,
    est_total_minutes: 110,
    zones: "Z3",
    power_target_zone: "Z3 (Tempo)",
    hr_target_zone: "Z3",
    rpe_target: "RPE 5–6",
    structure: "2–3 × 20–30 min, con 5 min Z1 di recupero tra i blocchi",
    duration_label: "60–100 min di lavoro",
    coaching_notes:
      "Per chi costruisce verso lo sweet spot ma non è pronto a Z4 sostenuta. Adatta anche quando la readiness suggerisce una giornata moderata invece che dura.",
    select_when:
      "Transizione Base/Build iniziale, o quando la readiness Section 11 A indica «modify» invece di «go» per una giornata strutturata.",
  },
  {
    id: "SS-5",
    title: "Sweet Spot ripetuto",
    domain: "sweet_spot",
    is_hard_session: true,
    work_minutes: 55,
    est_total_minutes: 85,
    zones: "Z4 (Sweet Spot)",
    power_target_zone: "Sweet Spot (Z4)",
    hr_target_zone: "Z3–Z4",
    rpe_target: "RPE 7–8",
    structure: "4 × 10 min, con 5 min Z1 di recupero tra gli intervalli",
    duration_label: "~55 min di lavoro",
    coaching_notes:
      "Più intervalli più brevi di SS-1. I blocchi da 10 min mantengono alta la qualità della potenza su tutti e quattro. Se completi i 4 con potenza e RPE stabili, progredisci allungando la durata (4×11, 4×12) prima di aggiungere un 5° intervallo.",
    select_when:
      "Atleti che rispondono meglio a sforzi più frequenti con recupero pieno, o come alternativa a SS-1 quando i blocchi da 15–20 min vedono calare la potenza. Efficace anche indoor.",
  },
  {
    id: "TH-1",
    title: "Threshold classico",
    domain: "threshold",
    is_hard_session: true,
    work_minutes: 38,
    est_total_minutes: 70,
    zones: "Z4 medio-alto (a/vicino MLSS/FTP)",
    power_target_zone: "Z4 (soglia/FTP)",
    hr_target_zone: "Z4",
    rpe_target: "RPE 8–9",
    structure: "2 × 20 min oppure 3 × 12 min, con 5–8 min Z1 di recupero tra i blocchi",
    duration_label: "36–40 min di lavoro",
    coaching_notes:
      "Vero lavoro a soglia, più duro dello sweet spot. Potenza al livello sostenibile ~40–60 min in crono. RPE 8–9/10. Se non completi il secondo blocco entro il 3% del primo, il target è troppo alto. Costo di recupero più alto dello sweet spot.",
    select_when: "Da metà Build in poi, quando SS-1/SS-5 sono completati con costanza e l'obiettivo è elevare FTP/MLSS.",
  },
  {
    id: "TH-2",
    title: "Long intervals stile Seiler (4×8)",
    domain: "threshold",
    is_hard_session: true,
    work_minutes: 36,
    est_total_minutes: 68,
    zones: "Z4-alto / Z5-basso in potenza, ~90–92% FCmax negli ultimi intervalli",
    power_target_zone: "Z4-alto / Z5-basso",
    hr_target_zone: "Z4 → ~90–92% FCmax",
    rpe_target: "RPE 8–9",
    structure: "4–5 × 8 min, con 2 min Z1 di recupero tra gli intervalli",
    duration_label: "32–40 min di lavoro",
    coaching_notes:
      "Sta al confine soglia/VO₂max: i recuperi corti da 2 min sono voluti, non si arriva riposati al successivo. La FC sale progressivamente; 90–92% FCmax negli ultimi 1–2 intervalli indica l'intensità giusta. Guadagni combinati VO₂ + soglia, molto time-efficient.",
    select_when: "Build medio-tardiva per adattamento combinato soglia+VO₂ senza Z5 piena. Richiede fitness a soglia consolidata.",
  },
  // --- 1C. VO₂max (Z5) ------------------------------------------------------
  {
    id: "VO2-1",
    title: "VO₂max long intervals classici",
    domain: "vo2max",
    is_hard_session: true,
    work_minutes: 35,
    est_total_minutes: 70,
    zones: "Z5",
    power_target_zone: "Z5 (VO₂max)",
    hr_target_zone: "Z5 (>90% FCmax)",
    rpe_target: "RPE 9",
    structure: "4–5 × 4 min, con 3–4 min Z1 di recupero tra gli intervalli (lavoro:riposo ~1:1)",
    duration_label: "30–40 min di lavoro",
    coaching_notes:
      "Formato VO₂max gold standard: accumula tempo >90% VO₂max. Il recupero dev'essere abbastanza facile da permettere il pieno impegno sul successivo. Se la potenza cala >5% tra gli intervalli, ferma la seduta.",
    select_when: "Formato VO₂max di default in Build. Servono ≥4 settimane di lavoro a soglia (SS-1/SS-2) prima.",
  },
  {
    id: "VO2-2",
    title: "VO₂max short-short (30/15 o 40/20)",
    domain: "vo2max",
    is_hard_session: true,
    work_minutes: 25,
    est_total_minutes: 60,
    zones: "Z5–Z6 nel lavoro, Z1 nel recupero",
    power_target_zone: "Z5–Z6",
    hr_target_zone: "Z5",
    rpe_target: "RPE 9",
    structure: "2–3 set da 8–10 ripetizioni di 30 s on / 15 s off (o 40/20). 5 min Z1 tra i set.",
    duration_label: "20–30 min di lavoro accumulato",
    coaching_notes:
      "Sfrutta la componente lenta del VO₂max: l'ossigeno resta alto nei brevi recuperi accumulando tempo ad alto VO₂. Spesso più tollerabile dei long interval. La potenza negli 'on' sarà più alta dei target VO2-1.",
    select_when: "Alternativa a VO2-1 se l'atleta fatica a sostenere intervalli lunghi, o per varietà. Efficace con poco tempo.",
  },
  {
    id: "VO2-3",
    title: "VO₂max a recuperi decrescenti",
    domain: "vo2max",
    is_hard_session: true,
    work_minutes: 25,
    est_total_minutes: 60,
    zones: "Z5",
    power_target_zone: "Z5 (VO₂max)",
    hr_target_zone: "Z5",
    rpe_target: "RPE 9",
    structure: "5 × 3 min, con recuperi 3 → 2.5 → 2 → 1.5 min tra gli intervalli",
    duration_label: "~25 min di lavoro",
    coaching_notes:
      "L'accumulo progressivo di fatica porta gli ultimi intervalli a vero VO₂max. I primi 2–3 possono sembrare moderati: è voluto. Se non completi l'ultimo entro il 5% del target, la seduta è comunque riuscita con 4 su 5.",
    select_when: "Build tardiva o Peak iniziale. Richiede tolleranza VO₂max consolidata (≥3 sedute di VO2-1/VO2-2).",
  },
  {
    id: "VO2-4",
    title: "VO₂max a durata crescente (piramide)",
    domain: "vo2max",
    is_hard_session: true,
    work_minutes: 25,
    est_total_minutes: 60,
    zones: "Z5",
    power_target_zone: "Z5 (VO₂max)",
    hr_target_zone: "Z5",
    rpe_target: "RPE 9",
    structure: "5 intervalli a durata crescente-decrescente: 2 → 3 → 4 → 3 → 2 min, con 3 min Z1 tra tutti",
    duration_label: "~25 min di lavoro",
    coaching_notes:
      "La struttura a piramide rende la seduta gestibile psicologicamente: lo sforzo più lungo è al centro, quando sei caldo ma non ancora profondamente affaticato. Buon formato introduttivo.",
    select_when: "Transizione verso il VO₂max da un blocco di soglia, o per chi è nuovo agli intervalli Z5.",
  },
  {
    id: "VO2-5",
    title: "VO₂max short-short alto volume (30/15)",
    domain: "vo2max",
    is_hard_session: true,
    work_minutes: 20,
    est_total_minutes: 90,
    zones: "Z5–Z6 nel lavoro, Z1 nel recupero",
    power_target_zone: "Z5–Z6",
    hr_target_zone: "Z5",
    rpe_target: "RPE 9–10",
    structure: "3 set × 13 ripetizioni di 30 s on / 15 s off. 5 min Z1 tra i set.",
    duration_label: "~19.5 min di lavoro accumulato",
    coaching_notes:
      "Variante ad alto volume di VO2-2: i set da 13 rip sono molto più impegnativi. La qualità della potenza nell'ultimo set è l'indicatore chiave. Includi un defaticamento esteso (~30 min Z1). Non per chi è nuovo al VO₂max.",
    select_when: "Progressione da VO2-2 quando completi con costanza 3×10 al target. Non come prima esposizione al VO₂max.",
  },
  // --- 1D. Anaerobic / Neuromuscular (Z6–Z7) --------------------------------
  {
    id: "AN-1",
    title: "Short power repeats",
    domain: "anaerobic",
    is_hard_session: true,
    work_minutes: 12,
    est_total_minutes: 50,
    zones: "Z6",
    power_target_zone: "Z6 (anaerobico)",
    hr_target_zone: "non indicativa (sforzi brevi)",
    rpe_target: "RPE 9–10",
    structure: "8–12 × 30 s, con 2.5–3 min Z1 di recupero tra gli sforzi",
    duration_label: "~10–15 min di lavoro",
    coaching_notes:
      "Recupero pieno tra gli sforzi è critico: contano la qualità e la potenza, non la fatica accumulata. Se la potenza cala >10% dal primo all'ultimo, riduci le ripetizioni.",
    select_when: "Solo fase Peak. Eventi con surge/attacchi ripetuti (criterium, tappe di montagna con scatti).",
  },
  {
    id: "AN-2",
    title: "Sprint intervals",
    domain: "anaerobic",
    is_hard_session: true,
    work_minutes: 8,
    est_total_minutes: 70,
    zones: "Z7 (massimale)",
    power_target_zone: "Z7 (sprint massimale)",
    hr_target_zone: "non indicativa (sprint)",
    rpe_target: "RPE 10",
    structure: "4–6 × 10–15 s all-out, con 5 min Z1 di recupero tra gli sforzi (dentro un ride Z1–Z2)",
    duration_label: "~5–8 min di lavoro (in un ride più lungo)",
    coaching_notes:
      "Vero lavoro neuromuscolare: riposo pieno, reclutamento massimale. Da fare freschi, di norma all'inizio dopo il riscaldamento. Seduta totale con riding Z2: 60–75 min.",
    select_when: "Raramente. Eventi con volata, o per mantenere il reclutamento neuromuscolare in Base. Max una volta a settimana.",
  },
  {
    id: "AN-3",
    title: "Progressive sprint sets",
    domain: "anaerobic",
    is_hard_session: true,
    work_minutes: 3,
    est_total_minutes: 60,
    zones: "Z7 (massimale)",
    power_target_zone: "Z7 (sprint massimale)",
    hr_target_zone: "non indicativa (sprint)",
    rpe_target: "RPE 10",
    structure: "3 set × 5 × 10 s sprint massimali. 3 min Z1 tra le rip, 5 min tra i set. Potenza crescente tra i set.",
    duration_label: "~2.5 min di lavoro, ~60 min totali",
    coaching_notes:
      "La struttura a potenza crescente è una progressione voluta: devi produrre la potenza più alta da affaticato. Sviluppa lo sprint sotto fatica cumulativa (race-specific). Defaticamento esteso (~15–20 min Z1).",
    select_when: "Fase Peak per eventi con accelerazioni ripetute. Progressione da AN-2. Max una volta a settimana.",
  },
  // --- 1E. Mixed / Race-Specific --------------------------------------------
  {
    id: "MIX-1",
    title: "Simulazione a intensità variabile",
    domain: "race_specific",
    is_hard_session: true,
    work_minutes: 105,
    est_total_minutes: 105,
    zones: "Base Z2 con surge programmati a Z4–Z5",
    power_target_zone: "Z2 con surge Z4–Z5",
    hr_target_zone: "Z2 → Z4–Z5 nei surge",
    rpe_target: "variabile (RPE 4 base, 8–9 nei surge)",
    structure: "90–120 min Z2 con 6–8 × 2–3 min di surge a Z4–Z5 a intervalli irregolari (ogni 10–20 min). Ritorno a Z2 tra i surge (no Z1).",
    duration_label: "90–120 min totali",
    coaching_notes:
      "Simula le richieste variabili di gara su strada o uscite di gruppo. Lo stimolo chiave sono le transizioni ripetute da costante a duro e ritorno. I tratti Z2 devono restare davvero comodi.",
    select_when: "Build medio-tardiva o Peak. Fitness di soglia e VO₂max già consolidate. Non in fase Base.",
  },
  {
    id: "MIX-2",
    title: "Opener pre-gara",
    domain: "race_specific",
    is_hard_session: false,
    work_minutes: 52,
    est_total_minutes: 52,
    zones: "Base Z2 con brevi opener Z5–Z6",
    power_target_zone: "Z2 con opener Z5–Z6",
    hr_target_zone: "Z2 con brevi picchi",
    rpe_target: "RPE leggero, sensazioni «sharp»",
    structure: "45–60 min facili Z2 con 3 × 1 min a Z5, 2 × 30 s a Z6. Recupero pieno (3–5 min Z2) tra gli sforzi.",
    duration_label: "45–60 min totali",
    coaching_notes:
      "Seduta di attivazione, non di allenamento. Prepara i sistemi neuromuscolare e cardiovascolare senza generare fatica significativa. Deve sembrare sharp e facile.",
    select_when: "1–2 giorni prima dell'evento target, secondo il protocollo race-week.",
  },
  // --- 1F. Strength-Endurance — Low Cadence (Optional) ----------------------
  {
    id: "SE-1",
    title: "Tempo a bassa cadenza (opzionale)",
    domain: "strength_endurance",
    is_hard_session: true,
    work_minutes: 55,
    est_total_minutes: 85,
    zones: "Z3",
    power_target_zone: "Z3 (Tempo)",
    hr_target_zone: "Z3",
    rpe_target: "RPE 6 (muscolare)",
    structure: "4–6 × 8 min a Z3, 50–60 rpm, con 4 min Z1 (cadenza normale) tra gli intervalli",
    duration_label: "45–65 min di lavoro",
    coaching_notes:
      "La bassa cadenza impone più torque per pedalata reclutando fibre di tipo II. Stress al ginocchio più alto: ogni fastidio al ginocchio è stop immediato. Lo sforzo deve sembrare muscolare più che cardiovascolare.",
    select_when: "Base/Build iniziale per atleti che puntano a eventi collinari. Max una volta a settimana. Non sostituisce SS-1/SS-4.",
    optional: true,
  },
  {
    id: "SE-2",
    title: "Sweet Spot a bassa cadenza (opzionale/avanzato)",
    domain: "strength_endurance",
    is_hard_session: true,
    work_minutes: 45,
    est_total_minutes: 75,
    zones: "Z4-basso (Sweet Spot)",
    power_target_zone: "Sweet Spot (Z4-basso)",
    hr_target_zone: "Z3–Z4",
    rpe_target: "RPE 7–8 (muscolare)",
    structure: "3 × 10–12 min a Z4-basso, 55–65 rpm, con 5–6 min Z1 (cadenza normale) tra gli intervalli",
    duration_label: "40–50 min di lavoro",
    coaching_notes:
      "Combina le richieste muscolari della bassa cadenza con lo stress metabolico dello sweet spot. Più impegnativa di SE-1. Solo con esperienza sia di SE-1 sia di SS-1/SS-5. Readiness deve essere «go» pieno, mai su giornate «modify».",
    select_when: "Build medio per atleti con base in SE-1 e SS-1. Occupa uno slot di seduta strutturata. Max una volta a settimana.",
    optional: true,
  },
];

/** Mappa id → template per lookup O(1). */
const BY_ID: Record<string, WorkoutTemplate> = Object.fromEntries(
  WORKOUT_TEMPLATES.map((t) => [t.id, t])
);

/** Insieme dei library_id validi (per validazione del planner). */
export const VALID_LIBRARY_IDS: ReadonlySet<string> = new Set(
  WORKOUT_TEMPLATES.map((t) => t.id)
);

/** Ritorna il template per id, o null se non esiste in libreria. */
export function getTemplate(id: string): WorkoutTemplate | null {
  return BY_ID[id] ?? null;
}

/** true se l'id riferisce un template reale della libreria. */
export function isValidLibraryId(id: string): boolean {
  return VALID_LIBRARY_IDS.has(id);
}
