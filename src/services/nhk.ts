/**
 * Fuente NHK News Web Easy (japonés fácil). EXPERIMENTAL: NHK no envía cabeceras
 * CORS, así que el fetch directo desde el navegador suele fallar en producción.
 * Si falla, la UI lo indica y sugiere pegar el texto a mano.
 */

const LIST_URL = "https://www3.nhk.or.jp/news/easy/news-list.json";
const articleUrl = (id: string) =>
  `https://www3.nhk.or.jp/news/easy/${id}/${id}.html`;

// NHK no envía cabeceras CORS, así que pasamos por un proxy público que sí las añade.
// Es un servicio externo de terceros; por eso la fuente sigue siendo experimental.
const proxied = (url: string) =>
  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

export interface NhkArticle {
  id: string;
  title: string;
}

export class NhkBlockedError extends Error {
  constructor() {
    super(
      "No se pudo acceder a NHK desde el navegador (CORS). Es una fuente experimental; por ahora pega el texto a mano."
    );
    this.name = "NhkBlockedError";
  }
}

/** Lista de noticias recientes. Lanza NhkBlockedError si CORS lo impide. */
export async function fetchNhkList(): Promise<NhkArticle[]> {
  let res: Response;
  try {
    res = await fetch(proxied(LIST_URL));
  } catch {
    throw new NhkBlockedError();
  }
  if (!res.ok) throw new NhkBlockedError();

  const data = (await res.json()) as Array<Record<string, NhkRawArticle[]>>;
  const articles: NhkArticle[] = [];
  for (const dateGroup of data) {
    for (const list of Object.values(dateGroup)) {
      for (const a of list) {
        if (a.news_id && a.title) articles.push({ id: a.news_id, title: a.title });
      }
    }
  }
  return articles.slice(0, 20);
}

interface NhkRawArticle {
  news_id?: string;
  title?: string;
}

/** Texto plano del artículo (sin furigana duplicada). Lanza NhkBlockedError si CORS. */
export async function fetchNhkArticle(id: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(proxied(articleUrl(id)));
  } catch {
    throw new NhkBlockedError();
  }
  if (!res.ok) throw new NhkBlockedError();

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body =
    doc.querySelector("#js-article-body") ??
    doc.querySelector(".article-main__body") ??
    doc.body;

  // Quita las lecturas <rt> para quedarnos con el texto base.
  body.querySelectorAll("rt").forEach((rt) => rt.remove());

  return (body.textContent ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}
