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
import { openSourceSheet, type SourceKind } from "../components/source-sheet.ts";
import { recognizeImage, type OcrProgress } from "../../services/ocr.ts";

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
  text: "",
  lines: [],
  tracked: new Set(),
  known: new Set(),
};

const EXAMPLE = "日本語を勉強する。\n今日はとてもいい天気です。";

// Iconos de las tarjetas de fuente (line icons).
const ICON = {
  photo: `<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  wikipedia: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>`,
  news: `<svg viewBox="0 0 24 24"><path d="M4 4h13v16H4z"/><path d="M17 8h3v10a2 2 0 0 1-2 2H4"/><path d="M7 8h7M7 12h7M7 16h5"/></svg>`,
  aozora: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
};

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

// ---------- Vista: elegir fuente ----------
function renderSource(root: HTMLElement) {
  root.innerHTML = `
    <h1 class="screen__title">Leer</h1>
    <p class="screen__subtitle">Pega texto japonés, o tráelo de una fuente, y pulsa Analizar.</p>

    <textarea id="src" class="source__textarea" lang="ja"
      placeholder="ここに日本語のテキストを貼り付け…"></textarea>
    <button class="btn btn--primary btn--block" id="analyze">Analizar</button>
    <button class="link-btn" id="example">Probar con una oración de ejemplo</button>

    <div class="source-divider"><span>o trae texto de</span></div>
    <div class="source-grid">
      ${sourceCard("photo", ICON.photo, "Foto o cámara", "Reconoce texto de una imagen")}
      ${sourceCard("wikipedia", ICON.wikipedia, "Wikipedia", "Artículos sobre cualquier tema")}
      ${sourceCard("news", ICON.news, "Noticias", "Wikinews en japonés")}
      ${sourceCard("aozora", ICON.aozora, "Aozora Bunko", "Literatura clásica gratuita")}
    </div>

    <input type="file" id="photo-input" accept="image/*" capture="environment" hidden />
    <div class="ocr-status" id="ocr-status" hidden>
      <span id="ocr-label"></span>
      <div class="dict-bar__progress"><span id="ocr-prog"></span></div>
    </div>

    <div class="dict-bar" id="dict-bar"></div>
  `;

  const textarea = root.querySelector<HTMLTextAreaElement>("#src")!;
  textarea.value = state.text;
  textarea.addEventListener("input", () => {
    state.text = textarea.value;
  });

  setupOcr(root, textarea);
  setupSourceCards(root, textarea);

  root.querySelector<HTMLButtonElement>("#example")!.addEventListener("click", () => {
    textarea.value = EXAMPLE;
    state.text = EXAMPLE;
    textarea.focus();
  });

  const analyzeBtn = root.querySelector<HTMLButtonElement>("#analyze")!;
  analyzeBtn.addEventListener("click", async () => {
    state.text = textarea.value;
    if (!state.text.trim()) {
      textarea.focus();
      return;
    }
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

function sourceCard(src: string, icon: string, title: string, desc: string): string {
  return `
    <button class="source-card" data-src="${src}">
      <span class="source-card__icon" aria-hidden="true">${icon}</span>
      <span class="source-card__title">${title}</span>
      <span class="source-card__desc">${desc}</span>
    </button>
  `;
}

function setupSourceCards(root: HTMLElement, textarea: HTMLTextAreaElement) {
  const fill = (text: string) => {
    textarea.value = text;
    state.text = text;
    textarea.scrollIntoView({ behavior: "smooth", block: "start" });
    root.querySelector<HTMLButtonElement>("#analyze")?.focus();
  };

  root.querySelectorAll<HTMLButtonElement>(".source-card").forEach((card) => {
    const src = card.dataset.src;
    card.addEventListener("click", () => {
      if (src === "photo") {
        root.querySelector<HTMLInputElement>("#photo-input")!.click();
      } else if (src === "wikipedia" || src === "news" || src === "aozora") {
        openSourceSheet(src as SourceKind, fill);
      }
    });
  });
}

function setupOcr(root: HTMLElement, textarea: HTMLTextAreaElement) {
  const input = root.querySelector<HTMLInputElement>("#photo-input")!;
  const statusEl = root.querySelector<HTMLElement>("#ocr-status")!;
  const labelEl = root.querySelector<HTMLElement>("#ocr-label")!;
  const progEl = root.querySelector<HTMLElement>("#ocr-prog")!;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    statusEl.hidden = false;
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
      input.value = ""; // permitir re-subir la misma imagen
    }
  });
}

async function renderDictBar(bar: HTMLElement) {
  const status = await getDictStatus();
  if (status.source === "full") {
    bar.innerHTML = `<span>Diccionario completo · ${status.entryCount.toLocaleString("es")} palabras</span>`;
    return;
  }

  bar.innerHTML = `
    <span id="dict-label">Diccionario básico (${status.entryCount.toLocaleString("es")} palabras)</span>
    <button class="btn" id="dict-dl">Descargar completo</button>
  `;

  bar.querySelector<HTMLButtonElement>("#dict-dl")!.addEventListener("click", async () => {
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
      bar.innerHTML = `<span>Diccionario completo · ${result.entryCount.toLocaleString("es")} palabras</span>`;
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
      <button class="btn btn--ghost" id="new-text">‹ Nuevo texto</button>
      <span class="comprehension-chip" id="comprehension"></span>
    </div>
    <p class="reader__hint">
      Toca una palabra para ver su lectura y significado. Las resaltadas son nuevas para ti.
    </p>
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
  el.textContent = `${pct}% · ${nuevas} nueva${nuevas === 1 ? "" : "s"}`;
}

// Escapa un valor para usarlo dentro de un selector de atributo.
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
