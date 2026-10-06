import { useState } from "react";
import { Info, Wallet } from "lucide-react";
import { Card, CardHeader, CategoryDot, EmptyState, NumberInput, PageHeader, catColor, cx } from "@/components/ui/primitives";
import { BarList } from "@/components/charts";
import { ActivitySheet } from "@/components/editors";
import { budgetSummary, phaseOf } from "@/domain/calc";
import { PHASE_COLOR_SLOTS } from "@/domain/defaults";
import { faNum, faPct, fmtJ } from "@/domain/jalali";
import type { Activity } from "@/domain/schema";
import { useStore, usePlan } from "@/store/store";

export function Budget() {
  const plan = usePlan();
  const upsert = useStore((s) => s.upsertActivity);
  const [editing, setEditing] = useState<Activity | null>(null);
  const b = budgetSummary(plan);
  const cap = plan.budgetMax;
  const items = plan.activities.filter((a) => a.cost > 0 || a.actualCost !== null).sort((x, y) => x.start.localeCompare(y.start));
  const reqById = new Map(plan.requirements.map((r) => [r.id, r]));
  const catById = new Map(plan.categories.map((c) => [c.id, c]));
  const scaleMax = Math.max(cap, b.planned, b.actual, 1) * 1.08;
  const unit = plan.currency;

  return (
    <>
      <PageHeader title="بودجه" description="بودجه از جمع هزینه‌ی فعالیت‌ها ساخته می‌شود؛ پس همیشه با برنامه‌ی عملیاتی هماهنگ است. هزینه‌ی واقعی را همین‌جا ثبت کنید." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="برنامه‌ریزی‌شده" value={faNum(b.planned)} unit={unit} tone={cap && b.planned > cap ? "serious" : undefined} />
        <Tile label="خرج‌شده (واقعی)" value={faNum(b.actual)} unit={unit} sub={b.planned ? `${faPct(b.actual / b.planned)} از برنامه` : undefined} />
        <Tile label="سقف بودجه" value={cap ? faNum(cap) : "—"} unit={cap ? unit : undefined} sub={plan.budgetMin ? `حداقل: ${faNum(plan.budgetMin)}` : undefined} />
        <Tile label={cap && b.planned > cap ? "بیش از سقف" : "باقی‌مانده تا سقف"} value={cap ? faNum(Math.abs(cap - b.planned)) : "—"} unit={cap ? unit : undefined} tone={cap && b.planned > cap ? "serious" : undefined} />
      </div>

      {cap > 0 && (
        <Card className="mt-4 p-5">
          <div className="mb-3 text-sm font-semibold">برنامه‌ریزی‌شده و خرج‌شده در برابر بازه‌ی بودجه</div>
          <div className="relative h-10">
            {plan.budgetMin > 0 && (
              <div className="absolute inset-y-0 rounded-md bg-good-soft" style={{ insetInlineStart: `${(plan.budgetMin / scaleMax) * 100}%`, width: `${((cap - plan.budgetMin) / scaleMax) * 100}%` }} />
            )}
            <div className="absolute inset-x-0 top-2 h-2.5 rounded-full bg-surface-3" />
            <div className={cx("absolute top-2 h-2.5 rounded-full", cap && b.planned > cap ? "bg-serious" : "bg-brand/40")} style={{ width: `${(b.planned / scaleMax) * 100}%` }} />
            <div className="absolute top-2 h-2.5 rounded-full bg-brand" style={{ width: `${(b.actual / scaleMax) * 100}%` }} />
            <div className="absolute -top-1 bottom-0 w-0.5 bg-ink" style={{ insetInlineStart: `${(cap / scaleMax) * 100}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />خرج‌شده</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand/40" />برنامه‌ریزی‌شده</span>
            {plan.budgetMin > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-good-soft ring-1 ring-good/30" />بازه‌ی مجاز (حداقل تا سقف)</span>}
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" />سقف</span>
          </div>
        </Card>
      )}

      {b.planned === 0 && items.length === 0 ? (
        <Card className="mt-4"><EmptyState icon={<Wallet className="size-5" />} title="هنوز هزینه‌ای ثبت نشده">در هر فعالیت «هزینه برنامه‌ریزی‌شده» را وارد کنید تا بودجه اینجا جمع شود.</EmptyState></Card>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="به تفکیک دسته" />
              <div className="p-4 sm:p-5">
                <BarList format={(v) => `${faNum(v)}`} rows={[
                  ...plan.categories.map((c) => ({ key: c.id, label: c.name, value: b.byCategory.get(c.id) ?? 0, color: catColor(c.color) })),
                  ...(b.byCategory.get("__none") ? [{ key: "none", label: "بدون هدف", value: b.byCategory.get("__none")!, color: "var(--ink-3)" }] : []),
                ].filter((r) => r.value > 0)} />
              </div>
            </Card>
            <Card>
              <CardHeader title="به تفکیک فاز" subtitle="بر اساس تاریخ شروع فعالیت" />
              <div className="p-4 sm:p-5">
                <BarList format={(v) => `${faNum(v)}`} rows={[
                  ...plan.phases.map((p, i) => ({ key: p.id, label: p.name, value: b.byPhase.get(p.id) ?? 0, color: catColor(PHASE_COLOR_SLOTS[i % 8]) })),
                  ...(b.byPhase.get("__none") ? [{ key: "none", label: "خارج از فازها", value: b.byPhase.get("__none")!, color: "var(--ink-3)" }] : []),
                ]} />
              </div>
            </Card>
          </div>

          <Card className="mt-4 overflow-hidden">
            <CardHeader title="اقلام هزینه" subtitle={`${faNum(items.length, 0)} فعالیت دارای هزینه · ارقام به ${unit}`} />
            <div className="scrollbar-thin mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-y border-line bg-surface-2/50 text-xs text-ink-3">
                    <th className="px-4 py-2 text-start font-medium sm:px-5">فعالیت</th>
                    <th className="px-2 py-2 text-start font-medium">فاز</th>
                    <th className="px-2 py-2 font-medium">برنامه‌ریزی‌شده</th>
                    <th className="w-32 px-2 py-2 font-medium">واقعی</th>
                    <th className="px-4 py-2 font-medium sm:px-5">اختلاف</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const r = a.requirementId ? reqById.get(a.requirementId) : undefined;
                    const c = r ? catById.get(r.categoryId) : undefined;
                    const diff = a.actualCost === null ? null : a.actualCost - a.cost;
                    return (
                      <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                        <td className="px-4 py-2 sm:px-5">
                          <button onClick={() => setEditing(a)} className="text-start leading-6 hover:text-brand-ink">{a.title}</button>
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-3">{c && <CategoryDot slot={c.color} className="size-2" />}{r?.title ?? "بدون هدف"} · {fmtJ(a.start, "short")}</div>
                        </td>
                        <td className="px-2 py-2 text-xs text-ink-3">{phaseOf(plan, a.start)?.name ?? "—"}</td>
                        <td className="px-2 py-2 text-center tabular">{faNum(a.cost)}</td>
                        <td className="px-2 py-1.5">
                          <NumberInput value={a.actualCost} allowEmpty placeholder="—" aria-label={`هزینه واقعی ${a.title}`}
                            onChange={(v) => upsert({ ...a, actualCost: v })} className="[&_input]:h-8 [&_input]:text-center" />
                        </td>
                        <td className={cx("px-4 py-2 text-center tabular sm:px-5", diff !== null && diff > 0 ? "text-critical-ink" : diff !== null && diff < 0 ? "text-good-ink" : "text-ink-3")}>
                          {diff === null ? "—" : `${diff > 0 ? "+" : ""}${faNum(diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-2/50 font-semibold">
                    <td className="px-4 py-2.5 sm:px-5" colSpan={2}>جمع</td>
                    <td className="px-2 py-2.5 text-center tabular">{faNum(b.planned)}</td>
                    <td className="px-2 py-2.5 text-center tabular">{faNum(b.actual)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-ink-3"><Info className="mt-0.5 size-3.5 shrink-0" />هزینه‌های دوره‌ای (مثل حقوق یا اشتراک سالانه) را به‌صورت یک فعالیت با بازه‌ی کامل و جمع هزینه ثبت کنید.</p>
        </>
      )}
      <ActivitySheet plan={plan} activity={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function Tile({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: "serious" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cx("mt-1 flex items-baseline gap-1 text-2xl font-bold tabular", tone === "serious" && "text-serious-ink")}>
        {value}{unit && <span className="text-xs font-normal text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-3">{sub}</div>}
    </Card>
  );
}
