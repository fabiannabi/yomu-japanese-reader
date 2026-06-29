import { countKnown } from "./known-words.ts";
import { countDeck, countDue } from "./deck.ts";

export interface ProgressStats {
  known: number; // palabras dominadas
  deck: number; // tarjetas en el mazo
  due: number; // por repasar
}

export async function getProgressStats(): Promise<ProgressStats> {
  const [known, deck, due] = await Promise.all([
    countKnown(),
    countDeck(),
    countDue(),
  ]);
  return { known, deck, due };
}

/** % de comprensión de un texto: palabras de contenido conocidas ÷ total. */
export function comprehension(known: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((known / total) * 100);
}
