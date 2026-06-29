import "../../styles/reader.css";
import "../../styles/settings.css";
import { analyzeText, type AnnotatedToken } from "../../services/reader.ts";
import { getKnownSet } from "../../services/known-words.ts";
import { getDeckWordSet } from "../../services/deck.ts";
import {
  buildWordDetail,
  buildPhraseDetail,
  openSheet,
} from "../components/word-sheet.ts";
import { openChooser } from "../components/chooser-sheet.ts";
import { hasJapanese } from "../../services/kana.ts";
import { getDictStatus, loadFullDictionary } from "../../data/jmdict.ts";
import { AOZORA_WORKS, fetchAozoraText } from "../../services/aozora.ts";

const LAST_TEXT_KEY = "yomu:lastText";
const WIDE = "(min-width: 900px)";
const MAX_CHARS = 2000; // tope por sesión de lectura (rendimiento + foco de estudio)
const EXAMPLE =
  "日本語を勉強する。\n今日はとてもいい天気です。\n新しい言葉を少しずつ覚える。";

/** Recorta textos largos al final de una oración para una sesión manejable. */
function clip(text: string, max = MAX_CHARS): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const stop = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("\n"));
  return (stop > max * 0.5 ? slice.slice(0, stop + 1) : slice).trim();
}

// Relatos cortos para la lectura por defecto (las novelas largas siguen
// disponibles en "Cambiar fuente → Aozora").
const SHORT_TITLES = new Set([
  "羅生門",
  "蜘蛛の糸",
  "走れメロス",
  "注文の多い料理店",
  "セロ弾きのゴーシュ",
  "檸檬",
  "ごん狐",
]);
function randomWork() {
  const pool = AOZORA_WORKS.filter((w) => SHORT_TITLES.has(w.title));
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Identidad de un token para el modelo del estudiante. */
function identityOf(t: AnnotatedToken): string {
  return t.entry?.word ?? t.baseForm;
}

interface ReaderState {
  text: string;
  lines: AnnotatedToken[][];
  tracked: Set<string>; // conocidas ∪ en el mazo (resaltado)
  known: Set<string>; // dominadas (comprensión)
  loaded: boolean; // ya se intentó la carga inicial
}
const state: ReaderState = {
  text: "",
  lines: [],
  tracked: new Set(),
  known: new Set(),
  loaded: false,
};

/** Estadísticas del último texto analizado (para Progreso). */
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
  root.className = "screen screen--reader";
  renderShell(root);

  if (state.lines.length > 0) {
    paintReading(root);
  } else if (!state.loaded) {
    void initialLoad(root);
  } else {
    showBodyState(root, "No hay lectura. Pulsa “Cambiar fuente” para elegir una.");
  }
  return root;
}

// ---------- Estructura fija del lector ----------
function renderShell(root: HTMLElement) {
  root.innerHTML = `
    <div class="reader__toolbar">
      <div class="reader__actions">
        <button class="btn btn--ghost" id="reroll" title="Otro artículo al azar">↻ Otra</button>
        <button class="btn" id="change">Cambiar fuente</button>
      </div>
      <span class="comprehension-chip" id="comprehension" hidden></span>
    </div>
    <div class="reader__layout">
      <div class="reader__main">
        <div class="reader__body" id="body" lang="ja"></div>
      </div>
      <aside class="reader__aside" id="aside">
        <p class="reader__aside-hint">Toca una palabra para ver su definición aquí.</p>
      </aside>
    </div>
  `;

  root.querySelector<HTMLButtonElement>("#reroll")!.addEventListener("click", () => {
    void loadRandomReading(root);
  });
  root.querySelector<HTMLButtonElement>("#change")!.addEventListener("click", () => {
    openChooser((text) => void analyzeAndShow(root, text));
  });

  setupSelection(root);
}

function showBodyState(root: HTMLElement, message: string) {
  const body = root.querySelector<HTMLElement>("#body");
  if (body) body.innerHTML = `<p class="reader__state">${message}</p>`;
}

