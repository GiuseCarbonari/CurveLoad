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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold tracking-tight">
        Collega Intervals.icu
      </h1>
      <p className="max-w-md text-center text-muted-foreground">
        Connetti il tuo account Intervals.icu per iniziare.
      </p>
      <Button asChild size="lg">
        <a href="/api/auth/intervals/login">Connetti Intervals.icu</a>
      </Button>
    </main>
  );
}
