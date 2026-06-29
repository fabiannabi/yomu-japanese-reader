/**
 * Fuentes de lectura vía la API de MediaWiki (Wikipedia y Wikinews en japonés).
 * La API soporta CORS con `origin=*`, así que funciona directo desde el navegador,
 * sin proxy ni scraping. Devuelve texto plano UTF-8, ideal para el tokenizer.
 */

export type WikiHost = "ja.wikipedia.org" | "ja.wikinews.org";

export interface WikiPage {
  title: string;
}

function apiUrl(host: WikiHost, params: Record<string, string>): string {
  const search = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  });
  return `https://${host}/w/api.php?${search.toString()}`;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error de red (${res.status})`);
  const data = await res.json();
  // MediaWiki puede responder 200 con un objeto de error.
  if (data?.error) throw new Error(data.error.info ?? "Error de la API");
  return data;
}

/** Artículos al azar (espacio principal). */
export async function randomPages(
  host: WikiHost,
  limit = 8
): Promise<WikiPage[]> {
  const data = await getJson(
    apiUrl(host, {
      action: "query",
      list: "random",
      rnnamespace: "0",
      rnlimit: String(limit),
    })
  );
  return (data.query?.random ?? []).map((r: { title: string }) => ({
    title: r.title,
  }));
}

/** Búsqueda por texto. */
export async function searchPages(
  host: WikiHost,
  query: string,
  limit = 10
): Promise<WikiPage[]> {
  if (!query.trim()) return [];
  const data = await getJson(
    apiUrl(host, {
      action: "query",
      list: "search",
      srsearch: query,
      srnamespace: "0",
      srlimit: String(limit),
    })
  );
  return (data.query?.search ?? []).map((r: { title: string }) => ({
    title: r.title,
  }));
}

/** Páginas nuevas recientes (para “noticias” en Wikinews). */
export async function recentPages(
  host: WikiHost,
  limit = 12
): Promise<WikiPage[]> {
  const data = await getJson(
    apiUrl(host, {
      action: "query",
      list: "recentchanges",
      rcnamespace: "0",
      rctype: "new",
      rcshow: "!redirect",
      rclimit: String(limit),
      rcprop: "title",
    })
  );
  const seen = new Set<string>();
  const out: WikiPage[] = [];
  for (const r of data.query?.recentchanges ?? []) {
    if (r.title && !seen.has(r.title)) {
      seen.add(r.title);
      out.push({ title: r.title });
    }
  }
  return out;
}

/** Texto plano de un artículo. */
export async function fetchExtract(
  host: WikiHost,
  title: string
): Promise<string> {
  const data = await getJson(
    apiUrl(host, {
      action: "query",
      prop: "extracts",
      explaintext: "1",
      exsectionformat: "plain",
      redirects: "1",
      titles: title,
    })
  );
  const pages = data.query?.pages ?? {};
  const first = Object.values(pages)[0] as { extract?: string } | undefined;
  return (first?.extract ?? "").trim();
}
