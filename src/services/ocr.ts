import { createWorker, type Worker } from "tesseract.js";

/**
 * OCR de japonés con Tesseract.js. El core WASM y los datos de idioma (jpn)
 * se descargan desde CDN la primera vez y quedan cacheados por el navegador.
 * (En la Fase 6, para PWA offline, se hospedarán localmente.)
 */

export interface OcrProgress {
  status: string; // estado crudo de tesseract (p. ej. "recognizing text")
  ratio: number; // 0–1
  message: string; // mensaje en español para la UI
}

type ProgressFn = (p: OcrProgress) => void;

let workerPromise: Promise<Worker> | null = null;

const STATUS_ES: Record<string, string> = {
  "loading tesseract core": "Cargando motor…",
  "initializing tesseract": "Inicializando…",
  "loading language traineddata": "Descargando datos de japonés…",
  "initializing api": "Preparando…",
  "recognizing text": "Reconociendo texto…",
};

function getWorker(onProgress?: ProgressFn): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("jpn", 1, {
      logger: (m: { status: string; progress: number }) => {
        onProgress?.({
          status: m.status,
          ratio: m.progress,
          message: STATUS_ES[m.status] ?? m.status,
        });
      },
    }).catch((err) => {
      workerPromise = null; // permitir reintento
      throw err;
    });
  }
  return workerPromise;
}

/** Limpieza típica del OCR japonés: quita espacios espurios entre caracteres. */
export function cleanOcrText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reconoce texto japonés en una imagen (File/Blob/dataURL). Devuelve texto limpio. */
export async function recognizeImage(
  image: File | Blob | string,
  onProgress?: ProgressFn
): Promise<string> {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  return cleanOcrText(data.text);
}

/** Libera el worker (p. ej. al cerrar la app). */
export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
