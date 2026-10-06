import { PRIORITY_RANK } from "./defaults";
import { addDays, dayNumber, diffDays, faNum, monthsBetween, weekStart } from "./jalali";
import type { Activity, JDate, Kpi, Phase, Plan, Requirement } from "./schema";

// ---------- Progress ----------

export const activityProgress = (a: Activity) => (a.status === "done" ? 100 : Math.max(0, Math.min(100, a.progress)));

/** Hours drive the weighting; cost-only items (0 h) still count as one unit of work. */
const weight = (a: Activity) => (a.hours > 0 ? a.hours : 1);

function weightedProgress(acts: Activity[]): number | null {
  if (!acts.length) return null;
  let w = 0, s = 0;
  for (const a of acts) { w += weight(a); s += weight(a) * activityProgress(a); }
  return s / w / 100;
}

export const activitiesOf = (plan: Plan, reqId: string) => plan.activities.filter((a) => a.requirementId === reqId);

/** 0..1, or null when the requirement has no activities yet. */
export const requirementProgress = (plan: Plan, reqId: string) => weightedProgress(activitiesOf(plan, reqId));

export function categoryStats(plan: Plan, categoryId: string) {
  const reqs = plan.requirements.filter((r) => r.categoryId === categoryId);
  const progresses = reqs.map((r) => requirementProgress(plan, r.id) ?? 0);
  return {
    count: reqs.length,
    critical: reqs.filter((r) => r.priority === "critical").length,
    progress: progresses.length ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0,
  };
}

/** Overall progress, weighted by estimated hours. */
export const planProgress = (plan: Plan) => weightedProgress(plan.activities) ?? 0;

/** Where progress should be today if every activity advanced linearly over its dates. */
export function expectedProgress(plan: Plan, today: JDate): number {
  if (!plan.activities.length) return 0;
  let w = 0, s = 0;
  for (const a of plan.activities) {
    const len = diffDays(a.start, a.end) + 1;
    if (!Number.isFinite(len) || len <= 0) continue;
    const elapsed = Math.max(0, Math.min(len, diffDays(a.start, today) + 1));
    w += weight(a); s += weight(a) * (elapsed / len);
  }
  return w ? s / w : 0;
}

// ---------- Dates & schedule ----------

export const isOverdue = (a: Activity, today: JDate) => a.status !== "done" && !!a.end && a.end < today;
export const isActiveOn = (a: Activity, j: JDate) => !!a.start && !!a.end && a.start <= j && j <= a.end;

export function phaseOf(plan: Plan, j: JDate): Phase | undefined {
  return plan.phases.find((p) => p.start <= j && j <= p.end);
}

/** Activities whose dates overlap [from, to]. */
export const overlapping = (acts: Activity[], from: JDate, to: JDate) =>
  acts.filter((a) => a.start && a.end && a.start <= to && a.end >= from);

// ---------- Capacity ----------

export interface WeekLoad { start: JDate; end: JDate; hours: number; activities: { id: string; hours: number }[] }

/**
 * Spreads each activity's hours evenly over its days and sums them per Saturday-based week.
 * Compare against plan.weeklyHours to find overloaded weeks.
 */
export function weeklyLoad(plan: Plan, includeDone = true): WeekLoad[] {
  if (!plan.start || !plan.end) return [];
  const first = weekStart(plan.start);
  const lastDay = dayNumber(plan.end);
  const weeks: WeekLoad[] = [];
  for (let s = first; dayNumber(s) <= lastDay && weeks.length < 260; s = addDays(s, 7)) {
    weeks.push({ start: s, end: addDays(s, 6), hours: 0, activities: [] });
  }
  const firstN = dayNumber(first);
  for (const a of plan.activities) {
    if (!includeDone && a.status === "done") continue;
    if (!a.hours || !a.start || !a.end) continue;
    const s = dayNumber(a.start), e = dayNumber(a.end);
    if (!(e >= s)) continue;
    const perDay = a.hours / (e - s + 1);
    for (let d = Math.max(s, firstN); d <= e; d++) {
      const w = weeks[Math.floor((d - firstN) / 7)];
      if (!w) break;
      w.hours += perDay;
      const entry = w.activities.find((x) => x.id === a.id);
      if (entry) entry.hours += perDay; else w.activities.push({ id: a.id, hours: perDay });
    }
  }
  return weeks;
}

// ---------- Budget ----------

export function budgetSummary(plan: Plan) {
  const planned = plan.activities.reduce((s, a) => s + (a.cost || 0), 0);
  const actual = plan.activities.reduce((s, a) => s + (a.actualCost ?? 0), 0);
  const reqCat = new Map(plan.requirements.map((r) => [r.id, r.categoryId]));
  const byCategory = new Map<string, number>();
  const byPhase = new Map<string, number>();
  for (const a of plan.activities) {
    if (!a.cost) continue;
    const cat = (a.requirementId && reqCat.get(a.requirementId)) || "__none";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + a.cost);
    const ph = phaseOf(plan, a.start)?.id ?? "__none";
    byPhase.set(ph, (byPhase.get(ph) ?? 0) + a.cost);
  }
  return { planned, actual, byCategory, byPhase };
}

// ---------- KPIs ----------

