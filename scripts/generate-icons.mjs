// Genera los PNG de icono para PWA/iOS desde public/icon.svg.
// Uso puntual: `node scripts/generate-icons.mjs` (requiere sharp como devDep).
// Los PNG resultantes se commitean en public/, así que el CI no necesita sharp.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svg = resolve(here, "../public/icon.svg");
const out = (name) => resolve(here, "../public", name);

const targets = [
  ["pwa-192x192.png", 192],
  ["pwa-512x512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(out(name));
  console.log(`[icons] ${name} (${size}x${size})`);
}
