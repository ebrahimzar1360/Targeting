import ExcelJS from "exceljs";
import { budgetSummary, kpiValue, phaseOf, planMonths, requirementProgress } from "@/domain/calc";
import { DEFAULT_CATEGORIES, PRIORITIES, STATUSES, priorityLabel, statusLabel } from "@/domain/defaults";
import { defaultCategories, nowIso, uid } from "@/domain/factory";
import { MONTHS, addDays, addMonths, diffDays, endOfMonth, formatJ, fromDate, monthsBetween, normalizeDigits, parseLooseJ, todayJ } from "@/domain/jalali";
import { normalizePlan } from "@/domain/migrate";
import type { Activity, Kpi, Phase, Plan, Priority, Requirement, Status } from "@/domain/schema";

/*
 * Excel in the method's own template layout («جدول الزامات», «Action plan», «KPI و پیگیری»),
 * so files made by hand and files exported here read the same way.
 */

const NAVY = "FF1F3864", BLUE = "FF2E5C8A", LIGHT = "FFD9E2F3", GOAL = "FFE2EFDA", CURRENT = "FFFBE5E5", INPUT = "FFFFF2CC", GRAY = "FFF2F2F2";
const CAT_FILLS = ["FF2E5C8A", "FFC0582B", "FF168C62", "FFBF9000", "FFB65C80", "FF376623", "FF4A3AA7"];

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin: Partial<ExcelJS.Borders> = { top: { style: "thin", color: { argb: "FFD0D0D0" } }, bottom: { style: "thin", color: { argb: "FFD0D0D0" } }, left: { style: "thin", color: { argb: "FFD0D0D0" } }, right: { style: "thin", color: { argb: "FFD0D0D0" } } };

function sheet(wb: ExcelJS.Workbook, name: string, widths: number[]) {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }] });
  ws.columns = widths.map((w) => ({ width: w }));
  return ws;
}

function titleRow(ws: ExcelJS.Worksheet, text: string, cols: number, argb = NAVY) {
  const r = ws.addRow([text]);
  ws.mergeCells(r.number, 1, r.number, cols);
  r.height = 28;
  r.getCell(1).fill = fill(argb);
  r.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "Tahoma" };
  r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  return r;
}

function headerRow(ws: ExcelJS.Worksheet, labels: string[]) {
  const r = ws.addRow(labels);
  r.height = 22;
  r.eachCell((c) => {
    c.fill = fill(BLUE);
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Tahoma" };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = thin;
  });
  return r;
}

function bodyRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], fills: (string | null)[] = []) {
  const r = ws.addRow(values);
  r.eachCell({ includeEmpty: true }, (c, i) => {
    c.alignment = { vertical: "top", wrapText: true };
    c.font = { name: "Tahoma", size: 10 };
    c.border = thin;
    const f = fills[i - 1];
    if (f) c.fill = fill(f);
  });
  return r;
}

