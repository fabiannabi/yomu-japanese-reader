import { openSourceSheet, type SourceKind } from "./source-sheet.ts";
import { recognizeImage, type OcrProgress } from "../../services/ocr.ts";

/**
 * Hoja "Cambiar fuente": elige de dónde traer la próxima lectura.
 * Pegar texto y Foto se resuelven aquí mismo; Wikipedia/Noticias/Aozora
 * abren su propia hoja de exploración. Al obtener texto, llama onText.
 */
export function openChooser(onText: (text: string) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const sheet = document.createElement("div");
  sheet.className = "sheet sheet--browse";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Cambiar fuente");

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
  overlay.addEventListener("keydown", onKey);

  const deliver = (text: string) => {
    onText(text);
    close();
  };

  function renderMenu() {
    sheet.innerHTML = `
      <div class="sheet__grip" aria-hidden="true"></div>
      <div class="sheet__header">
        <h2 class="sheet__title">Cambiar fuente</h2>
        <button class="sheet__close" aria-label="Cerrar">×</button>
      </div>
      <div class="sheet__list" id="menu"></div>
    `;
    sheet.querySelector(".sheet__grip")!.addEventListener("click", close);
    sheet.querySelector(".sheet__close")!.addEventListener("click", close);

    const menu = sheet.querySelector<HTMLElement>("#menu")!;
    const opt = (label: string, sub: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.className = "browse-item";
      b.type = "button";
      b.innerHTML = `<span>${label}</span><span class="browse-item__sub">${sub}</span>`;
      b.addEventListener("click", onClick);
      menu.appendChild(b);
    };

    opt("Pegar texto", "Escribe o pega japonés", renderPaste);
    opt("Foto o cámara", "Reconoce texto de una imagen", startPhoto);
    opt("Wikipedia", "Artículos sobre cualquier tema", () => {
      close();
      openSourceSheet("wikipedia" as SourceKind, onText);
    });
    opt("Noticias", "Wikinews en japonés", () => {
      close();
      openSourceSheet("news" as SourceKind, onText);
    });
    opt("Aozora Bunko", "Literatura clásica gratuita", () => {
      close();
      openSourceSheet("aozora" as SourceKind, onText);
    });
  }

  function renderPaste() {
    sheet.innerHTML = `
      <div class="sheet__grip" aria-hidden="true"></div>
      <div class="sheet__header">
        <h2 class="sheet__title">Pegar texto</h2>
        <button class="sheet__close" aria-label="Cerrar">×</button>
      </div>
      <textarea class="source__textarea" id="paste" lang="ja"
        placeholder="ここに日本語のテキストを貼り付け…"></textarea>
      <button class="btn btn--primary btn--block" id="paste-go">Leer este texto</button>
    `;
    sheet.querySelector(".sheet__grip")!.addEventListener("click", close);
    sheet.querySelector(".sheet__close")!.addEventListener("click", close);
    const ta = sheet.querySelector<HTMLTextAreaElement>("#paste")!;
    ta.focus();
    sheet.querySelector<HTMLButtonElement>("#paste-go")!.addEventListener("click", () => {
      if (ta.value.trim()) deliver(ta.value);
    });
  }

  function startPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      sheet.innerHTML = `
        <div class="sheet__grip" aria-hidden="true"></div>
        <div class="sheet__header"><h2 class="sheet__title">Leyendo la imagen</h2></div>
        <div class="ocr-status" style="margin-top:0">
          <span id="ocr-label">Preparando…</span>
          <div class="dict-bar__progress"><span id="ocr-prog"></span></div>
        </div>
      `;
      const labelEl = sheet.querySelector<HTMLElement>("#ocr-label")!;
      const progEl = sheet.querySelector<HTMLElement>("#ocr-prog")!;
      const onProgress = (p: OcrProgress) => {
        labelEl.textContent = p.message;
        progEl.style.width = `${Math.round(p.ratio * 100)}%`;
      };
      try {
        const text = await recognizeImage(file, onProgress);
        if (text) deliver(text);
        else {
          labelEl.textContent = "No se detectó texto. Prueba con una foto más nítida.";
          labelEl.className = "sheet__state--err";
        }
      } catch {
        labelEl.textContent = "Error en el OCR. Reintenta.";
        labelEl.className = "sheet__state--err";
      }
    });
    input.click();
  }

  renderMenu();
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
