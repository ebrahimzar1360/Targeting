import { useMemo } from "react";
import type { WeekLoad } from "@/domain/calc";
import { faNum, fmtJ, fmtRange } from "@/domain/jalali";
import type { Plan } from "@/domain/schema";
import { Tip, cx } from "./ui/primitives";

export function ProgressRing({ value, size = 112, stroke = 10, label, sub }: { value: number; size?: number; stroke?: number; label: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label} ${Math.round(v * 100)}٪`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset 600ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{faNum(Math.round(v * 100), 0)}<span className="text-base">٪</span></span>
        {sub && <span className="text-[11px] text-ink-3">{sub}</span>}
      </div>
    </div>
  );
}

/** Weekly planned hours vs. the weekly capacity (a reference line on the same axis). */
export function CapacityChart({ plan, weeks, today, height = 160, compact }: { plan: Plan; weeks: WeekLoad[]; today: string; height?: number; compact?: boolean }) {
  const titles = useMemo(() => new Map(plan.activities.map((a) => [a.id, a.title])), [plan.activities]);
  const cap = plan.weeklyHours;
  const peak = Math.max(cap, ...weeks.map((w) => w.hours), 1);
  const step = peak > 60 ? 20 : peak > 30 ? 10 : 5;
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const y = (v: number) => (v / top) * 100;

  if (!weeks.length) return <p className="text-sm text-ink-3">برای دیدن بار کاری، افق برنامه را تعیین کنید.</p>;

  return (
    <div>
      <div className="flex gap-2">
        {!compact && (
          <div className="relative w-7 shrink-0 text-[10px] text-ink-3 tabular" style={{ height }}>
            {ticks.map((t) => <span key={t} className="absolute end-0 translate-y-1/2" style={{ bottom: `${y(t)}%` }}>{faNum(t, 0)}</span>)}
          </div>
        )}
        <div className="relative flex-1" style={{ height }}>
          {!compact && ticks.map((t) => <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${y(t)}%` }} />)}
          {cap > 0 && (
            <div className="absolute inset-x-0 z-10 border-t-2 border-ink/70" style={{ bottom: `${y(cap)}%` }}>
              <span className="absolute -top-5 end-0 rounded bg-surface/90 px-1 text-[10px] font-medium text-ink-2">ظرفیت {faNum(cap, 0)} ساعت</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {weeks.map((w) => {
              const over = cap > 0 && w.hours > cap * 1.05;
              const isNow = today >= w.start && today <= w.end;
              const top3 = [...w.activities].sort((a, b) => b.hours - a.hours).slice(0, 3);
              return (
                <Tip key={w.start} label={
                  <span className="block">
                    <span className="font-semibold">{fmtRange(w.start, w.end)}</span><br />
                    {faNum(w.hours)} ساعت{over ? ` (${faNum(w.hours - cap)} ساعت بیش از ظرفیت)` : ""}
                    {top3.map((x) => <span key={x.id} className="block opacity-80">• {titles.get(x.id)?.slice(0, 48)} ({faNum(x.hours)})</span>)}
                  </span>
                }>
                  <div className="group relative flex h-full max-w-6 flex-1 items-end" tabIndex={0} aria-label={`هفته ${fmtJ(w.start)}: ${Math.round(w.hours)} ساعت`}>
                    <div
                      className={cx("w-full rounded-t-[4px] transition-opacity group-hover:opacity-80", over ? "bg-serious" : "bg-brand", isNow && "outline outline-2 outline-offset-1 outline-ink")}
                      style={{ height: `${Math.max(w.hours > 0 ? 1.5 : 0, y(w.hours))}%` }}
                    />
                  </div>
                </Tip>
              );
            })}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />بار کاری هفته</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-serious" />بیش از ظرفیت</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-ink/70" />ظرفیت هفتگی</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm outline outline-2 outline-ink" />هفته‌ی جاری</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars with labels; values are written beside the bar, never inside it. */
export function BarList({ rows, format, max }: { rows: { key: string; label: string; value: number; color: string }[]; format: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid grid-cols-1 gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="flex items-center gap-2 truncate"><span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />{r.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${(r.value / m) * 100}%`, background: r.color }} />
          </div>
          <span className="text-ink-2 tabular">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, width = 96, height = 28 }: { values: (number | null)[]; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => width - (i / Math.max(1, values.length - 1)) * width; // RTL: time flows right → left
  const yy = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${yy(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={yy(last.v)} r={3.5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
