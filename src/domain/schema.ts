import { z } from "zod";

/**
 * Data model of a plan. Every imported or persisted plan goes through `PlanSchema`,
 * so missing fields get defaults and old files keep loading after upgrades.
 * Bump SCHEMA_VERSION and add a step in migrate.ts when the shape changes.
 */
export const SCHEMA_VERSION = 1;

/** Jalali date "YYYY/MM/DD" with Latin digits, or "" when unset. Zero-padded, so string order = date order. */
const jdate = z.string().regex(/^(\d{4}\/\d{2}\/\d{2})?$/).catch("");
const text = z.string().catch("");
const num = z.number().finite().catch(0);

export const PrioritySchema = z.enum(["critical", "high", "medium", "low"]).catch("medium");
export const StatusSchema = z.enum(["todo", "doing", "done", "postponed"]).catch("todo");

export const CategorySchema = z.object({
  id: z.string(),
  name: text,
  question: text.default(""),
  /** Slot in the categorical palette (0-7). */
  color: z.number().int().min(0).max(7).catch(0),
});

export const RequirementSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  title: text,
  desired: text.default(""),
  current: text.default(""),
  goal: text.default(""),
  priority: PrioritySchema.default("medium"),
  dueDate: jdate.default(""),
  note: text.default(""),
});

export const ActivitySchema = z.object({
  id: z.string(),
  requirementId: z.string().nullable().catch(null).default(null),
  program: text.default(""),
  title: text,
  start: jdate.default(""),
  end: jdate.default(""),
  owner: text.default(""),
  resources: text.default(""),
  /** Estimated hours of the plan owner's time. */
  hours: num.default(0),
  /** Planned cost in the plan's currency unit. */
  cost: num.default(0),
  actualCost: z.number().finite().nullable().catch(null).default(null),
  status: StatusSchema.default("todo"),
  progress: z.number().min(0).max(100).catch(0).default(0),
  note: text.default(""),
});

export const PhaseSchema = z.object({
  id: z.string(),
  name: text,
  start: jdate,
  end: jdate,
  description: text.default(""),
});

export const KpiSchema = z.object({
  id: z.string(),
  title: text,
  unit: text.default(""),
  target: num.default(0),
  /** sum: monthly amounts add up · last: enter the running total each month · avg: average of months */
  mode: z.enum(["sum", "last", "avg"]).catch("sum").default("sum"),
  /** Monthly values keyed by "YYYY-MM" (Jalali). */
  values: z.record(z.string(), z.number().finite()).catch({}).default({}),
  requirementId: z.string().nullable().catch(null).default(null),
});

export const MilestoneSchema = z.object({
  id: z.string(),
  date: jdate,
  title: text,
  done: z.boolean().catch(false).default(false),
});

export const ReviewSchema = z.object({
  id: z.string(),
  date: jdate,
  wins: text.default(""),
  blockers: text.default(""),
  focus: text.default(""),
  mood: z.number().int().min(1).max(5).catch(3).default(3),
  progress: num.default(0),
});

export const PlanSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().catch(SCHEMA_VERSION).default(SCHEMA_VERSION),
  title: text,
  vision: text.default(""),
  /** «الگو»: the role model / benchmark the desired state is drawn from. */
  model: text.default(""),
  focus: text.default(""),
  owner: text.default(""),
  start: jdate,
  end: jdate,
  weeklyHours: num.default(15),
  budgetMin: num.default(0),
  budgetMax: num.default(0),
  currency: text.default("میلیون تومان"),
  categories: z.array(CategorySchema).catch([]).default([]),
  requirements: z.array(RequirementSchema).catch([]).default([]),
  activities: z.array(ActivitySchema).catch([]).default([]),
  phases: z.array(PhaseSchema).catch([]).default([]),
  kpis: z.array(KpiSchema).catch([]).default([]),
  milestones: z.array(MilestoneSchema).catch([]).default([]),
  reviews: z.array(ReviewSchema).catch([]).default([]),
  createdAt: text.default(""),
  updatedAt: text.default(""),
});

export type Priority = z.infer<typeof PrioritySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type Kpi = z.infer<typeof KpiSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type JDate = string;
