// Verificación de la lógica pura de la Fase 1 (sin navegador ni IndexedDB).
// Ejecutar: node --experimental-strip-types scripts/selftest.ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { kataToHira, isAllKana, hasKanji } from "../src/services/kana.ts";
import { wordToEntries, parseJmdict } from "../src/data/jmdict.ts";
import { chooseBest } from "../src/services/dictionary.ts";
import type { DictEntry } from "../src/data/db.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ok  ${msg}`);
  } else {
    failed++;
    console.error(`FAIL  ${msg}`);
  }
}

// --- kana ---
assert(kataToHira("ニホン") === "にほん", "kataToHira convierte katakana a hiragana");
assert(kataToHira("こんにちは") === "こんにちは", "kataToHira deja hiragana intacto");
assert(isAllKana("ことば") === true, "isAllKana detecta kana puro");
assert(hasKanji("言葉") === true, "hasKanji detecta kanji");
assert(hasKanji("ことば") === false, "hasKanji falso en kana puro");

// --- carga del seed + transformación ---
const here = dirname(fileURLToPath(import.meta.url));
const seed = parseJmdict(
  await readFile(resolve(here, "../public/dict-seed.json"), "utf8")
);
assert(seed.words.length > 50, `seed tiene ${seed.words.length} palabras`);

// Construye un índice en memoria igual que haría IndexedDB.
const index = new Map<string, DictEntry[]>();
for (const w of seed.words) {
  for (const e of wordToEntries(w)) {
    const list = index.get(e.key) ?? [];
    list.push(e);
    index.set(e.key, list);
  }
}

function lookup(key: string, reading?: string) {
  return chooseBest(index.get(key) ?? [], reading);
}

// 言葉 indexado por escritura y por lectura, con significado y lectura correctos.
const byKanji = lookup("言葉");
assert(!!byKanji, "lookup por kanji 言葉 encuentra entrada");
assert(byKanji?.reading === "ことば", "言葉 tiene lectura ことば");
assert(/word|language/.test(byKanji?.meaning ?? ""), `言葉 tiene significado: "${byKanji?.meaning}"`);

const byKana = lookup("ことば");
assert(byKana?.word === "言葉", "lookup por lectura ことば apunta a 言葉");

// Verbo con forma de diccionario.
const taberu = lookup("食べる");
assert(taberu?.reading === "たべる" && /eat/.test(taberu?.meaning ?? ""), "食べる -> たべる / to eat");

// Una palabra que no existe devuelve undefined.
assert(lookup("存在しない単語") === undefined, "palabra inexistente -> undefined");

console.log(failed === 0 ? "\nTODO OK" : `\n${failed} fallo(s)`);
process.exit(failed === 0 ? 0 : 1);
