import { useState } from "react";
import { Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, NumberInput, PageHeader, ProgressBar, Select, cx } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { Sparkline } from "@/components/charts";
import { kpiValue, planMonths } from "@/domain/calc";
import { KPI_MODES } from "@/domain/defaults";
import { uid } from "@/domain/factory";
import { faNum, faPct, monthKey, todayJ } from "@/domain/jalali";
import type { Kpi, Plan } from "@/domain/schema";
import { useStore, usePlan } from "@/store/store";

function pace(kpi: Kpi, plan: Plan) {
  const months = planMonths(plan);
  const keys = months.map((m) => m.key);
  const value = kpiValue(kpi, keys);
  const nowIdx = keys.indexOf(monthKey(todayJ()));
  const elapsed = nowIdx === -1 ? (todayJ() > plan.end ? keys.length : 0) : nowIdx + 1;
  const expected = kpi.mode === "avg" ? kpi.target : (kpi.target * elapsed) / Math.max(1, keys.length);
  const series: (number | null)[] = [];
  let run = 0;
  for (const k of keys) {
    const v = kpi.values[k];
    if (kpi.mode === "sum") { if (typeof v === "number") run += v; series.push(typeof v === "number" ? run : null); }
    else series.push(typeof v === "number" ? v : null);
  }
  return { value, expected, ratio: value === null || !kpi.target ? 0 : value / kpi.target, onTrack: value !== null && value >= expected * 0.95, series, elapsed };
}

