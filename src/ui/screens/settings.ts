import "../../styles/settings.css";
import { getSettings, saveSettings, MODELS } from "../../services/settings.ts";
import { exportDeck } from "../../services/deck.ts";
import {
  getDictStatus,
  loadFullDictionary,
  type LoadProgress,
} from "../../data/jmdict.ts";

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
          placeholder="sk-ant-..." />
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
      <label class="field__label">Diccionario</label>
      <div class="dict-bar" id="dict-bar"></div>
      <p class="field__hint">El diccionario completo (~22.000 palabras) mejora las definiciones. Se descarga una vez y queda offline.</p>
    </div>

    <div class="field">
      <label class="field__label">Respaldo</label>
      <button class="btn" id="export">Exportar mazo (JSON)</button>
    </div>

    <p class="settings-note">
      Fuentes de lectura: en la pestaña Leer puedes traer texto real de Wikipedia
      (cualquier tema, o al azar) y de Wikinews (noticias) en japonés — vía su API
      pública, sin proxy. NHK News Web Easy ya no está disponible (cerró su acceso público).
    </p>
  `;

  const keyInput = container.querySelector<HTMLInputElement>("#api-key")!;
  keyInput.value = settings.apiKey ?? "";
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

  void renderDictBar(container.querySelector<HTMLElement>("#dict-bar")!);
}

async function renderDictBar(bar: HTMLElement) {
  const status = await getDictStatus();
  if (status.source === "full") {
    bar.innerHTML = `<span>Completo · ${status.entryCount.toLocaleString("es")} palabras</span>`;
    return;
  }
  bar.innerHTML = `
    <span id="dict-label">Básico · ${status.entryCount.toLocaleString("es")} palabras</span>
    <button class="btn" id="dict-dl">Descargar completo</button>
  `;
  bar.querySelector<HTMLButtonElement>("#dict-dl")!.addEventListener("click", async () => {
    bar.innerHTML = `
      <span id="dict-label">Preparando…</span>
      <div class="dict-bar__progress"><span id="dict-prog"></span></div>
    `;
    const labelEl = bar.querySelector<HTMLElement>("#dict-label")!;
    const progEl = bar.querySelector<HTMLElement>("#dict-prog")!;
    const onProgress = (p: LoadProgress) => {
      labelEl.textContent = p.message;
      if (p.ratio !== undefined) progEl.style.width = `${Math.round(p.ratio * 100)}%`;
    };
    try {
      const result = await loadFullDictionary(onProgress);
      bar.innerHTML = `<span>Completo · ${result.entryCount.toLocaleString("es")} palabras</span>`;
    } catch (err) {
      console.error(err);
      labelEl.textContent = "Error al descargar. Reintenta más tarde.";
    }
  });
}
