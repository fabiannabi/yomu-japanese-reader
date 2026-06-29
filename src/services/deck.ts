import { db, type DeckCard } from "../data/db.ts";
import { emptyDeckCard, gradeDeckCard } from "./srs.ts";
import { addKnownWord } from "./known-words.ts";
import type { Grade } from "ts-fsrs";

/**
 * Mazo de tarjetas (§6) con repaso espaciado FSRS.
 * Al graduar una tarjeta, su palabra se mueve a knownWords y la tarjeta sale del mazo.
 */

/** ¿La palabra ya está en el mazo? */
export async function isInDeck(word: string): Promise<boolean> {
  return (await db.deck.where("word").equals(word).count()) > 0;
}

/** Añade una palabra al mazo si no existe. Devuelve true si se añadió. */
export async function addToDeck(
  word: string,
  reading: string,
  meaning: string
): Promise<boolean> {
  if (!word) return false;
  if (await isInDeck(word)) return false;
  await db.deck.add(emptyDeckCard(word, reading, meaning));
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

/** Tarjetas vencidas (due <= ahora), orden por vencimiento. */
export async function getDueCards(now = Date.now()): Promise<DeckCard[]> {
  return db.deck.where("due").belowOrEqual(now).sortBy("due");
}

/** Número de tarjetas vencidas ("por repasar"). */
export async function countDue(now = Date.now()): Promise<number> {
  return db.deck.where("due").belowOrEqual(now).count();
}

export interface ReviewOutcome {
  graduated: boolean;
  word: string;
}

/**
 * Califica una tarjeta del mazo: reprograma con FSRS y persiste. Si se gradúa,
 * mueve la palabra a knownWords y elimina la tarjeta del mazo.
 */
export async function reviewCard(
  card: DeckCard,
  rating: Grade,
  now: Date = new Date()
): Promise<ReviewOutcome> {
  const { card: updated, graduated } = gradeDeckCard(card, rating, now);

  if (graduated) {
    await addKnownWord(card.word);
    if (card.id !== undefined) await db.deck.delete(card.id);
  } else {
    await db.deck.put(updated);
  }
  return { graduated, word: card.word };
}
