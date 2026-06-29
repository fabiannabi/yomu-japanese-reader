import "../../styles/reader.css";
import "../../styles/settings.css";
import { analyzeText, type AnnotatedToken } from "../../services/reader.ts";
import { getKnownSet } from "../../services/known-words.ts";
import { getDeckWordSet } from "../../services/deck.ts";
import {
  getDictStatus,
  loadFullDictionary,
  type LoadProgress,
} from "../../data/jmdict.ts";
import { openWordSheet } from "../components/word-sheet.ts";
import { recognizeImage, type OcrProgress } from "../../services/ocr.ts";
import {
  randomPages,
  searchPages,
  recentPages,
  fetchExtract,
  type WikiHost,
  type WikiPage,
} from "../../services/wiki.ts";

/** Identidad de un token para el modelo del estudiante (forma de diccionario o superficie). */
function identityOf(t: AnnotatedToken): string {
  return t.entry?.word ?? t.baseForm;
}

// Estado del lector, persistente entre navegaciones de pestañas.
interface ReaderState {
  mode: "source" | "reading";
  text: string;
  lines: AnnotatedToken[][];
  tracked: Set<string>; // conocidas ∪ en el mazo (para el resaltado)
  known: Set<string>; // solo dominadas (para la comprensión)
}
const state: ReaderState = {
  mode: "source",
  text: "日本語を勉強する。\n今日はとてもいい天気です。",
  lines: [],
  tracked: new Set(),
  known: new Set(),
};

const EXAMPLE = "日本語を勉強する。\n今日はとてもいい天気です。";

/** Estadísticas del último texto analizado (para la pantalla de Progreso). */
export function getReadingStats(): { total: number; known: number } | null {
  if (state.lines.length === 0) return null;
  let total = 0;
  let known = 0;
  for (const line of state.lines) {
    for (const t of line) {
      if (!t.isContent) continue;
      total++;
      if (state.known.has(identityOf(t))) known++;
    }
  }
  return total === 0 ? null : { total, known };
}

export function ReadScreen(): HTMLElement {
  const root = document.createElement("section");
  root.className = "screen";
  render(root);
  return root;
}

function render(root: HTMLElement) {
  if (state.mode === "reading") renderReading(root);
  else renderSource(root);
}

// ---------- Vista: elegir fuente (pegar texto) ----------
function renderSource(root: HTMLElement) {
  root.innerHTML = `
    <h1 class="screen__title">Leer</h1>
    <p class="screen__subtitle">Pega texto japonés o usa una foto para analizarlo.</p>
    <div class="dict-bar" id="dict-bar"></div>
    <label class="source__label" for="src">Texto japonés</label>
    <textarea id="src" class="source__textarea" lang="ja" placeholder="ここに日本語を貼り付け…"></textarea>
    <div class="source__actions">
      <button class="btn btn--primary" id="analyze">Analizar</button>
      <button class="btn" id="photo">Foto / cámara</button>
      <button class="btn" id="src-wiki">Wikipedia</button>
      <button class="btn" id="src-news">Noticias</button>
      <button class="btn" id="example">Usar ejemplo</button>
    </div>
    <input type="file" id="photo-input" accept="image/*" capture="environment" hidden />
    <div class="ocr-status" id="ocr-status" hidden>
      <span id="ocr-label"></span>
      <div class="dict-bar__progress"><span id="ocr-prog"></span></div>
    </div>
    <div id="source-area"></div>
    <p class="source__hint">Las palabras nuevas se resaltan; las que ya dominas quedan en texto plano.</p>
  `;

  const textarea = root.querySelector<HTMLTextAreaElement>("#src")!;
  textarea.value = state.text;

  setupOcr(root, textarea);
  setupSources(root, textarea);

  root.querySelector<HTMLButtonElement>("#example")!.addEventListener("click", () => {
    textarea.value = EXAMPLE;
    state.text = EXAMPLE;
  });

  const analyzeBtn = root.querySelector<HTMLButtonElement>("#analyze")!;
  analyzeBtn.addEventListener("click", async () => {
    state.text = textarea.value;
    if (!state.text.trim()) return;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analizando…";
    try {
      await analyzeIntoState(state.text);
      state.mode = "reading";
      render(root);
    } catch (err) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analizar";
      console.error(err);
      alert("No se pudo analizar el texto. ¿Se cargó el diccionario kuromoji?");
    }
  });

  void renderDictBar(root.querySelector<HTMLElement>("#dict-bar")!);
}

function setupSources(root: HTMLElement, textarea: HTMLTextAreaElement) {
  const area = root.querySelector<HTMLElement>("#source-area")!;

  root
    .querySelector<HTMLButtonElement>("#src-wiki")!
    .addEventListener("click", () => renderWikiPanel(area, textarea, "ja.wikipedia.org"));
  root
    .querySelector<HTMLButtonElement>("#src-news")!
    .addEventListener("click", () => renderWikiPanel(area, textarea, "ja.wikinews.org"));
}

