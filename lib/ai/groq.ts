/**
 * Unico punto di chiamata all'API Groq (formato OpenAI chat completions) —
 * fetch grezzo, niente SDK: i call site previsti sono pochi e quasi identici
 * (un solo messaggio utente, nessuno streaming, nessun tool use), la
 * dipendenza non si guadagna il suo peso. Soglia di riconsiderazione
 * esplicita: se servono streaming, tool use o più di 5-6 call site,
 * reintrodurre un SDK.
 *
 * Scelta Groq (2026-07-31): tier gratuito senza carta (~30 req/min,
 * ~1.000 req/giorno), nessun training sui dati, retention zero attivabile.
 * La versione Anthropic di questo file vive nella storia git
 * (lib/ai/anthropic.ts, pre-Passo 1) — tornare a Claude resta un cambio
 * di questo solo file.
 */

export const DEFAULT_AI_MODEL = "llama-3.3-70b-versatile";

export class GroqCallError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GroqCallError";
  }
}

export interface CallLlmParams {
  apiKey: string;
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Chiama l'API chat completions e restituisce il testo della risposta.
 * Nessun retry automatico: a questo volume un 429 non è un problema reale;
 * se il cron futuro mostrerà rate limit veri, aggiungere un retry fisso di
 * 1-2s qui, non una libreria.
 */
export async function callLlm({
  apiKey,
  system,
  userMessage,
  model = DEFAULT_AI_MODEL,
  maxTokens = 700,
}: CallLlmParams): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GroqCallError(
      response.status,
      `Groq API ${response.status}: ${detail.slice(0, 300)}`
    );
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) {
    throw new GroqCallError(502, "Risposta Groq senza testo");
  }
  return text;
}
