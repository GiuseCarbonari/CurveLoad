import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";

/**
 * Astrazione provider AI per i tre commenti (OGGI, PROFILO, PERCORSO).
 *
 * Switch tra Anthropic (default) e Groq (env COACH_AI_PROVIDER=groq).
 * Max tokens: 300/comment (tight budget → ≤150 words output).
 * Nessun numero inventato — solo spiegazione e consigli dai dati forniti.
 */

export type CommentSection = "oggi" | "profilo" | "percorso";

export interface AICommentInput {
  section: CommentSection;
  payload: Record<string, unknown>;
}

export interface AICommentOutput {
  comment: string;
  tokens_used: { prompt: number; completion: number };
}

/** Verifica se AI è configurata (chiave presente). */
export function isAIConfigured(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY;
  return Boolean(apiKey);
}

/**
 * Genera commento per sezione. Switch automatico Anthropic/Groq.
 * Lancia "AI_NOT_CONFIGURED" se nessuna API key.
 */
export async function generateComment(input: AICommentInput): Promise<AICommentOutput> {
  const provider = process.env.COACH_AI_PROVIDER || "anthropic";

  if (provider === "groq") {
    return generateCommentGroq(input);
  }
  return generateCommentAnthropic(input);
}

// --- ANTHROPIC -----------------------------------------------------------------

const MODEL_ANTHROPIC = "claude-sonnet-4-6";
const MAX_TOKENS = 300;

const SYSTEM_PROMPTS: Record<CommentSection, string> = {
  oggi: `Sei un coach ciclismo esperto. Analizza lo stato dell'atleta OGGI e dai 3-4 consigli pratici. Commenta readiness, forma, fatica, freschezza, HRV, sonno. Se infortunato, consiglia SOLO prudenza e programma medico, no allenamenti. Tono incoraggiante, italiano, max 150 parole.`,
  profilo: `Sei un coach. Commenta il profilo di potenza dell'atleta (fenotipo, CP/W′, RPP trend). Spiega cosa significa il fenotipo, punti forti e limitatori, trend RPP nei 14gg. Non inventi numeri. Tono incoraggiante, italiano, max 150 parole.`,
  percorso: `Sei un coach. Analizza la gara target con altimetria, nutrizione e pacing. Spiega dove sarà impegnativo, strategia nutrizionale, come affrontare in base al fenotipo, piano di recupero post-gara. Tono motivante, italiano, max 200 parole.`,
};

async function generateCommentAnthropic(input: AICommentInput): Promise<AICommentOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL_ANTHROPIC,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPTS[input.section],
    messages: [
      {
        role: "user",
        content: `Ecco i dati già calcolati (in JSON). Commenta usando SOLO questi numeri, non aggiungerne altri.\n\n${JSON.stringify(input.payload, null, 2)}`,
      },
    ],
  });

  const comment = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return {
    comment,
    tokens_used: {
      prompt: response.usage?.input_tokens || 0,
      completion: response.usage?.output_tokens || 0,
    },
  };
}

// --- GROQ -----------------------------------------------------------------------

async function generateCommentGroq(input: AICommentInput): Promise<AICommentOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");

  const groq = new Groq({ apiKey });

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPTS[input.section],
      },
      {
        role: "user",
        content: `Ecco i dati già calcolati (in JSON). Commenta usando SOLO questi numeri, non aggiungerne altri.\n\n${JSON.stringify(input.payload, null, 2)}`,
      },
    ],
  });

  const comment = response.choices[0]?.message?.content || "";

  return {
    comment,
    tokens_used: {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
    },
  };
}
