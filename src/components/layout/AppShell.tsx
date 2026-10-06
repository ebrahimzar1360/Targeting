import { DropdownMenu } from "radix-ui";
import {
  BookOpen, CalendarCheck, Check, ChevronsUpDown, Grid3x3, LayoutDashboard, ListChecks, Menu, Plus,
  Printer, Settings, Target, Telescope, TrendingUp, Wallet,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useRoute } from "@/router";
import type { Page } from "@/router";
import { useStore, useActivePlan } from "@/store/store";
import { faDigits, todayJ, weekStart } from "@/domain/jalali";
import { cx } from "../ui/primitives";
import { NewPlanDialog } from "@/pages/NewPlanDialog";

interface NavItem { page: Page; label: string; icon: typeof LayoutDashboard; step?: number }
const NAV: NavItem[] = [
  { page: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { page: "vision", label: "چشم‌انداز و افق", icon: Telescope, step: 1 },
  { page: "requirements", label: "ماتریس الزامات", icon: Grid3x3, step: 2 },
  { page: "plan", label: "برنامه عملیاتی", icon: ListChecks, step: 3 },
  { page: "kpi", label: "شاخص‌ها (KPI)", icon: TrendingUp, step: 4 },
  { page: "budget", label: "بودجه", icon: Wallet },
  { page: "review", label: "بازبینی هفتگی", icon: CalendarCheck },
];
const NAV_SECONDARY: NavItem[] = [
  { page: "report", label: "گزارش و چاپ", icon: Printer },
  { page: "guide", label: "راهنمای روش", icon: BookOpen },
  { page: "settings", label: "تنظیمات و پشتیبان", icon: Settings },
];
const MOBILE: NavItem[] = [
  { page: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { page: "requirements", label: "الزامات", icon: Grid3x3 },
  { page: "plan", label: "برنامه", icon: ListChecks },
  { page: "review", label: "بازبینی", icon: CalendarCheck },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-brand text-white shadow-card"><Target className="size-[18px]" /></div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold">هدف‌نگار</div>
        <div className="text-[11px] text-ink-3">ماتریس ساختار طراحی</div>
      </div>
    </div>
  );
}

function PlanSwitcher() {
  const plans = useStore((s) => s.plans);
  const setActive = useStore((s) => s.setActive);
  const active = useActivePlan();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-start shadow-card transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-ink-3">برنامه فعال</div>
              <div className="truncate text-[13px] font-semibold">{active?.title || "بدون عنوان"}</div>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className="anim-fade z-50 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
            <DropdownMenu.Label className="px-2 py-1.5 text-xs text-ink-3">برنامه‌های شما</DropdownMenu.Label>
            {plans.map((p) => (
              <DropdownMenu.Item key={p.id} onSelect={() => setActive(p.id)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-surface-2">
                <span className="flex-1 truncate">{p.title || "بدون عنوان"}</span>
                {p.id === active?.id && <Check className="size-4 text-brand" />}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item onSelect={() => setCreating(true)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-brand-ink outline-none data-[highlighted]:bg-surface-2">
              <Plus className="size-4" /> برنامه جدید
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <NewPlanDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

/** True when the plan has started and this week's review is not recorded yet. */
function useReviewDue() {
  const plan = useActivePlan();
  if (!plan) return false;
  const today = todayJ();
  if (!plan.start || today < plan.start || today > plan.end) return false;
  const ws = weekStart(today);
  return !plan.reviews.some((r) => r.date >= ws);
}

const DueDot = ({ className }: { className?: string }) => (
  <span className={cx("size-2 rounded-full bg-serious ring-2 ring-surface", className)} aria-label="بازبینی این هفته انجام نشده" role="img" />
);

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const due = useReviewDue() && item.page === "review";
  const Icon = item.icon;
  return (
    <a
      href={`#/${item.page}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
        active ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {due && <DueDot />}
      {item.step && (
        <span className={cx("grid size-5 place-items-center rounded-full text-[11px]", active ? "bg-brand text-white" : "bg-surface-2 text-ink-3 group-hover:bg-surface-3")}>
          {faDigits(item.step)}
        </span>
      )}
    </a>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { page } = useRoute();
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Logo />
      <PlanSwitcher />
      <nav className="flex flex-col gap-0.5" aria-label="بخش‌های برنامه">
        {NAV.map((n) => <NavLink key={n.page} item={n} active={page === n.page} onClick={onNavigate} />)}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
        {NAV_SECONDARY.map((n) => <NavLink key={n.page} item={n} active={page === n.page} onClick={onNavigate} />)}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { page } = useRoute();
  const reviewDue = useReviewDue();
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr] print:block">
      <aside className="sticky top-0 hidden h-dvh border-e border-line bg-surface/60 lg:block print:hidden">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden print:hidden">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 print:max-w-none print:p-0">{children}</main>

      {/* Mobile bottom navigation */}
      <nav aria-label="ناوبری اصلی" className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur lg:hidden print:hidden">
        {MOBILE.map((n) => {
          const Icon = n.icon;
          const active = page === n.page;
          return (
            <a key={n.page} href={`#/${n.page}`} aria-current={active ? "page" : undefined}
              className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "font-semibold text-brand-ink" : "text-ink-3")}>
              <span className="relative"><Icon className="size-5" />{reviewDue && n.page === "review" && <DueDot className="absolute -end-1 -top-0.5" />}</span>{n.label}
            </a>
          );
        })}
        <button onClick={() => setMoreOpen(true)} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", !MOBILE.some((m) => m.page === page) ? "font-semibold text-brand-ink" : "text-ink-3")}>
          <Menu className="size-5" />بیشتر
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="منو">
          <div className="anim-fade absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="anim-drawer absolute inset-y-0 start-0 w-[280px] overflow-y-auto bg-surface shadow-pop">
            <SidebarContent onNavigate={() => setMoreOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

