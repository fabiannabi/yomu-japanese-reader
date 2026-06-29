import { unzipSync, strFromU8 } from "fflate";
import { db, type DictEntry, type Meta } from "./db.ts";

/**
 * Carga del diccionario JMdict-simplified (subconjunto "common", inglés) en IndexedDB.
 *
 * - El asset solo existe como .zip (~1.4 MB) en GitHub Releases; se descomprime en el cliente.
 * - Los release assets de GitHub envían CORS permisivo, así que `fetch` funciona en el navegador.
 * - El primer arranque carga un seed pequeño (offline, instantáneo); el diccionario completo
 *   se baja a demanda con indicador de progreso.
 */

// ---- Tipos del formato jmdict-simplified (subconjunto que usamos) ----
interface JMGloss {
  lang: string;
  text: string;
}
interface JMSense {
  partOfSpeech: string[];
  gloss: JMGloss[];
}
interface JMKanji {
  text: string;
  common: boolean;
}
interface JMKana {
  text: string;
  common: boolean;
}
export interface JMWord {
  id: string;
  kanji: JMKanji[];
  kana: JMKana[];
  sense: JMSense[];
}
interface JMFile {
  words: JMWord[];
  tags?: Record<string, string>;
}

const GH_LATEST =
  "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest";

const META_STATUS = "dictStatus";

export type DictSource = "none" | "seed" | "full";

export interface DictStatus {
  source: DictSource;
  entryCount: number;
  version?: string;
  loadedAt?: number;
}

export interface LoadProgress {
  phase: "resolviendo" | "descargando" | "descomprimiendo" | "indexando";
  /** 0–1 cuando se conoce el total; undefined si es indeterminado. */
  ratio?: number;
  message: string;
}

type ProgressFn = (p: LoadProgress) => void;

// Mapeo mínimo de códigos POS de JMdict a etiquetas legibles (las más comunes).
const POS_LABELS: Record<string, string> = {
  n: "sustantivo",
  "adj-i": "adjetivo-i",
  "adj-na": "adjetivo-na",
  "adj-no": "adjetivo-no",
  adv: "adverbio",
  v1: "verbo ichidan",
  "v5u": "verbo godan",
  "v5k": "verbo godan",
  "v5s": "verbo godan",
  "v5t": "verbo godan",
  "v5r": "verbo godan",
  "v5g": "verbo godan",
  "v5b": "verbo godan",
  "v5m": "verbo godan",
  "v5n": "verbo godan",
  vs: "verbo suru",
  "vs-i": "verbo suru",
  vk: "verbo kuru",
  exp: "expresión",
  int: "interjección",
  pn: "pronombre",
  conj: "conjunción",
  prt: "partícula",
  pref: "prefijo",
  suf: "sufijo",
  ctr: "contador",
  num: "número",
};

function readablePos(codes: string[]): string {
  const labels = codes.map((c) => POS_LABELS[c] ?? c);
  return [...new Set(labels)].join(", ");
}

/**
 * Convierte una entrada JMdict en filas de `dict` (una por cada escritura y lectura únicas).
 * Función pura: testeable sin IndexedDB.
 */
export function wordToEntries(word: JMWord): DictEntry[] {
  const kanjiTexts = word.kanji.map((k) => k.text);
  const kanaTexts = word.kana.map((k) => k.text);

  const primaryWord = kanjiTexts[0] ?? kanaTexts[0] ?? "";
  const primaryReading = kanaTexts[0] ?? "";
  if (!primaryWord) return [];

  // Glosas en inglés unidas por sentido; varios sentidos separados por " / ".
  const meaning = word.sense
    .map((s) =>
      s.gloss
        .filter((g) => g.lang === "eng")
        .map((g) => g.text)
        .join("; ")
    )
    .filter(Boolean)
    .join(" / ");

  const posCodes = word.sense.flatMap((s) => s.partOfSpeech);
  const pos = readablePos(posCodes);
  const common =
    word.kanji.some((k) => k.common) || word.kana.some((k) => k.common);

  // Claves de lookup: todas las escrituras + todas las lecturas, únicas.
  const keys = [...new Set([...kanjiTexts, ...kanaTexts])].filter(Boolean);

  return keys.map((key) => ({
    key,
    word: primaryWord,
    reading: primaryReading,
    meaning,
    pos,
    common,
  }));
}