export function kpiValue(kpi: Kpi, monthKeys: string[]): number | null {
  const vals = monthKeys.map((k) => kpi.values[k]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  if (kpi.mode === "sum") return vals.reduce((a, b) => a + b, 0);
  if (kpi.mode === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals[vals.length - 1];
}

export const planMonths = (plan: Plan) => monthsBetween(plan.start, plan.end);

// ---------- Goal quality ----------

/** Lightweight SMART hints: a goal should carry a number and a deadline. */
export function goalChecks(r: Requirement) {
  return {
    measurable: /[0-9۰-۹]/.test(r.goal),
    timed: !!r.dueDate,
  };
}

// ---------- Plan health ----------

export type Severity = "critical" | "serious" | "warning" | "info";
export interface HealthItem { id: string; label: string; target: { page: string; open?: string } }
export interface HealthIssue { key: string; severity: Severity; title: string; detail: string; items: HealthItem[] }

const SEV_RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2, info: 3 };

/**
 * Deterministic checks that catch the inconsistencies a spreadsheet lets through:
 * unlinked goals and activities, dates that miss deadlines, budget over the cap,
 * weeks over capacity.
 */
export function healthChecks(plan: Plan, today: JDate): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const reqById = new Map(plan.requirements.map((r) => [r.id, r]));
  const reqItem = (r: Requirement): HealthItem => ({ id: r.id, label: r.title || "الزام بی‌عنوان", target: { page: "requirements", open: r.id } });
  const actItem = (a: Activity): HealthItem => ({ id: a.id, label: a.title || "فعالیت بی‌عنوان", target: { page: "plan", open: a.id } });
  const push = (key: string, severity: Severity, title: string, detail: string, items: HealthItem[]) => {
    if (items.length) issues.push({ key, severity, title, detail, items });
  };

  const badDates = plan.activities.filter((a) => !a.start || !a.end || a.end < a.start);
  push("bad-dates", "critical", "فعالیت با تاریخ نامعتبر", "تاریخ پایان قبل از شروع است یا تاریخ ثبت نشده.", badDates.map(actItem));

  const overdue = plan.activities.filter((a) => isOverdue(a, today));
  push("overdue", "serious", "فعالیت‌های عقب‌افتاده", "موعدشان گذشته و هنوز «انجام شد» نیستند. یا انجامش دهید یا تاریخ را واقع‌بینانه کنید.", overdue.map(actItem));

  const noGoal = plan.requirements.filter((r) => !r.goal.trim());
  push("no-goal", "serious", "الزام بدون هدف", "فاصله‌ی وضعیت موجود تا مطلوب هنوز به یک هدف تبدیل نشده.", noGoal.map(reqItem));

  const orphanReqs = plan.requirements
    .filter((r) => r.goal.trim() && !plan.activities.some((a) => a.requirementId === r.id))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  push(
    "req-no-activity",
    orphanReqs.some((r) => r.priority === "critical") ? "serious" : "warning",
    "هدف بدون فعالیت",
    "برای این هدف‌ها هنوز هیچ فعالیتی در برنامه عملیاتی نیست؛ پس اجرا نمی‌شوند.",
    orphanReqs.map(reqItem),
  );

  const orphanActs = plan.activities.filter((a) => !a.requirementId || !reqById.has(a.requirementId));
  push("act-no-req", "warning", "فعالیت بدون هدف", "معلوم نیست این فعالیت کدام فاصله را پر می‌کند. آن را به یک الزام وصل کنید.", orphanActs.map(actItem));

  const late = plan.activities.filter((a) => {
    const r = a.requirementId ? reqById.get(a.requirementId) : undefined;
    return r?.dueDate && a.end && a.end > r.dueDate;
  });
  push("after-due", "warning", "فعالیت دیرتر از موعد هدف", "پایان فعالیت بعد از موعد هدف مرتبط است. یکی از دو تاریخ را اصلاح کنید.", late.map(actItem));

  if (plan.budgetMax > 0) {
    const { planned } = budgetSummary(plan);
    if (planned > plan.budgetMax) {
      issues.push({
        key: "budget", severity: "serious", title: "بودجه از سقف بیشتر است",
        detail: `جمع هزینه‌های برنامه‌ریزی‌شده ${faNum(planned)} و سقف بودجه ${faNum(plan.budgetMax)} ${plan.currency} است.`,
        items: [{ id: "budget", label: "مشاهده بودجه", target: { page: "budget" } }],
      });
    }
  }

  if (plan.weeklyHours > 0) {
    const over = weeklyLoad(plan).filter((w) => w.hours > plan.weeklyHours * 1.05);
    if (over.length) {
      const peak = Math.max(...over.map((w) => w.hours));
      issues.push({
        key: "capacity", severity: over.length > 4 ? "serious" : "warning", title: "هفته‌های بیش از ظرفیت",
        detail: `${faNum(over.length, 0)} هفته بار کاری بیش از ${faNum(plan.weeklyHours)} ساعت دارد (اوج: ${faNum(Math.round(peak), 0)} ساعت). فعالیت‌ها را جابه‌جا، کوچک یا واگذار کنید.`,
        items: [{ id: "capacity", label: "مشاهده نمودار ظرفیت", target: { page: "review" } }],
      });
    }
  }

  const unmeasurable = plan.requirements.filter((r) => r.goal.trim() && !goalChecks(r).measurable);
  push("not-measurable", "info", "هدف بدون عدد", "هدفی که عدد ندارد قابل سنجش نیست. مقدار، تعداد یا درصد را مشخص کنید.", unmeasurable.map(reqItem));

  const untimed = plan.requirements.filter((r) => r.goal.trim() && !r.dueDate);
  push("no-due", "info", "هدف بدون موعد", "برای هدف تاریخ موعد تعیین کنید تا بتوان آن را پیگیری کرد.", untimed.map(reqItem));

  return issues.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}
