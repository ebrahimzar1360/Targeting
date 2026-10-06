import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, NumberInput, Textarea, cx } from "@/components/ui/primitives";
import { DatePicker } from "@/components/ui/DatePicker";
import { createPlan } from "@/domain/factory";
import { addDays, addMonths, faDigits, fmtJ, formatJ, parseJ, todayJ } from "@/domain/jalali";
import { useStore } from "@/store/store";
import { navigate } from "@/router";
import { toast } from "@/components/ui/toast";

const STEPS = ["چشم‌انداز", "افق و ظرفیت", "مرور"];

/** Default start: the first day of next month. */
function nextMonthStart() {
  const t = parseJ(todayJ())!;
  return addMonths(formatJ({ ...t, jd: 1 }), 1);
}

export function NewPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const addPlan = useStore((s) => s.addPlan);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    title: "", vision: "", model: "", start: nextMonthStart(), months: 12, weeklyHours: 10, budgetMin: 0, budgetMax: 0, withPhases: true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const canNext = step !== 0 || (f.title.trim() && f.vision.trim());

  const finish = () => {
    const plan = createPlan(f);
    addPlan(plan);
    onOpenChange(false);
    setStep(0);
    toast.good("برنامه ساخته شد. حالا الزامات را در ۷ دسته بنویسید.");
    navigate("requirements");
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) setStep(0); }}
      title="برنامه جدید"
      description="در سه گام کوتاه؛ همه‌چیز بعداً قابل ویرایش است."
      size="lg"
      footer={
        <>
          {step > 0 && <Button onClick={() => setStep(step - 1)}><ArrowRight className="size-4" />قبلی</Button>}
          {step < 2 && <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>بعدی<ArrowLeft className="size-4" /></Button>}
          {step === 2 && <Button variant="primary" onClick={finish}><Check className="size-4" />ساخت برنامه</Button>}
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-2" aria-label="گام‌ها">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
              i < step ? "bg-good text-white" : i === step ? "bg-brand text-white" : "bg-surface-2 text-ink-3")}>
              {i < step ? <Check className="size-3.5" /> : faDigits(i + 1)}
            </span>
            <span className={cx("text-[13px]", i === step ? "font-semibold" : "text-ink-3")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid grid-cols-1 gap-4">
          <Field label="نام برنامه" htmlFor="np-title">
            <Input id="np-title" autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="مثلاً: راه‌اندازی کسب‌وکار مشاوره" />
          </Field>
          <Field label="بیانیه چشم‌انداز" hint="می‌خواهید در پایان این مسیر چه کسی باشید یا چه چیزی داشته باشید؟ یک جمله‌ی روشن.">
            <Textarea value={f.vision} onChange={(e) => set("vision", e.target.value)} placeholder="مثلاً: مشاور کسب‌وکار و سیستم‌سازی سازمان‌ها با هوش مصنوعی" />
          </Field>
          <Field label="الگو (اختیاری)" hint="فرد، مجموعه یا نمونه‌ی موفقی که امروز در وضعیت مطلوب شماست؛ «وضعیت مطلوب» هر الزام را از روی آن بنویسید.">
            <Input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="مثلاً: یک مشاور شناخته‌شده در صنعت" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="شروع برنامه"><DatePicker value={f.start} onChange={(v) => set("start", v)} /></Field>
          <Field label="مدت (ماه)"><NumberInput value={f.months} onChange={(v) => set("months", Math.max(1, Math.min(60, Math.round(v ?? 12))))} suffix="ماه" /></Field>
          <Field label="ظرفیت زمانی هفتگی" hint="ساعتی که واقعاً هر هفته برای این برنامه دارید. اپ با آن بار کاری را می‌سنجد." className="sm:col-span-2">
            <NumberInput value={f.weeklyHours} onChange={(v) => set("weeklyHours", v ?? 0)} suffix="ساعت" />
          </Field>
          <Field label="بودجه حداقل"><NumberInput value={f.budgetMin} onChange={(v) => set("budgetMin", v ?? 0)} suffix="م.ت" /></Field>
          <Field label="بودجه حداکثر (سقف)"><NumberInput value={f.budgetMax} onChange={(v) => set("budgetMax", v ?? 0)} suffix="م.ت" /></Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 sm:col-span-2">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={f.withPhases} onChange={(e) => set("withPhases", e.target.checked)} />
            <span className="text-sm leading-6">
              <span className="font-medium">تقسیم به ۴ فاز مساوی</span>
              <span className="block text-ink-3">فازها بعداً در صفحه‌ی «چشم‌انداز و افق» قابل تغییرند.</span>
            </span>
          </label>
        </div>
      )}

      {step === 2 && (
        <dl className="grid grid-cols-1 gap-3 text-sm">
          {[
            ["نام", f.title],
            ["چشم‌انداز", f.vision],
            ["الگو", f.model || "—"],
            ["افق", `${fmtJ(f.start)} تا ${fmtJ(addDays(addMonths(f.start, f.months), -1))}`],
            ["ظرفیت", `${faDigits(f.weeklyHours)} ساعت در هفته`],
            ["بودجه", f.budgetMax ? `${faDigits(f.budgetMin)} تا ${faDigits(f.budgetMax)} میلیون تومان` : "تعیین نشده"],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[88px_1fr] gap-3 border-b border-line pb-3 last:border-0">
              <dt className="text-ink-3">{k}</dt><dd className="leading-6">{v}</dd>
            </div>
          ))}
          <p className="rounded-lg bg-brand-soft p-3 leading-6 text-brand-ink">
            گام بعد: در «ماتریس الزامات» برای هر یک از ۷ دسته بنویسید چه چیزی لازم است، امروز کجایید، و هدفِ قابل‌سنجش برای پر کردن فاصله چیست.
          </p>
        </dl>
      )}
    </Modal>
  );
}
