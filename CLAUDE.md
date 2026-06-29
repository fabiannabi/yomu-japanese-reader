# 読む (Yomu) — Tutor de lectura de japonés

> Documento puente entre la planeación (hecha con Claude en el chat) y la construcción (Claude Code).
> Léelo completo antes de tocar código. Construye **fase por fase**, con auto-revisión y commit al cerrar cada fase.

---

## 1. Visión

App personal para **leer japonés del mundo real** (noticias, letreros, menús, empaques) y **memorizar el vocabulario** que encuentro. Resalta las palabras que aún no conozco, me deja tocarlas para ver lectura y significado, y las guarda en un sistema de repaso espaciado. A medida que aprendo, esas palabras dejan de resaltarse y mi % de comprensión sube.

El motor central es un **modelo del estudiante**: el conjunto de palabras que ya domino. Todo lo demás (resaltado, % de comprensión, repaso) se deriva de ahí.

## 2. Alcance

**Dentro:** leer (pegar texto, cámara/OCR, y más adelante noticias NHK), tokenizar japonés, resaltar palabras nuevas vs. conocidas, diccionario al tocar, repaso espaciado (SRS), progreso, y explicación de gramática con IA (opcional).

**Fuera (NO construir):** práctica de **hablar**. Eso se cubre con la app de ChatGPT/Gemini por separado. No hay módulo de voz, ni grabación, ni conversación en esta app.

## 3. Cómo trabajar (instrucciones de autonomía)

Quiero ver el localhost y ver cómo se construye, con la mínima intervención mía. Por lo tanto:

1. **Empieza en plan mode** al inicio de cada fase: propón un plan corto antes de implementar.
2. **Implementa la fase completa.**
3. **Corre el dev server** (`npm run dev`) y verifica los **criterios de aceptación** de esa fase.
4. **Invoca al subagente `qa-reviewer`** para revisar el diff contra los criterios y el diseño; corrige lo que reporte.
5. **Haz commit** con mensaje convencional (ver §10).
6. **Dime en 1–2 líneas** qué quedó y **qué debería ver yo en el localhost** para confirmarlo visualmente, y **sigue con la siguiente fase sin esperar mi permiso.**
7. No te detengas entre fases salvo para acciones que requieren confirmación (§11).

Estoy mirando el localhost y soy tu verificador visual. Tú encárgate de la lógica y la auto-revisión; yo confirmo lo que se ve.

## 4. Stack técnico

- **Vite + TypeScript (vanilla, sin framework pesado)** — dev server con hot-reload para ver cómo se construye en vivo; build a estático para GitHub Pages.
- **Dexie.js** sobre IndexedDB para persistencia local (palabras conocidas, mazo, ajustes).
- **kuromoji** (o un fork mantenido como `@aiktb/kuromoji`/`kuromojin`) para tokenizar japonés con diccionario IPADIC.
- **jmdict-simplified** (releases JSON de `scriptin/jmdict-simplified`) como diccionario; usar el subconjunto "common" para mantenerlo ligero, indexado en IndexedDB.
- **ts-fsrs** para el algoritmo de repaso espaciado (FSRS).
- **Tesseract.js** (`jpn` + `jpn_vert`) para el OCR de cámara.
- **vite-plugin-pwa** para que sea instalable y funcione offline (clave en el iPhone: Compartir → Añadir a inicio).
- **API de Claude** (solo para "explicar gramática", opcional) llamada directo del navegador con la cabecera `anthropic-dangerous-direct-browser-access: true`; la key la pone el usuario y se guarda en localStorage. **Nunca** se commitea.

Todo corre en el cliente. No hay backend propio. Objetivo: desplegable en GitHub Pages, casi todo gratis y offline; lo único con costo es "explicar gramática".

## 5. Estructura de carpetas

```
/public            # jmdict json, diccionario kuromoji, manifest PWA
/src
  /data            # capa Dexie: stores + carga de JMdict
  /services        # tokenizer, dictionary lookup, srs, ocr, llm
  /ui              # pantallas y componentes
  /styles          # tokens y css
  main.ts
index.html
vite.config.ts
```

