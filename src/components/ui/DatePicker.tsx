import { Popover } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { MONTHS, WEEKDAYS_SHORT, faDigits, fmtJ, formatJ, monthLength, parseJ, parseLooseJ, todayJ, weekday } from "@/domain/jalali";
import { Button, cx } from "./primitives";

/** Jalali date picker: month grid + typed input ("1405/7/14" or Persian digits). */
export function DatePicker({ value, onChange, placeholder = "انتخاب تاریخ", min, max, id, clearable }: {
  value: string; onChange: (v: string) => void; placeholder?: string; min?: string; max?: string; id?: string; clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = todayJ();
  const base = parseJ(value) ?? parseJ(today)!;
  const [view, setView] = useState({ jy: base.jy, jm: base.jm });
  const [typed, setTyped] = useState("");

  const openChange = (o: boolean) => {
    if (o) { const b = parseJ(value) ?? parseJ(today)!; setView({ jy: b.jy, jm: b.jm }); setTyped(value ? faDigits(value) : ""); }
    setOpen(o);
  };
  const shift = (d: number) => setView(({ jy, jm }) => {
    const idx = jy * 12 + jm - 1 + d;
    return { jy: Math.floor(idx / 12), jm: (idx % 12) + 1 };
  });
  const pick = (j: string) => { onChange(j); setOpen(false); };

  const first = weekday(formatJ({ jy: view.jy, jm: view.jm, jd: 1 }));
  const len = monthLength(view.jy, view.jm);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild>
        <button
          id={id} type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <span className={cx(!value && "text-ink-3")}>{value ? fmtJ(value) : placeholder}</span>
          <CalendarDays className="size-4 text-ink-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="anim-fade z-50 w-72 rounded-xl border border-line bg-surface p-3 shadow-pop">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { const j = parseLooseJ(typed); if (j) pick(j); } }}
            placeholder="مثلاً ۱۴۰۵/۰۷/۱۴"
            aria-label="تایپ تاریخ"
            className="mb-3 h-8 w-full rounded-md border border-line bg-surface-2 px-2.5 text-sm tabular focus:border-brand focus:outline-none"
          />
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" aria-label="ماه قبل" onClick={() => shift(-1)}><ChevronRight className="size-4" /></Button>
            <div className="text-sm font-semibold">{MONTHS[view.jm - 1]} {faDigits(view.jy)}</div>
            <Button variant="ghost" size="icon-sm" aria-label="ماه بعد" onClick={() => shift(1)}><ChevronLeft className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {WEEKDAYS_SHORT.map((d) => <div key={d} className="py-1 text-ink-3">{d}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const j = formatJ({ jy: view.jy, jm: view.jm, jd: d });
              const disabled = (min && j < min) || (max && j > max);
              return (
                <button
                  key={j} type="button" disabled={!!disabled} onClick={() => pick(j)}
                  className={cx(
                    "h-8 rounded-md tabular transition-colors disabled:opacity-30",
                    j === value ? "bg-brand font-semibold text-white" : "hover:bg-surface-2",
                    j === today && j !== value && "font-bold text-brand-ink ring-1 ring-brand/40",
                  )}
                >
                  {faDigits(d)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <Button variant="ghost" size="sm" onClick={() => pick(today)}>امروز</Button>
            {clearable && value && <Button variant="ghost" size="sm" onClick={() => pick("")}>پاک کردن</Button>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
