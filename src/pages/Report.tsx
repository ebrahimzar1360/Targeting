import { useState } from "react";
import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button, Card, PageHeader, cx } from "@/components/ui/primitives";
import {
  activitiesOf, activityProgress, budgetSummary, capacityInRange, categoryStats, expectedProgress, healthChecks,
  hoursInRange, isOverdue, kpiValue, phaseOf, planMonths, planProgress, requirementProgress,
} from "@/domain/calc";
import { priorityLabel, statusLabel } from "@/domain/defaults";
import { faNum, faPct, fmtJ, fmtRange, todayJ } from "@/domain/jalali";
import type { Activity, Plan } from "@/domain/schema";
import { usePlan } from "@/store/store";

type Section = "health" | "matrix" | "phases" | "plan" | "kpi";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "health", label: "سلامت برنامه" },
  { key: "matrix", label: "ماتریس الزامات" },
  { key: "phases", label: "فازها و ظرفیت" },
  { key: "plan", label: "برنامه عملیاتی" },
  { key: "kpi", label: "شاخص‌ها و نقاط عطف" },
];

/** A printable one-document view of the plan; the browser's print dialog saves it as PDF. */
export function Report() {
  const plan = usePlan();
  const [on, setOn] = useState<Record<Section, boolean>>({ health: true, matrix: true, phases: true, plan: true, kpi: true });
  const today = todayJ();
  const b = budgetSummary(plan);
  const totalHours = plan.activities.reduce((s, a) => s + a.hours, 0);
  const totalCap = plan.start && plan.end ? capacityInRange(plan, plan.start, plan.end) : 0;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="گزارش و چاپ"
          description="کل برنامه در یک سند؛ برای ارائه به منتور، شریک یا تیم. در پنجره‌ی چاپ، «Save as PDF» را انتخاب کنید تا فایل PDF بگیرید."
          actions={<Button variant="primary" onClick={() => window.print()}><Printer className="size-4" />چاپ / ذخیره PDF</Button>}
        />
        <Card className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
          <span className="text-ink-3">بخش‌های گزارش:</span>
          {SECTIONS.map((s) => (
            <label key={s.key} className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={on[s.key]} onChange={(e) => setOn({ ...on, [s.key]: e.target.checked })} />
              {s.label}
            </label>
          ))}
        </Card>
      </div>

      <article className="rounded-xl border border-line bg-surface p-5 text-[13px] leading-6 shadow-card sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-ink pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold">{plan.title}</h1>
            <span className="text-xs text-ink-3">تاریخ گزارش: {fmtJ(today)}</span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
            <Def k="چشم‌انداز" v={plan.vision} strong />
            {plan.model && <Def k="الگو" v={plan.model} />}
            {plan.focus && <Def k="تمرکز" v={plan.focus} />}
            <Def k="افق" v={`${fmtRange(plan.start, plan.end)} · ظرفیت ${faNum(plan.weeklyHours)} ساعت در هفته`} />
          </dl>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="پیشرفت کل" value={faPct(planProgress(plan))} sub={`طبق زمان‌بندی: ${faPct(expectedProgress(plan, today))}`} />
          <Kpi label="فعالیت‌ها" value={`${faNum(plan.activities.filter((a) => a.status === "done").length, 0)} / ${faNum(plan.activities.length, 0)}`}
            sub={`${faNum(plan.activities.filter((a) => isOverdue(a, today)).length, 0)} عقب‌افتاده`} />
          <Kpi label="ساعت لازم / ظرفیت" value={`${faNum(Math.round(totalHours), 0)} / ${faNum(Math.round(totalCap), 0)}`} sub={totalCap ? `${faPct(totalHours / totalCap)} ظرفیت` : undefined} warn={totalHours > totalCap * 1.05} />
          <Kpi label={`بودجه (${plan.currency})`} value={faNum(b.planned)} sub={plan.budgetMax ? `سقف ${faNum(plan.budgetMax)} · خرج‌شده ${faNum(b.actual)}` : `خرج‌شده ${faNum(b.actual)}`} warn={!!plan.budgetMax && b.planned > plan.budgetMax} />
        </section>

        {on.health && <HealthSection plan={plan} today={today} />}
        {on.matrix && <MatrixSection plan={plan} />}
        {on.phases && plan.phases.length > 0 && <PhasesSection plan={plan} />}
        {on.plan && <PlanSection plan={plan} today={today} />}
        {on.kpi && <KpiSection plan={plan} />}

        <footer className="mt-8 border-t border-line pt-3 text-[11px] text-ink-3">ساخته‌شده با هدف‌نگار — هدف‌گذاری به روش ماتریس ساختار طراحی</footer>
      </article>
    </>
  );
}

