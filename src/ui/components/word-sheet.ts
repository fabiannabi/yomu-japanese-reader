import "../../styles/settings.css";
import { addToDeck, isInDeck } from "../../services/deck.ts";
import { isKnown } from "../../services/known-words.ts";
import { explainGrammar } from "../../services/llm.ts";
import { analyzeGrammar, type GrammarSegment } from "../../services/grammar.ts";
import { hasApiKey } from "../../services/settings.ts";

export interface WordSheetData {
  identity: string;
  word: string;
  reading: string;
  meaning?: string;
  pos?: string;
  sentence?: string;
}

interface WordSheetOptions {
  onTracked?: (identity: string) => void;
}

/**
 * Detalle de una palabra: escritura, lectura, significado, [al mazo] y el
 * desglose gramatical de su oración (SIEMPRE visible, sin botón). Si hay API
 * key, ofrece además una explicación con IA. Se usa en la hoja inferior (móvil)
 * y en el panel lateral (escritorio).
 */
export function buildWordDetail(
  data: WordSheetData,
  options: WordSheetOptions = {},
  onClose?: () => void
): HTMLElement {
  const el = document.createElement("div");
  el.className = "word-detail";

  const hasMeaning = !!data.meaning;
  el.innerHTML = `
    <h2 class="sheet__word" lang="ja">${escapeHtml(data.word)}</h2>
    ${data.reading ? `<p class="sheet__reading" lang="ja">${escapeHtml(data.reading)}</p>` : ""}
    ${data.pos ? `<span class="sheet__pos">${escapeHtml(data.pos)}</span>` : ""}
    <p class="sheet__meaning ${hasMeaning ? "" : "sheet__meaning--empty"}">
      ${hasMeaning ? escapeHtml(data.meaning!) : "No está en el diccionario (puede ser un nombre propio o una palabra poco frecuente)."}
    </p>
    <div class="sheet__actions">
      <button class="btn btn--primary" data-action="deck"></button>
    </div>
    <div class="explain" id="explain"></div>
  `;

  wireDeck(el, data, options);

  const box = el.querySelector<HTMLElement>("#explain")!;
  void renderGrammarFor(box, data.sentence?.trim() || data.word, onClose);

  return el;
}

/**
 * Detalle de una FRASE seleccionada: muestra el desglose gramatical de todo el
 * texto seleccionado (con significado por palabra) y, si hay key, opción de IA.
 */
export function buildPhraseDetail(
  text: string,
  onClose?: () => void
): HTMLElement {
  const el = document.createElement("div");
  el.className = "word-detail";
  el.innerHTML = `
    <p class="sheet__reading">Frase seleccionada</p>
    <h2 class="sheet__word phrase-detail__text" lang="ja"></h2>
    <div class="explain" id="explain"></div>
  `;
  el.querySelector<HTMLElement>(".phrase-detail__text")!.textContent =
    text.length > 80 ? `${text.slice(0, 80)}…` : text;

  const box = el.querySelector<HTMLElement>("#explain")!;
  void renderGrammarFor(box, text, onClose);
  return el;
}

