import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, CircleCheck, Plus, Trash2 } from "lucide-react";
import { Sheet } from "./ui/overlays";
import { Badge, Button, CategoryDot, Field, Input, NumberInput, ProgressBar, Segmented, Select, Slider, Textarea, cx } from "./ui/primitives";
import { DatePicker } from "./ui/DatePicker";
import { toast } from "./ui/toast";
import { AiBox, AiButton, AiError, useAi } from "./AiPanel";
import { suggestActivities, suggestGoals } from "@/ai/claude";
import type { ActivityIdea, GoalIdea } from "@/ai/claude";
import { activitiesOf, goalChecks, isOverdue, requirementProgress, shiftActivity } from "@/domain/calc";
import { PRIORITIES, STATUSES, statusLabel } from "@/domain/defaults";
import { newActivity, newRequirement } from "@/domain/factory";
import { diffDays, faNum, faPct, fmtJ, fmtRange, todayJ } from "@/domain/jalali";
import type { Activity, Plan, Requirement, Status } from "@/domain/schema";
import { useStore } from "@/store/store";

const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.key, s.tone])) as Record<Status, (typeof STATUSES)[number]["tone"]>;

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]} dot>{statusLabel(status)}</Badge>;
}

const undoToast = (text: string) =>
  toast.info(text, { label: "برگرداندن", run: () => useStore.getState().undo() });

/** Saves on close when something changed; a new item without a title is discarded. */
function useDraft<T extends { id: string; title: string }>(item: T | null, save: (x: T) => void) {
  const [draft, setDraft] = useState<T | null>(item);
  const original = useRef<T | null>(item);
  useEffect(() => { setDraft(item); original.current = item; }, [item]);
  const commit = () => {
    if (!draft) return false;
    if (!draft.title.trim()) return false;
    if (JSON.stringify(draft) !== JSON.stringify(original.current)) { save(draft); original.current = draft; return true; }
    return false;
  };
  return { draft, setDraft, commit };
}

// ---------- Requirement ----------

