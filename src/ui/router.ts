import { ReadScreen } from "./screens/read.ts";
import { ReviewScreen } from "./screens/review.ts";
import { ProgressScreen } from "./screens/progress.ts";
import { SettingsScreen } from "./screens/settings.ts";

export type RouteId = "leer" | "repaso" | "progreso" | "ajustes";

interface Route {
  id: RouteId;
  label: string;
  glyph: string; // kanji corto como icono de la pestaña
  render: () => HTMLElement;
}

const routes: Route[] = [
  { id: "leer", label: "Leer", glyph: "読", render: ReadScreen },
  { id: "repaso", label: "Repaso", glyph: "習", render: ReviewScreen },
  { id: "progreso", label: "Progreso", glyph: "伸", render: ProgressScreen },
  { id: "ajustes", label: "Ajustes", glyph: "設", render: SettingsScreen },
];

const DEFAULT_ROUTE: RouteId = "leer";

function currentRouteId(): RouteId {
  const hash = location.hash.replace(/^#\/?/, "") as RouteId;
  return routes.some((r) => r.id === hash) ? hash : DEFAULT_ROUTE;
}

function buildNav(active: RouteId): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Navegación principal");

  for (const route of routes) {
    const btn = document.createElement("button");
    btn.className = "bottom-nav__item";
    btn.type = "button";
    if (route.id === active) btn.setAttribute("aria-current", "page");
    btn.innerHTML = `
      <span class="bottom-nav__glyph" aria-hidden="true">${route.glyph}</span>
      <span class="bottom-nav__label">${route.label}</span>
    `;
    btn.addEventListener("click", () => {
      location.hash = `#/${route.id}`;
    });
    nav.appendChild(btn);
  }
  return nav;
}

function renderInto(root: HTMLElement) {
  const active = currentRouteId();
  const route = routes.find((r) => r.id === active)!;

  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.appendChild(route.render());
  shell.appendChild(buildNav(active));

  root.replaceChildren(shell);
}

export function startRouter(root: HTMLElement) {
  if (!location.hash) location.hash = `#/${DEFAULT_ROUTE}`;
  renderInto(root);
  window.addEventListener("hashchange", () => renderInto(root));
}
