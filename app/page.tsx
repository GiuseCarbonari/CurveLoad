import { Button } from "@/components/ui/button";

/**
 * Landing page (Milestone 0, attivata in Milestone 1).
 *
 * Il bottone porta a /login (sessione Supabase): da lì il middleware guida
 * l'utente verso /connect per il collegamento OAuth a Intervals.icu.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-base px-4 py-10">
      <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[11px] bg-amber text-xl font-bold text-amber-on">
          C
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">
          Coach IA
        </h1>
        <p className="max-w-xl text-lg text-secondary">
          Il tuo coach endurance basato sul protocollo Section 11. Accedi con
          il tuo account Intervals.icu, ricevi ogni giorno una decisione chiara
          sul tuo allenamento e un programma costruito sui tuoi dati reali.
        </p>
      </div>

      <Button asChild size="lg">
        <a href="/login">Accedi con Intervals.icu</a>
      </Button>

      <p className="max-w-md text-center text-sm text-muted">
        Più dati hai su Intervals.icu, più il coach sarà preciso. Nessuna
        metrica inventata: ogni numero viene dai tuoi dati reali.
      </p>
    </main>
  );
}
