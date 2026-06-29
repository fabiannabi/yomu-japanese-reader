import Dexie, { type Table } from "dexie";

/**
 * Modelo de datos (§6 de CLAUDE.md).
 * Los stores se definen aquí desde la Fase 0; las Fases 1–3 los pueblan y usan.
 */

export interface KnownWord {
  word: string; // clave: escritura base de la palabra dominada
  addedAt: number;
}

export interface DeckCard {
  id?: number;
  word: string;
  reading: string;
  meaning: string;
  // Campos FSRS (se rellenan en la Fase 3 con ts-fsrs)
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
}

export interface DictEntry {
  id?: number;
  key: string; // escritura o lectura, normalizada para lookup
  word: string; // forma principal a mostrar (kanji si existe, si no kana)
  reading: string; // lectura principal en kana
  meaning: string; // glosas unidas (p. ej. "language; word; phrase")
  pos?: string; // categoría(s) gramatical(es), legibles
  common?: boolean; // si la entrada está marcada como común en JMdict
}

export interface Settings {
  id: string; // siempre "app"
  apiKey?: string;
  model?: string;
  sources?: string[];
}

/** Bookkeeping interno clave-valor (estado de carga del diccionario, versiones, etc.). */
export interface Meta {
  key: string;
  value: unknown;
}

export class YomuDB extends Dexie {
  knownWords!: Table<KnownWord, string>;
  deck!: Table<DeckCard, number>;
  dict!: Table<DictEntry, number>;
  settings!: Table<Settings, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("yomu");
    this.version(1).stores({
      knownWords: "word, addedAt",
      deck: "++id, word, due, state",
      dict: "++id, key, word",
      settings: "id",
    });
    // v2: store de bookkeeping para el estado del diccionario (Fase 1).
    this.version(2).stores({
      meta: "key",
    });
  }
}

export const db = new YomuDB();
