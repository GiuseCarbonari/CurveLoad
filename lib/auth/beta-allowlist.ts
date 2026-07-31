/**
 * Allowlist email per la beta (Passo 3): senza, chiunque trovi l'URL di
 * login potrebbe registrarsi. La lista vive in `BETA_ALLOWED_EMAILS`
 * (email separate da virgola), letta solo lato server. Se la variabile
 * manca o è vuota, blocca tutte le registrazioni (fail closed) invece di
 * lasciare la beta aperta per una dimenticanza di configurazione.
 */
export function isEmailAllowed(
  email: string,
  allowedEmailsEnv: string | undefined
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const allowed = (allowedEmailsEnv ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(normalizedEmail);
}
