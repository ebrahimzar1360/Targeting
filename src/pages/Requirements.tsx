import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, CalendarClock } from "lucide-react";
import { Badge, Button, Card, CategoryDot, EmptyState, Input, PageHeader, ProgressBar, Segmented, catColor, cx } from "@/components/ui/primitives";
import { ActivitySheet, RequirementSheet } from "@/components/editors";
import { AiBox, AiButton, AiError, useAi } from "@/components/AiPanel";
import { suggestRequirements } from "@/ai/claude";
import type { RequirementIdea } from "@/ai/claude";
import { activitiesOf, categoryStats, requirementProgress } from "@/domain/calc";
import { PRIORITIES } from "@/domain/defaults";
import { newRequirement } from "@/domain/factory";
import { faNum, faPct, fmtJ } from "@/domain/jalali";
import type { Activity, Category, Plan, Priority, Requirement } from "@/domain/schema";
import { usePlan } from "@/store/store";
import { clearParams, useRoute } from "@/router";

const PRIORITY_TONE = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.tone])) as Record<Priority, (typeof PRIORITIES)[number]["tone"]>;
const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.label])) as Record<Priority, string>;

export function Requirements() {
  const plan = usePlan();
  const { params } = useRoute();
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [editingAct, setEditingAct] = useState<Activity | null>(null);
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState<"all" | Priority>("all");

  useEffect(() => {
    if (params.open) {
      const r = plan.requirements.find((x) => x.id === params.open);
      if (r) setEditing(r);
      clearParams();
    }
  }, [params.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filter = (r: Requirement) =>
    (prio === "all" || r.priority === prio) &&
    (!q.trim() || [r.title, r.desired, r.current, r.goal].some((t) => t.includes(q.trim())));
  const total = plan.requirements.length;
  const withGoal = plan.requirements.filter((r) => r.goal.trim()).length;

  return (
    <>
      <PageHeader
        step={2}
        title="ماتریس الزامات"
        description="برای هر دسته بنویسید چشم‌انداز چه چیزی لازم دارد (مطلوب)، امروز کجایید (موجود)، و چه هدف قابل‌سنجشی این فاصله را پر می‌کند."
        actions={<Button variant="primary" onClick={() => setEditing(newRequirement(plan.categories[0].id))}><Plus className="size-4" />الزام جدید</Button>}
      />

      <Card className="mb-4 p-4">
        <div className="text-xs text-ink-3">چشم‌انداز</div>
        <p className="mt-0.5 font-semibold leading-7">{plan.vision || "—"}</p>
        {plan.model && <p className="mt-1 text-[13px] text-ink-2"><span className="text-ink-3">الگو: </span>{plan.model}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
          <span>{faNum(total, 0)} الزام</span>
          <span>{faNum(withGoal, 0)} هدف تعریف‌شده</span>
          <span>{faNum(plan.requirements.filter((r) => r.priority === "critical").length, 0)} بحرانی</span>
        </div>
      </Card>

      {/* Category overview — doubles as quick navigation */}
      <div className="scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
        {plan.categories.map((c) => {
          const st = categoryStats(plan, c.id);
          return (
            <a key={c.id} href={`#cat-${c.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className="min-w-[140px] rounded-xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-line-strong sm:min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-medium"><CategoryDot slot={c.color} /><span className="truncate">{c.name}</span></div>
              <div className="mt-2 flex items-baseline justify-between text-xs text-ink-3"><span>{faNum(st.count, 0)} الزام</span><span className="tabular">{faPct(st.progress)}</span></div>
              <ProgressBar value={st.progress} color={catColor(c.color)} className="mt-1.5" height={4} label={`پیشرفت ${c.name}`} />
            </a>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در الزامات و هدف‌ها" className="ps-9" aria-label="جستجو" />
        </div>
        <Segmented label="فیلتر اولویت" size="sm" value={prio} onChange={setPrio}
          options={[{ value: "all", label: "همه" }, ...PRIORITIES.map((p) => ({ value: p.key, label: p.label, dot: p.tone }))]} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {plan.categories.map((c) => (
          <CategorySection key={c.id} plan={plan} category={c} filter={filter} filtering={prio !== "all" || !!q.trim()}
            onOpen={setEditing} onAdd={(patch) => setEditing(newRequirement(c.id, patch))} />
        ))}
      </div>

      <RequirementSheet plan={plan} requirement={editing} onClose={() => setEditing(null)} onOpenActivity={setEditingAct} />
      <ActivitySheet plan={plan} activity={editingAct} onClose={() => setEditingAct(null)} />
    </>
  );
}

function CategorySection({ plan, category: c, filter, filtering, onOpen, onAdd }: {
  plan: Plan; category: Category; filter: (r: Requirement) => boolean; filtering: boolean;
  onOpen: (r: Requirement) => void; onAdd: (patch?: Partial<Requirement>) => void;
}) {
  const all = plan.requirements.filter((r) => r.categoryId === c.id);
  const reqs = all.filter(filter);
  const st = categoryStats(plan, c.id);
  const ai = useAi<RequirementIdea[]>();
  if (filtering && !reqs.length) return null;

  return (
    <Card id={`cat-${c.id}`} className="scroll-mt-20 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full" style={{ background: catColor(c.color) }} />
            <h2 className="font-semibold">{c.name}</h2>
            <span className="text-xs text-ink-3">{faNum(all.length, 0)} الزام · {faPct(st.progress)}</span>
          </div>
          <p className="mt-1 text-[13px] leading-6 text-ink-3">{c.question}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AiButton loading={ai.loading} onClick={() => ai.run((s) => suggestRequirements(s, plan, c.id))}>پیشنهاد</AiButton>
          <Button size="sm" onClick={() => onAdd()}><Plus className="size-4" />افزودن</Button>
        </div>
      </div>

      {ai.setupDialog}
      {ai.error && <div className="px-4 pt-3 sm:px-5"><AiError message={ai.error} /></div>}
      {ai.data && (
        <div className="px-4 pt-3 sm:px-5">
          <AiBox>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ai.data.map((idea, i) => (
                <li key={i} className="flex flex-col rounded-lg border border-line bg-surface p-3">
                  <div className="text-sm font-medium">{idea.title}</div>
                  <div className="mt-1 flex-1 text-xs leading-5 text-ink-3">{idea.desired}</div>
                  <Button size="sm" className="mt-2 self-start" onClick={() => onAdd({ title: idea.title, desired: idea.desired })}><Plus className="size-4" />افزودن و تکمیل</Button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" className="mt-2" onClick={ai.reset}>بستن پیشنهادها</Button>
          </AiBox>
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState title="هنوز الزامی در این دسته نیست">
          اگر برای چشم‌انداز شما در این دسته چیزی لازم نیست، خالی ماندنش اشکالی ندارد.
        </EmptyState>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_110px] gap-4 border-b border-line bg-surface-2/50 px-5 py-2 text-xs font-medium text-ink-3 lg:grid">
            <span>الزام</span><span>وضعیت مطلوب</span><span>وضعیت موجود</span><span>هدف</span><span>پیشرفت</span>
          </div>
          <ul className="divide-y divide-line">
            {reqs.map((r) => <RequirementRow key={r.id} plan={plan} r={r} onOpen={() => onOpen(r)} />)}
          </ul>
        </>
      )}
    </Card>
  );
}

function RequirementRow({ plan, r, onOpen }: { plan: Plan; r: Requirement; onOpen: () => void }) {
  const prog = requirementProgress(plan, r.id);
  const count = useMemo(() => activitiesOf(plan, r.id).length, [plan, r.id]);
  const noActs = r.goal.trim() && count === 0;
  return (
    <li>
      <button onClick={onOpen} className="grid w-full gap-3 px-4 py-3.5 text-start transition-colors hover:bg-surface-2/60 sm:px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_110px] lg:gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-6">{r.title || "بی‌عنوان"}</div>
          <Badge tone={PRIORITY_TONE[r.priority]} dot className="mt-1">{PRIORITY_LABEL[r.priority]}</Badge>
        </div>
        <Cell label="مطلوب" text={r.desired} />
        <Cell label="موجود" text={r.current} />
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-ink-3 lg:hidden">هدف</span>
          <p className={cx("line-clamp-3 text-[13px] leading-6", r.goal ? "text-ink" : "italic text-ink-3")}>{r.goal || "هدف تعریف نشده"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {r.dueDate && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{fmtJ(r.dueDate)}</span>}
            {noActs && <span className="inline-flex items-center gap-1 text-serious-ink"><AlertTriangle className="size-3.5" />بدون فعالیت</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-1">
          <ProgressBar value={prog ?? 0} className="max-w-40 lg:max-w-none" label="پیشرفت" />
          <span className="shrink-0 text-xs text-ink-3 tabular">{prog === null ? "—" : faPct(prog)} · {faNum(count, 0)} فعالیت</span>
        </div>
      </button>
    </li>
  );
}

/** Desired/current are shown in the matrix on wide screens; on phones the goal carries the row. */
function Cell({ label, text }: { label: string; text: string }) {
  return (
    <div className="hidden min-w-0 lg:block">
      <span className="text-[11px] font-medium text-ink-3 lg:hidden">{label}</span>
      <p className={cx("line-clamp-3 text-[13px] leading-6", text ? "text-ink-2" : "text-ink-3")}>{text || "—"}</p>
    </div>
  );
}
