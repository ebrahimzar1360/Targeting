import { useEffect, useMemo, useState } from "react";
import { Circle, CircleCheck, CircleDot, CirclePause, GanttChart, List, Plus, Search } from "lucide-react";
import { Badge, Button, Card, CategoryDot, EmptyState, Input, PageHeader, ProgressBar, Segmented, Select, Tip, catColor, cx } from "@/components/ui/primitives";
import { ActivitySheet } from "@/components/editors";
import { activityProgress, isOverdue, phaseOf, requirementProgress } from "@/domain/calc";
import { newActivity } from "@/domain/factory";
import { dayNumber, diffDays, faNum, faPct, fmtJ, fmtRange, monthsBetween, relDays, todayJ } from "@/domain/jalali";
import type { Activity, Plan, Status } from "@/domain/schema";
import { useStore, usePlan } from "@/store/store";
import { clearParams, useRoute } from "@/router";

type GroupBy = "goal" | "phase" | "none";
type StatusFilter = "all" | "open" | "overdue" | Status;

export function ActionPlan() {
  const plan = usePlan();
  const { params } = useRoute();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [view, setView] = useState<"list" | "timeline">("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("goal");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const today = todayJ();

  useEffect(() => {
    if (params.open) {
      const a = plan.activities.find((x) => x.id === params.open);
      if (a) setEditing(a);
      clearParams();
    }
  }, [params.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const reqById = useMemo(() => new Map(plan.requirements.map((r) => [r.id, r])), [plan.requirements]);
  const catById = useMemo(() => new Map(plan.categories.map((c) => [c.id, c])), [plan.categories]);
  const catOf = (a: Activity) => { const r = a.requirementId ? reqById.get(a.requirementId) : undefined; return r ? catById.get(r.categoryId) : undefined; };

  const visible = plan.activities
    .filter((a) =>
      (status === "all" || (status === "open" ? a.status !== "done" : status === "overdue" ? isOverdue(a, today) : a.status === status)) &&
      (cat === "all" || catOf(a)?.id === cat) &&
      (!q.trim() || [a.title, a.program, a.owner, a.resources].some((t) => t.includes(q.trim()))))
    .sort((a, b) => a.start.localeCompare(b.start));

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", title: "", subtitle: "", color: undefined as number | undefined, items: visible }];
    const map = new Map<string, Activity[]>();
    for (const a of visible) {
      const k = groupBy === "goal" ? (a.requirementId && reqById.has(a.requirementId) ? a.requirementId : "__none") : (phaseOf(plan, a.start)?.id ?? "__none");
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    const order = groupBy === "goal"
      ? [...plan.categories.flatMap((c) => plan.requirements.filter((r) => r.categoryId === c.id).map((r) => r.id)), "__none"]
      : [...plan.phases.map((p) => p.id), "__none"];
    return order.filter((k) => map.has(k)).map((k) => {
      if (groupBy === "goal") {
        const r = reqById.get(k);
        return { key: k, title: r?.goal || r?.title || "فعالیت‌های بدون هدف", subtitle: r ? r.title : "به یک الزام وصل کنید", color: r ? catById.get(r.categoryId)?.color : undefined, items: map.get(k)! };
      }
      const p = plan.phases.find((x) => x.id === k);
      return { key: k, title: p?.name ?? "خارج از فازها", subtitle: p ? `${fmtRange(p.start, p.end)}${p.description ? ` · ${p.description}` : ""}` : "", color: undefined, items: map.get(k)! };
    });
  }, [visible, groupBy, plan, reqById, catById]);

  const counts = {
    total: plan.activities.length,
    done: plan.activities.filter((a) => a.status === "done").length,
    doing: plan.activities.filter((a) => a.status === "doing").length,
    overdue: plan.activities.filter((a) => isOverdue(a, today)).length,
  };

  return (
    <>
      <PageHeader
        step={3}
        title="برنامه عملیاتی"
        description="هر هدف ← برنامه ← فعالیت‌های تاریخ‌دار. ساعت و هزینه را عددی وارد کنید تا ظرفیت و بودجه خودکار حساب شوند."
        actions={<Button variant="primary" onClick={() => setEditing(newActivity(plan))}><Plus className="size-4" />فعالیت جدید</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "کل فعالیت‌ها", value: counts.total, f: "all" as StatusFilter },
          { label: "در حال اجرا", value: counts.doing, f: "doing" as StatusFilter },
          { label: "انجام‌شده", value: counts.done, f: "done" as StatusFilter },
          { label: "عقب‌افتاده", value: counts.overdue, f: "overdue" as StatusFilter, warn: counts.overdue > 0 },
        ].map((s) => (
          <button key={s.label} onClick={() => setStatus(status === s.f ? "all" : s.f)}
            className={cx("rounded-xl border bg-surface p-3 text-start shadow-card transition-colors", status === s.f ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-line-strong")}>
            <div className="text-xs text-ink-3">{s.label}</div>
            <div className={cx("mt-1 text-xl font-bold tabular", s.warn && "text-critical-ink")}>{faNum(s.value, 0)}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی فعالیت، برنامه، مسئول" className="ps-9" aria-label="جستجو" />
          </div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-44" aria-label="دسته">
            <option value="all">همه‌ی دسته‌ها</option>
            {plan.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="sm:w-40" aria-label="وضعیت">
            <option value="all">همه‌ی وضعیت‌ها</option>
            <option value="open">باز (انجام‌نشده)</option>
            <option value="overdue">عقب‌افتاده</option>
            <option value="todo">شروع نشده</option>
            <option value="doing">در حال اجرا</option>
            <option value="done">انجام شد</option>
            <option value="postponed">به تعویق افتاد</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="گروه‌بندی" size="sm" value={groupBy} onChange={setGroupBy}
            options={[{ value: "goal", label: "هدف" }, ...(plan.phases.length ? [{ value: "phase" as GroupBy, label: "فاز" }] : []), { value: "none", label: "بدون گروه" }]} />
          <Segmented label="نما" size="sm" value={view} onChange={setView}
            options={[{ value: "list", label: <><List className="size-3.5" />فهرست</> }, { value: "timeline", label: <><GanttChart className="size-3.5" />زمان‌بندی</> }]} />
        </div>
      </div>

      {plan.activities.length === 0 ? (
        <Card>
          <EmptyState icon={<List className="size-5" />} title="هنوز فعالیتی ندارید"
            action={<Button variant="primary" onClick={() => setEditing(newActivity(plan))}><Plus className="size-4" />اولین فعالیت</Button>}>
            از «ماتریس الزامات» یک هدف را باز کنید و برایش فعالیت بسازید، یا مستقیم از اینجا شروع کنید.
          </EmptyState>
        </Card>
      ) : visible.length === 0 ? (
        <Card><EmptyState title="موردی با این فیلترها نیست" /></Card>
      ) : view === "list" ? (
        <div className="grid grid-cols-1 gap-4">
          {groups.map((g) => (
            <Card key={g.key} className="overflow-hidden">
              {g.title && (
                <div className="flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5">
                  {g.color !== undefined && <span className="mt-1.5 h-4 w-1 shrink-0 rounded-full" style={{ background: catColor(g.color) }} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-6">{g.title}</div>
                    {g.subtitle && <div className="text-xs leading-5 text-ink-3">{g.subtitle}</div>}
                  </div>
                  {groupBy === "goal" && g.key !== "__none" && (() => {
                    const p = requirementProgress(plan, g.key) ?? 0;
                    return <div className="hidden w-28 shrink-0 items-center gap-2 text-xs text-ink-3 sm:flex"><ProgressBar value={p} label="پیشرفت هدف" />{faPct(p)}</div>;
                  })()}
                </div>
              )}
              <ul className="divide-y divide-line">
                {g.items.map((a) => <ActivityRow key={a.id} plan={plan} a={a} today={today} catSlot={catOf(a)?.color} showGoal={groupBy !== "goal"} goalTitle={a.requirementId ? reqById.get(a.requirementId)?.title : undefined} onOpen={() => setEditing(a)} />)}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Timeline plan={plan} groups={groups} today={today} catOf={catOf} onOpen={setEditing} />
      )}

      <ActivitySheet plan={plan} activity={editing} onClose={() => setEditing(null)} />
    </>
  );
}

const NEXT: Record<Status, Status> = { todo: "doing", doing: "done", done: "todo", postponed: "doing" };
const STATUS_ICON = { todo: Circle, doing: CircleDot, done: CircleCheck, postponed: CirclePause };
const STATUS_COLOR = { todo: "text-ink-3", doing: "text-brand", done: "text-good", postponed: "text-warning-ink" };

function ActivityRow({ plan, a, today, catSlot, showGoal, goalTitle, onOpen }: {
  plan: Plan; a: Activity; today: string; catSlot?: number; showGoal: boolean; goalTitle?: string; onOpen: () => void;
}) {
  const upsert = useStore((s) => s.upsertActivity);
  const Icon = STATUS_ICON[a.status];
  const overdue = isOverdue(a, today);
  const daysLeft = diffDays(today, a.end);
  const p = activityProgress(a);
  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5">
      <Tip label={`وضعیت: کلیک برای تغییر`}>
        <button
          aria-label="تغییر وضعیت"
          onClick={() => {
            const next = NEXT[a.status];
            upsert({ ...a, status: next, progress: next === "done" ? 100 : next === "todo" ? 0 : Math.max(a.progress, a.progress === 100 ? 50 : a.progress) });
          }}
          className={cx("mt-0.5 shrink-0 rounded-full p-0.5 transition-transform hover:scale-110", STATUS_COLOR[a.status])}
        >
          <Icon className="size-5" />
        </button>
      </Tip>
      <button onClick={onOpen} className="min-w-0 flex-1 text-start">
        <div className={cx("text-sm leading-6", a.status === "done" && "text-ink-3 line-through decoration-ink-3/40")}>{a.title || "بی‌عنوان"}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          {a.program && <span>{a.program}</span>}
          {showGoal && goalTitle && <span className="inline-flex items-center gap-1"><CategoryDot slot={catSlot ?? 0} className="size-2" />{goalTitle}</span>}
          {!a.requirementId && <Badge tone="warning">بدون هدف</Badge>}
          <span className="tabular">{fmtRange(a.start, a.end)}</span>
          {a.owner && <span>{a.owner}</span>}
        </div>
      </button>
      <div className="hidden shrink-0 flex-col items-end gap-1 text-xs sm:flex">
        <span className={cx("tabular", overdue ? "font-medium text-critical-ink" : a.status === "done" ? "text-good-ink" : "text-ink-3")}>
          {a.status === "done" ? "انجام شد" : overdue ? `${faNum(-daysLeft, 0)} روز تأخیر` : a.start > today ? `شروع ${relDays(diffDays(today, a.start))}` : relDays(daysLeft)}
        </span>
        <span className="text-ink-3 tabular">{a.hours ? `${faNum(a.hours, 0)} ساعت` : ""}{a.hours && a.cost ? " · " : ""}{a.cost ? `${faNum(a.cost)} ${plan.currency === "میلیون تومان" ? "م.ت" : plan.currency}` : ""}</span>
        {a.status !== "todo" && a.status !== "done" && <div className="flex w-24 items-center gap-1.5"><ProgressBar value={p / 100} height={4} label="پیشرفت" /><span className="tabular text-ink-3">{faPct(p / 100)}</span></div>}
      </div>
    </li>
  );
}

// ---------- Timeline (Gantt) ----------

function Timeline({ plan, groups, today, catOf, onOpen }: {
  plan: Plan; groups: { key: string; title: string; items: Activity[] }[]; today: string;
  catOf: (a: Activity) => { color: number } | undefined; onOpen: (a: Activity) => void;
}) {
  const months = monthsBetween(plan.start, plan.end);
  const start = dayNumber(plan.start), end = dayNumber(plan.end);
  const span = Math.max(1, end - start + 1);
  const pos = (j: string) => ((Math.max(start, Math.min(end + 1, dayNumber(j))) - start) / span) * 100;
  const todayPct = today >= plan.start && today <= plan.end ? pos(today) : null;

  return (
    <Card className="overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Month header */}
          <div className="sticky top-0 z-10 grid grid-cols-[240px_1fr] border-b border-line bg-surface">
            <div className="border-e border-line px-4 py-2 text-xs font-medium text-ink-3">فعالیت</div>
            <div className="relative h-14">
              {plan.phases.map((p, i) => (
                <div key={p.id} className={cx("absolute top-0 h-6 truncate border-e border-line px-2 text-[11px] leading-6 text-ink-2", i % 2 ? "bg-surface-2" : "bg-surface-2/40")}
                  style={{ insetInlineStart: `${pos(p.start)}%`, width: `${pos(p.end) - pos(p.start) + 100 / span}%` }} title={p.name}>{p.name}</div>
              ))}
              {months.map((m) => (
                <div key={m.key} className="absolute bottom-0 h-8 border-e border-line px-1.5 pt-1.5 text-[11px] text-ink-3"
                  style={{ insetInlineStart: `${pos(m.start)}%`, width: `${pos(m.end) - pos(m.start) + 100 / span}%` }}>{m.label}</div>
              ))}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.key}>
              {g.title && <div className="border-b border-line bg-surface-2/50 px-4 py-1.5 text-xs font-semibold text-ink-2">{g.title}</div>}
              {g.items.map((a) => {
                const color = catOf(a)?.color;
                const left = pos(a.start), width = Math.max(0.6, pos(a.end) - left + 100 / span);
                const p = activityProgress(a);
                return (
                  <div key={a.id} className="grid grid-cols-[240px_1fr] border-b border-line last:border-b-0 hover:bg-surface-2/40">
                    <button onClick={() => onOpen(a)} className="truncate border-e border-line px-4 py-2 text-start text-[13px]" title={a.title}>{a.title}</button>
                    <div className="relative">
                      {months.map((m) => <div key={m.key} className="absolute inset-y-0 border-e border-line/60" style={{ insetInlineStart: `${pos(m.start)}%` }} />)}
                      {todayPct !== null && <div className="absolute inset-y-0 w-px bg-critical/70" style={{ insetInlineStart: `${todayPct}%` }} />}
                      <Tip label={<span>{a.title}<br />{fmtRange(a.start, a.end)} · {faPct(p / 100)}{isOverdue(a, today) ? " · عقب‌افتاده" : ""}</span>}>
                        <button
                          onClick={() => onOpen(a)}
                          aria-label={a.title}
                          className={cx("absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded", isOverdue(a, today) && "ring-2 ring-critical/60")}
                          style={{ insetInlineStart: `${left}%`, width: `${width}%`, background: color !== undefined ? `color-mix(in srgb, ${catColor(color)} 28%, transparent)` : "var(--surface-3)" }}
                        >
                          <span className="block h-full rounded" style={{ width: `${p}%`, background: color !== undefined ? catColor(color) : "var(--ink-3)" }} />
                        </button>
                      </Tip>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 text-xs text-ink-3">
        {plan.categories.map((c) => <span key={c.id} className="inline-flex items-center gap-1.5"><CategoryDot slot={c.color} />{c.name}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-critical" />امروز ({fmtJ(today, "short")})</span>
        <span>بخش پررنگ هر نوار = درصد پیشرفت</span>
      </div>
    </Card>
  );
}
