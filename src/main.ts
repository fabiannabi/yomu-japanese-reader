import "./styles/app.css";
import { db } from "./data/db.ts";
import { startRouter } from "./ui/router.ts";

// Abre la base de datos local (§6). En la Fase 1 cargará JMdict en el primer arranque.
db.open().catch((err) => console.error("No se pudo abrir la base de datos:", err));

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("No se encontró el contenedor #app");

startRouter(root);
