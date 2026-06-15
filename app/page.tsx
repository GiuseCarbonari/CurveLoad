import { Button } from "@/components/ui/button";

/**
 * Landing pubblica. L'account Coach IA e il collegamento a Intervals.icu
 * sono due passaggi distinti e vengono descritti come tali.
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
          Il tuo coach endurance basato sul protocollo Section 11. Crea il tuo
          account Coach IA e collega Intervals.icu per ricevere ogni giorno una
          decisione chiara e un programma costruito sui tuoi dati reali.
        </p>
      </div>

      <Button asChild size="lg">
        <a href="/login">Accedi a Coach IA</a>
      </Button>

      <p className="max-w-md text-center text-sm text-muted">
        Non hai ancora un account? Potrai registrarti nella schermata
        successiva e collegare Intervals.icu subito dopo.
      </p>
    </main>
  );
}
