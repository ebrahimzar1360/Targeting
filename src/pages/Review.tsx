import { useMemo, useState } from "react";
import { CalendarCheck, Check, History, TrendingUp } from "lucide-react";
import { Badge, Button, Card, CardHeader, CategoryDot, EmptyState, Field, PageHeader, Textarea, cx } from "@/components/ui/primitives";
import { CapacityChart } from "@/components/charts";
import { StatusBadge } from "@/components/editors";
import { toast } from "@/components/ui/toast";
import { activityProgress, isOverdue, overlapping, planProgress, weeklyLoad } from "@/domain/calc";
import { uid } from "@/domain/factory";
import { addDays, diffDays, faNum, faPct, fmtJ, fmtRange, monthLength, parseJ, relDays, todayJ, weekStart } from "@/domain/jalali";
import type { Activity, Plan } from "@/domain/schema";
import { useStore, usePlan } from "@/store/store";
import { navigate } from "@/router";

const MOODS = ["خیلی سخت", "سخت", "معمولی", "خوب", "عالی"];

export function Review() {
  const plan = usePlan();
  const addReview = useStore((s) => s.addReview);
  const today = todayJ();
  const ws = weekStart(today), we = addDays(ws, 6);
  const weeks = useMemo(() => weeklyLoad(plan), [plan]);
  const thisWeek = weeks.find((w) => w.start === ws);
  const nextWeek = weeks.find((w) => w.start === addDays(ws, 7));
  const titles = new Map(plan.activities.map((a) => [a.id, a]));
  const focus = [
    ...plan.activities.filter((a) => isOverdue(a, today)),
    ...overlapping(plan.activities, ws, we).filter((a) => a.status !== "done" && !isOverdue(a, today)),
  ];
  const lastReview = plan.reviews[plan.reviews.length - 1];
  const reviewedThisWeek = lastReview && lastReview.date >= ws;
  const [form, setForm] = useState({ wins: "", blockers: "", focus: "", mood: 3 });
  const p = parseJ(today)!;
  const monthEndSoon = p.jd >= monthLength(p.jy, p.jm) - 4 || p.jd <= 3;
  const over = weeks.filter((w) => w.hours > plan.weeklyHours * 1.05);

  const save = () => {
    addReview({ id: uid("rv"), date: today, ...form, progress: planProgress(plan) });
    setForm({ wins: "", blockers: "", focus: "", mood: 3 });
    toast.good("بازبینی این هفته ثبت شد. آفرین!");
  };

  return (
    <>
      <PageHeader
        title="بازبینی هفتگی"
        description="هر هفته حدود ۳۰ دقیقه: پیشرفت فعالیت‌ها را به‌روز کنید، بار کاری هفته‌ی بعد را ببینید، و تمرکز هفته را بنویسید."
        actions={<Badge tone={reviewedThisWeek ? "good" : "neutral"} dot>{reviewedThisWeek ? "این هفته بازبینی شده" : lastReview ? `آخرین بازبینی: ${relDays(diffDays(today, lastReview.date))}` : "هنوز بازبینی‌ای ثبت نشده"}</Badge>}
      />

      {monthEndSoon && plan.kpis.length > 0 && (
        <button onClick={() => navigate("kpi")} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4 text-start text-sm text-brand-ink">
          <TrendingUp className="size-5 shrink-0" />
          <span className="flex-1 leading-6"><span className="font-semibold">وقت بازبینی ماهانه است.</span> عددهای واقعی این ماه را در «شاخص‌ها» وارد کنید و برنامه‌ی ماه بعد را اصلاح کنید.</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="۱. به‌روزرسانی فعالیت‌ها" subtitle={`هفته‌ی ${fmtRange(ws, we)} · عقب‌افتاده‌ها اول`} icon={<CalendarCheck className="size-4" />} />
          <div className="p-4 pt-3 sm:px-5">
            {focus.length === 0 ? (
              <EmptyState title="این هفته فعالیت بازی ندارید">برنامه‌ی هفته خالی است یا همه انجام شده.</EmptyState>
            ) : (
              <ul className="grid grid-cols-1 gap-2">{focus.map((a) => <QuickUpdate key={a.id} plan={plan} a={a} today={today} />)}</ul>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 content-start gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="۲. بار کاری" subtitle={`ظرفیت شما ${faNum(plan.weeklyHours, 0)} ساعت در هفته است.`} />
            <div className="grid grid-cols-2 gap-3 p-4 sm:px-5">
              {[{ label: "این هفته", w: thisWeek }, { label: "هفته‌ی بعد", w: nextWeek }].map(({ label, w }) => {
                const h = w?.hours ?? 0;
                const isOver = h > plan.weeklyHours * 1.05;
                return (
                  <div key={label} className={cx("rounded-lg p-3", isOver ? "bg-serious-soft" : "bg-surface-2")}>
                    <div className="text-xs text-ink-3">{label}</div>
                    <div className={cx("mt-0.5 text-xl font-bold tabular", isOver && "text-serious-ink")}>{faNum(Math.round(h), 0)} <span className="text-xs font-normal">ساعت</span></div>
                    {w && <ul className="mt-2 grid gap-0.5 text-[11px] leading-4 text-ink-3">
                      {[...w.activities].sort((x, y) => y.hours - x.hours).slice(0, 3).map((x) => <li key={x.id} className="truncate">• {titles.get(x.id)?.title}</li>)}
                    </ul>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="۳. جمع‌بندی هفته" />
            <div className="grid grid-cols-1 gap-3 p-4 sm:px-5">
              <Field label="چه چیزی خوب پیش رفت؟"><Textarea value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} /></Field>
              <Field label="مانع‌ها و درس‌ها"><Textarea value={form.blockers} onChange={(e) => setForm({ ...form, blockers: e.target.value })} /></Field>
              <Field label="تمرکز هفته‌ی بعد (حداکثر ۳ مورد)"><Textarea value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} /></Field>
              <Field label="هفته چطور بود؟">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="امتیاز هفته">
                  {MOODS.map((m, i) => (
                    <button key={m} role="radio" aria-checked={form.mood === i + 1} onClick={() => setForm({ ...form, mood: i + 1 })}
                      className={cx("rounded-md border px-2.5 py-1 text-xs", form.mood === i + 1 ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-line text-ink-2 hover:bg-surface-2")}>{m}</button>
                  ))}
                </div>
              </Field>
              <Button variant="primary" onClick={save}><Check className="size-4" />ثبت بازبینی</Button>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="بار کاری کل برنامه" subtitle={over.length ? `${faNum(over.length, 0)} هفته بیش از ظرفیت است؛ فعالیت‌های آن هفته‌ها را جابه‌جا، کوچک یا واگذار کنید.` : "همه‌ی هفته‌ها در حد ظرفیت‌اند."} />
        <div className="p-4 pt-6 sm:px-5"><CapacityChart plan={plan} weeks={weeks} today={today} /></div>
      </Card>

      {plan.reviews.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="بازبینی‌های قبلی" icon={<History className="size-4" />} />
          <ul className="divide-y divide-line">
            {[...plan.reviews].reverse().slice(0, 12).map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-[13px] sm:grid-cols-[140px_1fr] sm:px-5">
                <div>
                  <div className="font-medium">{fmtJ(r.date)}</div>
                  <div className="text-xs text-ink-3">{MOODS[r.mood - 1]} · پیشرفت {faPct(r.progress)}</div>
                </div>
                <div className="grid grid-cols-1 gap-1 leading-6 text-ink-2">
                  {r.wins && <p><span className="text-ink-3">خوب: </span>{r.wins}</p>}
                  {r.blockers && <p><span className="text-ink-3">مانع: </span>{r.blockers}</p>}
                  {r.focus && <p><span className="text-ink-3">تمرکز: </span>{r.focus}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** Progress is committed on release, so one drag = one save and one undo step. */
function QuickUpdate({ plan, a, today }: { plan: Plan; a: Activity; today: string }) {
  const upsert = useStore((s) => s.upsertActivity);
  const [val, setVal] = useState(activityProgress(a));
  const [prevA, setPrevA] = useState(a);
  if (prevA !== a) { setPrevA(a); setVal(activityProgress(a)); }
  const req = plan.requirements.find((r) => r.id === a.requirementId);
  const cat = plan.categories.find((c) => c.id === req?.categoryId);
  const overdue = isOverdue(a, today);
  const commit = (v: number) => {
    if (v === activityProgress(a)) return;
    upsert({ ...a, progress: v, status: v === 100 ? "done" : v > 0 ? "doing" : a.status === "done" ? "doing" : a.status });
  };
  return (
    <li className={cx("rounded-lg border p-3", overdue ? "border-critical/40 bg-critical-soft/30" : "border-line")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate("plan", { open: a.id })} className="text-start text-sm leading-6 hover:text-brand-ink">{a.title}</button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {req && <span className="inline-flex items-center gap-1"><CategoryDot slot={cat?.color ?? 0} className="size-2" />{req.title}</span>}
            <span className={cx(overdue && "font-medium text-critical-ink")}>{overdue ? `موعد ${relDays(diffDays(today, a.end))}` : `تا ${fmtJ(a.end, "short")}`}</span>
          </div>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <input
          type="range" min={0} max={100} step={5} value={val} aria-label={`پیشرفت ${a.title}`}
          onChange={(e) => setVal(+e.target.value)}
          onPointerUp={() => commit(val)} onKeyUp={() => commit(val)} onBlur={() => commit(val)}
          className="range flex-1" style={{ ["--fill" as string]: `${val}%` }}
        />
        <span className="w-10 text-xs text-ink-2 tabular">{faPct(val / 100)}</span>
        <Button size="sm" variant={a.status === "done" ? "soft" : "secondary"} onClick={() => { setVal(100); commit(100); }} disabled={a.status === "done"}>
          <Check className="size-4" />انجام شد
        </Button>
      </div>
    </li>
  );
}