// ---------- Carga ----------
async function initialLoad(root: HTMLElement) {
  state.loaded = true;
  await ensureDictionary(root);
  const saved = localStorage.getItem(LAST_TEXT_KEY);
  if (saved && saved.trim()) {
    await analyzeAndShow(root, saved);
  } else {
    await loadRandomReading(root);
  }
}

/** Asegura el diccionario completo la primera vez (es local, ~1.4 MB). */
async function ensureDictionary(root: HTMLElement) {
  const status = await getDictStatus();
  if (status.source === "full") return;
  showBodyState(root, "Preparando el diccionario… (solo la primera vez)");
  try {
    await loadFullDictionary((p) =>
      showBodyState(root, `Diccionario: ${p.message}`)
    );
  } catch (err) {
    // Si falla, seguimos con el diccionario básico (no bloquea la lectura).
    console.error(err);
  }
}

/** Carga una obra de Aozora al azar (literatura con vocabulario estándar). */
async function loadRandomReading(root: HTMLElement) {
  showBodyState(root, "Cargando una lectura…");
  try {
    const text = await fetchAozoraText(randomWork().path);
    await analyzeAndShow(root, text || EXAMPLE);
  } catch {
    // Sin conexión: cae a un texto de ejemplo para que siempre haya algo que leer.
    await analyzeAndShow(root, EXAMPLE);
  }
}

async function analyzeAndShow(root: HTMLElement, text: string) {
  const clean = clip(text.trim());
  if (!clean) return;
  showBodyState(root, "Analizando…");
  try {
    await analyzeIntoState(clean);
    state.text = clean;
    try {
      localStorage.setItem(LAST_TEXT_KEY, clean);
    } catch {
      /* almacenamiento lleno: no es crítico */
    }
    paintReading(root);
  } catch (err) {
    console.error(err);
    showBodyState(root, "No se pudo analizar el texto. Reintenta.");
  }
}

async function analyzeIntoState(text: string) {
  const [knownSet, deckSet] = await Promise.all([getKnownSet(), getDeckWordSet()]);
  state.known = knownSet;
  state.tracked = new Set([...knownSet, ...deckSet]);

  const rawLines = text.split("\n");
  state.lines = await Promise.all(
    rawLines.map((line) => (line.trim() ? analyzeText(line) : Promise.resolve([])))
  );
}

// ---------- Pintado de la lectura ----------
function paintReading(root: HTMLElement) {
  resetAside(root);
  const body = root.querySelector<HTMLElement>("#body")!;
  body.replaceChildren(...state.lines.map((line) => renderLine(line, root)));
  updateComprehension(root);
}

function resetAside(root: HTMLElement) {
  const aside = root.querySelector<HTMLElement>("#aside");
  if (aside) {
    aside.innerHTML = `<p class="reader__aside-hint">Toca una palabra para ver su definición aquí.</p>`;
  }
}

function renderLine(tokens: AnnotatedToken[], root: HTMLElement): HTMLElement {
  const p = document.createElement("p");
  p.className = "reader__line";
  if (tokens.length === 0) {
    p.innerHTML = "&nbsp;";
    return p;
  }
  // Agrupa por oración (corta en 。！？…) para que la gramática se acote a la
  // oración de la palabra tocada, no a todo el párrafo.
  for (const group of splitSentences(tokens)) {
    const sentence = group.map((t) => t.surface).join("");
    for (const t of group) p.appendChild(renderToken(t, root, sentence));
  }
  return p;
}

