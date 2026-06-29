export function ReviewScreen(): HTMLElement {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h1 class="screen__title">Repaso</h1>
    <p class="screen__subtitle">Repasa las palabras de tu mazo con repetición espaciada.</p>
    <div class="placeholder">
      El repaso (SRS) llega en la Fase 3.
    </div>
  `;
  return el;
}
