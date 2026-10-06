import { useEffect, useRef, useState } from "react";
import { Flag, Plus, Trash2, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Field, IconButton, Input, NumberInput, PageHeader, ProgressBar, Textarea, catColor, cx } from "@/components/ui/primitives";
import { capacityInRange, hoursInRange } from "@/domain/calc";
import { DatePicker } from "@/components/ui/DatePicker";
import { Confirm } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { PHASE_COLOR_SLOTS } from "@/domain/defaults";
import { quarterlyPhases, uid } from "@/domain/factory";
import { diffDays, faNum, fmtJ, fmtRange, monthsBetween, todayJ } from "@/domain/jalali";
import type { Plan } from "@/domain/schema";
import { useStore, usePlan } from "@/store/store";

type Basics = Pick<Plan, "title" | "vision" | "model" | "focus" | "owner" | "start" | "end" | "weeklyHours" | "budgetMin" | "budgetMax" | "currency">;
const pick = (p: Plan): Basics => ({
  title: p.title, vision: p.vision, model: p.model, focus: p.focus, owner: p.owner, start: p.start, end: p.end,
  weeklyHours: p.weeklyHours, budgetMin: p.budgetMin, budgetMax: p.budgetMax, currency: p.currency,
});

export function Vision() {
  const plan = usePlan();
  const edit = useStore((s) => s.edit);
  const [f, setF] = useState<Basics>(pick(plan));
  const planBasics = JSON.stringify(pick(plan));
  const lastSaved = useRef(planBasics);

  // Pick up outside changes (undo, plan switch) without clobbering typing.
  useEffect(() => {
    if (planBasics !== lastSaved.current) { lastSaved.current = planBasics; setF(pick(plan)); }
  }, [planBasics]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save shortly after typing stops; each save is one undo step.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = JSON.stringify(f);
      if (next !== lastSaved.current) { lastSaved.current = next; edit("ویرایش چشم‌انداز", (p) => Object.assign(p, f)); }
    }, 600);
    return () => clearTimeout(t);
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Basics>(k: K, v: Basics[K]) => setF((x) => ({ ...x, [k]: v }));
  const validRange = f.start && f.end && f.end > f.start;

  return (
    <>
      <PageHeader step={1} title="چشم‌انداز و افق" description="مقصد، الگو، بازه‌ی زمانی، ظرفیت و بودجه. تغییرات خودکار ذخیره می‌شوند." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="چشم‌انداز" subtitle="همه‌ی الزامات از همین جمله بیرون می‌آیند؛ روشن و کوتاه بنویسید." />
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
            <Field label="نام برنامه"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="بیانیه چشم‌انداز"><Textarea value={f.vision} onChange={(e) => set("vision", e.target.value)} placeholder="در پایان مسیر چه کسی هستید یا چه چیزی دارید؟" /></Field>
            <Field label="الگو" hint="فرد، مجموعه یا نمونه‌ی موفقی که امروز در وضعیت مطلوب است؛ «وضعیت مطلوب» الزامات را از روی آن بنویسید.">
              <Input value={f.model} onChange={(e) => set("model", e.target.value)} />
            </Field>
            <Field label="تمرکز / بازار هدف (اختیاری)"><Textarea value={f.focus} onChange={(e) => set("focus", e.target.value)} /></Field>
            <Field label="صاحب برنامه (مسئول پیش‌فرض)" hint="در فعالیت‌های جدید به‌عنوان مسئول قرار می‌گیرد.">
              <Input value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="خودم" />
            </Field>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="افق، ظرفیت و بودجه" subtitle="این عددها مبنای سنجش شدنی بودن برنامه‌اند." />
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="شروع"><DatePicker value={f.start} onChange={(v) => set("start", v)} /></Field>
              <Field label="پایان"><DatePicker value={f.end} onChange={(v) => set("end", v)} min={f.start} /></Field>
            </div>
            {validRange && <p className="-mt-2 text-xs text-ink-3">{faNum(monthsBetween(f.start, f.end).length, 0)} ماه · {faNum(diffDays(f.start, f.end) + 1, 0)} روز</p>}
            <Field label="ظرفیت زمانی هفتگی" hint={`≈ ${faNum(Math.round((f.weeklyHours * (validRange ? diffDays(f.start, f.end) + 1 : 365)) / 7), 0)} ساعت در کل افق`}>
              <NumberInput value={f.weeklyHours} onChange={(v) => set("weeklyHours", Math.max(0, v ?? 0))} suffix="ساعت" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="بودجه حداقل"><NumberInput value={f.budgetMin} onChange={(v) => set("budgetMin", Math.max(0, v ?? 0))} /></Field>
              <Field label="سقف بودجه"><NumberInput value={f.budgetMax} onChange={(v) => set("budgetMax", Math.max(0, v ?? 0))} /></Field>
            </div>
            <Field label="واحد پول"><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PhasesCard plan={plan} />
        <MilestonesCard plan={plan} />
      </div>
    </>
  );
}

