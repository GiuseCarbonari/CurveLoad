import { Button } from "@/components/ui/button";

/**
 * Landing page (Milestone 0, attivata in Milestone 1).
 *
 * Il bottone porta a /login (sessione Supabase): da lì il middleware guida
 * l'utente verso /connect per il collegamento OAuth a Intervals.icu.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Coach IA</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Il tuo coach endurance basato sul protocollo Section 11. Accedi con
          il tuo account Intervals.icu, ricevi ogni giorno una decisione chiara
          sul tuo allenamento e un programma costruito sui tuoi dati reali.
        </p>
      </div>

      <Button asChild size="lg">
        <a href="/login">Accedi con Intervals.icu</a>
      </Button>

      <p className="max-w-md text-center text-sm text-muted-foreground">
        Più dati hai su Intervals.icu, più il coach sarà preciso. Nessuna
        metrica inventata: ogni numero viene dai tuoi dati reali.
      </p>
    </main>
  );
}
