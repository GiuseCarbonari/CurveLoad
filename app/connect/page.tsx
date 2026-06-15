import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

/**
 * Pagina /connect — invito a collegare Intervals.icu (Milestone 1, punto 5).
 *
 * Ci si arriva dal middleware quando l'utente è autenticato su Supabase ma
 * non ha ancora una riga in intervals_connections. Il bottone avvia il
 * flusso OAuth (GET /api/auth/intervals/login → consent page Intervals).
 */
export default function ConnectPage() {
  return (
    <AppShell className="items-center justify-center">
      <section className="panel flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Collega Intervals.icu
        </h1>
        <p className="max-w-md text-secondary">
          Connetti il tuo account Intervals.icu per iniziare.
        </p>
        <Button asChild size="lg">
          <a href="/api/auth/intervals/login">Connetti Intervals.icu</a>
        </Button>
      </section>
    </AppShell>
  );
}