function Def({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-ink-3">{k}</dt>
      <dd className={cx(strong && "font-semibold")}>{v || "—"}</dd>
    </>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line p-3 print:break-inside-avoid">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={cx("text-lg font-bold tabular", warn && "text-serious-ink")}>{value}</div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

function H2({ children, breakBefore }: { children: ReactNode; breakBefore?: boolean }) {
  return <h2 className={cx("mb-2 mt-7 border-b border-line pb-1 text-base font-bold", breakBefore && "print:break-before-page")}>{children}</h2>;
}

const th = "border border-line bg-surface-2 px-2 py-1.5 text-start text-[11px] font-semibold text-ink-2";
const td = "border border-line px-2 py-1.5 align-top";

function HealthSection({ plan, today }: { plan: Plan; today: string }) {
  const issues = healthChecks(plan, today);
  return (
    <>
      <H2>سلامت برنامه</H2>
      {issues.length === 0 ? <p>موردی پیدا نشد؛ برنامه هماهنگ است.</p> : (
        <ul className="grid grid-cols-1 gap-2">
          {issues.map((i) => (
            <li key={i.key} className="print:break-inside-avoid">
              <span className="font-semibold">{i.title} ({faNum(i.items.length, 0)})</span>
              <span className="text-ink-2"> — {i.detail}</span>
              {i.items.length > 1 || (i.key !== "budget" && i.key !== "capacity") ? (
                <div className="text-[12px] text-ink-3">{i.items.slice(0, 12).map((x) => x.label).join("، ")}{i.items.length > 12 ? " …" : ""}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MatrixSection({ plan }: { plan: Plan }) {
  return (
    <>
      <H2 breakBefore>ماتریس الزامات</H2>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[720px] border-collapse text-[12px] print:min-w-0">
          <thead>
            <tr>
              <th className={cx(th, "w-[16%]")}>الزام</th><th className={cx(th, "w-[22%]")}>وضعیت مطلوب</th><th className={cx(th, "w-[20%]")}>وضعیت موجود</th>
              <th className={cx(th, "w-[24%]")}>هدف</th><th className={th}>موعد</th><th className={th}>اولویت</th><th className={th}>پیشرفت</th>
            </tr>
          </thead>
          <tbody>
            {plan.categories.map((c) => {
              const reqs = plan.requirements.filter((r) => r.categoryId === c.id);
              if (!reqs.length) return null;
              return [
                <tr key={c.id} className="print:break-after-avoid">
                  <td colSpan={7} className={cx(td, "font-bold")} style={{ borderInlineStartWidth: 4, borderInlineStartColor: `var(--cat-${c.color})` }}>
                    {c.name} <span className="font-normal text-ink-3">· {faNum(reqs.length, 0)} الزام · پیشرفت {faPct(categoryStats(plan, c.id).progress)}</span>
                  </td>
                </tr>,
                ...reqs.map((r) => {
                  const p = requirementProgress(plan, r.id);
                  return (
                    <tr key={r.id} className="print:break-inside-avoid">
                      <td className={cx(td, "font-medium")}>{r.title}</td>
                      <td className={td}>{r.desired}</td>
                      <td className={td}>{r.current}</td>
                      <td className={td}>{r.goal || <span className="text-ink-3">—</span>}</td>
                      <td className={cx(td, "whitespace-nowrap")}>{r.dueDate ? fmtJ(r.dueDate, "numeric") : "—"}</td>
                      <td className={cx(td, "whitespace-nowrap")}>{priorityLabel(r.priority)}</td>
                      <td className={cx(td, "whitespace-nowrap tabular")}>{p === null ? `— (${faNum(activitiesOf(plan, r.id).length, 0)})` : faPct(p)}</td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PhasesSection({ plan }: { plan: Plan }) {
  const b = budgetSummary(plan);
  return (
    <>
      <H2>فازها و ظرفیت</H2>
      <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-[12px]">
        <thead><tr><th className={th}>فاز</th><th className={th}>بازه</th><th className={th}>ساعت لازم</th><th className={th}>ظرفیت</th><th className={th}>هزینه</th></tr></thead>
        <tbody>
          {plan.phases.map((p) => {
            const need = hoursInRange(plan, p.start, p.end), cap = capacityInRange(plan, p.start, p.end);
            return (
              <tr key={p.id} className="print:break-inside-avoid">
                <td className={td}><span className="font-medium">{p.name}</span>{p.description && <div className="text-ink-3">{p.description}</div>}</td>
                <td className={cx(td, "whitespace-nowrap")}>{fmtRange(p.start, p.end)}</td>
                <td className={cx(td, "tabular", need > cap * 1.05 && "font-semibold text-serious-ink")}>{faNum(Math.round(need), 0)}</td>
                <td className={cx(td, "tabular")}>{faNum(Math.round(cap), 0)}</td>
                <td className={cx(td, "tabular")}>{faNum(b.byPhase.get(p.id) ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

function PlanSection({ plan, today }: { plan: Plan; today: string }) {
  const reqById = new Map(plan.requirements.map((r) => [r.id, r]));
  const sorted = [...plan.activities].sort((a, b) => a.start.localeCompare(b.start));
  const groups: { title: string; items: Activity[] }[] = plan.phases.length
    ? [...plan.phases.map((p) => ({ title: `${p.name} (${fmtRange(p.start, p.end)})`, items: sorted.filter((a) => phaseOf(plan, a.start)?.id === p.id) })),
       { title: "خارج از فازها", items: sorted.filter((a) => !phaseOf(plan, a.start)) }]
    : [{ title: "", items: sorted }];
  return (
    <>
      <H2 breakBefore>برنامه عملیاتی</H2>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[720px] border-collapse text-[12px] print:min-w-0">
          <thead>
            <tr>
              <th className={cx(th, "w-[34%]")}>فعالیت</th><th className={cx(th, "w-[22%]")}>هدف (الزام)</th><th className={th}>بازه</th>
              <th className={th}>مسئول</th><th className={th}>ساعت</th><th className={th}>هزینه</th><th className={th}>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {groups.filter((g) => g.items.length).map((g) => [
              g.title ? <tr key={g.title} className="print:break-after-avoid"><td colSpan={7} className={cx(td, "bg-surface-2 font-bold")}>{g.title}</td></tr> : null,
              ...g.items.map((a) => (
                <tr key={a.id} className="print:break-inside-avoid">
                  <td className={td}>{a.program && <span className="text-ink-3">{a.program} · </span>}{a.title}</td>
                  <td className={td}>{a.requirementId ? reqById.get(a.requirementId)?.title : <span className="text-serious-ink">بدون هدف</span>}</td>
                  <td className={cx(td, "whitespace-nowrap")}>{fmtRange(a.start, a.end)}</td>
                  <td className={td}>{a.owner}</td>
                  <td className={cx(td, "tabular")}>{a.hours ? faNum(a.hours) : "—"}</td>
                  <td className={cx(td, "tabular")}>{a.cost ? faNum(a.cost) : "—"}</td>
                  <td className={cx(td, "whitespace-nowrap", isOverdue(a, today) && "font-semibold text-critical-ink")}>
                    {isOverdue(a, today) ? "عقب‌افتاده" : statusLabel(a.status)}{a.status === "doing" ? ` ${faPct(activityProgress(a) / 100)}` : ""}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KpiSection({ plan }: { plan: Plan }) {
  const keys = planMonths(plan).map((m) => m.key);
  return (
    <>
      {plan.kpis.length > 0 && (
        <>
          <H2>شاخص‌های کلیدی</H2>
          <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-[12px]">
            <thead><tr><th className={th}>شاخص</th><th className={th}>هدف</th><th className={th}>تا امروز</th><th className={th}>درصد</th></tr></thead>
            <tbody>
              {plan.kpis.map((k) => {
                const v = kpiValue(k, keys);
                return (
                  <tr key={k.id} className="print:break-inside-avoid">
                    <td className={td}>{k.title} <span className="text-ink-3">({k.unit})</span></td>
                    <td className={cx(td, "tabular")}>{faNum(k.target)}</td>
                    <td className={cx(td, "tabular")}>{v === null ? "—" : faNum(v)}</td>
                    <td className={cx(td, "tabular")}>{v === null || !k.target ? "—" : faPct(v / k.target)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
      {plan.milestones.length > 0 && (
        <>
          <H2>نقاط عطف</H2>
          <ul className="grid grid-cols-1 gap-1.5">
            {plan.milestones.map((m) => (
              <li key={m.id} className="print:break-inside-avoid">
                <span className="font-semibold">{fmtJ(m.date)}{m.done ? " ✓" : ""}: </span>{m.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
