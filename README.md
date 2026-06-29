# 読む — Yomu

Tutor personal para **leer japonés del mundo real** (noticias, letreros, menús) y
**memorizar el vocabulario**. Resalta las palabras que aún no conoces, las explica al
tocarlas y las guarda en repaso espaciado. Todo corre en el cliente: gratis y offline,
salvo "explicar gramática" (API de Claude, opcional).

## Funciones

- **Lector**: pega texto u OCR de una foto → tokenización con furigana, palabras nuevas resaltadas.
- **Diccionario** offline (JMdict-simplified) al tocar cualquier palabra.
- **Repaso espaciado** (FSRS) y **progreso** con % de comprensión.
- **Cámara / OCR** de japonés (Tesseract.js).
- **Explicar gramática** con IA (API de Claude; la key vive solo en tu navegador).
- **PWA** instalable y offline.

## Correr en local

```bash
npm install        # copia también el diccionario kuromoji a public/dict
npm run dev        # http://localhost:5173
npm run build      # estático en dist/
npm run preview    # sirve dist/ localmente
npm run selftest   # pruebas de lógica pura (kana, diccionario, FSRS)
```

## Stack

Vite + TypeScript (vanilla) · Dexie (IndexedDB) · @aiktb/kuromoji · jmdict-simplified ·
ts-fsrs · Tesseract.js · vite-plugin-pwa · API de Claude (opcional).

## Publicar en GitHub Pages

El despliegue está listo (`.github/workflows/deploy.yml`): cada push a `main` construye
y publica en Pages, con el `base` ajustado automáticamente al nombre del repo.

1. Crea el repo y súbelo (requiere tu autorización):
   ```bash
   gh repo create yomu --public --source . --push
   ```
2. En GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` actualiza la URL `https://<usuario>.github.io/<repo>/`.

## Notas

- Solo para **leer**. Para practicar **hablar**, usa la app de ChatGPT/Gemini aparte.
- El diccionario kuromoji (~96 MB) se reconstruye desde `node_modules` y no se commitea.
- La API key de Claude se guarda solo en IndexedDB del navegador; nunca en el repo.
