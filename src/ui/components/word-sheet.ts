import "../../styles/settings.css";
import { addToDeck, isInDeck } from "../../services/deck.ts";
import { isKnown } from "../../services/known-words.ts";
import { explainGrammar } from "../../services/llm.ts";
import { analyzeGrammar, type GrammarSegment } from "../../services/grammar.ts";
import { hasApiKey } from "../../services/settings.ts";

export interface WordSheetData {
  /** Identidad para mazo/conocidas (forma de diccionario o superficie). */
  identity: string;
  word: string;
  reading: string;
  meaning?: string;
  pos?: string;
  /** Oración que contiene la palabra (para “explicar gramática”). */
  sentence?: string;
}

interface WordSheetOptions {
  /** Se llama cuando la palabra pasa a estar "rastreada" (añadida al mazo). */
  onTracked?: (identity: string) => void;
}

/**
 * Construye el contenido del detalle de una palabra (escritura, lectura, POS,
 * significado, [al mazo], [explicar]). Se usa tanto en la hoja inferior (móvil)
 * como en el panel lateral del lector (escritorio). `onClose` se invoca al
 * navegar a Ajustes desde "explicar" (la hoja la usa para cerrarse).
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
      <button class="btn" data-action="explain">Explicar</button>
    </div>
    <div class="explain" id="explain" hidden></div>
  `;

  const deckBtn = el.querySelector<HTMLButtonElement>('[data-action="deck"]')!;
  function refreshDeckBtn(s: { known: boolean; inDeck: boolean }) {
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
  refreshDeckBtn({ known: false, inDeck: false });
  // Estado real (conocida / en el mazo) de forma asíncrona.
  void Promise.all([isKnown(data.identity), isInDeck(data.identity)]).then(
    ([known, inDeck]) => refreshDeckBtn({ known, inDeck })
  );

  deckBtn.addEventListener("click", async () => {
    deckBtn.disabled = true;
    const added = await addToDeck(data.identity, data.reading, data.meaning ?? "");
    refreshDeckBtn({ known: false, inDeck: true });
    if (added) options.onTracked?.(data.identity);
  });

  const explainBtn = el.querySelector<HTMLButtonElement>('[data-action="explain"]')!;
  const explainBox = el.querySelector<HTMLElement>("#explain")!;
  explainBtn.addEventListener("click", async () => {
    const sentence = data.sentence?.trim() || data.word;
    explainBox.hidden = false;
    explainBox.innerHTML = `<p class="explain__loading">Analizando…</p>`;
    explainBtn.disabled = true;
    try {
      const segments = await analyzeGrammar(sentence);
      renderGrammar(explainBox, segments);
      await offerAi(explainBox, sentence, onClose);
    } catch {
      explainBox.innerHTML = `<p class="explain__error">No se pudo analizar la gramática.</p>`;
    } finally {
      explainBtn.disabled = false;
    }
  });

  return el;
}

/** Abre la hoja inferior de detalle de una palabra (móvil). */
export function openWordSheet(
  data: WordSheetData,
  options: WordSheetOptions = {}
): void {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", `Detalle de ${data.word}`);

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
  sheet.appendChild(buildWordDetail(data, options, close));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", onKey);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

/** Pinta el desglose gramatical local (sin API). */
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

/** Ofrece una explicación con IA solo como extra opcional (si hay API key). */
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
    note.textContent = "¿Quieres una explicación más detallada con IA? Añade tu API key en ";
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
