import { DEFAULT_CATEGORIES } from "./defaults";
import { addDays, addMonths, todayJ } from "./jalali";
import { PlanSchema, SCHEMA_VERSION } from "./schema";
import type { Activity, JDate, Phase, Plan, Requirement } from "./schema";

export function uid(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix + rnd;
}

export const nowIso = () => new Date().toISOString();

export function defaultCategories(): Plan["categories"] {
  return DEFAULT_CATEGORIES.map((c, i) => ({ id: c.key, name: c.name, question: c.question, color: i }));
}

/** Splits [start, end] into `count` consecutive phases of equal months. */
export function quarterlyPhases(start: JDate, months: number, count = 4): Phase[] {
  const names = ["پایه‌گذاری", "اعتبارسازی", "رشد", "تثبیت و مقیاس"];
  const per = Math.max(1, Math.round(months / count));
  return Array.from({ length: count }, (_, i) => {
    const s = addMonths(start, i * per);
    const e = i === count - 1 ? addDays(addMonths(start, months), -1) : addDays(addMonths(start, (i + 1) * per), -1);
    return { id: uid("ph"), name: `فاز ${i + 1} — ${names[i] ?? ""}`.trim(), start: s, end: e, description: "" };
  });
}

export interface NewPlanInput {
  title: string;
  vision: string;
  model: string;
  focus?: string;
  owner?: string;
  start: JDate;
  months: number;
  weeklyHours: number;
  budgetMin: number;
  budgetMax: number;
  withPhases: boolean;
}

export function createPlan(input: NewPlanInput): Plan {
  const end = addDays(addMonths(input.start, input.months), -1);
  return PlanSchema.parse({
    id: uid("p"),
    schemaVersion: SCHEMA_VERSION,
    title: input.title,
    vision: input.vision,
    model: input.model,
    focus: input.focus ?? "",
    owner: input.owner ?? "",
    start: input.start,
    end,
    weeklyHours: input.weeklyHours,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    categories: defaultCategories(),
    phases: input.withPhases ? quarterlyPhases(input.start, input.months) : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export function newRequirement(categoryId: string, patch: Partial<Requirement> = {}): Requirement {
  return {
    id: uid("r"), categoryId, title: "", desired: "", current: "", goal: "",
    priority: "medium", dueDate: "", note: "", ...patch,
  };
}

export function newActivity(plan: Plan, patch: Partial<Activity> = {}): Activity {
  const today = todayJ();
  const start = plan.start && today < plan.start ? plan.start : today;
  return {
    id: uid("a"), requirementId: null, program: "", title: "", start, end: addDays(start, 13),
    owner: plan.owner || "خودم", resources: "", hours: 0, cost: 0, actualCost: null,
    status: "todo", progress: 0, note: "", ...patch,
  };
}
