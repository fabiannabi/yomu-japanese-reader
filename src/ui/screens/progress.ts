import "../../styles/review.css";
import { getProgressStats, comprehension } from "../../services/progress.ts";
import { getReadingStats } from "./read.ts";

export function ProgressScreen(): HTMLElement {
  const root = document.createElement("section");
  root.className = "screen";
  root.innerHTML = `
    <h1 class="screen__title">Progreso</h1>
    <p class="screen__subtitle">Palabras dominadas y tu % de comprensión.</p>
    <div id="stats"></div>
  `;
  void render(root);
  return root;
}

async function render(root: HTMLElement) {
  const stats = await getProgressStats();
  const container = root.querySelector<HTMLElement>("#stats")!;

  const reading = getReadingStats();
  const pct = reading ? comprehension(reading.known, reading.total) : null;

  container.innerHTML = `
    <div class="stats">
      <div class="stat">
        <div class="stat__num">${stats.known}</div>
        <div class="stat__label">dominadas</div>
      </div>
      <div class="stat">
        <div class="stat__num">${stats.deck}</div>
        <div class="stat__label">en el mazo</div>
      </div>
      <div class="stat">
        <div class="stat__num stat__num--due">${stats.due}</div>
        <div class="stat__label">por repasar</div>
      </div>
    </div>
    ${
      pct === null
        ? `<div class="comprehension-card">
             <p class="comprehension-card__title">Comprensión</p>
             <p class="screen__subtitle" style="margin:0">Analiza un texto en la pestaña Leer para ver tu % de comprensión.</p>
           </div>`
        : `<div class="comprehension-card">
             <p class="comprehension-card__title">Comprensión del último texto</p>
             <div class="comprehension-bar"><span style="width:${pct}%"></span></div>
             <p class="comprehension-card__pct">${pct}%</p>
             <p class="screen__subtitle" style="margin:0">${reading!.known} de ${reading!.total} palabras de contenido conocidas.</p>
           </div>`
    }
  `;
}