/** Parsea el JSON crudo de jmdict-simplified. Función pura. */
export function parseJmdict(jsonText: string): JMFile {
  return JSON.parse(jsonText) as JMFile;
}

// ---- Estado en IndexedDB ----

export async function getDictStatus(): Promise<DictStatus> {
  const meta = await db.meta.get(META_STATUS);
  if (meta && typeof meta.value === "object" && meta.value !== null) {
    return meta.value as DictStatus;
  }
  const count = await db.dict.count();
  return { source: count > 0 ? "seed" : "none", entryCount: count };
}

async function setDictStatus(status: DictStatus): Promise<void> {
  const row: Meta = { key: META_STATUS, value: status };
  await db.meta.put(row);
}

async function bulkInsert(
  entries: DictEntry[],
  onProgress?: ProgressFn
): Promise<void> {
  const CHUNK = 5000;
  if (entries.length === 0) return;
  for (let i = 0; i < entries.length; i += CHUNK) {
    await db.dict.bulkAdd(entries.slice(i, i + CHUNK));
    onProgress?.({
      phase: "indexando",
      ratio: Math.min(1, (i + CHUNK) / entries.length),
      message: `Indexando ${Math.min(i + CHUNK, entries.length).toLocaleString(
        "es"
      )} / ${entries.length.toLocaleString("es")}`,
    });
  }
}

// ---- Carga del seed (offline, primer arranque) ----

/** Si el diccionario está vacío, carga el seed incluido en /public. Idempotente. */
export async function ensureSeedDictionary(): Promise<DictStatus> {
  const status = await getDictStatus();
  if (status.entryCount > 0) return status;

  const url = `${import.meta.env.BASE_URL}dict-seed.json`.replace(
    /\/{2,}/g,
    "/"
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar el seed: ${res.statusText}`);
  const file = parseJmdict(await res.text());

  const entries = file.words.flatMap(wordToEntries);
  await db.dict.bulkAdd(entries);

  const newStatus: DictStatus = {
    source: "seed",
    entryCount: entries.length,
    loadedAt: Date.now(),
  };
  await setDictStatus(newStatus);
  return newStatus;
}

// ---- Carga del diccionario completo (a demanda, con progreso) ----

async function resolveLatestZipUrl(): Promise<{ url: string; version: string }> {
  const res = await fetch(GH_LATEST, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(`No se pudo consultar el último release: ${res.statusText}`);
  }
  const data = (await res.json()) as {
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
  };
  const asset = data.assets.find(
    (a) => a.name.startsWith("jmdict-eng-common") && a.name.endsWith(".json.zip")
  );
  if (!asset) throw new Error("No se encontró el asset jmdict-eng-common .zip");
  return { url: asset.browser_download_url, version: data.tag_name };
}

async function fetchWithProgress(
  url: string,
  onProgress?: ProgressFn
): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Descarga fallida: ${res.statusText}`);
  }
  const total = Number(res.headers.get("Content-Length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.({
      phase: "descargando",
      ratio: total ? received / total : undefined,
      message: total
        ? `Descargando ${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(
            1
          )} MB`
        : `Descargando ${(received / 1e6).toFixed(1)} MB`,
    });
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Descarga e indexa el diccionario JMdict completo (common). Reemplaza lo existente.
 * Llama a onProgress en cada fase para alimentar la barra de progreso.
 */
export async function loadFullDictionary(
  onProgress?: ProgressFn
): Promise<DictStatus> {
  onProgress?.({
    phase: "resolviendo",
    message: "Buscando la última versión del diccionario…",
  });
  const { url, version } = await resolveLatestZipUrl();

  const zipBytes = await fetchWithProgress(url, onProgress);

  onProgress?.({ phase: "descomprimiendo", message: "Descomprimiendo…" });
  const files = unzipSync(zipBytes);
  const jsonName = Object.keys(files).find((n) => n.endsWith(".json"));
  if (!jsonName) throw new Error("El zip no contiene un .json");
  const file = parseJmdict(strFromU8(files[jsonName]));

  onProgress?.({
    phase: "indexando",
    ratio: 0,
    message: "Preparando entradas…",
  });
  const entries = file.words.flatMap(wordToEntries);

  // Reemplaza el contenido actual (seed o versión previa).
  await db.dict.clear();
  await bulkInsert(entries, onProgress);

  const status: DictStatus = {
    source: "full",
    entryCount: entries.length,
    version,
    loadedAt: Date.now(),
  };
  await setDictStatus(status);
  return status;
}
