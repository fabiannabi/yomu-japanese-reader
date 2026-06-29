import { db, type DictEntry } from "../data/db.ts";

export interface LookupResult {
  word: string;
  reading: string;
  meaning: string;
  pos?: string;
  common?: boolean;
}

/**
 * Elige la mejor entrada entre varias candidatas para una clave.
 * Prioriza: lectura coincidente con el token > marcada como común > primera.
 * Función pura (testeable sin IndexedDB).
 */
export function chooseBest(
  entries: DictEntry[],
  hintReading?: string
): DictEntry | undefined {
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];

  const scored = entries.map((e) => {
    let score = 0;
    if (hintReading && e.reading === hintReading) score += 4;
    if (e.common) score += 2;
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].e;
}

function toResult(e: DictEntry): LookupResult {
  return {
    word: e.word,
    reading: e.reading,
    meaning: e.meaning,
    pos: e.pos,
    common: e.common,
  };
}

/**
 * Busca una palabra en el diccionario local.
 * Prueba en orden: forma base, superficie, lectura. Devuelve la mejor coincidencia.
 */
export async function lookup(
  baseForm: string,
  surface?: string,
  reading?: string
): Promise<LookupResult | undefined> {
  const candidates = [baseForm, surface, reading].filter(
    (k): k is string => !!k
  );

  for (const key of candidates) {
    const entries = await db.dict.where("key").equals(key).toArray();
    const best = chooseBest(entries, reading);
    if (best) return toResult(best);
  }
  return undefined;
}

/** Variante para varias palabras a la vez (útil para el lector). */
export async function lookupMany(
  queries: { baseForm: string; surface?: string; reading?: string }[]
): Promise<(LookupResult | undefined)[]> {
  return Promise.all(
    queries.map((q) => lookup(q.baseForm, q.surface, q.reading))
  );
}