export function RequirementSheet({ plan, requirement, onClose, onOpenActivity }: {
  plan: Plan; requirement: Requirement | null; onClose: () => void; onOpenActivity: (a: Activity) => void;
}) {
  const upsert = useStore((s) => s.upsertRequirement);
  const remove = useStore((s) => s.deleteRequirement);
  const upsertActivity = useStore((s) => s.upsertActivity);
  const { draft, setDraft, commit } = useDraft(requirement, upsert);
  const goalsAi = useAi<GoalIdea[]>();
  const actsAi = useAi<ActivityIdea[]>();
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => { goalsAi.reset(); actsAi.reset(); setPicked(new Set()); }, [requirement?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return null;
  const isNew = !plan.requirements.some((r) => r.id === draft.id);
  const set = <K extends keyof Requirement>(k: K, v: Requirement[K]) => setDraft({ ...draft, [k]: v });
  const close = () => { commit(); onClose(); };
  const checks = goalChecks(draft);
  const acts = activitiesOf(plan, draft.id);
  const prog = requirementProgress(plan, draft.id);
  const today = todayJ();

  const addIdeas = () => {
    if (!actsAi.data) return;
    commit();
    actsAi.data.forEach((idea, i) => {
      if (!picked.has(i)) return;
      upsertActivity(newActivity(plan, { ...idea, requirementId: draft.id }));
    });
    toast.good(`${faNum(picked.size, 0)} فعالیت به برنامه عملیاتی اضافه شد.`);
    actsAi.reset(); setPicked(new Set());
  };

  return (
    <Sheet
      open onOpenChange={(o) => !o && close()} wide
      title={isNew ? "الزام جدید" : draft.title || "الزام"}
      description="فاصله‌ی وضعیت موجود تا وضعیت مطلوب را به یک هدف قابل‌سنجش تبدیل کنید."
      footer={
        <>
          <Button variant="primary" onClick={close} disabled={!draft.title.trim()}><Check className="size-4" />ذخیره و بستن</Button>
          {!isNew && (
            <Button variant="ghost" className="ms-auto text-critical-ink" onClick={() => { remove(draft.id); onClose(); undoToast("الزام حذف شد؛ فعالیت‌هایش بدون هدف ماندند."); }}>
              <Trash2 className="size-4" />حذف
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="عنوان الزام" htmlFor="rq-title">
            <Input id="rq-title" autoFocus={isNew} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="مثلاً: دانش قیمت‌گذاری خدمات" />
          </Field>
          <Field label="دسته">
            <Select value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {plan.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="وضعیت مطلوب" hint="آنچه چشم‌انداز (یا الگو) لازم دارد.">
            <Textarea value={draft.desired} onChange={(e) => set("desired", e.target.value)} placeholder="کجا باید باشید؟" />
          </Field>
          <Field label="وضعیت موجود" hint="صادقانه؛ امروز کجایید.">
            <Textarea value={draft.current} onChange={(e) => set("current", e.target.value)} placeholder="الان کجایید؟" />
          </Field>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/60 p-4">
          <Field
            label={<span className="text-ink">هدف <span className="font-normal text-ink-3">— گام قابل‌سنجش برای پر کردن فاصله</span></span>}
            extra={<AiButton loading={goalsAi.loading} onClick={() => goalsAi.run((s) => suggestGoals(s, plan, draft))}>پیشنهاد هدف</AiButton>}
          >
            <Textarea value={draft.goal} onChange={(e) => set("goal", e.target.value)} placeholder="مثلاً: طراحی ۳ بسته خدمت با قیمت مشخص" className="bg-surface" />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={cx("inline-flex items-center gap-1", checks.measurable ? "text-good-ink" : "text-ink-3")}>
              {checks.measurable ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}عدد دارد (قابل سنجش)
            </span>
            <span className={cx("inline-flex items-center gap-1", checks.timed ? "text-good-ink" : "text-ink-3")}>
              {checks.timed ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}موعد دارد
            </span>
          </div>
          {goalsAi.setupDialog}
          {goalsAi.error && <div className="mt-3"><AiError message={goalsAi.error} /></div>}
          {goalsAi.data && (
            <AiBox className="mt-3">
              <ul className="grid grid-cols-1 gap-2">
                {goalsAi.data.map((g, i) => (
                  <li key={i}>
                    <button
                      className="w-full rounded-lg border border-line bg-surface p-3 text-start transition-colors hover:border-brand"
                      onClick={() => { setDraft({ ...draft, goal: g.goal, dueDate: g.due_date }); goalsAi.reset(); }}
                    >
                      <div className="text-sm font-medium leading-6">{g.goal}</div>
                      <div className="mt-1 text-xs leading-5 text-ink-3">موعد: {fmtJ(g.due_date)} · {g.why}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </AiBox>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="موعد هدف"><DatePicker value={draft.dueDate} onChange={(v) => set("dueDate", v)} clearable min={plan.start} /></Field>
            <Field label="اولویت">
              <Segmented label="اولویت" value={draft.priority} onChange={(v) => set("priority", v)} options={PRIORITIES.map((p) => ({ value: p.key, label: p.label, dot: p.tone }))} />
            </Field>
          </div>
        </div>

        {!isNew && (
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">فعالیت‌های این هدف <span className="font-normal text-ink-3">({faNum(acts.length, 0)})</span></h3>
              <div className="flex gap-2">
                <AiButton loading={actsAi.loading} onClick={() => { commit(); actsAi.run((s) => suggestActivities(s, plan, draft)); }}>پیشنهاد فعالیت</AiButton>
                <Button size="sm" onClick={() => { commit(); onOpenActivity(newActivity(plan, { requirementId: draft.id })); }}><Plus className="size-4" />فعالیت</Button>
              </div>
            </div>
            {prog !== null && <div className="mb-3 flex items-center gap-3 text-xs text-ink-3"><ProgressBar value={prog} className="max-w-48" label="پیشرفت هدف" />{faPct(prog)}</div>}
            {actsAi.setupDialog}
            {actsAi.error && <AiError message={actsAi.error} />}
            {actsAi.data && (
              <AiBox className="mb-3">
                <ul className="grid grid-cols-1 gap-2">
                  {actsAi.data.map((a, i) => (
                    <li key={i}>
                      <label className={cx("flex cursor-pointer gap-3 rounded-lg border bg-surface p-3", picked.has(i) ? "border-brand" : "border-line")}>
                        <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={picked.has(i)}
                          onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                        <span className="min-w-0 text-sm">
                          <span className="block font-medium leading-6">{a.title}</span>
                          <span className="block text-xs leading-5 text-ink-3">{a.program} · {fmtRange(a.start, a.end)} · {faNum(a.hours, 0)} ساعت{a.cost ? ` · ${faNum(a.cost)} ${plan.currency}` : ""}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" size="sm" disabled={!picked.size} onClick={addIdeas}>افزودن {picked.size ? faNum(picked.size, 0) : ""} مورد</Button>
                  <Button variant="ghost" size="sm" onClick={() => { actsAi.reset(); setPicked(new Set()); }}>رد کردن</Button>
                </div>
              </AiBox>
            )}
            {acts.length === 0 && !actsAi.data && (
              <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-[13px] leading-6 text-ink-3">
                هنوز فعالیتی برای این هدف نیست؛ بدون فعالیت، هدف اجرا نمی‌شود.
              </p>
            )}
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {acts.map((a) => (
                <li key={a.id}>
                  <button onClick={() => { commit(); onOpenActivity(a); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-surface-2">
                    <StatusBadge status={a.status} />
                    <span className="min-w-0 flex-1 truncate text-sm">{a.title}</span>
                    <span className={cx("shrink-0 text-xs tabular", isOverdue(a, today) ? "text-critical-ink" : "text-ink-3")}>{fmtJ(a.end, "short")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Field label="یادداشت (اختیاری)">
          <Textarea value={draft.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

export function useNewRequirement(plan: Plan) {
  return (categoryId?: string) => newRequirement(categoryId ?? plan.categories[0]?.id ?? "knowledge");
}

// ---------- Activity ----------

/** Quick reschedules; the most common fix for weeks over capacity. */
const SHIFTS: [number, string][] = [[-7, "یک هفته زودتر"], [7, "یک هفته بعد"], [14, "دو هفته بعد"], [30, "یک ماه بعد"]];

export function ActivitySheet({ plan, activity, onClose }: { plan: Plan; activity: Activity | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertActivity);
  const remove = useStore((s) => s.deleteActivity);
  const { draft, setDraft, commit } = useDraft(activity, upsert);
  const programs = useMemo(() => [...new Set(plan.activities.map((a) => a.program).filter(Boolean))], [plan.activities]);
  const owners = useMemo(() => [...new Set(plan.activities.map((a) => a.owner).filter(Boolean))], [plan.activities]);

  if (!draft) return null;
  const isNew = !plan.activities.some((a) => a.id === draft.id);
  const set = <K extends keyof Activity>(k: K, v: Activity[K]) => setDraft({ ...draft, [k]: v });
  const close = () => { commit(); onClose(); };
  const req = plan.requirements.find((r) => r.id === draft.requirementId);
  const days = draft.start && draft.end ? diffDays(draft.start, draft.end) + 1 : 0;
  const perWeek = days > 0 ? (draft.hours / days) * 7 : 0;
  const lateForGoal = req?.dueDate && draft.end > req.dueDate;

  return (
    <Sheet
      open onOpenChange={(o) => !o && close()}
      title={isNew ? "فعالیت جدید" : "فعالیت"}
      description={req ? `برای هدف: ${req.title}` : "این فعالیت را به یک هدف وصل کنید."}
      footer={
        <>
          <Button variant="primary" onClick={close} disabled={!draft.title.trim()}><Check className="size-4" />ذخیره و بستن</Button>
          {!isNew && (
            <Button variant="ghost" className="ms-auto text-critical-ink" onClick={() => { remove(draft.id); onClose(); undoToast("فعالیت حذف شد."); }}>
              <Trash2 className="size-4" />حذف
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <Field label="عنوان فعالیت" hint="با فعل شروع کنید و خروجی را مشخص کنید؛ مثلاً «تدوین ۱۰ SOP نمونه».">
          <Textarea autoFocus={isNew} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="چه کاری انجام می‌شود؟" />
        </Field>

        <Field label="هدف مرتبط (الزام)">
          <Select value={draft.requirementId ?? ""} onChange={(e) => set("requirementId", e.target.value || null)}>
            <option value="">— بدون هدف —</option>
            {plan.categories.map((c) => {
              const reqs = plan.requirements.filter((r) => r.categoryId === c.id);
              return reqs.length ? (
                <optgroup key={c.id} label={c.name}>
                  {reqs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </optgroup>
              ) : null;
            })}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="برنامه" hint="گروه فعالیت‌ها؛ مثلاً «فروش فعال».">
            <Input list="programs" value={draft.program} onChange={(e) => set("program", e.target.value)} />
            <datalist id="programs">{programs.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="مسئول">
            <Input list="owners" value={draft.owner} onChange={(e) => set("owner", e.target.value)} />
            <datalist id="owners">{owners.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="تاریخ شروع"><DatePicker value={draft.start} onChange={(v) => set("start", v)} /></Field>
          <Field label="تاریخ پایان"><DatePicker value={draft.end} onChange={(v) => set("end", v)} min={draft.start} /></Field>
        </div>
        {draft.start && draft.end && (
          <div className="-mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="جابه‌جایی کل فعالیت">
            <span className="text-xs text-ink-3">جابه‌جایی کل فعالیت:</span>
            {SHIFTS.map(([days, label]) => (
              <Button key={days} size="sm" variant="ghost" className="h-7 border border-line px-2 text-xs" onClick={() => setDraft(shiftActivity(draft, days))}>{label}</Button>
            ))}
          </div>
        )}
        {lateForGoal && (
          <p className="-mt-2 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] leading-6 text-warning-ink">
            <CircleAlert className="mt-1 size-4 shrink-0" />پایان این فعالیت بعد از موعد هدف ({fmtJ(req!.dueDate)}) است.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="ساعت تخمینی" hint={perWeek ? `≈ ${faNum(perWeek)} ساعت در هفته` : "وقت خودتان"}>
            <NumberInput value={draft.hours} onChange={(v) => set("hours", Math.max(0, v ?? 0))} suffix="ساعت" />
          </Field>
          <Field label="هزینه برنامه‌ریزی‌شده"><NumberInput value={draft.cost} onChange={(v) => set("cost", Math.max(0, v ?? 0))} suffix="م.ت" /></Field>
          <Field label="هزینه واقعی"><NumberInput value={draft.actualCost} allowEmpty onChange={(v) => set("actualCost", v)} suffix="م.ت" placeholder="—" /></Field>
        </div>

        <Field label="منابع و امکانات لازم">
          <Textarea value={draft.resources} onChange={(e) => set("resources", e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-2/60 p-4">
          <Field label="وضعیت">
            <Segmented label="وضعیت" value={draft.status}
              onChange={(v) => setDraft({ ...draft, status: v, progress: v === "done" ? 100 : v === "todo" && draft.progress === 100 ? 0 : draft.progress })}
              options={STATUSES.map((s) => ({ value: s.key, label: s.label, dot: s.tone }))} />
          </Field>
          <Field label={`درصد پیشرفت: ${faPct(draft.progress / 100)}`}>
            <Slider label="درصد پیشرفت" value={draft.progress}
              onChange={(v) => setDraft({ ...draft, progress: v, status: v === 100 ? "done" : v > 0 && draft.status === "todo" ? "doing" : draft.status === "done" && v < 100 ? "doing" : draft.status })} />
          </Field>
        </div>

        <Field label="یادداشت (اختیاری)">
          <Textarea value={draft.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
        {req && <div className="flex items-center gap-2 text-xs text-ink-3"><CategoryDot slot={plan.categories.find((c) => c.id === req.categoryId)?.color ?? 0} />{plan.categories.find((c) => c.id === req.categoryId)?.name} · {req.goal}</div>}
      </div>
    </Sheet>
  );
}
