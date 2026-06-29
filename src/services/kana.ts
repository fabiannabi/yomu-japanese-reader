// Utilidades de kana: kuromoji devuelve lecturas en katakana; las mostramos en hiragana.

/** Convierte katakana a hiragana (rango U+30A1–U+30F6). Deja el resto intacto. */
export function kataToHira(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

const HIRAGANA = /[぀-ゟ]/;
const KATAKANA = /[゠-ヿ]/;
const KANJI = /[一-龯㐀-䶿]/;

/** ¿La cadena contiene al menos un kanji? */
export function hasKanji(s: string): boolean {
  return KANJI.test(s);
}

/** ¿La cadena es íntegramente kana (hiragana o katakana) y/o marcas largas? */
export function isAllKana(s: string): boolean {
  for (const ch of s) {
    if (!HIRAGANA.test(ch) && !KATAKANA.test(ch) && ch !== "ー") return false;
  }
  return s.length > 0;
}

/** ¿Contiene algún caracter japonés (kana o kanji)? */
export function hasJapanese(s: string): boolean {
  return HIRAGANA.test(s) || KATAKANA.test(s) || KANJI.test(s);
}
