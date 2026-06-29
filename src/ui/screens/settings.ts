export function SettingsScreen(): HTMLElement {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h1 class="screen__title">Ajustes</h1>
    <p class="screen__subtitle">API key, modelo, fuentes y exportar mazo.</p>
    <div class="placeholder">
      Los ajustes llegan en la Fase 5.
    </div>
  `;
  return el;
}