## 6. Modelo de datos (Dexie / IndexedDB)

- `knownWords`: `{ word, addedAt }` — el modelo del estudiante. Si una palabra está aquí, NO se resalta.
- `deck`: `{ id, word, reading, meaning, due, stability, difficulty, reps, lapses, state }` — tarjetas FSRS.
- `dict`: índice de JMdict (clave por escritura y por lectura) para lookup rápido offline.
- `settings`: `{ apiKey, model, sources }`.

Regla central: cuando una palabra del `deck` se "gradúa" (la dominas), se inserta en `knownWords` y deja de resaltarse en futuros textos.

## 7. Pantallas y flujo

Basado en los wireframes ya aprobados. Navegación inferior con 4 pestañas: **Leer · Repaso · Progreso · Ajustes**. Dos entradas al lector (fuentes y cámara) que convergen en la misma pantalla de lectura.

1. **Inicio/Leer** — repasos pendientes, acceso a fuentes, snapshot de progreso.
2. **Elegir fuente** — pegar texto · cámara · (NHK, fase 5).
3. **Lector** — texto tokenizado; **palabras nuevas resaltadas**, conocidas en texto plano; tocar abre el detalle.
4. **Detalle de palabra** (hoja inferior) — escritura, furigana/lectura, acento tonal si está disponible, significado, botones **[al mazo]** y **[explicar]**.
5. **Explicar gramática** — explicación de la oración con IA (opcional, fase 5).
6. **Cámara/OCR** — foto → texto detectado → cae en el lector.
7. **Repaso (SRS)** — frente (palabra) → mostrar → calificar (otra vez / bien / fácil).
8. **Progreso** — palabras dominadas, % de comprensión, tendencia.
9. **Ajustes** — API key, modelo, fuentes, exportar mazo.

## 8. Fases de construcción

Cada fase termina con: dev server corriendo, criterios cumplidos, revisión del `qa-reviewer`, y un commit.

### Fase 0 — Andamiaje
Scaffold Vite + TS, Dexie, estructura de §5, navegación de 4 pestañas vacías, `git init`, primer commit, dev server.
**Aceptación:** `npm run dev` abre, se ven 4 pestañas navegables, sin errores en consola.

### Fase 1 — Capa de datos + tokenizer + diccionario
Stores de Dexie (§6). Cargar `jmdict-simplified` (common) a IndexedDB en el primer arranque con indicador de progreso. Servicio de tokenización con kuromoji. Servicio de lookup en el diccionario.
**Aceptación:** dado un texto japonés, una función devuelve tokens con lectura y significado desde el diccionario local.

### Fase 2 — Lector + detalle de palabra
Pegar texto → tokenizar → render con furigana. Resaltar tokens **que no estén en `knownWords`**. Tocar token → hoja de detalle (lectura, significado, [al mazo], [explicar deshabilitado por ahora]). [al mazo] crea tarjeta FSRS.
**Aceptación:** pego una oración, veo furigana, las palabras nuevas resaltadas; toco una, la guardo, y deja de resaltarse al re-analizar.

### Fase 3 — Repaso (SRS) + Progreso
Repaso con `ts-fsrs` (frente/atrás/calificar). Al graduar una tarjeta, mover la palabra a `knownWords`. Pantalla de progreso: conteo de dominadas y % de comprensión de un texto (palabras conocidas ÷ total).
**Aceptación:** repaso una tarjeta, la calificación reprograma el `due`; el contador de "por repasar" y el % de comprensión se actualizan.

### Fase 4 — Cámara / OCR
Entrada de cámara (`<input capture>`/getUserMedia) + Tesseract.js (`jpn`,`jpn_vert`). El texto detectado entra al lector con el mismo flujo.
**Aceptación:** subo/tomo una foto de texto japonés impreso claro y aparece tokenizado en el lector.

