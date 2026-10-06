import { defaultCategories, nowIso, uid } from "./factory";
import { PlanSchema, SCHEMA_VERSION } from "./schema";
import type { Plan } from "./schema";

/**
 * Turns anything that looks like a plan (an old export, a hand-edited file) into a valid
 * current Plan. Unknown fields are dropped, missing ones get defaults.
 * Add `if (version < N)` steps here when SCHEMA_VERSION is bumped.
 */
export function normalizePlan(raw: unknown): Plan {
  if (!raw || typeof raw !== "object") throw new Error("فایل برنامه معتبر نیست.");
  const obj = { ...(raw as Record<string, unknown>) };
  if (typeof obj.id !== "string") obj.id = uid("p");
  if (!Array.isArray(obj.categories) || obj.categories.length === 0) obj.categories = defaultCategories();
  const res = PlanSchema.safeParse(obj);
  if (!res.success) throw new Error("ساختار فایل برنامه قابل خواندن نیست.");
  const plan = res.data;
  plan.schemaVersion = SCHEMA_VERSION;
  plan.updatedAt ||= nowIso();
  plan.createdAt ||= plan.updatedAt;
  // Drop links that point nowhere so health checks report them as unlinked.
  const reqIds = new Set(plan.requirements.map((r) => r.id));
  const catIds = new Set(plan.categories.map((c) => c.id));
  plan.activities.forEach((a) => { if (a.requirementId && !reqIds.has(a.requirementId)) a.requirementId = null; });
  plan.kpis.forEach((k) => { if (k.requirementId && !reqIds.has(k.requirementId)) k.requirementId = null; });
  plan.requirements.forEach((r) => { if (!catIds.has(r.categoryId)) r.categoryId = plan.categories[0].id; });
  return plan;
}

/** File format for backups: one or many plans. */
export interface BackupFile { app: "hadafnegar"; version: number; exportedAt: string; plans: Plan[] }

export function makeBackup(plans: Plan[]): BackupFile {
  return { app: "hadafnegar", version: SCHEMA_VERSION, exportedAt: nowIso(), plans };
}

export function readBackup(json: unknown): Plan[] {
  if (json && typeof json === "object" && Array.isArray((json as BackupFile).plans)) {
    return (json as BackupFile).plans.map(normalizePlan);
  }
  return [normalizePlan(json)];
}
