import { useSyncExternalStore } from "react";

/**
 * Minimal router: "#/plan?open=a12" → { page: "plan", params: { open: "a12" } }.
 * The route lives in memory and is mirrored to the URL hash when the host allows it, so it
 * works on any static host and inside claude.ai's sandboxed frame alike.
 */
export type Page = "dashboard" | "vision" | "requirements" | "plan" | "kpi" | "budget" | "review" | "report" | "settings" | "guide";
const PAGES: Page[] = ["dashboard", "vision", "requirements", "plan", "kpi", "budget", "review", "report", "settings", "guide"];

export interface Route { page: Page; params: Record<string, string> }

function parse(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const page = (PAGES as string[]).includes(path) ? (path as Page) : "dashboard";
  return { page, params: Object.fromEntries(new URLSearchParams(query)) };
}

const listeners = new Set<() => void>();
let current: Route = parse(typeof location === "undefined" ? "" : location.hash);
const set = (r: Route) => { current = r; listeners.forEach((l) => l()); };

if (typeof window !== "undefined") {
  const fromUrl = () => { if (location.hash.startsWith("#/")) set(parse(location.hash)); };
  window.addEventListener("hashchange", fromUrl);
  window.addEventListener("popstate", fromUrl);
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useRoute = () => useSyncExternalStore(subscribe, () => current, () => current);

const toHash = (r: Route) => { const q = new URLSearchParams(r.params).toString(); return `#/${r.page}${q ? `?${q}` : ""}`; };

export function navigate(page: Page, params: Record<string, string> = {}) {
  const r = { page, params };
  try { history.pushState(null, "", toHash(r)); } catch { /* URL is read-only here; memory route still works */ }
  set(r);
}

/** Removes query params (e.g. after a sheet closes) without adding a history entry. */
export function clearParams() {
  const r = { page: current.page, params: {} };
  try { history.replaceState(null, "", toHash(r)); } catch { /* ignore */ }
  set(r);
}

/** Click handler for in-app links: keeps the href for semantics, navigates in memory. */
export const linkTo = (page: Page) => (e: { preventDefault(): void; metaKey?: boolean; ctrlKey?: boolean }) => {
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  navigate(page);
};
