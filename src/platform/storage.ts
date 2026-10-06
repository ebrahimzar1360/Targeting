import { create } from "zustand";
import type { StateStorage } from "zustand/middleware";
import { IS_ARTIFACT, capability, errorCode } from "./index";
import type { ArtifactDb } from "./index";

/** Where this viewer's plans are kept, shown in Settings. */
export const useStorageMode = create<{ mode: "device" | "account" }>(() => ({ mode: "device" }));

const local: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked or full */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/** Never send an API key to the shared store; the artifact build does not use one. */
const withoutKey = (s: unknown) => {
  if (!s || typeof s !== "object") return null;
  const { aiKey: _omit, ...rest } = s as Record<string, unknown>;
  return rest;
};

interface Persisted { state: { plans?: { id: string }[]; activeId?: string | null; settings?: unknown; lastBackupAt?: string | null }; version?: number }

/**
 * claude.ai storage: each viewer's plans live in their own private subtree of the artifact's
 * database (`data/users/<id>/…`), one document per plan plus one for app state, so they survive
 * cleared browser data and follow the viewer across devices. Viewers who cannot write there
 * (signed out, view-only, public-link visitors) fall back to this browser's localStorage.
 * localStorage is also kept as a fast local copy.
 */
function accountStorage(): StateStorage {
  let target: { db: ArtifactDb; base: string } | null = null;
  const written = new Map<string, string>(); // doc path → last JSON written
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = Promise.resolve();

  const resolveTarget = async () => {
    const [db, user] = await Promise.all([capability("db"), capability("user")]);
    const uid = user ? await user.id().catch(() => null) : null;
    if (!db || !uid) return null;
    try { db.doc(`data/users/${uid}/app`); } catch { return null; } // id not usable as a path segment
    return { db, base: `data/users/${uid}` };
  };

  const flush = async (value: string) => {
    if (!target) return;
    const { db, base } = target;
    const parsed = JSON.parse(value) as Persisted;
    const plans = parsed.state.plans ?? [];
    const docs = new Map<string, string>();
    for (const p of plans) docs.set(`${base}/plan-${p.id}`, JSON.stringify({ plan: p }));
    docs.set(`${base}/app`, JSON.stringify({
      version: parsed.version ?? 1, planIds: plans.map((p) => p.id), activeId: parsed.state.activeId ?? null,
      settings: withoutKey(parsed.state.settings), lastBackupAt: parsed.state.lastBackupAt ?? null,
    }));
    try {
      // One write at a time, only for documents whose content changed.
      for (const [path, json] of docs) {
        if (written.get(path) === json) continue;
        await db.doc(path).set(JSON.parse(json));
        written.set(path, json);
      }
      for (const path of [...written.keys()]) {
        if (!docs.has(path)) { await db.doc(path).delete(); written.delete(path); }
      }
    } catch (e) {
      // No write access for this viewer: keep working on this device only.
      if (errorCode(e) === "invalid_argument" || errorCode(e) === "revoked" || errorCode(e) === "not_granted") {
        target = null;
        useStorageMode.setState({ mode: "device" });
      }
    }
  };

  return {
    async getItem(name) {
      const cached = local.getItem(name) as string | null;
      target = await resolveTarget();
      if (!target) return cached;
      try {
        const app = await target.db.doc(`${target.base}/app`).get();
        if (!app.exists) {
          useStorageMode.setState({ mode: "account" });
          return cached; // first visit: start from (and later upload) whatever this browser has
        }
        const a = app.data() as { version?: number; planIds?: string[]; activeId?: string | null; settings?: unknown; lastBackupAt?: string | null };
        const plans: unknown[] = [];
        for (const id of a.planIds ?? []) {
          const path = `${target.base}/plan-${id}`;
          const snap = await target.db.doc(path).get();
          const plan = snap.exists ? (snap.data() as { plan?: unknown }).plan : undefined;
          if (plan) { plans.push(plan); written.set(path, JSON.stringify({ plan })); }
        }
        written.set(`${target.base}/app`, JSON.stringify({
          version: a.version ?? 1, planIds: a.planIds ?? [], activeId: a.activeId ?? null, settings: a.settings ?? null, lastBackupAt: a.lastBackupAt ?? null,
        }));
        useStorageMode.setState({ mode: "account" });
        return JSON.stringify({ state: { plans, activeId: a.activeId ?? null, settings: a.settings ?? undefined, lastBackupAt: a.lastBackupAt ?? null }, version: a.version ?? 1 });
      } catch {
        target = null;
        return cached;
      }
    },
    setItem(name, value) {
      local.setItem(name, value);
      if (!target) return;
      // Coalesce bursts of edits (typing, sliders) into one save per pause.
      pending = value;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const v = pending!;
        pending = null;
        writing = writing.then(() => flush(v));
      }, 800);
    },
    removeItem: local.removeItem,
  };
}

export const appStorage: StateStorage = IS_ARTIFACT ? accountStorage() : local;
