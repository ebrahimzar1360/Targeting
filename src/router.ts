import { useSyncExternalStore } from "react";

/** Minimal hash router: "#/plan?open=a12" → { page: "plan", params: { open: "a12" } }. Works on any static host. */
export type Page = "dashboard" | "vision" | "requirements" | "plan" | "kpi" | "budget" | "review" | "report" | "settings" | "guide";
const PAGES: Page[] = ["dashboard", "vision", "requirements", "plan", "kpi", "budget", "review", "report", "settings", "guide"];

export interface Route { page: Page; params: Record<string, string> }

function parse(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const page = (PAGES as string[]).includes(path) ? (path as Page) : "dashboard";
  return { page, params: Object.fromEntries(new URLSearchParams(query)) };
}

let cached = { hash: "", route: parse("") };
function snapshot(): Route {
  if (cached.hash !== location.hash) cached = { hash: location.hash, route: parse(location.hash) };
  return cached.route;
}
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export const useRoute = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export function navigate(page: Page, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString();
  location.hash = `/${page}${q ? `?${q}` : ""}`;
}

/** Removes query params (e.g. after a sheet closes) without adding a history entry. */
export function clearParams() {
  const { page } = snapshot();
  history.replaceState(null, "", `#/${page}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
