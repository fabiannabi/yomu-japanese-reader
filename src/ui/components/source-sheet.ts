import {
  randomPages,
  searchPages,
  recentPages,
  fetchExtract,
  type WikiHost,
} from "../../services/wiki.ts";
import { AOZORA_WORKS, fetchAozoraText } from "../../services/aozora.ts";

export type SourceKind = "wikipedia" | "news" | "aozora";

const TITLES: Record<SourceKind, string> = {
  wikipedia: "Wikipedia",
  news: "Noticias",
  aozora: "Aozora Bunko",
};

/**
 * Abre una hoja inferior para explorar una fuente y traer el texto de un artículo.
 * onText recibe el texto cargado (el lector lo coloca en el cuadro de análisis).
 */
export function openSourceSheet(
  kind: SourceKind,
  onText: (text: string) => void
): void {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";

  const sheet = document.createElement("div");
  sheet.className = "sheet sheet--browse";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", TITLES[kind]);

  sheet.innerHTML = `
    <div class="sheet__grip" aria-hidden="true"></div>
    <div class="sheet__header">
      <h2 class="sheet__title">${TITLES[kind]}</h2>
      <button class="sheet__close" aria-label="Cerrar">×</button>
    </div>
    <div id="sheet-controls"></div>
    <div class="sheet__list" id="sheet-list"></div>
  `;

  const controls = sheet.querySelector<HTMLElement>("#sheet-controls")!;
  const list = sheet.querySelector<HTMLElement>("#sheet-list")!;

  function close() {
    overlay.removeEventListener("keydown", onKey);
    overlay.remove();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", onKey);
  sheet.querySelector(".sheet__close")!.addEventListener("click", close);
  sheet.querySelector(".sheet__grip")!.addEventListener("click", close);

  function setState(text: string, error = false) {
    list.innerHTML = `<p class="sheet__state${error ? " sheet__state--err" : ""}">${text}</p>`;
  }

  // Carga el texto de un artículo y cierra la hoja.
  async function pick(loader: () => Promise<string>, label: string) {
    setState(`Cargando “${label}”…`);
    try {
      const text = await loader();
      if (!text) {
        setState("El artículo no tiene texto legible. Prueba otro.", true);
        return;
      }
      onText(text);
      close();
    } catch {
      setState("No se pudo cargar. Revisa tu conexión y reintenta.", true);
    }
  }

  function renderItems(
    items: { title: string; sub?: string; load: () => Promise<string> }[]
  ) {
    if (items.length === 0) {
      setState("Sin resultados.");
      return;
    }
    list.replaceChildren(
      ...items.map((it) => {
        const btn = document.createElement("button");
        btn.className = "browse-item";
        btn.type = "button";
        const t = document.createElement("span");
        t.textContent = it.title;
        btn.appendChild(t);
        if (it.sub) {
          const s = document.createElement("span");
          s.className = "browse-item__sub";
          s.textContent = it.sub;
          btn.appendChild(s);
        }
        btn.addEventListener("click", () => pick(it.load, it.title));
        return btn;
      })
    );
  }

  if (kind === "aozora") {
    renderItems(
      AOZORA_WORKS.map((w) => ({
        title: w.title,
        sub: w.author,
        load: () => fetchAozoraText(w.path),
      }))
    );
  } else {
    const host: WikiHost =
      kind === "news" ? "ja.wikinews.org" : "ja.wikipedia.org";
    const isNews = kind === "news";

    controls.innerHTML = `
      <div class="sheet__search">
        <input class="field__input" id="q" type="search"
          placeholder="${isNews ? "Buscar noticia…" : "Buscar tema…"}" />
        <button class="btn" id="go">Buscar</button>
        <button class="btn" id="browse">${isNews ? "Recientes" : "Al azar"}</button>
      </div>
    `;
    const input = controls.querySelector<HTMLInputElement>("#q")!;

    const mapPages = (titles: { title: string }[]) =>
      titles.map((p) => ({
        title: p.title,
        load: () => fetchExtract(host, p.title),
      }));

    const doSearch = async () => {
      if (!input.value.trim()) return;
      setState("Buscando…");
      try {
        renderItems(mapPages(await searchPages(host, input.value)));
      } catch {
        setState("No se pudo buscar. Reintenta.", true);
      }
    };
    const doBrowse = async () => {
      setState("Cargando…");
      try {
        let pages = isNews ? await recentPages(host) : await randomPages(host);
        if (isNews && pages.length === 0) pages = await randomPages(host);
        renderItems(mapPages(pages));
      } catch {
        setState("No se pudo cargar. Reintenta.", true);
      }
    };

    controls.querySelector<HTMLButtonElement>("#go")!.addEventListener("click", doSearch);
    controls.querySelector<HTMLButtonElement>("#browse")!.addEventListener("click", doBrowse);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    void doBrowse();
  }

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
