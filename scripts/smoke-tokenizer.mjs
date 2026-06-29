// Prueba end-to-end del tokenizador: usa el MISMO bundle de navegador de kuromoji
// que la app, cargando el diccionario desde el dev server (http://localhost:5173/dict).
// Requiere `npm run dev` corriendo. Node 24 trae fetch global.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const kuromoji = require("@aiktb/kuromoji/build/kuromoji.js");

const DIC = "http://localhost:5173/dict";

function kataToHira(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    out += c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
  }
  return out;
}

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: DIC }).build((err, t) => (err ? reject(err) : resolve(t)));
});

const sample = "日本語を勉強する。今日はいい天気です。";
const tokens = tokenizer.tokenize(sample);

console.log(`Oración: ${sample}\n`);
for (const t of tokens) {
  const reading = t.reading && t.reading !== "*" ? kataToHira(t.reading) : "—";
  const base = t.basic_form && t.basic_form !== "*" ? t.basic_form : t.surface_form;
  console.log(`  ${t.surface_form.padEnd(5)} lectura:${reading.padEnd(8)} base:${base.padEnd(6)} pos:${t.pos}`);
}
console.log(`\n${tokens.length} tokens. Tokenizador OK.`);
