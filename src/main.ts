import "./styles/app.css";
import { db } from "./data/db.ts";
import { ensureSeedDictionary } from "./data/jmdict.ts";
import { startRouter } from "./ui/router.ts";

// Abre la base de datos local (§6) y asegura un diccionario mínimo (seed offline)
// en el primer arranque. El diccionario completo se baja a demanda (Fase 5/ajustes).
db.open()
  .then(() => ensureSeedDictionary())
  .then((s) => console.info(`[yomu] diccionario listo: ${s.entryCount} entradas (${s.source})`))
  .catch((err) => console.error("No se pudo inicializar la base de datos:", err));

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("No se encontró el contenedor #app");

startRouter(root);
