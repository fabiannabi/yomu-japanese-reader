import { db, type KnownWord } from "../data/db.ts";

/**
 * Modelo del estudiante (§6): el conjunto de palabras dominadas.
 * Si una palabra está aquí, NO se resalta en el lector.
 */

/** Marca una palabra como conocida (idempotente). */
export async function addKnownWord(word: string): Promise<void> {
  if (!word) return;
  const row: KnownWord = { word, addedAt: Date.now() };
  await db.knownWords.put(row);
}

/** Quita una palabra del conjunto de conocidas. */
export async function removeKnownWord(word: string): Promise<void> {
  await db.knownWords.delete(word);
}

/** ¿La palabra ya es conocida? */
export async function isKnown(word: string): Promise<boolean> {
  return (await db.knownWords.get(word)) !== undefined;
}

/** Conjunto de todas las palabras conocidas (para resaltar un texto completo). */
export async function getKnownSet(): Promise<Set<string>> {
  const all = await db.knownWords.toArray();
  return new Set(all.map((k) => k.word));
}

/** Cuántas palabras dominadas hay. */
export async function countKnown(): Promise<number> {
  return db.knownWords.count();
}
