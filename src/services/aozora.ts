/**
 * Aozora Bunko (青空文庫): literatura japonesa de dominio público.
 * Se sirve desde el mirror de GitHub vía jsDelivr (con CORS). Los archivos están
 * en Shift-JIS y traen el furigana en <rt>/<rp>, que se elimina para dejar el
 * texto base (el tokenizer luego genera su propia lectura).
 *
 * No hay API de búsqueda pública, así que se ofrece una lista curada de clásicos
 * cuyas rutas están verificadas.
 */

export interface AozoraWork {
  title: string;
  author: string;
  path: string; // ruta dentro del repo aozorabunko/aozorabunko
}

export const AOZORA_WORKS: AozoraWork[] = [
  { title: "羅生門", author: "芥川龍之介", path: "cards/000879/files/127_15260.html" },
  { title: "蜘蛛の糸", author: "芥川龍之介", path: "cards/000879/files/92_14545.html" },
  { title: "走れメロス", author: "太宰治", path: "cards/000035/files/1567_14913.html" },
  { title: "人間失格", author: "太宰治", path: "cards/000035/files/301_14912.html" },
  { title: "こころ", author: "夏目漱石", path: "cards/000148/files/773_14560.html" },
  { title: "吾輩は猫である", author: "夏目漱石", path: "cards/000148/files/789_14547.html" },
  { title: "坊っちゃん", author: "夏目漱石", path: "cards/000148/files/752_14964.html" },
  { title: "注文の多い料理店", author: "宮沢賢治", path: "cards/000081/files/43754_17659.html" },
  { title: "セロ弾きのゴーシュ", author: "宮沢賢治", path: "cards/000081/files/470_15407.html" },
  { title: "檸檬", author: "梶井基次郎", path: "cards/000074/files/424_19826.html" },
  { title: "ごん狐", author: "新美南吉", path: "cards/000121/files/628_14895.html" },
];

const CDN = "https://cdn.jsdelivr.net/gh/aozorabunko/aozorabunko@master/";

/** Descarga y limpia el texto de una obra (decodifica Shift-JIS, quita furigana). */
export async function fetchAozoraText(path: string): Promise<string> {
  const res = await fetch(`${CDN}${path}`);
  if (!res.ok) throw new Error(`No se pudo cargar la obra (${res.status})`);

  const buffer = await res.arrayBuffer();
  const html = new TextDecoder("shift_jis").decode(buffer);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.querySelector(".main_text") ?? doc.body;

  // Quita las lecturas (furigana) para quedarnos con el texto base.
  body.querySelectorAll("rt, rp").forEach((el) => el.remove());

  return (body.textContent ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t　]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
