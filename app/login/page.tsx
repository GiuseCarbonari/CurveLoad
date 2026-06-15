"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Pagina /login — autenticazione Supabase (email + password).
 *
 * Minima per Milestone 1: serve solo a stabilire la sessione Supabase a cui
 * il callback OAuth aggancia la connessione Intervals. L'onboarding completo
 * (PRD §12) arriverà in un milestone successivo.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    // Il middleware deciderà se mandare a /connect o /dashboard.
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    // Se la conferma email è attiva sul progetto Supabase, signUp non crea
    // una sessione: l'utente deve prima cliccare il link ricevuto.
    if (!data.session) {
      setMessage(
        "Registrazione avviata: controlla la tua email per confermare l'account."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold tracking-tight">Accedi a Coach IA</h1>

      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSignIn();
        }}
      >
        <input
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 caratteri)"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />

        <Button type="submit" disabled={loading}>
          Accedi
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => void handleSignUp()}
        >
          Registrati
        </Button>
      </form>

      {message && (
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </main>
  );
}
