import "../../styles/settings.css";
import { getSettings, saveSettings, MODELS } from "../../services/settings.ts";
import { exportDeck } from "../../services/deck.ts";

export function SettingsScreen(): HTMLElement {
  const root = document.createElement("section");
  root.className = "screen";
  root.innerHTML = `
    <h1 class="screen__title">Ajustes</h1>
    <p class="screen__subtitle">API key para “explicar gramática”, modelo y respaldo del mazo.</p>
    <div id="settings"></div>
  `;
  void render(root);
  return root;
}

async function render(root: HTMLElement) {
  const settings = await getSettings();
  const container = root.querySelector<HTMLElement>("#settings")!;

  const options = MODELS.map(
    (m) =>
      `<option value="${m.id}" ${m.id === settings.model ? "selected" : ""}>${m.label}</option>`
  ).join("");

  container.innerHTML = `
    <div class="field">
      <label class="field__label" for="api-key">API key de Claude</label>
      <div class="field__row">
        <input class="field__input" id="api-key" type="password" autocomplete="off"
          placeholder="sk-ant-..." value="${settings.apiKey ?? ""}" />
        <button class="btn btn--primary" id="save-key">Guardar</button>
      </div>
      <p class="field__status" id="key-status"></p>
      <p class="field__hint">Se guarda solo en este dispositivo (IndexedDB). Nunca se sube a ningún repositorio.</p>
    </div>

    <div class="field">
      <label class="field__label" for="model">Modelo</label>
      <select class="field__select" id="model">${options}</select>
      <p class="field__hint">“Explicar gramática” es lo único con costo (centavos). El resto de la app es gratis y offline.</p>
    </div>

    <div class="field">
      <label class="field__label">Respaldo</label>
      <button class="btn" id="export">Exportar mazo (JSON)</button>
    </div>

    <p class="settings-note">
      Fuente NHK News Web Easy: experimental. NHK no permite el acceso directo desde el navegador
      (CORS), así que puede no cargar; mientras tanto, pega el texto en la pestaña Leer.
    </p>
  `;

  const keyInput = container.querySelector<HTMLInputElement>("#api-key")!;
  const status = container.querySelector<HTMLElement>("#key-status")!;
  container.querySelector<HTMLButtonElement>("#save-key")!.addEventListener("click", async () => {
    await saveSettings({ apiKey: keyInput.value.trim() || undefined });
    status.textContent = keyInput.value.trim() ? "Key guardada." : "Key eliminada.";
    status.className = "field__status field__status--ok";
  });

  const modelSelect = container.querySelector<HTMLSelectElement>("#model")!;
  modelSelect.addEventListener("change", async () => {
    await saveSettings({ model: modelSelect.value });
  });

  container.querySelector<HTMLButtonElement>("#export")!.addEventListener("click", async () => {
    const json = await exportDeck();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yomu-mazo.json";
    a.click();
    URL.revokeObjectURL(url);
  });
}