export function Kpis() {
  const plan = usePlan();
  const setValue = useStore((s) => s.setKpiValue);
  const [editing, setEditing] = useState<Kpi | null>(null);
  const months = planMonths(plan);
  const current = monthKey(todayJ());

  return (
    <>
      <PageHeader
        step={4}
        title="شاخص‌های کلیدی (KPI)"
        description="آخر هر ماه عدد واقعی هر شاخص را وارد کنید. اپ آن را با هدف سال و با «سهم تا امروز» مقایسه می‌کند."
        actions={<Button variant="primary" onClick={() => setEditing({ id: uid("k"), title: "", unit: "", target: 0, mode: "sum", values: {}, requirementId: null })}><Plus className="size-4" />شاخص جدید</Button>}
      />

      {plan.kpis.length === 0 ? (
        <Card><EmptyState icon={<TrendingUp className="size-5" />} title="هنوز شاخصی ندارید">مثلاً «درآمد قراردادی»، «جلسه‌ی فروش»، «محتوای منتشرشده». هر هدف مالی یا رشد را با یک شاخص ماهانه بسنجید.</EmptyState></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[1240px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2/50 text-xs text-ink-3">
                    <th className="sticky start-0 z-10 w-56 min-w-56 bg-surface-2 px-4 py-2.5 text-start font-medium">شاخص</th>
                    <th className="px-2 py-2.5 font-medium">هدف</th>
                    {months.map((m) => (
                      <th key={m.key} className={cx("w-16 min-w-16 px-1 py-2.5 font-medium", m.key === current && "text-brand-ink")}>
                        {m.label}{m.key === current && <span className="block text-[10px]">این ماه</span>}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-medium">وضعیت</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {plan.kpis.map((k) => {
                    const p = pace(k, plan);
                    return (
                      <tr key={k.id} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                        <td className="sticky start-0 z-10 w-56 min-w-56 bg-surface px-4 py-2">
                          <div className="font-medium leading-5">{k.title}</div>
                          <div className="text-[11px] text-ink-3">{k.unit} · {KPI_MODES.find((m) => m.key === k.mode)?.label}</div>
                        </td>
                        <td className="px-2 py-2 text-center font-semibold tabular">{faNum(k.target)}</td>
                        {months.map((m) => (
                          <td key={m.key} className={cx("px-0.5 py-1.5", m.key === current && "bg-brand-soft/40")}>
                            <NumberInput
                              value={k.values[m.key] ?? null} allowEmpty aria-label={`${k.title} — ${m.label}`}
                              onChange={(v) => setValue(k.id, m.key, v)}
                              className="[&_input]:h-8 [&_input]:px-1 [&_input]:text-center [&_input]:text-[13px]"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <div className="mb-1 flex justify-between text-[11px] text-ink-3 tabular"><span>{p.value === null ? "—" : faNum(p.value)}</span><span>{faPct(p.ratio)}</span></div>
                              <ProgressBar value={p.ratio} height={4} tone={p.value === null ? "neutral" : p.onTrack ? "good" : "warning"} label="نسبت به هدف" />
                            </div>
                            <Sparkline values={p.series} width={64} />
                          </div>
                        </td>
                        <td className="px-1"><IconButton label="ویرایش شاخص" size="icon-sm" onClick={() => setEditing(k)}><Pencil className="size-4" /></IconButton></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {plan.kpis.map((k) => {
              const p = pace(k, plan);
              return (
                <Card key={k.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{k.title}</div>
                      <div className="text-xs text-ink-3">هدف: {faNum(k.target)} {k.unit}</div>
                    </div>
                    <IconButton label="ویرایش شاخص" size="icon-sm" onClick={() => setEditing(k)}><Pencil className="size-4" /></IconButton>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={p.ratio} tone={p.value === null ? "neutral" : p.onTrack ? "good" : "warning"} label="نسبت به هدف" />
                      <div className="mt-1 text-xs text-ink-3">{p.value === null ? "هنوز عددی ثبت نشده" : `${faNum(p.value)} از ${faNum(k.target)} (${faPct(p.ratio)})`}</div>
                    </div>
                    <Sparkline values={p.series} />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {months.map((m) => (
                      <label key={m.key} className={cx("rounded-md p-1 text-center text-[11px]", m.key === current ? "bg-brand-soft text-brand-ink" : "text-ink-3")}>
                        {m.label}
                        <NumberInput value={k.values[m.key] ?? null} allowEmpty onChange={(v) => setValue(k.id, m.key, v)} className="mt-0.5 [&_input]:h-8 [&_input]:px-1 [&_input]:text-center" />
                      </label>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5"><Badge tone="good">سبز</Badge>هم‌پای هدف (نسبت به سهم ماه‌های گذشته)</span>
            <span className="inline-flex items-center gap-1.5"><Badge tone="warning">زرد</Badge>عقب‌تر از سهم تا امروز</span>
          </div>
        </>
      )}

      <KpiDialog plan={plan} kpi={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function KpiDialog({ plan, kpi, onClose }: { plan: Plan; kpi: Kpi | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertKpi);
  const remove = useStore((s) => s.deleteKpi);
  const [draft, setDraft] = useState<Kpi | null>(kpi);
  const [lastId, setLastId] = useState<string | null>(null);
  if (kpi && kpi.id !== lastId) { setLastId(kpi.id); setDraft(kpi); }
  if (!kpi || !draft) return null;
  const isNew = !plan.kpis.some((k) => k.id === draft.id);
  const mode = KPI_MODES.find((m) => m.key === draft.mode)!;
  return (
    <Modal
      open onOpenChange={(o) => { if (!o) { setLastId(null); onClose(); } }}
      title={isNew ? "شاخص جدید" : "ویرایش شاخص"}
      footer={
        <>
          {!isNew && <Button variant="ghost" className="me-auto text-critical-ink" onClick={() => { remove(draft.id); setLastId(null); onClose(); }}><Trash2 className="size-4" />حذف</Button>}
          <Button onClick={() => { setLastId(null); onClose(); }}>انصراف</Button>
          <Button variant="primary" disabled={!draft.title.trim()} onClick={() => { upsert(draft); setLastId(null); onClose(); }}>ذخیره</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="نام شاخص"><Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="مثلاً: درآمد قراردادی" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="هدف سال"><NumberInput value={draft.target} onChange={(v) => setDraft({ ...draft, target: v ?? 0 })} /></Field>
          <Field label="واحد"><Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="مثلاً: میلیون تومان" /></Field>
        </div>
        <Field label="نوع محاسبه" hint={mode.hint}>
          <Select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as Kpi["mode"] })}>
            {KPI_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="هدف مرتبط (اختیاری)">
          <Select value={draft.requirementId ?? ""} onChange={(e) => setDraft({ ...draft, requirementId: e.target.value || null })}>
            <option value="">—</option>
            {plan.requirements.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
