import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { DeckCard } from "../data/db.ts";

/**
 * Repetición espaciada con FSRS (ts-fsrs). Mapea entre la `Card` de ts-fsrs
 * (con fechas Date) y nuestra `DeckCard` (fechas en ms epoch).
 */

const scheduler = fsrs();

/** Una tarjeta se "gradúa" (pasa a knownWords) al llegar a Review con intervalo maduro. */
export const GRADUATE_DAYS = 21;

/** Calificaciones que mostramos en el repaso (§7: otra vez / bien / fácil). */
export interface UiRating {
  key: "again" | "good" | "easy";
  label: string;
  rating: Grade;
}
export const UI_RATINGS: UiRating[] = [
  { key: "again", label: "Otra vez", rating: Rating.Again },
  { key: "good", label: "Bien", rating: Rating.Good },
  { key: "easy", label: "Fácil", rating: Rating.Easy },
];

function cardToDeckFields(c: Card): Omit<DeckCard, "id" | "word" | "reading" | "meaning"> {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learningSteps: c.learning_steps,
    state: c.state,
    lastReview: c.last_review ? c.last_review.getTime() : undefined,
  };
}

/** Reconstruye la `Card` de ts-fsrs a partir de una `DeckCard`. */
export function toFsrsCard(d: DeckCard): Card {
  return {
    due: new Date(d.due),
    stability: d.stability,
    difficulty: d.difficulty,
    elapsed_days: d.elapsedDays,
    scheduled_days: d.scheduledDays,
    reps: d.reps,
    lapses: d.lapses,
    learning_steps: d.learningSteps,
    state: d.state as State,
    last_review: d.lastReview ? new Date(d.lastReview) : undefined,
  };
}

/** Crea una tarjeta nueva (estado New) lista para FSRS. */
export function emptyDeckCard(
  word: string,
  reading: string,
  meaning: string,
  now: Date = new Date()
): DeckCard {
  const c = createEmptyCard(now);
  return { word, reading, meaning, ...cardToDeckFields(c) };
}

export interface GradeResult {
  card: DeckCard;
  graduated: boolean;
}

/** Califica una tarjeta y devuelve la versión reprogramada + si se graduó. */
export function gradeDeckCard(
  d: DeckCard,
  rating: Grade,
  now: Date = new Date()
): GradeResult {
  const { card } = scheduler.next(toFsrsCard(d), now, rating);
  const updated: DeckCard = {
    ...d,
    ...cardToDeckFields(card),
  };
  const graduated =
    card.state === State.Review && card.scheduled_days >= GRADUATE_DAYS;
  return { card: updated, graduated };
}

/** Etiqueta legible del próximo intervalo para una calificación (para los botones). */
export function nextIntervalLabel(
  d: DeckCard,
  rating: Grade,
  now: Date = new Date()
): string {
  const { card } = scheduler.next(toFsrsCard(d), now, rating);
  const ms = card.due.getTime() - now.getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  return `${months} mes${months === 1 ? "" : "es"}`;
}
