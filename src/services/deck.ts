import { db, type DeckCard } from "../data/db.ts";

/**
 * Mazo de tarjetas (§6). En la Fase 2 se crean tarjetas nuevas; el algoritmo de
 * repaso FSRS (ts-fsrs) que reprograma `due`/`stability`/etc. llega en la Fase 3.
 *
 * Los campos siguen el modelo de FSRS: state 0 = New, due = ahora para repaso inmediato.
 */

/** Crea una tarjeta nueva en estado "New" lista para FSRS. */
export function newCard(word: string, reading: string, meaning: string): DeckCard {
  return {
    word,
    reading,
    meaning,
    due: Date.now(),
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
  };
}

/** ¿La palabra ya está en el mazo? */
export async function isInDeck(word: string): Promise<boolean> {
  return (await db.deck.where("word").equals(word).count()) > 0;
}

/**
 * Añade una palabra al mazo si no existe ya. Devuelve true si se añadió,
 * false si ya estaba.
 */
export async function addToDeck(
  word: string,
  reading: string,
  meaning: string
): Promise<boolean> {
  if (!word) return false;
  if (await isInDeck(word)) return false;
  await db.deck.add(newCard(word, reading, meaning));
  return true;
}

/** Número de tarjetas en el mazo. */
export async function countDeck(): Promise<number> {
  return db.deck.count();
}

/** Conjunto de palabras que ya están en el mazo (para el resaltado del lector). */
export async function getDeckWordSet(): Promise<Set<string>> {
  const all = await db.deck.toArray();
  return new Set(all.map((c) => c.word));
}

/** Tarjetas vencidas (due <= ahora). Base del contador "por repasar". */
export async function countDue(now = Date.now()): Promise<number> {
  return db.deck.where("due").belowOrEqual(now).count();
}
