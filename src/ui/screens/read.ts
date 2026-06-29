import "../../styles/reader.css";
import { analyzeText, type AnnotatedToken } from "../../services/reader.ts";
import { getKnownSet } from "../../services/known-words.ts";
import { getDeckWordSet } from "../../services/deck.ts";
import {
  getDictStatus,
  loadFullDictionary,
  type LoadProgress,
} from "../../data/jmdict.ts";
import { openWordSheet } from "../components/word-sheet.ts";

/** Identidad de un token para el modelo del estudiante (forma de diccionario o superficie). */
function identityOf(t: AnnotatedToken): string {
  return t.entry?.word ?? t.baseForm;
}

// Estado del lector, persistente entre navegaciones de pestañas.
interface ReaderState {
  mode: "source" | "reading";
  text: string;
  lines: AnnotatedToken[][];
  tracked: Set<string>; // conocidas ∪ en el mazo
}
const state: ReaderState = {
  mode: "source",
  text: "日本語を勉強する。\n今日はとてもいい天気です。",
  lines: [],
  tracked: new Set(),
};

const EXAMPLE = "日本語を勉強する。\n今日はとてもいい天気です。";

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
    <p class="screen__subtitle">Pega texto japonés para analizarlo. (Cámara en la Fase 4.)</p>
    <div class="dict-bar" id="dict-bar"></div>
    <label class="source__label" for="src">Texto japonés</label>
    <textarea id="src" class="source__textarea" lang="ja" placeholder="ここに日本語を貼り付け…"></textarea>
    <div class="source__actions">
      <button class="btn btn--primary" id="analyze">Analizar</button>
      <button class="btn" id="example">Usar ejemplo</button>
    </div>
    <p class="source__hint">Las palabras nuevas se resaltan; las que ya dominas quedan en texto plano.</p>
  `;

  const textarea = root.querySelector<HTMLTextAreaElement>("#src")!;
  textarea.value = state.text;

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
  for (const t of tokens) {
    p.appendChild(renderToken(t, root));
  }
  return p;
}

function renderToken(t: AnnotatedToken, root: HTMLElement): Node {
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
      if (state.tracked.has(identityOf(t))) known++;
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