// Carga el texto de un artículo en el cuadro y deja listo para Analizar.
async function loadArticle(
  host: WikiHost,
  title: string,
  area: HTMLElement,
  textarea: HTMLTextAreaElement
) {
  area.innerHTML = `<p class="source__hint">Cargando “${escapeText(title)}”…</p>`;
  try {
    const text = await fetchExtract(host, title);
    if (!text) {
      area.innerHTML = `<p class="explain__error">El artículo no tiene texto legible. Prueba otro.</p>`;
      return;
    }
    textarea.value = text;
    state.text = text;
    area.innerHTML = `<p class="source__hint">“${escapeText(title)}” cargado. Pulsa Analizar.</p>`;
  } catch {
    area.innerHTML = `<p class="explain__error">No se pudo cargar el artículo. Reintenta.</p>`;
  }
}

function renderList(
  pages: WikiPage[],
  host: WikiHost,
  listEl: HTMLElement,
  area: HTMLElement,
  textarea: HTMLTextAreaElement
) {
  if (pages.length === 0) {
    listEl.innerHTML = `<p class="source__hint">Sin resultados.</p>`;
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "source-list";
  for (const p of pages) {
    const li = document.createElement("li");
    li.className = "source-list__item";
    li.textContent = p.title;
    li.addEventListener("click", () => loadArticle(host, p.title, area, textarea));
    ul.appendChild(li);
  }
  listEl.replaceChildren(ul);
}

function renderWikiPanel(
  area: HTMLElement,
  textarea: HTMLTextAreaElement,
  host: WikiHost
) {
  const isNews = host === "ja.wikinews.org";
  area.innerHTML = `
    <div class="source__row" style="margin-top:var(--space-3)">
      <input class="field__input" id="wiki-q" type="search"
        placeholder="${isNews ? "Buscar noticias…" : "Buscar tema…"}" />
      <button class="btn" id="wiki-search">Buscar</button>
      <button class="btn" id="wiki-rand">${isNews ? "Recientes" : "Al azar"}</button>
    </div>
    <div id="wiki-list"></div>
  `;
  const input = area.querySelector<HTMLInputElement>("#wiki-q")!;
  const listEl = area.querySelector<HTMLElement>("#wiki-list")!;

  const doSearch = async () => {
    listEl.innerHTML = `<p class="source__hint">Buscando…</p>`;
    try {
      renderList(await searchPages(host, input.value), host, listEl, area, textarea);
    } catch {
      listEl.innerHTML = `<p class="explain__error">No se pudo buscar. Reintenta.</p>`;
    }
  };
  const doBrowse = async () => {
    listEl.innerHTML = `<p class="source__hint">Cargando…</p>`;
    try {
      let pages = isNews ? await recentPages(host) : await randomPages(host);
      // Wikinews ja tiene poca actividad: si no hay recientes, cae a al azar.
      if (isNews && pages.length === 0) pages = await randomPages(host);
      renderList(pages, host, listEl, area, textarea);
    } catch {
      listEl.innerHTML = `<p class="explain__error">No se pudo cargar. Reintenta.</p>`;
    }
  };

  area.querySelector<HTMLButtonElement>("#wiki-search")!.addEventListener("click", doSearch);
  area.querySelector<HTMLButtonElement>("#wiki-rand")!.addEventListener("click", doBrowse);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // Carga inicial: noticias recientes o artículos al azar.
  void doBrowse();
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setupOcr(root: HTMLElement, textarea: HTMLTextAreaElement) {
  const photoBtn = root.querySelector<HTMLButtonElement>("#photo")!;
  const input = root.querySelector<HTMLInputElement>("#photo-input")!;
  const statusEl = root.querySelector<HTMLElement>("#ocr-status")!;
  const labelEl = root.querySelector<HTMLElement>("#ocr-label")!;
  const progEl = root.querySelector<HTMLElement>("#ocr-prog")!;

  photoBtn.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    statusEl.hidden = false;
    photoBtn.disabled = true;
    labelEl.textContent = "Preparando…";
    progEl.style.width = "0%";

    const onProgress = (p: OcrProgress) => {
      labelEl.textContent = p.message;
      progEl.style.width = `${Math.round(p.ratio * 100)}%`;
    };
    try {
      const text = await recognizeImage(file, onProgress);
      if (text) {
        textarea.value = text;
        state.text = text;
        labelEl.textContent = "Texto detectado. Revísalo y pulsa Analizar.";
      } else {
        labelEl.textContent = "No se detectó texto. Prueba con una foto más nítida.";
      }
    } catch (err) {
      console.error(err);
      labelEl.textContent = "Error en el OCR. Reintenta.";
    } finally {
      photoBtn.disabled = false;
      input.value = ""; // permitir re-subir la misma imagen
    }
  });
}

