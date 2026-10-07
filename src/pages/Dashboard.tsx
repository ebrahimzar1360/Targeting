import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Download, Flag, Info, Sparkles, XCircle } from "lucide-react";
import { Badge, Button, Card, CardHeader, CategoryDot, catColor, cx } from "@/components/ui/primitives";
import { BarList, CapacityChart, ProgressRing } from "@/components/charts";
import { AiBox, AiButton, AiError, useAi } from "@/components/AiPanel";
import { reviewPlan } from "@/ai/claude";
import type { PlanReview } from "@/ai/claude";
import { budgetSummary, categoryStats, expectedProgress, healthChecks, isActiveOn, isOverdue, phaseOf, planProgress, weeklyLoad } from "@/domain/calc";
import type { Severity } from "@/domain/calc";
import { addDays, diffDays, faNum, faPct, fmtJ, relDays, todayJ, weekStart } from "@/domain/jalali";
import { usePlan, useStore } from "@/store/store";
import { useStorageMode } from "@/platform/storage";
import { exportJson } from "@/io/files";
import { toast } from "@/components/ui/toast";
import { navigate } from "@/router";
import type { Page } from "@/router";

const SEV = {
  critical: { icon: XCircle, cls: "text-critical", label: "بحرانی" },
  serious: { icon: AlertTriangle, cls: "text-serious", label: "مهم" },
  warning: { icon: AlertCircle, cls: "text-warning", label: "هشدار" },
  info: { icon: Info, cls: "text-ink-3", label: "نکته" },
} satisfies Record<Severity, unknown>;

