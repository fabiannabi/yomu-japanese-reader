import { db, type Settings } from "../data/db.ts";

/**
 * Ajustes de la app (§6). La API key vive SOLO en IndexedDB del navegador,
 * nunca se commitea ni sale del dispositivo (§4, §11).
 */

const ID = "app";

export const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — rápido y económico" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — equilibrado" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — máxima calidad" },
] as const;

export const DEFAULT_MODEL = "claude-haiku-4-5";

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(ID)) ?? { id: ID, model: DEFAULT_MODEL };
}

export async function saveSettings(patch: Partial<Omit<Settings, "id">>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: ID });
}

export async function getApiKey(): Promise<string | undefined> {
  return (await getSettings()).apiKey;
}

export async function getModel(): Promise<string> {
  return (await getSettings()).model ?? DEFAULT_MODEL;
}

export async function hasApiKey(): Promise<boolean> {
  return !!(await getApiKey());
}