async function renderDictBar(bar: HTMLElement) {
  const status = await getDictStatus();
  const label =
    status.source === "full"
      ? `Diccionario completo · ${status.entryCount.toLocaleString("es")} entradas`
      : `Diccionario inicial · ${status.entryCount.toLocaleString("es")} entradas`;

  bar.innerHTML = `
    <span id="dict-label">${label}</span>
    ${status.source === "full" ? "" : '<button class="btn" id="dict-dl">Descargar completo</button>'}
  `;

  const dl = bar.querySelector<HTMLButtonElement>("#dict-dl");
  dl?.addEventListener("click", async () => {
    bar.innerHTML = `
      <span id="dict-label">Preparando…</span>
      <div class="dict-bar__progress"><span id="dict-prog"></span></div>
    `;
    const labelEl = bar.querySelector<HTMLElement>("#dict-label")!;
    const progEl = bar.querySelector<HTMLElement>("#dict-prog")!;
    const onProgress = (p: LoadProgress) => {
      labelEl.textContent = p.message;
      if (p.ratio !== undefined) progEl.style.width = `${Math.round(p.ratio * 100)}%`;
    };
    try {
      const result = await loadFullDictionary(onProgress);
      bar.innerHTML = `<span>Diccionario completo · ${result.entryCount.toLocaleString("es")} entradas</span>`;
    } catch (err) {
      console.error(err);
      labelEl.textContent = "Error al descargar. Reintenta más tarde.";
    }
  });
}

// ---------- Análisis ----------
async function analyzeIntoState(text: string) {
  const [knownSet, deckSet] = await Promise.all([getKnownSet(), getDeckWordSet()]);
  state.known = knownSet;
  state.tracked = new Set([...knownSet, ...deckSet]);

  // Tokeniza línea por línea para conservar los saltos de párrafo.
  const rawLines = text.split("\n");
  state.lines = await Promise.all(
    rawLines.map((line) => (line.trim() ? analyzeText(line) : Promise.resolve([])))
  );
}

// ---------- Vista: lectura ----------
function renderReading(root: HTMLElement) {
  root.innerHTML = `
    <div class="reader__toolbar">
      <button class="btn" id="new-text">Nuevo texto</button>
      <span class="reader__comprehension" id="comprehension"></span>
    </div>
    <div class="reader__body" id="body" lang="ja"></div>
  `;

  root.querySelector<HTMLButtonElement>("#new-text")!.addEventListener("click", () => {
    state.mode = "source";
    render(root);
  });

  const body = root.querySelector<HTMLElement>("#body")!;
  for (const line of state.lines) {
    body.appendChild(renderLine(line, root));
  }
  updateComprehension(root);
}

function renderLine(tokens: AnnotatedToken[], root: HTMLElement): HTMLElement {
  const p = document.createElement("p");
  p.className = "reader__line";
  if (tokens.length === 0) {
    p.innerHTML = "&nbsp;";
    return p;
  }
  const sentence = tokens.map((t) => t.surface).join("");
  for (const t of tokens) {
    p.appendChild(renderToken(t, root, sentence));
  }
  return p;
}

function renderToken(t: AnnotatedToken, root: HTMLElement, sentence: string): Node {
  // Partículas, signos y demás: texto plano no tocable.
  if (!t.isContent) {
    const span = document.createElement("span");
    span.className = "tok tok--plain";
    span.textContent = t.surface;
    return span;
  }

  const identity = identityOf(t);
  const isNew = !state.tracked.has(identity);

  const span = document.createElement("span");
  span.className = `tok${isNew ? " tok--new" : ""}`;
  span.dataset.identity = identity;

  if (t.needsFurigana) {
    const ruby = document.createElement("ruby");
    ruby.append(document.createTextNode(t.surface));
    const rt = document.createElement("rt");
    rt.textContent = t.reading;
    ruby.appendChild(rt);
    span.appendChild(ruby);
  } else {
    span.textContent = t.surface;
  }

  span.addEventListener("click", () => {
    void openWordSheet(
      {
        identity,
        word: t.entry?.word ?? t.baseForm,
        reading: t.entry?.reading || t.reading,
        meaning: t.entry?.meaning,
        pos: t.entry?.pos,
        sentence,
      },
      {
        onTracked: (id) => {
          state.tracked.add(id);
          // Quita el resaltado de todas las apariciones de esa palabra.
          root
            .querySelectorAll<HTMLElement>(`.tok[data-identity="${cssEscape(id)}"]`)
            .forEach((el) => el.classList.remove("tok--new"));
          updateComprehension(root);
        },
      }
    );
  });

  return span;
}

function updateComprehension(root: HTMLElement) {
  let total = 0;
  let known = 0;
  for (const line of state.lines) {
    for (const t of line) {
      if (!t.isContent) continue;
      total++;
      if (state.known.has(identityOf(t))) known++;
    }
  }
  const el = root.querySelector<HTMLElement>("#comprehension");
  if (!el) return;
  if (total === 0) {
    el.textContent = "";
    return;
  }
  const pct = Math.round((known / total) * 100);
  const nuevas = total - known;
  el.innerHTML = `Comprensión <strong>${pct}%</strong> · ${nuevas} nueva${nuevas === 1 ? "" : "s"}`;
}

// Escapa un valor para usarlo dentro de un selector de atributo.
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
