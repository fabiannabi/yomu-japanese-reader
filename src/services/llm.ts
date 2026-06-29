import { getApiKey, getModel } from "./settings.ts";

/**
 * "Explicar gramática" con la API de Claude, llamada directo desde el navegador
 * (cabecera anthropic-dangerous-direct-browser-access). La key la pone el usuario
 * y vive solo en IndexedDB. Es lo único de la app con costo (centavos).
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class MissingApiKeyError extends Error {
  constructor() {
    super("Falta la API key");
    this.name = "MissingApiKeyError";
  }
}

const SYSTEM_PROMPT = `Eres un tutor de japonés para un hispanohablante. Explicas la gramática de una oración japonesa de forma clara y breve, en español.
Estructura tu respuesta así:
1. Traducción natural de la oración al español.
2. Desglose de la estructura: partículas (は, を, に, で, が…), forma de los verbos y su función.
3. Un par de notas útiles si aplican (matices, registro, orden de palabras).
Sé conciso y didáctico. No uses markdown con encabezados grandes; usa texto plano y listas simples.`;

interface ClaudeContentBlock {
  type: string;
  text?: string;
}
interface ClaudeResponse {
  content?: ClaudeContentBlock[];
  stop_reason?: string;
  error?: { message?: string };
}

/**
 * Pide a Claude una explicación gramatical en español de una oración japonesa.
 * Lanza MissingApiKeyError si no hay key configurada.
 */
export async function explainGrammar(sentence: string): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  const model = await getModel();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Explica la gramática de esta oración japonesa:\n\n${sentence}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as ClaudeResponse;
      detail = body.error?.message ?? detail;
    } catch {
      /* sin cuerpo JSON */
    }
    if (res.status === 401) {
      throw new Error("API key inválida. Revísala en Ajustes.");
    }
    throw new Error(`Error de la API (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as ClaudeResponse;
  if (data.stop_reason === "refusal") {
    throw new Error("La IA no pudo responder a esta oración.");
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "Sin respuesta.";
}