export async function planToWorkbook(plan: Plan): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "هدف‌نگار";
  wb.created = new Date();
  const reqById = new Map(plan.requirements.map((r) => [r.id, r]));

  // Guide
  const g = wb.addWorksheet("راهنما", { views: [{ rightToLeft: true }] });
  g.columns = [{ width: 24 }, { width: 90 }];
  titleRow(g, plan.title || "برنامه", 2);
  for (const [k, v] of [
    ["چشم‌انداز", plan.vision], ["الگو", plan.model], ["تمرکز", plan.focus],
    ["افق زمانی", `${plan.start} تا ${plan.end}`], ["ظرفیت زمانی", `${plan.weeklyHours} ساعت در هفته`],
    ["بودجه", plan.budgetMax ? `${plan.budgetMin} تا ${plan.budgetMax} ${plan.currency}` : "—"],
    ["خروجی از", `هدف‌نگار · ${todayJ()}`],
  ]) bodyRow(g, [k, v], [LIGHT, null]);

  // Requirements matrix
  const m = sheet(wb, "هدف گذاری", [30, 46, 40, 46, 12, 14, 12]);
  titleRow(m, "جدول الزامات", 7);
  const r2 = m.addRow([`بیانیه چشم انداز: ${plan.vision}`, "", "", `الگو: ${plan.model}`]);
  m.mergeCells(r2.number, 1, r2.number, 3);
  m.mergeCells(r2.number, 4, r2.number, 7);
  r2.eachCell((c) => { c.fill = fill(INPUT); c.font = { bold: true, name: "Tahoma" }; c.alignment = { wrapText: true, vertical: "middle" }; });
  headerRow(m, ["الزامات", "وضعیت مطلوب", "وضعیت موجود", "هدف", "اولویت", "موعد", "پیشرفت"]);
  plan.categories.forEach((c, ci) => {
    const reqs = plan.requirements.filter((r) => r.categoryId === c.id);
    const cr = m.addRow([c.name, `— ${reqs.length} الزام —`]);
    m.mergeCells(cr.number, 2, cr.number, 7);
    cr.eachCell((cell) => { cell.fill = fill(CAT_FILLS[ci % CAT_FILLS.length]); cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Tahoma" }; });
    for (const r of reqs) {
      const p = requirementProgress(plan, r.id);
      const row = bodyRow(m, [r.title, r.desired, r.current, r.goal, priorityLabel(r.priority), r.dueDate, p === null ? null : p], [GRAY, null, CURRENT, GOAL, null, null, null]);
      row.getCell(7).numFmt = "0%";
    }
  });
  addListValidation(m, `E4:E${m.rowCount + 20}`, { type: "list", allowBlank: true, formulae: [`"${PRIORITIES.map((p) => p.label).join(",")}"`] });

  // Action plan
  const a = sheet(wb, "Action plan", [34, 24, 52, 13, 13, 18, 30, 15, 12, 10, 10, 10, 30]);
  titleRow(a, `هدف: ${plan.vision}`, 13);
  const a2 = a.addRow([`چشم‌انداز: ${plan.vision}   |   ظرفیت: ${plan.weeklyHours} ساعت در هفته`]);
  a.mergeCells(a2.number, 1, a2.number, 13);
  a2.getCell(1).fill = fill(INPUT);
  headerRow(a, ["هدف", "برنامه", "فعالیت", "تاریخ شروع", "تاریخ پایان", "مسئول", "منابع و امکانات لازم", "وضعیت", "درصد پیشرفت", "ساعت", "هزینه", "هزینه واقعی", "الزام"]);
  const sorted = [...plan.activities].sort((x, y) => x.start.localeCompare(y.start));
  const groups: { phase?: Phase; items: Activity[] }[] = plan.phases.length
    ? [...plan.phases.map((ph) => ({ phase: ph, items: sorted.filter((x) => phaseOf(plan, x.start)?.id === ph.id) })), { items: sorted.filter((x) => !phaseOf(plan, x.start)) }]
    : [{ items: sorted }];
  for (const grp of groups) {
    if (!grp.items.length) continue;
    if (grp.phase) {
      const pr = a.addRow([`${grp.phase.name} (${grp.phase.start} تا ${grp.phase.end})${grp.phase.description ? `: ${grp.phase.description}` : ""}`]);
      a.mergeCells(pr.number, 1, pr.number, 13);
      pr.getCell(1).fill = fill(BLUE);
      pr.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Tahoma" };
    }
    for (const x of grp.items) {
      const r = x.requirementId ? reqById.get(x.requirementId) : undefined;
      const row = bodyRow(a, [r?.goal || r?.title || "", x.program, x.title, x.start, x.end, x.owner, x.resources, statusLabel(x.status), x.status === "done" ? 1 : x.progress / 100, x.hours, x.cost, x.actualCost, r?.title ?? ""],
        [GRAY, LIGHT, null, null, null, null, null, INPUT, INPUT, null, null, INPUT, null]);
      row.getCell(9).numFmt = "0%";
    }
  }
  const last = a.rowCount;
  addListValidation(a, `H4:H${last + 50}`, { type: "list", allowBlank: true, formulae: [`"${STATUSES.map((s) => s.label).join(",")}"`] });
  const tot = a.addRow(["جمع", "", "", "", "", "", "", "", "", { formula: `SUM(J4:J${last})` }, { formula: `SUM(K4:K${last})` }, { formula: `SUM(L4:L${last})` }]);
  tot.font = { bold: true, name: "Tahoma" };

  // KPI
  const months = planMonths(plan);
  const k = sheet(wb, "KPI و پیگیری", [34, 12, ...months.map(() => 10), 14, 14, 18]);
  titleRow(k, "شاخص‌های کلیدی عملکرد (KPI) — پیگیری ماهانه", months.length + 5);
  const k2 = k.addRow(["فقط سلول‌های زردرنگ را پر کنید."]);
  k.mergeCells(k2.number, 1, k2.number, months.length + 5);
  k2.getCell(1).fill = fill(INPUT);
  headerRow(k, ["شاخص", "هدف سال", ...months.map((x) => x.label), "جمع / وضعیت", "واحد", "نوع محاسبه"]);
  for (const kpi of plan.kpis) {
    const rowNo = k.rowCount + 1;
    const first = "C", lastCol = colName(2 + months.length);
    const formula = kpi.mode === "sum" ? `SUM(${first}${rowNo}:${lastCol}${rowNo})` : kpi.mode === "avg" ? `IFERROR(AVERAGE(${first}${rowNo}:${lastCol}${rowNo}),0)` : `IFERROR(LOOKUP(2,1/(${first}${rowNo}:${lastCol}${rowNo}<>""),${first}${rowNo}:${lastCol}${rowNo}),0)`;
    const v = kpiValue(kpi, months.map((x) => x.key));
    const row = bodyRow(k, [kpi.title, kpi.target, ...months.map((x) => kpi.values[x.key] ?? null), null, kpi.unit, kpi.mode === "sum" ? "جمع ماه‌ها" : kpi.mode === "avg" ? "میانگین" : "تجمعی (آخرین عدد)"],
      [GRAY, LIGHT, ...months.map(() => INPUT), GOAL, null, null]);
    row.getCell(3 + months.length).value = { formula, result: v ?? 0 };
  }
  if (plan.milestones.length) {
    k.addRow([]);
    titleRow(k, "اهداف نقطه‌عطفی (Milestone)", months.length + 5);
    for (const ms of plan.milestones) {
      const row = k.addRow([ms.date, ms.title, ms.done ? "✓ محقق شد" : ""]);
      k.mergeCells(row.number, 2, row.number, months.length + 3);
      row.getCell(1).fill = fill(INPUT);
    }
  }

  // Budget
  const b = sheet(wb, "بودجه", [30, 50, 14, 14, 18]);
  const sum = budgetSummary(plan);
  titleRow(b, `بودجه (ارقام به ${plan.currency})`, 5);
  const b2 = b.addRow([`سقف: ${plan.budgetMax || "—"} · برنامه‌ریزی‌شده: ${sum.planned} · خرج‌شده: ${sum.actual}`]);
  b.mergeCells(b2.number, 1, b2.number, 5);
  b2.getCell(1).fill = fill(INPUT);
  headerRow(b, ["سرفصل (دسته)", "شرح (فعالیت)", "برنامه‌ریزی‌شده", "واقعی", "فاز"]);
  const catName = new Map(plan.categories.map((c) => [c.id, c.name]));
  const first = b.rowCount + 1;
  for (const x of sorted.filter((s) => s.cost || s.actualCost !== null)) {
    const r = x.requirementId ? reqById.get(x.requirementId) : undefined;
    bodyRow(b, [r ? catName.get(r.categoryId) ?? "" : "بدون هدف", x.title, x.cost, x.actualCost, phaseOf(plan, x.start)?.name ?? ""], [GRAY, null, INPUT, INPUT, null]);
  }
  const bl = b.rowCount;
  const bt = b.addRow(["جمع کل", "", { formula: `SUM(C${first}:C${bl})`, result: sum.planned }, { formula: `SUM(D${first}:D${bl})`, result: sum.actual }]);
  bt.eachCell((c) => { c.font = { bold: true, name: "Tahoma" }; c.fill = fill(GOAL); });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

type DV = { type: "list"; allowBlank: boolean; formulae: string[] };
/** Range data validation (supported at runtime by ExcelJS, missing from its typings). */
const addListValidation = (ws: ExcelJS.Worksheet, range: string, dv: DV) =>
  (ws as unknown as { dataValidations: { add(range: string, dv: DV): void } }).dataValidations.add(range, dv);

function colName(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// ---------- Import ----------

const clean = (s: string) => normalizeDigits(s).replace(/[‌‏‎]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return fromDate(v);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    if ("result" in v) return text(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text).trim();
  }
  return "";
}

function num(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  const t = clean(text(v)).replace(/[,٪%]/g, "");
  return t && Number.isFinite(+t) ? +t : null;
}

function rows(ws: ExcelJS.Worksheet): ExcelJS.CellValue[][] {
  const out: ExcelJS.CellValue[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: ExcelJS.CellValue[] = [];
    for (let i = 1; i <= Math.max(row.cellCount, 16); i++) vals.push(row.getCell(i).value);
    out.push(vals);
  });
  return out;
}

function findHeader(data: ExcelJS.CellValue[][], must: string): { index: number; cols: Map<string, number> } | null {
  for (let i = 0; i < data.length; i++) {
    const labels = data[i].map((v) => clean(text(v)));
    if (labels.includes(must)) return { index: i, cols: new Map(labels.map((l, j) => [l, j] as const).filter(([l]) => l)) };
  }
  return null;
}

const PRIORITY_BY_LABEL = new Map<string, Priority>(PRIORITIES.map((p) => [p.label, p.key]));
const STATUS_BY_LABEL = new Map<string, Status>(STATUSES.map((s) => [s.label, s.key]));
const CAT_BY_NAME = new Map(DEFAULT_CATEGORIES.map((c) => [clean(c.name), c.key as string]));

/** "تا پایان آذر ۱۴۰۵" → "1405/09/30" (the end of the named month). */
export function dueFromText(s: string): string {
  const t = clean(s);
  let best = "";
  for (let i = 0; i < 12; i++) {
    const re = new RegExp(`${MONTHS[i]}\\s*(\\d{4})`, "g");
    for (const m of t.matchAll(re)) {
      const d = endOfMonth(+m[1], i + 1);
      if (d > best) best = d;
    }
  }
  return best;
}

function hoursFrom(resources: string, start: string, end: string): number {
  const t = clean(resources);
  const weekly = /(\d+(?:\.\d+)?)\s*ساعت\s*در\s*هفته/.exec(t);
  if (weekly && start && end) return Math.round((+weekly[1] * (diffDays(start, end) + 1)) / 7);
  const total = /(\d+(?:\.\d+)?)\s*ساعت/.exec(t);
  return total ? +total[1] : 0;
}
/** "(1405/07/01 تا 1405/09/30)" or "(مهر تا آذر ۱۴۰۵)" → [start, end]; ["", ""] when absent. */
function phaseRange(raw: string): [string, string] {
  const t = clean(raw);
  const d = /(\d{4}\/\d{1,2}\/\d{1,2})\s*تا\s*(\d{4}\/\d{1,2}\/\d{1,2})/.exec(t);
  if (d) return [parseLooseJ(d[1]) ?? "", parseLooseJ(d[2]) ?? ""];
  const names = MONTHS.join("|");
  const m = new RegExp(`(${names})\\s*(\\d{4})?\\s*تا\\s*(${names})\\s*(\\d{4})`).exec(t);
  if (!m) return ["", ""];
  const y2 = +m[4], y1 = m[2] ? +m[2] : y2;
  const m1 = MONTHS.indexOf(m[1]) + 1, m2 = MONTHS.indexOf(m[3]) + 1;
  return [formatJ({ jy: y1, jm: m1, jd: 1 }), endOfMonth(y2, m2)];
}
const costFrom = (resources: string) => { const m = /(\d+(?:\.\d+)?)\s*م\.?\s*ت/.exec(clean(resources)); return m ? +m[1] : 0; };

export async function workbookToPlan(buf: ArrayBuffer, fallbackTitle: string): Promise<Plan> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const categories = defaultCategories();
  const requirements: Requirement[] = [];
  const activities: Activity[] = [];
  const phases: Phase[] = [];
  const kpis: Kpi[] = [];
  let vision = "", model = "", weeklyHours = 0, budgetMin = 0, budgetMax = 0;
  const links = new Map<string, { req: string; goal: string }>();
  const explicit = new Set<string>();

  for (const ws of wb.worksheets) {
    const data = rows(ws);
    const flat = data.flat().map((v) => clean(text(v))).join(" | ");
    const cap = /ظرفیت[^|]*?(\d+)\s*ساعت/.exec(flat);
    if (cap && !weeklyHours) weeklyHours = +cap[1];
    const bud = /بودجه[^|]*(?:\|\s*)?[^|\d]*(\d+)\s*تا\s*(\d+)\s*میلیون/.exec(flat);
    if (bud && !budgetMax) { budgetMin = +bud[1]; budgetMax = +bud[2]; }

    // Requirements matrix
    const rh = findHeader(data, "الزامات");
    if (rh) {
      const c = rh.cols;
      const col = (name: string, def: number) => c.get(name) ?? def;
      const [cT, cD, cC, cG, cP, cDue] = [col("الزامات", 0), col("وضعیت مطلوب", 1), col("وضعیت موجود", 2), col("هدف", 3), col("اولویت", 4), c.get("موعد")];
      let cat = categories[0].id;
      for (const row of data) {
        const first = clean(text(row[0]));
        if (!first) continue;
        if (first.startsWith("بیانیه چشم انداز") || first.startsWith("بیانیه چشم‌انداز")) {
          vision ||= text(row[0]).replace(/^[^:：]*[:：]\s*/, "").trim();
          const mt = row.map((v) => text(v)).find((s) => clean(s).startsWith("الگو"));
          if (mt) model ||= mt.replace(/^[^:：]*[:：]\s*/, "").trim();
          continue;
        }
        if (first === "الزامات" || first === "جدول الزامات") continue;
        const catKey = CAT_BY_NAME.get(first);
        if (catKey) { cat = catKey; continue; }
        const goal = text(row[cG]);
        const dueText = cDue !== undefined ? text(row[cDue]) : "";
        requirements.push({
          id: uid("r"), categoryId: cat, title: text(row[cT]), desired: text(row[cD]), current: text(row[cC]), goal,
          priority: PRIORITY_BY_LABEL.get(clean(text(row[cP]))) ?? "medium",
          dueDate: parseLooseJ(dueText) ?? dueFromText(goal), note: "",
        });
      }
    }

    // Action plan
    const ah = findHeader(data, "فعالیت");
    if (ah && !rh) {
      const c = ah.cols;
      const at = (row: ExcelJS.CellValue[], name: string) => { const i = c.get(name); return i === undefined ? undefined : row[i]; };
      let phase: Phase | null = null;
      for (const row of data.slice(ah.index + 1)) {
        const title = text(at(row, "فعالیت") ?? null);
        const first = clean(text(row[0]));
        // Phase rows are merged across the table, so every column repeats the same text.
        const phaseRow = first.startsWith("فاز") && clean(title) === first;
        if (!title || phaseRow) {
          if (phaseRow) {
            const raw = text(row[0]);
            const [ps, pe] = phaseRange(raw);
            phase = { id: uid("ph"), name: raw.split(/[:(]/)[0].trim(), start: ps, end: pe, description: (raw.split(/\)\s*:|:\s/)[1] ?? "").trim() };
            if (ps) explicit.add(phase.id);
            phases.push(phase);
          }
          continue;
        }
        const start = parseLooseJ(text(at(row, "تاریخ شروع") ?? null)) ?? "";
        const end = parseLooseJ(text(at(row, "تاریخ پایان") ?? null)) ?? start;
        const resources = text(at(row, "منابع و امکانات لازم") ?? null);
        const rawProg = num(at(row, "درصد پیشرفت") ?? null) ?? 0;
        const status = STATUS_BY_LABEL.get(clean(text(at(row, "وضعیت") ?? null))) ?? "todo";
        const hours = num(at(row, "ساعت") ?? null);
        const cost = num(at(row, "هزینه") ?? null);
        const id = uid("a");
        links.set(id, { req: clean(text(at(row, "الزام") ?? null)), goal: text(at(row, "هدف") ?? null) });
        activities.push({
          id,
          requirementId: null,
          program: text(at(row, "برنامه") ?? null), title, start, end,
          owner: text(at(row, "مسئول") ?? null), resources,
          hours: hours ?? hoursFrom(resources, start, end), cost: cost ?? costFrom(resources),
          actualCost: num(at(row, "هزینه واقعی") ?? null),
          status, progress: Math.max(0, Math.min(100, rawProg <= 1 ? rawProg * 100 : rawProg)),
          note: "",
        });
        if (phase && !explicit.has(phase.id) && start && (!phase.start || start < phase.start)) phase.start = start;
      }
    }

    // KPIs
    const kh = findHeader(data, "شاخص");
    if (kh && kh.cols.has("هدف سال")) {
      const monthCols = MONTHS.map((m) => kh.cols.get(m)).map((i, mi) => ({ i, mi })).filter((x): x is { i: number; mi: number } => x.i !== undefined).sort((a, b) => a.i - b.i);
      for (const row of data.slice(kh.index + 1)) {
        const title = text(row[kh.cols.get("شاخص")!]);
        const target = num(row[kh.cols.get("هدف سال")!]);
        if (!title || target === null) continue;
        const lastCell = row[(monthCols[monthCols.length - 1]?.i ?? 0) + 1];
        const f = lastCell && typeof lastCell === "object" && "formula" in lastCell ? String(lastCell.formula) : "";
        const mode: Kpi["mode"] = /AVERAGE/i.test(f) ? "avg" : /INDEX|LOOKUP|MATCH/i.test(f) || title.includes("تجمعی") ? "last" : "sum";
        const values: Record<string, number> = {};
        monthCols.forEach(({ i, mi }) => { const v = num(row[i]); if (v !== null) values[`__m${mi + 1}`] = v; });
        kpis.push({ id: uid("k"), title: title.replace(/\s*\((?:تجمعی)\)\s*/, " ").trim(), unit: "", target, mode, values, requirementId: null });
      }
    }
  }

  // Link activities to requirements by the «الزام» column, else by the «هدف» text.
  for (const a of activities) {
    const l = links.get(a.id)!;
    const goal = clean(l.goal);
    const r = requirements.find((x) => (l.req && clean(x.title) === l.req) || (goal && (clean(x.goal) === goal || clean(x.title) === goal)));
    if (r) a.requirementId = r.id;
    else if (l.goal) a.note = `هدف در فایل اصلی: ${l.goal}`;
  }

  // Phases without explicit dates run until the next phase starts.
  phases.sort((a, b) => a.start.localeCompare(b.start));
  phases.forEach((p, i) => { if (!explicit.has(p.id) && phases[i + 1]?.start) p.end = addDays(phases[i + 1].start, -1); });

  // Horizon from activity dates (or 12 months from the first of this month).
  const starts = activities.map((x) => x.start).filter(Boolean).sort();
  const ends = activities.map((x) => x.end).filter(Boolean).sort();
  const start = starts[0] ?? addMonths(todayJ().slice(0, 8) + "01", 0);
  const end = ends[ends.length - 1] && ends[ends.length - 1] > start ? ends[ends.length - 1] : addDays(addMonths(start, 12), -1);

  // Month-name KPI values → keys of the plan's months.
  const months = monthsBetween(start, end);
  for (const k of kpis) {
    const v: Record<string, number> = {};
    for (const [key, val] of Object.entries(k.values)) {
      const jm = +key.slice(3);
      const m = months.find((x) => x.jm === jm);
      if (m) v[m.key] = val;
    }
    k.values = v;
  }

  if (!requirements.length && !activities.length) throw new Error("در این فایل جدول «الزامات» یا «فعالیت» پیدا نشد.");
  phases.forEach((p) => { if (!p.end) p.end = end; });
  return normalizePlan({
    id: uid("p"), title: vision || fallbackTitle, vision, model, start, end,
    weeklyHours: weeklyHours || 10, budgetMin, budgetMax,
    categories, requirements, activities, phases: phases.filter((p) => p.start && p.end), kpis,
    createdAt: nowIso(), updatedAt: nowIso(),
  });
}
