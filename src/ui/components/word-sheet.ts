import "../../styles/settings.css";
import { addToDeck, isInDeck } from "../../services/deck.ts";
import { isKnown } from "../../services/known-words.ts";
import { explainGrammar, MissingApiKeyError } from "../../services/llm.ts";

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

/** Abre la hoja inferior de detalle de una palabra (§7). */
export async function openWordSheet(
  data: WordSheetData,
  options: WordSheetOptions = {}
): Promise<void> {
  const [known, inDeck] = await Promise.all([
    isKnown(data.identity),
    isInDeck(data.identity),
  ]);

  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", `Detalle de ${data.word}`);

  const hasMeaning = !!data.meaning;
  sheet.innerHTML = `
    <div class="sheet__grip" aria-hidden="true"></div>
    <h2 class="sheet__word" lang="ja">${escapeHtml(data.word)}</h2>
    ${data.reading ? `<p class="sheet__reading" lang="ja">${escapeHtml(data.reading)}</p>` : ""}
    ${data.pos ? `<span class="sheet__pos">${escapeHtml(data.pos)}</span>` : ""}
    <p class="sheet__meaning ${hasMeaning ? "" : "sheet__meaning--empty"}">
      ${hasMeaning ? escapeHtml(data.meaning!) : "Sin definición en el diccionario local."}
    </p>
    <div class="sheet__actions">
      <button class="btn btn--primary" data-action="deck"></button>
      <button class="btn" data-action="explain">Explicar</button>
    </div>
    <div class="explain" id="explain" hidden></div>
  `;

  const deckBtn = sheet.querySelector<HTMLButtonElement>('[data-action="deck"]')!;
  function refreshDeckBtn(state: { known: boolean; inDeck: boolean }) {
    if (state.known) {
      deckBtn.textContent = "Ya la dominas";
      deckBtn.disabled = true;
      deckBtn.classList.remove("btn--primary");
      deckBtn.classList.add("btn--known");
    } else if (state.inDeck) {
      deckBtn.textContent = "En el mazo";
      deckBtn.disabled = true;
      deckBtn.classList.remove("btn--primary");
      deckBtn.classList.add("btn--known");
    } else {
      deckBtn.textContent = "Al mazo";
      deckBtn.disabled = false;
    }
  }
  refreshDeckBtn({ known, inDeck });

  deckBtn.addEventListener("click", async () => {
    deckBtn.disabled = true;
    const added = await addToDeck(data.identity, data.reading, data.meaning ?? "");
    refreshDeckBtn({ known: false, inDeck: true });
    if (added) options.onTracked?.(data.identity);
  });

  const explainBtn = sheet.querySelector<HTMLButtonElement>('[data-action="explain"]')!;
  const explainBox = sheet.querySelector<HTMLElement>("#explain")!;
  explainBtn.addEventListener("click", async () => {
    const sentence = data.sentence?.trim() || data.word;
    explainBox.hidden = false;
    explainBox.innerHTML = `<p class="explain__loading">Pensando…</p>`;
    explainBtn.disabled = true;
    try {
      const text = await explainGrammar(sentence);
      explainBox.innerHTML = `
        <p class="explain__title">Gramática</p>
        <div class="explain__body"></div>
      `;
      explainBox.querySelector<HTMLElement>(".explain__body")!.textContent = text;
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        explainBox.innerHTML = `<p class="explain__error">Añade tu API key en Ajustes para usar “explicar”.</p>`;
        const link = document.createElement("button");
        link.className = "btn";
        link.textContent = "Ir a Ajustes";
        link.style.marginTop = "var(--space-2)";
        link.addEventListener("click", () => {
          close();
          location.hash = "#/ajustes";
        });
        explainBox.appendChild(link);
      } else {
        explainBox.innerHTML = `<p class="explain__error">${escapeHtml(
          err instanceof Error ? err.message : "Error al explicar."
        )}</p>`;
      }
    } finally {
      explainBtn.disabled = false;
    }
  });

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
  sheet.querySelector(".sheet__grip")!.addEventListener("click", close);
  overlay.addEventListener("keydown", onKey);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
