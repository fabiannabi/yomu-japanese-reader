# Empezar aquí

Estos son los únicos pasos que haces tú. De ahí en adelante, miras el localhost mientras Claude Code construye.

## Una sola vez (preparar)

1. Instala lo necesario en tu compu (Windows está bien para todo esto):
   - **Node.js 18+** (https://nodejs.org)
   - **Git**
   - **Claude Code** (o usa la pestaña Code de la app de escritorio de Claude). Corre con tu suscripción.
   - (Opcional, para publicar después) **GitHub CLI** (`gh`) autenticado.

2. Crea una carpeta vacía para el proyecto y copia dentro:
   - `CLAUDE.md`
   - la carpeta `.claude/agents/` con `qa-reviewer.md` y `design-reviewer.md`

   Debe quedar así:
   ```
   mi-app/
     CLAUDE.md
     .claude/agents/qa-reviewer.md
     .claude/agents/design-reviewer.md
   ```

## Lanzar (y a mirar)

3. Abre Claude Code en esa carpeta y dile, tal cual:

   > Lee CLAUDE.md y construye el proyecto fase por fase. Usa plan mode al inicio de cada fase, corre el dev server, invoca al subagente qa-reviewer antes de cada commit, haz commit al cerrar cada fase, y sigue sin pedirme permiso entre fases. Cuando el localhost esté corriendo, dame la URL.

4. Abre la URL de localhost que te dé (normalmente http://localhost:5173) y míralo construirse. Claude Code te irá diciendo, fase por fase, qué deberías ver.

## Lo que SÍ te va a preguntar

Por seguridad, se detiene solo para pedirte confirmación en: publicar/crear el repo en GitHub, instalar herramientas globales, o borrar cosas. Los commits locales los hace solo.

## Recordatorio

- Esta app es solo para **leer**. Para **hablar** japonés, usa la app de ChatGPT/Gemini (modo de voz), aparte.
- Casi todo es gratis y offline. Lo único que cuesta es "explicar gramática" con IA, y es opcional.
