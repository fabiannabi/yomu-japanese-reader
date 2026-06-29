export function ReadScreen(): HTMLElement {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h1 class="screen__title">Leer</h1>
    <p class="screen__subtitle">Pega texto japonés o usa la cámara para empezar a leer.</p>
    <div class="placeholder">
      El lector llega en la Fase 2.
    </div>
  `;
  return el;
}
