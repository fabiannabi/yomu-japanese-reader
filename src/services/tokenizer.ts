import kuromoji from "@aiktb/kuromoji/build/kuromoji.js";
import type { IpadicFeatures, Tokenizer } from "@aiktb/kuromoji";
import { kataToHira, hasKanji, hasJapanese } from "./kana.ts";

/** Un token listo para la UI del lector. */
export interface YomuToken {
  /** Texto tal como aparece en la oración. */
  surface: string;
  /** Lectura en hiragana (vacía si no aplica, p. ej. signos de puntuación). */
  reading: string;
  /** Forma de diccionario (lema) para el lookup; cae a `surface` si kuromoji no la da. */
  baseForm: string;
  /** Categoría gramatical principal (pos) de IPADIC. */
  pos: string;
  /** ¿Es una palabra de contenido candidata a resaltar y guardar? */
  isContent: boolean;
  /** ¿Necesita furigana (tiene kanji y lectura)? */
  needsFurigana: boolean;
}

// POS de IPADIC que NO son palabras de contenido (no se resaltan ni se guardan).
const FUNCTION_POS = new Set(["助詞", "助動詞", "記号", "フィラー", "その他"]);

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

/** Ruta del diccionario IPADIC servido desde /public/dict (respeta BASE_URL para GitHub Pages). */
function dicPath(): string {
  return `${import.meta.env.BASE_URL}dict`.replace(/\/{2,}/g, "/");
}

/** Inicializa (una sola vez) el tokenizador kuromoji. */
export function initTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: dicPath() }).build((err, tokenizer) => {
        if (err) {
          tokenizerPromise = null; // permitir reintento si falló la carga
          reject(err);
        } else {
          resolve(tokenizer);
        }
      });
    });
  }
  return tokenizerPromise;
}

function toYomuToken(f: IpadicFeatures): YomuToken {
  const surface = f.surface_form;
  const readingRaw = f.reading && f.reading !== "*" ? f.reading : "";
  const reading = kataToHira(readingRaw);
  const baseForm = f.basic_form && f.basic_form !== "*" ? f.basic_form : surface;
  const pos = f.pos ?? "";

  const isJa = hasJapanese(surface);
  const isContent = isJa && !FUNCTION_POS.has(pos);
  const needsFurigana = hasKanji(surface) && reading.length > 0;

  return { surface, reading, baseForm, pos, isContent, needsFurigana };
}

/** Tokeniza un texto japonés en tokens listos para la UI. */
export async function tokenize(text: string): Promise<YomuToken[]> {
  if (!text.trim()) return [];
  const tokenizer = await initTokenizer();
  return tokenizer.tokenize(text).map(toYomuToken);
}

/** Tokeniza devolviendo las características crudas de IPADIC (para análisis gramatical). */
export async function tokenizeRaw(text: string): Promise<IpadicFeatures[]> {
  if (!text.trim()) return [];
  const tokenizer = await initTokenizer();
  return tokenizer.tokenize(text);
}
