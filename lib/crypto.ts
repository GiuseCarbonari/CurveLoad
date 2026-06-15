import crypto from "crypto";

/**
 * Cifratura dei token OAuth a riposo (PRD §9.4, §24.2).
 *
 * Perché AES-256-GCM: cifratura autenticata — oltre alla confidenzialità
 * garantisce l'integrità (l'auth tag rileva qualsiasi manomissione del
 * ciphertext nel DB). L'access token Intervals è permanente (niente refresh
 * token), quindi un token in chiaro compromesso resterebbe valido per
 * sempre: la cifratura applicativa prima dell'INSERT è obbligatoria.
 *
 * Formato di output: "iv.ciphertext.authTag" (base64, separati da punto).
 * L'IV è casuale per ogni cifratura: mai riusare un IV con la stessa chiave
 * in GCM.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bit, dimensione raccomandata per GCM

/**
 * Legge e valida TOKEN_ENCRYPTION_KEY (32 byte in base64).
 * Fallisce subito e in modo esplicito se la chiave manca o è malformata:
 * meglio un errore chiaro che un token salvato in chiaro per errore.
 */
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY non configurata in .env.local");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY deve essere 32 byte in base64 (genera con: openssl rand -base64 32)"
    );
  }
  return key;
}

/** Cifra un token prima del salvataggio nel database. */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(".");
}

/** Decifra un token letto dal database. Lancia se il dato è stato manomesso. */
export function decryptToken(encoded: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 3) {
    throw new Error("Token cifrato in formato non valido");
  }
  const [iv, ciphertext, authTag] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
