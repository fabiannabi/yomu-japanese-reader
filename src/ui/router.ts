import { ReadScreen } from "./screens/read.ts";
import { ReviewScreen } from "./screens/review.ts";
import { ProgressScreen } from "./screens/progress.ts";
import { SettingsScreen } from "./screens/settings.ts";
import { countDue } from "../services/deck.ts";

export type RouteId = "leer" | "repaso" | "progreso" | "ajustes";

interface Route {
  id: RouteId;
  label: string;
  icon: string; // SVG inline (line icon)
  render: () => HTMLElement;
}

// Iconos de línea (estilo Feather), claros y reconocibles.
const ICONS: Record<RouteId, string> = {
  leer: `<svg viewBox="0 0 24 24"><path d="M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z"/></svg>`,
  repaso: `<svg viewBox="0 0 24 24"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>`,
  progreso: `<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-5 3 3 5-7"/></svg>`,
  ajustes: `<svg viewBox="0 0 24 24"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>`,
};

const routes: Route[] = [
  { id: "leer", label: "Leer", icon: ICONS.leer, render: ReadScreen },
  { id: "repaso", label: "Repaso", icon: ICONS.repaso, render: ReviewScreen },
  { id: "progreso", label: "Progreso", icon: ICONS.progreso, render: ProgressScreen },
  { id: "ajustes", label: "Ajustes", icon: ICONS.ajustes, render: SettingsScreen },
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
      <span class="bottom-nav__icon" aria-hidden="true">${route.icon}</span>
      <span class="bottom-nav__label">${route.label}</span>
    `;
    btn.addEventListener("click", () => {
      location.hash = `#/${route.id}`;
    });
    nav.appendChild(btn);
  }

  // Badge de repasos pendientes en la pestaña Repaso.
  void countDue().then((n) => {
    if (n <= 0) return;
    const repasoBtn = nav.children[1] as HTMLElement;
    const iconSpan = repasoBtn.querySelector(".bottom-nav__icon");
    if (!iconSpan) return;
    const badge = document.createElement("span");
    badge.className = "bottom-nav__badge";
    badge.textContent = n > 99 ? "99+" : String(n);
    iconSpan.appendChild(badge);
  });

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
