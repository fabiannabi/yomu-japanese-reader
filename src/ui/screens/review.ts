import "../../styles/review.css";
import type { DeckCard } from "../../data/db.ts";
import { getDueCards, reviewCard } from "../../services/deck.ts";
import { UI_RATINGS, nextIntervalLabel } from "../../services/srs.ts";

interface Session {
  queue: DeckCard[];
  index: number;
  reviewed: number;
  graduated: number;
  revealed: boolean;
}

export function ReviewScreen(): HTMLElement {
  const root = document.createElement("section");
  root.className = "screen";
  root.innerHTML = `<h1 class="screen__title">Repaso</h1>`;
  void start(root);
  return root;
}

async function start(root: HTMLElement) {
  const queue = await getDueCards();
  const session: Session = {
    queue,
    index: 0,
    reviewed: 0,
    graduated: 0,
    revealed: false,
  };
  renderSession(root, session);
}

function renderSession(root: HTMLElement, s: Session) {
  // Conserva el título; reemplaza el resto.
  root.innerHTML = `<h1 class="screen__title">Repaso</h1>`;

  if (s.queue.length === 0) {
    const empty = document.createElement("div");
    empty.className = "review__empty";
    empty.innerHTML = `
      <p>No hay tarjetas por repasar.</p>
      <p class="screen__subtitle">Añade palabras desde el lector tocándolas y pulsando “Al mazo”.</p>
    `;
    root.appendChild(empty);
    return;
  }

  if (s.index >= s.queue.length) {
    const done = document.createElement("div");
    done.className = "review__done";
    done.innerHTML = `
      <p class="review__done-num">${s.reviewed}</p>
      <p>tarjeta${s.reviewed === 1 ? "" : "s"} repasada${s.reviewed === 1 ? "" : "s"}.</p>
      ${s.graduated > 0 ? `<p class="screen__subtitle">${s.graduated} palabra${s.graduated === 1 ? "" : "s"} dominada${s.graduated === 1 ? "" : "s"}.</p>` : ""}
    `;
    root.appendChild(done);
    return;
  }

  const card = s.queue[s.index];
  const remaining = s.queue.length - s.index;

  const wrap = document.createElement("div");
  wrap.className = "review";
  wrap.innerHTML = `
    <p class="review__count"><strong>${remaining}</strong> por repasar</p>
    <div class="review__card">
      <div class="review__word" lang="ja">${escapeHtml(card.word)}</div>
      ${s.revealed ? renderBack(card) : ""}
    </div>
  `;

  const actions = document.createElement("div");
  actions.className = "review__actions";
  if (!s.revealed) {
    const reveal = document.createElement("button");
    reveal.className = "btn btn--primary";
    reveal.textContent = "Mostrar";
    reveal.style.flex = "1";
    reveal.addEventListener("click", () => {
      s.revealed = true;
      renderSession(root, s);
    });
    actions.appendChild(reveal);
  } else {
    for (const r of UI_RATINGS) {
      const btn = document.createElement("button");
      btn.className = `btn ${r.key === "again" ? "btn--again" : r.key === "good" ? "btn--primary" : ""}`;
      const interval = nextIntervalLabel(card, r.rating);
      btn.innerHTML = `<span>${r.label}</span><span class="review__interval">${interval}</span>`;
      btn.addEventListener("click", async () => {
        actions.querySelectorAll("button").forEach((b) => (b.disabled = true));
        const outcome = await reviewCard(card, r.rating);
        s.reviewed++;
        if (outcome.graduated) s.graduated++;
        s.index++;
        s.revealed = false;
        renderSession(root, s);
      });
      actions.appendChild(btn);
    }
  }
  wrap.appendChild(actions);
  root.appendChild(wrap);
}

function renderBack(card: DeckCard): string {
  return `
    ${card.reading ? `<div class="review__reading" lang="ja">${escapeHtml(card.reading)}</div>` : ""}
    <div class="review__meaning">${card.meaning ? escapeHtml(card.meaning) : "Sin definición."}</div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
