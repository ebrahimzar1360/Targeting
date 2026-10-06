import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nowIso, uid } from "@/domain/factory";
import { normalizePlan } from "@/domain/migrate";
import type { Activity, Kpi, Milestone, Phase, Plan, Requirement, Review } from "@/domain/schema";

export type Theme = "system" | "light" | "dark";
export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (پیش‌فرض، دقیق‌تر)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (سریع‌تر و ارزان‌تر)" },
] as const;

export interface Settings {
  theme: Theme;
  aiKey: string;
  aiModel: string;
  /** Optional Anthropic-compatible endpoint; empty = api.anthropic.com. */
  aiBaseUrl: string;
}

interface Snapshot { planId: string; plan: Plan; label: string }

interface State {
  plans: Plan[];
  activeId: string | null;
  settings: Settings;
  lastBackupAt: string | null;
  /** In-memory undo stack (not persisted). */
  past: Snapshot[];

  addPlan(plan: Plan): void;
  setActive(id: string): void;
  deletePlan(id: string): void;
  duplicatePlan(id: string): void;
  replaceAll(plans: Plan[]): void;

  /** Applies `recipe` to a copy of the active plan and records an undo step. */
  edit(label: string, recipe: (p: Plan) => void): void;
  undo(): Snapshot | null;

  upsertRequirement(r: Requirement): void;
  deleteRequirement(id: string): void;
  upsertActivity(a: Activity): void;
  deleteActivity(id: string): void;
  upsertKpi(k: Kpi): void;
  deleteKpi(id: string): void;
  setKpiValue(id: string, month: string, value: number | null): void;
  upsertPhase(p: Phase): void;
  deletePhase(id: string): void;
  upsertMilestone(m: Milestone): void;
  deleteMilestone(id: string): void;
  addReview(r: Review): void;

  setSettings(patch: Partial<Settings>): void;
  markBackup(): void;
}

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item); else list[i] = item;
};
const removeById = <T extends { id: string }>(list: T[], id: string) => list.filter((x) => x.id !== id);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      plans: [],
      activeId: null,
      settings: { theme: "system", aiKey: "", aiModel: AI_MODELS[0].id, aiBaseUrl: "" },
      lastBackupAt: null,
      past: [],

      addPlan: (plan) => set((s) => ({ plans: [...s.plans, plan], activeId: plan.id })),
      setActive: (id) => set({ activeId: id, past: [] }),
      deletePlan: (id) =>
        set((s) => {
          const plans = s.plans.filter((p) => p.id !== id);
          return { plans, activeId: s.activeId === id ? (plans[0]?.id ?? null) : s.activeId, past: [] };
        }),
      duplicatePlan: (id) =>
        set((s) => {
          const src = s.plans.find((p) => p.id === id);
          if (!src) return {};
          const copy: Plan = { ...structuredClone(src), id: uid("p"), title: `${src.title} (کپی)`, createdAt: nowIso(), updatedAt: nowIso() };
          return { plans: [...s.plans, copy], activeId: copy.id };
        }),
      replaceAll: (plans) => set({ plans, activeId: plans[0]?.id ?? null, past: [] }),

      edit: (label, recipe) =>
        set((s) => {
          const idx = s.plans.findIndex((p) => p.id === s.activeId);
          if (idx === -1) return {};
          const before = s.plans[idx];
          const next = structuredClone(before);
          recipe(next);
          next.updatedAt = nowIso();
          const plans = s.plans.slice();
          plans[idx] = next;
          return { plans, past: [...s.past.slice(-29), { planId: before.id, plan: before, label }] };
        }),
      undo: () => {
        const s = get();
        const last = s.past[s.past.length - 1];
        if (!last) return null;
        set({
          plans: s.plans.map((p) => (p.id === last.planId ? last.plan : p)),
          activeId: last.planId,
          past: s.past.slice(0, -1),
        });
        return last;
      },

      upsertRequirement: (r) => get().edit("ذخیره الزام", (p) => upsert(p.requirements, r)),
      deleteRequirement: (id) =>
        get().edit("حذف الزام", (p) => {
          p.requirements = removeById(p.requirements, id);
          p.activities.forEach((a) => { if (a.requirementId === id) a.requirementId = null; });
          p.kpis.forEach((k) => { if (k.requirementId === id) k.requirementId = null; });
        }),
      upsertActivity: (a) => get().edit("ذخیره فعالیت", (p) => upsert(p.activities, a)),
      deleteActivity: (id) => get().edit("حذف فعالیت", (p) => { p.activities = removeById(p.activities, id); }),
      upsertKpi: (k) => get().edit("ذخیره شاخص", (p) => upsert(p.kpis, k)),
      deleteKpi: (id) => get().edit("حذف شاخص", (p) => { p.kpis = removeById(p.kpis, id); }),
      setKpiValue: (id, month, value) =>
        get().edit("ثبت عدد شاخص", (p) => {
          const k = p.kpis.find((x) => x.id === id);
          if (!k) return;
          if (value === null) delete k.values[month]; else k.values[month] = value;
        }),
      upsertPhase: (ph) => get().edit("ذخیره فاز", (p) => { upsert(p.phases, ph); p.phases.sort((a, b) => a.start.localeCompare(b.start)); }),
      deletePhase: (id) => get().edit("حذف فاز", (p) => { p.phases = removeById(p.phases, id); }),
      upsertMilestone: (m) => get().edit("ذخیره نقطه عطف", (p) => { upsert(p.milestones, m); p.milestones.sort((a, b) => a.date.localeCompare(b.date)); }),
      deleteMilestone: (id) => get().edit("حذف نقطه عطف", (p) => { p.milestones = removeById(p.milestones, id); }),
      addReview: (r) => get().edit("ثبت بازبینی", (p) => { p.reviews.push(r); }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      markBackup: () => set({ lastBackupAt: nowIso() }),
    }),
    {
      name: "hadafnegar",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ plans: s.plans, activeId: s.activeId, settings: s.settings, lastBackupAt: s.lastBackupAt }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const plans: Plan[] = [];
        for (const raw of p.plans ?? []) {
          try { plans.push(normalizePlan(raw)); } catch { /* skip unreadable plan */ }
        }
        return {
          ...current,
          plans,
          activeId: plans.some((x) => x.id === p.activeId) ? p.activeId! : (plans[0]?.id ?? null),
          settings: { ...current.settings, ...(p.settings ?? {}) },
          lastBackupAt: p.lastBackupAt ?? null,
        };
      },
    },
  ),
);

export const useActivePlan = () => useStore((s) => s.plans.find((p) => p.id === s.activeId) ?? null);

/** Use inside pages that are only rendered when a plan exists. */
export function usePlan(): Plan {
  const plan = useActivePlan();
  if (!plan) throw new Error("No active plan");
  return plan;
}
