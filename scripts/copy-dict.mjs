// Copia el diccionario IPADIC de @aiktb/kuromoji (archivos *.dat sin comprimir)
// a public/dict para que Vite los sirva en dev y los incluya en el build.
// El diccionario es reproducible desde node_modules, así que public/dict
// está en .gitignore y no se commitea.

import { cp, mkdir, access, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../node_modules/@aiktb/kuromoji/dict");
const dest = resolve(here, "../public/dict");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(src))) {
  console.error(
    "[copy-dict] No se encontró el diccionario en node_modules. Corre `npm install` primero."
  );
  process.exit(1);
}

// Si ya está copiado y no vacío, no hacer nada (idempotente, no ralentiza dev).
if (await exists(dest)) {
  const files = await readdir(dest);
  if (files.some((f) => f.endsWith(".dat"))) {
    console.log("[copy-dict] public/dict ya está listo.");
    process.exit(0);
  }
}

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log("[copy-dict] Diccionario kuromoji copiado a public/dict.");