function splitSentences(tokens: AnnotatedToken[]): AnnotatedToken[][] {
  const groups: AnnotatedToken[][] = [];
  let cur: AnnotatedToken[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (/[。．！？!?…]/.test(t.surface)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function renderToken(t: AnnotatedToken, root: HTMLElement, sentence: string): Node {
  if (!t.isContent) {
    const span = document.createElement("span");
    span.className = "tok tok--plain";
    span.dataset.surface = t.surface;
    span.textContent = t.surface;
    return span;
  }

  const identity = identityOf(t);
  const isNew = !state.tracked.has(identity);

  const span = document.createElement("span");
  span.className = `tok${isNew ? " tok--new" : ""}`;
  span.dataset.identity = identity;
  span.dataset.surface = t.surface;

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

  span.addEventListener("click", () => showWord(root, t, identity, sentence));
  return span;
}

function showWord(
  root: HTMLElement,
  t: AnnotatedToken,
  identity: string,
  sentence: string
) {
  const data = {
    identity,
    word: t.entry?.word ?? t.baseForm,
    surface: t.surface,
    reading: t.entry?.reading || t.reading,
    meaning: t.entry?.meaning,
    pos: t.entry?.pos,
    sentence,
  };
  const onTracked = (id: string) => {
    state.tracked.add(id);
    root
      .querySelectorAll<HTMLElement>(`.tok[data-identity="${cssEscape(id)}"]`)
      .forEach((el) => el.classList.remove("tok--new"));
    updateComprehension(root);
  };

  showDetail(root, (onClose) => buildWordDetail(data, { onTracked }, onClose));
}

function showPhrase(root: HTMLElement, text: string) {
  showDetail(root, (onClose) => buildPhraseDetail(text, onClose));
}

/** Muestra el detalle en el panel lateral (escritorio) o en una hoja (móvil). */
function showDetail(
  root: HTMLElement,
  make: (onClose?: () => void) => HTMLElement
) {
  if (window.matchMedia(WIDE).matches) {
    const aside = root.querySelector<HTMLElement>("#aside")!;
    aside.replaceChildren(make());
  } else {
    openSheet((close) => make(close));
  }
}

// ---------- Selección de frase ----------
let selBody: HTMLElement | null = null;
let selPill: HTMLButtonElement | null = null;
let selPhrase = "";
let selWired = false;

function setupSelection(root: HTMLElement) {
  const body = root.querySelector<HTMLElement>("#body")!;
  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "sel-pill";
  pill.hidden = true;
  pill.textContent = "Explicar selección";
  // pointerdown dispara antes de que el tap borre la selección (móvil y escritorio).
  pill.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!selPhrase) return;
    const text = selPhrase;
    pill.hidden = true;
    window.getSelection()?.removeAllRanges();
    showPhrase(root, text);
  });
  root.appendChild(pill);

  selBody = body;
  selPill = pill;
  selPhrase = "";

  if (!selWired) {
    selWired = true;
    document.addEventListener("selectionchange", () =>
      requestAnimationFrame(updateSelectionPill)
    );
  }
}

function updateSelectionPill() {
  const body = selBody;
  const pill = selPill;
  if (!body || !pill || !document.contains(body)) {
    if (pill) pill.hidden = true;
    return;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !sel.anchorNode || !body.contains(sel.anchorNode)) {
    pill.hidden = true;
    selPhrase = "";
    return;
  }
  // Reconstruye el texto base de los tokens seleccionados (sin furigana).
  const inSel = (n: Node) =>
    (sel as Selection & { containsNode(node: Node, partial?: boolean): boolean }).containsNode(n, true);
  const text = [...body.querySelectorAll<HTMLElement>(".tok")]
    .filter((s) => inSel(s))
    .map((s) => s.dataset.surface ?? s.textContent ?? "")
    .join("")
    .trim();

  if (text.length > 1 && hasJapanese(text)) {
    selPhrase = text;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    pill.style.top = `${Math.max(8, rect.top - 44)}px`;
    pill.style.left = `${Math.min(rect.left, window.innerWidth - 170)}px`;
    pill.hidden = false;
  } else {
    pill.hidden = true;
    selPhrase = "";
  }
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
    el.hidden = true;
    return;
  }
  const pct = Math.round((known / total) * 100);
  el.hidden = false;
  el.textContent = `${pct}% comprensión`;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