function PhasesCard({ plan }: { plan: Plan }) {
  const upsert = useStore((s) => s.upsertPhase);
  const remove = useStore((s) => s.deletePhase);
  const edit = useStore((s) => s.edit);
  const [confirm, setConfirm] = useState(false);
  const regenerate = () => {
    const months = Math.max(1, monthsBetween(plan.start, plan.end).length);
    edit("ساخت فازها", (p) => { p.phases = quarterlyPhases(p.start, months); });
    toast.good("۴ فاز مساوی ساخته شد.");
  };
  return (
    <Card>
      <CardHeader title="فازها" subtitle="بازه‌های بزرگ برنامه؛ فعالیت‌ها بر اساس تاریخ شروع در فاز قرار می‌گیرند."
        action={<Button size="sm" variant="ghost" onClick={() => (plan.phases.length ? setConfirm(true) : regenerate())}><Wand2 className="size-4" />۴ فاز مساوی</Button>} />
      <ul className="grid grid-cols-1 gap-3 p-4 sm:p-5">
        {plan.phases.map((ph, i) => (
          <li key={ph.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-1 rounded-full" style={{ background: catColor(PHASE_COLOR_SLOTS[i % 8]) }} />
              <Input value={ph.name} onChange={(e) => upsert({ ...ph, name: e.target.value })} className="h-8 flex-1 font-medium" aria-label="نام فاز" />
              <IconButton label="حذف فاز" size="icon-sm" onClick={() => remove(ph.id)}><Trash2 className="size-4" /></IconButton>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <DatePicker value={ph.start} onChange={(v) => upsert({ ...ph, start: v })} />
              <DatePicker value={ph.end} onChange={(v) => upsert({ ...ph, end: v })} min={ph.start} />
            </div>
            <Input value={ph.description} onChange={(e) => upsert({ ...ph, description: e.target.value })} placeholder="هدف این فاز در یک جمله" className="mt-2 h-8 text-[13px]" aria-label="توضیح فاز" />
            <PhaseLoad plan={plan} start={ph.start} end={ph.end} />
          </li>
        ))}
        <li>
          <Button size="sm" onClick={() => {
            const last = plan.phases[plan.phases.length - 1];
            upsert({ id: uid("ph"), name: `فاز ${faNum(plan.phases.length + 1, 0)}`, start: last?.end ?? plan.start, end: plan.end, description: "" });
          }}><Plus className="size-4" />افزودن فاز</Button>
        </li>
      </ul>
      <Confirm open={confirm} onOpenChange={setConfirm} title="فازها از نو ساخته شوند؟" description="فازهای فعلی با ۴ فاز مساوی در افق برنامه جایگزین می‌شوند (قابل برگرداندن)." confirmLabel="ساختن" onConfirm={regenerate} />
    </Card>
  );
}

/** Planned hours in a phase against the capacity of the same period. */
function PhaseLoad({ plan, start, end }: { plan: Plan; start: string; end: string }) {
  if (!start || !end || end < start || !plan.weeklyHours) return null;
  const need = hoursInRange(plan, start, end), cap = capacityInRange(plan, start, end);
  const ratio = cap ? need / cap : 0;
  const over = ratio > 1.05;
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink-3">بار کاری این فاز</span>
        <span className={cx("tabular", over ? "font-medium text-serious-ink" : "text-ink-2")}>
          {faNum(Math.round(need), 0)} ساعت لازم / {faNum(Math.round(cap), 0)} ساعت ظرفیت{over ? ` · ${faNum(Math.round(ratio * 10) / 10)} برابر` : ""}
        </span>
      </div>
      <ProgressBar value={Math.min(1, ratio)} tone={over ? "serious" : "good"} height={4} label="بار کاری فاز نسبت به ظرفیت" />
    </div>
  );
}

function MilestonesCard({ plan }: { plan: Plan }) {
  const upsert = useStore((s) => s.upsertMilestone);
  const remove = useStore((s) => s.deleteMilestone);
  const today = todayJ();
  return (
    <Card>
      <CardHeader title="نقاط عطف" subtitle="نتیجه‌هایی که در تاریخ‌های کلیدی باید محقق شده باشند." icon={<Flag className="size-4" />} />
      <ul className="grid grid-cols-1 gap-3 p-4 sm:p-5">
        {plan.milestones.map((m) => (
          <li key={m.id} className={cx("rounded-lg border p-3", m.done ? "border-good/40 bg-good-soft/40" : m.date < today ? "border-critical/40" : "border-line")}>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-2.5 size-4 accent-[var(--good)]" checked={m.done} onChange={(e) => upsert({ ...m, done: e.target.checked })} aria-label="محقق شد" />
              <div className="grid flex-1 gap-2">
                <div className="w-48"><DatePicker value={m.date} onChange={(v) => upsert({ ...m, date: v })} /></div>
                <Textarea value={m.title} onChange={(e) => upsert({ ...m, title: e.target.value })} className="text-[13px]" aria-label="شرح نقطه عطف" />
              </div>
              <IconButton label="حذف" size="icon-sm" onClick={() => remove(m.id)}><Trash2 className="size-4" /></IconButton>
            </div>
            {!m.done && m.date < today && <p className="mt-1 ps-6 text-xs text-critical-ink">موعد گذشته ({fmtJ(m.date)})</p>}
          </li>
        ))}
        {plan.milestones.length === 0 && <p className="text-sm text-ink-3">مثلاً «پایان فاز ۱: ۲ پروژه پایلوت در حال اجرا».</p>}
        <li>
          <Button size="sm" onClick={() => upsert({ id: uid("m"), date: plan.phases[0]?.end ?? plan.end, title: "", done: false })}><Plus className="size-4" />افزودن نقطه عطف</Button>
        </li>
      </ul>
      {plan.phases.length > 0 && <p className="px-5 pb-4 text-xs text-ink-3">فازها: {plan.phases.map((p) => `${p.name} (${fmtRange(p.start, p.end)})`).join(" · ")}</p>}
    </Card>
  );
}
