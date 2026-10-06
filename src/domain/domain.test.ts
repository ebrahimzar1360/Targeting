import { describe, expect, it } from "vitest";
import { buildSampleConsultant } from "@/data/sampleConsultant";
import { budgetSummary, capacityInRange, expectedProgress, healthChecks, hoursInRange, kpiValue, planProgress, requirementProgress, weeklyLoad } from "./calc";
import { createPlan, quarterlyPhases } from "./factory";
import { addDays, addMonths, dayNumber, diffDays, fmtJ, isValidJ, monthsBetween, normalizeDigits, parseLooseJ, weekday, weekStart } from "./jalali";
import { normalizePlan, readBackup, makeBackup } from "./migrate";

describe("jalali", () => {
  it("parses loose input with Persian digits", () => {
    expect(parseLooseJ("۱۴۰۵/۷/۱")).toBe("1405/07/01");
    expect(parseLooseJ("1405-07-14")).toBe("1405/07/14");
    expect(parseLooseJ("1405/13/01")).toBeNull();
    expect(normalizeDigits("۱۲٫۵")).toBe("12.5");
  });
  it("does date arithmetic across month and year ends", () => {
    expect(addDays("1405/06/31", 1)).toBe("1405/07/01");
    expect(addDays("1405/12/29", 1)).toBe("1406/01/01"); // 1405 is not a leap year
    expect(isValidJ("1405/12/30")).toBe(false);
    expect(addMonths("1405/06/31", 1)).toBe("1405/07/30");
    expect(diffDays("1405/07/01", "1406/06/31")).toBe(364);
  });
  it("knows the Saturday-first week", () => {
    expect(weekday("1405/07/11")).toBe(0); // Saturday 3 Oct 2026
    expect(weekStart("1405/07/14")).toBe("1405/07/11");
  });
  it("lists months of a horizon", () => {
    const m = monthsBetween("1405/07/01", "1406/06/31");
    expect(m).toHaveLength(12);
    expect(m[0].key).toBe("1405-07");
    expect(m[11].label).toBe("شهریور");
  });
  it("formats in Persian", () => {
    expect(fmtJ("1405/07/14")).toBe("۱۴ مهر ۱۴۰۵");
  });
});

describe("factory", () => {
  it("creates quarterly phases covering the horizon", () => {
    const ph = quarterlyPhases("1405/07/01", 12);
    expect(ph.map((p) => [p.start, p.end])).toEqual([
      ["1405/07/01", "1405/09/30"], ["1405/10/01", "1405/12/29"],
      ["1406/01/01", "1406/03/31"], ["1406/04/01", "1406/06/31"],
    ]);
  });
  it("creates a plan with the seven categories", () => {
    const p = createPlan({ title: "t", vision: "v", model: "", start: "1405/07/01", months: 12, weeklyHours: 10, budgetMin: 0, budgetMax: 0, withPhases: true });
    expect(p.categories).toHaveLength(7);
    expect(p.end).toBe("1406/06/31");
  });
});

describe("sample plan", () => {
  const plan = buildSampleConsultant();

  it("links every activity to an existing requirement with valid dates", () => {
    const ids = new Set(plan.requirements.map((r) => r.id));
    for (const a of plan.activities) {
      expect(ids.has(a.requirementId!), a.title).toBe(true);
      expect(isValidJ(a.start) && isValidJ(a.end), a.title).toBe(true);
      expect(a.end >= a.start, a.title).toBe(true);
    }
    for (const r of plan.requirements) expect(isValidJ(r.dueDate), r.title).toBe(true);
  });

  it("gives every requirement at least one activity", () => {
    for (const r of plan.requirements) expect(plan.activities.some((a) => a.requirementId === r.id), r.title).toBe(true);
  });

  it("keeps the budget equal to the «توسعه‌ای» scenario of the original sheet", () => {
    expect(budgetSummary(plan).planned).toBe(289);
  });

  it("reports only the intentional date conflicts as health issues", () => {
    const issues = healthChecks(plan, "1405/07/01");
    const keys = issues.map((i) => i.key);
    expect(keys).not.toContain("bad-dates");
    expect(keys).not.toContain("act-no-req");
    expect(keys).not.toContain("req-no-activity");
    expect(keys).not.toContain("not-measurable");
    expect(keys).toContain("after-due");
  });

  it("survives a backup round trip", () => {
    const [back] = readBackup(JSON.parse(JSON.stringify(makeBackup([plan]))));
    expect(back).toEqual(plan);
  });
});