export function Dashboard() {
  const plan = usePlan();
  const today = todayJ();
  const progress = planProgress(plan);
  const expected = expectedProgress(plan, today);
  const issues = useMemo(() => healthChecks(plan, today), [plan, today]);
  const weeks = useMemo(() => weeklyLoad(plan), [plan]);
  const budget = budgetSummary(plan);
  const phase = phaseOf(plan, today);
  const totalDays = plan.start && plan.end ? diffDays(plan.start, plan.end) + 1 : 0;
  const elapsed = totalDays ? Math.max(0, Math.min(totalDays, diffDays(plan.start, today) + 1)) : 0;
  const ws = weekStart(today);
  const thisWeek = weeks.find((w) => w.start === ws);
  const overdue = plan.activities.filter((a) => isOverdue(a, today));
  const upcoming = plan.activities
    .filter((a) => a.status !== "done" && (isActiveOn(a, today) || (a.start > today && a.start <= addDays(today, 14))))
    .sort((a, b) => a.end.localeCompare(b.end)).slice(0, 6);
  const nextMilestone = plan.milestones.find((m) => !m.done && m.date >= today);
  const ai = useAi<PlanReview>();
  const backupDue = useBackupDue(plan.createdAt);
  const delta = progress - expected;

  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <div className="text-[13px] text-ink-3">{fmtJ(today)}{phase ? ` · ${phase.name}` : ""}</div>
        <h1 className="text-xl font-bold leading-8 sm:text-2xl">{plan.title || "داشبورد"}</h1>
      </div>
      {backupDue.due && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm text-warning-ink sm:flex-row sm:items-center" role="status">
          <AlertTriangle className="size-5 shrink-0" aria-label="هشدار" />
          <p className="flex-1 leading-6">
            برنامه‌ها فقط در همین مرورگر ذخیره شده‌اند و اگر داده‌های مرورگر پاک شود از بین می‌روند. هر دو هفته یک فایل پشتیبان بگیرید.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="primary" onClick={backupDue.backup}><Download className="size-4" />گرفتن پشتیبان</Button>
            <Button size="sm" variant="ghost" onClick={backupDue.dismiss}>بعداً</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="text-xs font-medium text-brand-ink">چشم‌انداز</div>
          <p className="mt-1 text-lg font-semibold leading-8">{plan.vision || "چشم‌انداز را در «چشم‌انداز و افق» بنویسید."}</p>
          {plan.model && <p className="mt-1 text-[13px] text-ink-2"><span className="text-ink-3">الگو: </span>{plan.model}</p>}
          {totalDays > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-ink-3">
                <span>{fmtJ(plan.start)}</span>
                <span>{today < plan.start ? `شروع ${relDays(diffDays(today, plan.start))}` : today > plan.end ? "افق برنامه تمام شده" : `${faNum(totalDays - elapsed, 0)} روز مانده`}</span>
                <span>{fmtJ(plan.end)}</span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-3">
                {plan.phases.map((p) => (
                  <div key={p.id} className="absolute inset-y-0 border-s-2 border-surface" style={{ insetInlineStart: `${(diffDays(plan.start, p.start) / totalDays) * 100}%` }} />
                ))}
                <div className="h-full rounded-full bg-ink-3/50" style={{ width: `${(elapsed / totalDays) * 100}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-ink-3">{faPct(elapsed / totalDays)} از زمان برنامه گذشته</div>
            </div>
          )}
        </Card>

        <Card className="flex items-center gap-5 p-5">
          <ProgressRing value={progress} label="پیشرفت کل" sub="پیشرفت کل" />
          <div className="min-w-0 text-sm leading-6">
            <div className="text-ink-3">طبق زمان‌بندی تا امروز</div>
            <div className="font-semibold">{faPct(expected)} باید انجام شده باشد</div>
            {plan.activities.length > 0 && (
              <Badge tone={delta >= -0.02 ? "good" : delta >= -0.1 ? "warning" : "critical"} className="mt-2">
                {delta >= -0.02 ? "طبق برنامه یا جلوتر" : `${faNum(Math.round(-delta * 100), 0)} واحد درصد عقب`}
              </Badge>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="فعالیت‌های جاری" value={faNum(plan.activities.filter((a) => a.status !== "done" && isActiveOn(a, today)).length, 0)} hint="بازه‌شان امروز را شامل می‌شود" />
        <Stat label="عقب‌افتاده" value={faNum(overdue.length, 0)} tone={overdue.length ? "critical" : undefined} hint="موعد گذشته و انجام‌نشده" onClick={() => navigate("plan")} />
        <Stat label="بار کاری این هفته" value={`${faNum(Math.round(thisWeek?.hours ?? 0), 0)} / ${faNum(plan.weeklyHours, 0)}`} unit="ساعت"
          tone={thisWeek && thisWeek.hours > plan.weeklyHours * 1.05 ? "serious" : undefined} hint="برنامه‌ریزی‌شده / ظرفیت" onClick={() => navigate("review")} />
        <Stat label="بودجه برنامه‌ریزی‌شده" value={faNum(budget.planned)} unit={plan.currency}
          tone={plan.budgetMax && budget.planned > plan.budgetMax ? "serious" : undefined}
          hint={plan.budgetMax ? `سقف: ${faNum(plan.budgetMax)} · خرج‌شده: ${faNum(budget.actual)}` : `خرج‌شده: ${faNum(budget.actual)}`} onClick={() => navigate("budget")} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="سلامت برنامه" subtitle="بررسی خودکار ناهماهنگی‌ها؛ روی هر مورد بزنید تا مستقیم اصلاحش کنید." />
          <div className="p-4 pt-3 sm:px-5">
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-good-soft px-3 py-3 text-sm text-good-ink"><CheckCircle2 className="size-4" />برنامه هماهنگ است؛ موردی پیدا نشد.</div>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {issues.map((i) => {
                  const s = SEV[i.severity];
                  const single = i.items.length === 1 && (i.key === "budget" || i.key === "capacity");
                  return (
                    <li key={i.key}>
                      <details className="group rounded-lg border border-line open:bg-surface-2/40">
                        <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                          <s.icon className={cx("mt-0.5 size-[18px] shrink-0", s.cls)} aria-label={s.label} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium leading-6">{i.title}{!single && <span className="ms-1.5 text-ink-3">({faNum(i.items.length, 0)})</span>}</div>
                            <div className="text-xs leading-5 text-ink-3">{i.detail}</div>
                          </div>
                          <ChevronDown className="mt-1 size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                        </summary>
                        <ul className="flex flex-wrap gap-1.5 px-3 pb-3 ps-10">
                          {i.items.slice(0, 30).map((it) => (
                            <li key={it.id} className="min-w-0 max-w-full">
                              <button onClick={() => navigate(it.target.page as Page, it.target.open ? { open: it.target.open } : {})}
                                className="max-w-full truncate rounded-md border sm:max-w-72 border-line bg-surface px-2 py-1 text-xs hover:border-brand hover:text-brand-ink">
                                {it.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="پیش رو" subtitle="فعالیت‌های جاری و دو هفته‌ی آینده" icon={<CalendarClock className="size-4" />} />
          <div className="p-4 pt-3 sm:px-5">
            {nextMilestone && (
              <div className="mb-3 rounded-lg bg-brand-soft p-3 text-[13px] leading-6 text-brand-ink">
                <div className="flex items-center gap-1.5 font-semibold"><Flag className="size-3.5" />نقطه عطف بعدی · {fmtJ(nextMilestone.date)}</div>
                <div className="mt-0.5">{nextMilestone.title}</div>
              </div>
            )}
            {upcoming.length === 0 ? <p className="text-sm text-ink-3">موردی برای دو هفته‌ی آینده نیست.</p> : (
              <ul className="grid grid-cols-1 gap-1">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => navigate("plan", { open: a.id })} className="w-full rounded-md px-2 py-1.5 text-start hover:bg-surface-2">
                      <div className="line-clamp-1 text-[13px]">{a.title}</div>
                      <div className="text-[11px] text-ink-3">{a.start > today ? `شروع ${relDays(diffDays(today, a.start))}` : `پایان ${relDays(diffDays(today, a.end))}`}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate("review")}>بازبینی هفتگی<ArrowLeft className="size-4" /></Button>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="پیشرفت در ۷ دسته" subtitle="میانگین پیشرفت هدف‌های هر دسته" />
          <div className="p-4 pt-4 sm:px-5">
            <BarList max={1} format={(v) => faPct(v)} rows={plan.categories.map((c) => ({ key: c.id, label: c.name, value: categoryStats(plan, c.id).progress, color: catColor(c.color) }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="بار کاری در برابر ظرفیت" subtitle={`ساعت برنامه‌ریزی‌شده در هر هفته؛ ظرفیت شما ${faNum(plan.weeklyHours, 0)} ساعت است.`} />
          <div className="p-4 pt-6 sm:px-5"><CapacityChart plan={plan} weeks={weeks} today={today} height={140} /></div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="نقد برنامه با هوش مصنوعی" subtitle="یک نگاه بیرونی مثل یک مشاور: شدنی بودن، جاافتاده‌ها، ترتیب کارها." icon={<Sparkles className="size-4" />}
          action={<AiButton loading={ai.loading} onClick={() => ai.run((s) => reviewPlan(s, plan))}>{ai.data ? "دوباره" : "نقد برنامه"}</AiButton>} />
        <div className="p-4 pt-3 sm:px-5">
          {ai.setupDialog}
          {ai.loading && <p className="text-sm text-ink-3">در حال بررسی برنامه… (ممکن است تا یک دقیقه طول بکشد)</p>}
          {ai.error && <AiError message={ai.error} />}
          {ai.data && (
            <AiBox>
              <p className="text-sm leading-7">{ai.data.summary}</p>
              <ul className="mt-3 grid gap-2">
                {ai.data.findings.map((f, i) => (
                  <li key={i} className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={f.severity === "high" ? "critical" : f.severity === "medium" ? "warning" : "neutral"}>{f.severity === "high" ? "مهم" : f.severity === "medium" ? "متوسط" : "جزئی"}</Badge>
                      <span className="text-sm font-semibold">{f.title}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-6 text-ink-2">{f.detail}</p>
                    <p className="mt-1 text-[13px] leading-6"><span className="font-medium text-brand-ink">پیشنهاد: </span>{f.suggestion}</p>
                  </li>
                ))}
              </ul>
            </AiBox>
          )}
          {!ai.data && !ai.loading && !ai.error && (
            <div className="flex flex-wrap gap-2">
              {plan.categories.map((c) => <span key={c.id} className="inline-flex items-center gap-1.5 text-xs text-ink-3"><CategoryDot slot={c.color} />{c.name}</span>)}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

/** Remind to back up when plans live only in this browser: never backed up after a few days, or a stale backup. */
function useBackupDue(createdAt: string) {
  const mode = useStorageMode((s) => s.mode);
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const plans = useStore((s) => s.plans);
  const markBackup = useStore((s) => s.markBackup);
  const [dismissed, setDismissed] = useState(false);
  const days = (iso: string) => (Date.now() - Date.parse(iso)) / 86_400_000;
  const due = mode === "device" && !dismissed && (lastBackupAt ? days(lastBackupAt) > 14 : !!createdAt && days(createdAt) > 3);
  const backup = async () => {
    try {
      if ((await exportJson(plans, "hadafnegar-backup")) === "saved") { markBackup(); toast.good("فایل پشتیبان ذخیره شد."); }
    } catch (e) { toast.error((e as Error).message); }
  };
  return { due, backup, dismiss: () => setDismissed(true) };
}

function Stat({ label, value, unit, hint, tone, onClick }: { label: string; value: string; unit?: string; hint?: string; tone?: "critical" | "serious"; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cx("rounded-xl border border-line bg-surface p-4 text-start shadow-card", onClick && "transition-colors hover:border-line-strong")}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cx("mt-1 flex items-baseline gap-1 text-2xl font-bold tabular", tone === "critical" && "text-critical-ink", tone === "serious" && "text-serious-ink")}>
        {value}{unit && <span className="text-xs font-normal text-ink-3">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-4 text-ink-3">{hint}</div>}
    </Comp>
  );
}