/** Abre cualquier contenido de detalle como hoja inferior (móvil). */
export function openSheet(build: (close: () => void) => HTMLElement): void {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");

  function close() {
    overlay.removeEventListener("keydown", onKey);
    overlay.remove();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  const grip = document.createElement("div");
  grip.className = "sheet__grip";
  grip.setAttribute("aria-hidden", "true");
  grip.addEventListener("click", close);

  sheet.appendChild(grip);
  sheet.appendChild(build(close));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", onKey);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

/** Atajo: abre el detalle de una palabra como hoja (móvil). */
export function openWordSheet(
  data: WordSheetData,
  options: WordSheetOptions = {}
): void {
  openSheet((close) => buildWordDetail(data, options, close));
}

// ---------- Internos ----------

function wireDeck(
  el: HTMLElement,
  data: WordSheetData,
  options: WordSheetOptions
) {
  const deckBtn = el.querySelector<HTMLButtonElement>('[data-action="deck"]')!;
  function refresh(s: { known: boolean; inDeck: boolean }) {
    if (s.known) {
      deckBtn.textContent = "Ya la dominas";
      deckBtn.disabled = true;
      deckBtn.classList.remove("btn--primary");
      deckBtn.classList.add("btn--known");
    } else if (s.inDeck) {
      deckBtn.textContent = "En el mazo";
      deckBtn.disabled = true;
      deckBtn.classList.remove("btn--primary");
      deckBtn.classList.add("btn--known");
    } else {
      deckBtn.textContent = "Al mazo";
      deckBtn.disabled = false;
    }
  }
  refresh({ known: false, inDeck: false });
  void Promise.all([isKnown(data.identity), isInDeck(data.identity)]).then(
    ([known, inDeck]) => refresh({ known, inDeck })
  );

  deckBtn.addEventListener("click", async () => {
    deckBtn.disabled = true;
    const added = await addToDeck(data.identity, data.reading, data.meaning ?? "");
    refresh({ known: false, inDeck: true });
    if (added) options.onTracked?.(data.identity);
  });
}

async function renderGrammarFor(
  box: HTMLElement,
  sentence: string,
  onClose?: () => void
) {
  box.innerHTML = `<p class="explain__loading">Analizando gramática…</p>`;
  try {
    const segments = await analyzeGrammar(sentence);
    renderGrammar(box, segments);
    await offerAi(box, sentence, onClose);
  } catch {
    box.innerHTML = `<p class="explain__error">No se pudo analizar la gramática.</p>`;
  }
}

function renderGrammar(box: HTMLElement, segments: GrammarSegment[]) {
  box.innerHTML = `<p class="explain__title">Gramática</p>`;
  if (segments.length === 0) {
    const p = document.createElement("p");
    p.className = "explain__hint";
    p.textContent = "No hay nada que desglosar.";
    box.appendChild(p);
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "grammar";
  for (const seg of segments) {
    const li = document.createElement("li");
    li.className = "grammar__item";

    const head = document.createElement("div");
    head.className = "grammar__head";
    const w = document.createElement("span");
    w.className = "grammar__w";
    w.lang = "ja";
    w.textContent =
      seg.reading && seg.reading !== seg.surface
        ? `${seg.surface}（${seg.reading}）`
        : seg.surface;
    head.appendChild(w);
    if (seg.meaning) {
      const g = document.createElement("span");
      g.className = "grammar__gloss";
      g.textContent = seg.meaning;
      head.appendChild(g);
    }

    const r = document.createElement("span");
    r.className = "grammar__role";
    r.textContent = seg.role;

    li.append(head, r);
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

async function offerAi(
  box: HTMLElement,
  sentence: string,
  onClose?: () => void
) {
  if (await hasApiKey()) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.marginTop = "var(--space-3)";
    btn.textContent = "Explicación con IA";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Pensando…";
      try {
        const text = await explainGrammar(sentence);
        const body = document.createElement("div");
        body.className = "explain__body";
        body.style.marginTop = "var(--space-3)";
        body.textContent = text;
        box.appendChild(body);
        btn.remove();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Explicación con IA";
        const e = document.createElement("p");
        e.className = "explain__error";
        e.textContent = err instanceof Error ? err.message : "Error al explicar.";
        box.appendChild(e);
      }
    });
    box.appendChild(btn);
  } else {
    const note = document.createElement("p");
    note.className = "explain__hint";
    note.textContent =
      "¿Quieres una explicación más detallada con IA? Añade tu API key en ";
    const link = document.createElement("button");
    link.className = "link-btn";
    link.textContent = "Ajustes";
    link.addEventListener("click", () => {
      onClose?.();
      location.hash = "#/ajustes";
    });
    note.appendChild(link);
    note.appendChild(document.createTextNode("."));
    box.appendChild(note);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