describe("calc", () => {
  const plan = buildSampleConsultant();

  it("weights progress by hours and treats done as 100%", () => {
    const p = structuredClone(plan);
    expect(planProgress(p)).toBe(0);
    p.activities.forEach((a) => { if (a.requirementId === "k5") a.status = "done"; });
    expect(requirementProgress(p, "k5")).toBe(1);
    expect(requirementProgress(p, "k1")).toBe(0);
  });

  it("spreads hours over weeks without losing any", () => {
    const weeks = weeklyLoad(plan);
    const total = weeks.reduce((s, w) => s + w.hours, 0);
    const expected = plan.activities.reduce((s, a) => s + a.hours, 0);
    expect(total).toBeCloseTo(expected, 6);
    expect(dayNumber(weeks[1].start) - dayNumber(weeks[0].start)).toBe(7);
  });

  it("splits hours across phases and compares them with capacity", () => {
    const perPhase = plan.phases.map((p) => hoursInRange(plan, p.start, p.end));
    const total = plan.activities.reduce((s, a) => s + a.hours, 0);
    expect(perPhase.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 6);
    // Phase 1 of the sample needs far more than 15 h/week.
    expect(perPhase[0]).toBeGreaterThan(capacityInRange(plan, plan.phases[0].start, plan.phases[0].end) * 1.5);
  });

  it("computes expected progress over time", () => {
    expect(expectedProgress(plan, "1405/06/01")).toBe(0);
    expect(expectedProgress(plan, "1407/01/01")).toBe(1);
  });

  it("aggregates KPIs by mode", () => {
    const keys = ["1405-07", "1405-08", "1405-09"];
    const base = { id: "x", title: "", unit: "", target: 10, requirementId: null };
    expect(kpiValue({ ...base, mode: "sum", values: { "1405-07": 2, "1405-09": 3 } }, keys)).toBe(5);
    expect(kpiValue({ ...base, mode: "last", values: { "1405-07": 2, "1405-08": 7 } }, keys)).toBe(7);
    expect(kpiValue({ ...base, mode: "avg", values: { "1405-07": 8, "1405-08": 9 } }, keys)).toBe(8.5);
    expect(kpiValue({ ...base, mode: "sum", values: {} }, keys)).toBeNull();
  });
});

describe("migrate", () => {
  it("fills defaults and drops dangling links", () => {
    const p = normalizePlan({
      title: "x", start: "1405/07/01", end: "1406/06/31",
      activities: [{ id: "a", title: "t", requirementId: "missing", hours: "bad" }],
    });
    expect(p.categories).toHaveLength(7);
    expect(p.activities[0].requirementId).toBeNull();
    expect(p.activities[0].hours).toBe(0);
    expect(p.activities[0].status).toBe("todo");
  });
  it("rejects non-objects", () => {
    expect(() => normalizePlan("nope")).toThrow();
  });
});

describe("templates", () => {
  it("fill a new plan with valid requirements in every category", async () => {
    const { TEMPLATES, applyTemplate } = await import("@/data/templates");
    for (const t of TEMPLATES) {
      const base = createPlan({ title: t.title, vision: t.vision, model: t.model, start: "1405/07/01", months: 12, weeklyHours: 10, budgetMin: 0, budgetMax: 0, withPhases: true });
      const plan = applyTemplate(base, t);
      expect(plan.requirements, t.id).toHaveLength(t.requirements.length);
      for (const c of plan.categories) expect(plan.requirements.some((r) => r.categoryId === c.id), `${t.id}/${c.id}`).toBe(true);
      expect(new Set(plan.requirements.map((r) => r.id)).size).toBe(plan.requirements.length);
      // Goals are left for the user, so the health panel asks for them.
      expect(healthChecks(plan, "1405/07/01").some((i) => i.key === "no-goal")).toBe(true);
    }
  });
});
