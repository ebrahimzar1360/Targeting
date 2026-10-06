import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { buildSampleConsultant } from "@/data/sampleConsultant";
import { budgetSummary } from "@/domain/calc";
import { dueFromText, planToWorkbook, workbookToPlan } from "./excel";

describe("excel", () => {
  it("reads deadlines from goal text", () => {
    expect(dueFromText("ساخت ۱۰ قالب تا پایان آذر ۱۴۰۵")).toBe("1405/09/30");
    expect(dueFromText("۲ پایلوت تا آذر ۱۴۰۵ و ۴ پروژه تا شهریور ۱۴۰۶")).toBe("1406/06/31");
    expect(dueFromText("بدون تاریخ")).toBe("");
  });

  it("round-trips a plan through the template layout", async () => {
    const plan = buildSampleConsultant();
    plan.activities[0].status = "doing";
    plan.activities[0].progress = 40;
    plan.kpis[0].values = { "1405-07": 30, "1405-08": 45 };
    const back = await workbookToPlan(await planToWorkbook(plan), "x");
    expect(back.vision).toBe(plan.vision);
    expect(back.model).toBe(plan.model);
    expect(back.requirements).toHaveLength(plan.requirements.length);
    expect(back.activities).toHaveLength(plan.activities.length);
    expect(back.activities.every((a) => a.requirementId)).toBe(true);
    expect(budgetSummary(back).planned).toBe(289);
    expect(back.activities.reduce((s, a) => s + a.hours, 0)).toBe(plan.activities.reduce((s, a) => s + a.hours, 0));
    expect(back.phases.map((p) => [p.start, p.end])).toEqual(plan.phases.map((p) => [p.start, p.end]));
    expect(back.requirements.map((r) => r.dueDate)).toEqual(plan.requirements.map((r) => r.dueDate));
    expect(back.weeklyHours).toBe(15);
    const first = back.activities.find((a) => a.title === plan.activities[0].title)!;
    expect(first.status).toBe("doing");
    expect(first.progress).toBe(40);
    expect(back.kpis).toHaveLength(plan.kpis.length);
    expect(back.kpis[0].values).toEqual({ "1405-07": 30, "1405-08": 45 });
  });

  // The original spreadsheet stays outside the repo; this runs only where it is available.
  const original = process.env.GOAL_XLSX;
  it.skipIf(!original || !existsSync(original))("imports the original goal.xlsx", async () => {
    const buf = readFileSync(original!);
    const plan = await workbookToPlan(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "goal");
    console.log(JSON.stringify({
      reqs: plan.requirements.length, acts: plan.activities.length, phases: plan.phases.map((p) => [p.name, p.start, p.end]),
      kpis: plan.kpis.length, start: plan.start, end: plan.end, hours: plan.weeklyHours, budget: [plan.budgetMin, plan.budgetMax],
      linked: plan.activities.filter((a) => a.requirementId).length, totalH: plan.activities.reduce((s, a) => s + a.hours, 0),
      cost: budgetSummary(plan).planned, due: plan.requirements.filter((r) => r.dueDate).length, vision: plan.vision, model: plan.model,
    }, null, 1));
    expect(plan.requirements.length).toBe(36);
    expect(plan.phases).toHaveLength(4);
    expect(plan.activities.length).toBe(47);
  });
});
