"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Pagina /login — autenticazione Supabase (email + password).
 *
 * Solo la UI è cambiata rispetto alla versione MVP: tab Accedi/Registrati,
 * card centrata, stile Coach IA chiaro. La logica di auth resta invariata —
 * signInWithPassword / signUp, poi redirect a /dashboard dove il middleware
 * decide se mandare l'utente a /connect (Intervals non ancora collegato).
 */

type Mode = "signin" | "signup";

/**
 * Traduce in italiano i messaggi d'errore Supabase più comuni. Supabase
 * risponde in inglese: mappiamo sul testo del messaggio invece che su codici
 * (l'SDK auth non espone codici stabili per questi casi).
 */
function localizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email o password non corretti";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Email già registrata";
  }
  if (m.includes("password should be at least") || m.includes("password")) {
    return "Password troppo corta (min 8 caratteri)";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(localizeError(error.message));
      return;
    }
    // Il middleware deciderà se mandare a /connect o /dashboard.
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(localizeError(error.message));
      return;
    }
    // Se la conferma email è attiva sul progetto Supabase, signUp non crea
    // una sessione: l'utente deve prima cliccare il link ricevuto.
    if (!data.session) {
      setNotice(
        "Registrazione avviata: controlla la tua email per confermare l'account."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setNotice(null);
  }

  const isSignin = mode === "signin";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F6] px-4 py-10">
      <div className="w-full max-w-[420px] rounded-lg border-[0.5px] border-border bg-white p-8 shadow-sm">
        {/* 1. Logo / nome */}
        <div className="mb-6 text-center">
          <p className="text-[20px] font-medium tracking-tight text-foreground">
            Coach IA
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Il tuo coach endurance basato su dati reali
          </p>
        </div>

        {/* 2. Tab toggle Accedi / Registrati */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-md bg-[#F7F7F6] p-1">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`rounded-[6px] py-1.5 text-[13px] font-medium transition-colors ${
              isSignin
                ? "border-[0.5px] border-border bg-secondary text-foreground"
                : "border-[0.5px] border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Accedi
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-[6px] py-1.5 text-[13px] font-medium transition-colors ${
              !isSignin
                ? "border-[0.5px] border-border bg-secondary text-foreground"
                : "border-[0.5px] border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Registrati
          </button>
        </div>

        {/* 3. Form */}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (isSignin ? handleSignIn() : handleSignUp());
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] text-muted-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border-[0.5px] border-border bg-white px-3 text-sm outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[13px] text-muted-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md border-[0.5px] border-border bg-white px-3 text-sm outline-none transition-colors focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
            />
          </div>

          {/* 6. Box errore */}
          {error && (
            <div className="rounded-md border-[0.5px] border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* Avviso non-bloccante (es. conferma email su registrazione) */}
          {notice && (
            <div className="rounded-md border-[0.5px] border-border bg-[#F7F7F6] px-3 py-2 text-[13px] text-muted-foreground">
              {notice}
            </div>
          )}

          {/* 4. Bottone primario "success" */}
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-md border-[0.5px] border-green-600 bg-white text-sm font-medium text-green-700 transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading
              ? "Attendere…"
              : isSignin
                ? "Accedi"
                : "Crea account"}
          </button>

          {/* 5. Password dimenticata — solo tab Accedi.
              Visivo per ora: il flusso di reset non è ancora in scope, quindi
              niente route dedicata (resta un placeholder non navigante). */}
          {isSignin && (
            <div className="text-center">
              <button
                type="button"
                className="text-[12px] text-muted-foreground/70 hover:text-muted-foreground"
              >
                Password dimenticata?
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