### Fase 5 — Explicar gramática (IA) + fuente NHK
Pantalla de ajustes con API key + modelo. Botón "explicar" llama a la API de Claude (CORS de navegador) y muestra la explicación de la oración. Fuente NHK News Web Easy (manejar CORS; si bloquea, usar proxy en dev o dejar la fuente como "experimental").
**Aceptación:** con una key válida, "explicar" devuelve una explicación de gramática en español; sin key, el botón guía a ajustes.

### Fase 6 — PWA + despliegue
`vite-plugin-pwa` (instalable, offline). `base` correcto para GitHub Pages. GitHub Action que despliega a Pages en cada push a `main`.
**Aceptación:** `npm run build` genera estático; instalable como PWA; (si el usuario autoriza el push) queda publicado en la URL de Pages.

## 9. Diseño

Identidad **tinta sobre papel** con índigo japonés (藍) y un toque de bermellón (朱), modo claro y oscuro.

- Papel `#faf8f3` / tinta `#1a1c22`; índigo `#284b8c` (acción principal); bermellón `#c8482e` (solo alertas/"por repasar"); línea `#e3ddd0`.
- Oscuro: papel `#15161a`, tinta `#eceae3`, índigo `#8fb0e8`.
- Japonés: `"Hiragino Sans","Noto Sans JP","Yu Gothic"`; UI: system sans. Furigana con `<ruby>`.
- Palabra resaltada = fondo índigo tenue. Acento tonal con contorno sobre la kana cuando haya datos.
- Sentence case, sin emojis, formas limpias, esquinas suaves.

## 10. Convenciones

- **Commits convencionales**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`. Uno por fase (o por sub-tarea grande). Ej: `feat(reader): resaltado de palabras desconocidas`.
- TypeScript estricto. Funciones de servicio puras y testeables. Nada de claves ni secretos en el repo (usar `.gitignore`, y la API key vive solo en localStorage del navegador).
- Nombres de archivos en kebab-case.

## 11. Acciones que requieren mi confirmación

No hagas sin preguntarme primero: **push a un repo remoto / crear repo en GitHub**, instalar herramientas globales, borrar archivos o ramas, cualquier cosa irreversible, o exponer/commitear una key. Los commits **locales** sí los haces libremente, fase por fase.

## 12. Repo y git

- `git init` y commits locales desde la Fase 0 (libre).
- Para publicar: pregúntame; si autorizo, usa `gh repo create` (requiere GitHub CLI autenticado) o dame los comandos para hacerlo yo.
- `.gitignore` con `node_modules`, `dist`, `.env`, claves.

## 13. Cómo correr (localhost)

```
npm install
npm run dev      # abre http://localhost:5173 — aquí miro cómo se construye
npm run build    # estático para GitHub Pages
```

## 14. Agentes y auto-revisión

- Usa **plan mode** al inicio de cada fase.
- Subagentes definidos en `.claude/agents/`:
  - **qa-reviewer** — tras cada fase, revisa el diff contra los criterios de aceptación y reporta fallos. Invócalo siempre antes del commit.
  - **design-reviewer** — revisa que la UI respete los tokens de diseño (§9) y los wireframes.
- Bucle de feedback por fase: *implementar → correr → qa-reviewer → corregir → (design-reviewer en fases de UI) → commit → siguiente*.
- Para tareas de búsqueda/exploración pesada usa el subagente Explore para no llenar el contexto principal.

## 15. Notas de costo

- Claude Code **interactivo** (terminal o app de escritorio) corre con la suscripción Pro/Max.
- La app en sí: NHK + kuromoji + JMdict + SRS + OCR son **gratis**. Lo único con costo es "explicar gramática" (API de Claude, centavos; o gratis con el tier gratuito de Gemini si se decide cambiar ese servicio).
- Existe un prototipo previo de `index.html` (hecho en el chat) como referencia del flujo, pero **construye la versión real desde cero** siguiendo este documento; no lo copies tal cual.
