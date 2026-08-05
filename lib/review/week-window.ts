import { isoWeekStart } from "@/lib/efficiency-trend";

/**
 * Finestra della settimana da recensire — sempre l'ultima settimana ISO
 * (lunedì-domenica) GIÀ CHIUSA rispetto a "oggi", mai quella in corso.
 * Funzione pura: `todayIso` è un parametro esplicito, mai `new Date()` letto
 * a sorpresa dentro la logica (testabile a tavolino).
 */

export interface WeekWindow {
  weekStart: string; // lunedì, YYYY-MM-DD
  weekEnd: string; // domenica, YYYY-MM-DD
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Settimana chiusa più recente rispetto a `todayIso` (default: oggi). */
export function lastClosedWeek(
  todayIso: string = new Date().toISOString().slice(0, 10)
): WeekWindow {
  const currentWeekStart = isoWeekStart(todayIso);
  const weekStart = addDaysIso(currentWeekStart, -7);
  const weekEnd = addDaysIso(weekStart, 6);
  return { weekStart, weekEnd };
}

/** true se `dateIso` (YYYY-MM-DD o ISO completo) cade dentro la finestra. */
export function isInWeek(dateIso: string, week: WeekWindow): boolean {
  const d = dateIso.slice(0, 10);
  return d >= week.weekStart && d <= week.weekEnd;
}
