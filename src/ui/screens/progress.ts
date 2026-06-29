export function ProgressScreen(): HTMLElement {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h1 class="screen__title">Progreso</h1>
    <p class="screen__subtitle">Palabras dominadas y tu % de comprensión.</p>
    <div class="placeholder">
      El progreso llega en la Fase 3.
    </div>
  `;
  return el;
}
