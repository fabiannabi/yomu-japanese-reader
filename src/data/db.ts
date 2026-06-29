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
  word: string;
  reading: string;
  meaning: string;
}

export interface Settings {
  id: string; // siempre "app"
  apiKey?: string;
  model?: string;
  sources?: string[];
}

export class YomuDB extends Dexie {
  knownWords!: Table<KnownWord, string>;
  deck!: Table<DeckCard, number>;
  dict!: Table<DictEntry, number>;
  settings!: Table<Settings, string>;

  constructor() {
    super("yomu");
    this.version(1).stores({
      knownWords: "word, addedAt",
      deck: "++id, word, due, state",
      dict: "++id, key, word",
      settings: "id",
    });
  }
}

export const db = new YomuDB();
