import { tokenize, type YomuToken } from "./tokenizer.ts";
import { lookup, type LookupResult } from "./dictionary.ts";

/** Token del lector enriquecido con la entrada de diccionario (si existe). */
export interface AnnotatedToken extends YomuToken {
  entry?: LookupResult;
}

/**
 * Función central de la Fase 1: dado un texto japonés, devuelve sus tokens con
 * lectura (furigana) y significado desde el diccionario local.
 */
export async function analyzeText(text: string): Promise<AnnotatedToken[]> {
  const tokens = await tokenize(text);

  const results = await Promise.all(
    tokens.map((t) =>
      t.isContent ? lookup(t.baseForm, t.surface, t.reading) : undefined
    )
  );

  return tokens.map((t, i) => ({ ...t, entry: results[i] }));
}
