import { clsx } from "clsx";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { Tooltip } from "radix-ui";
import { faDigits, normalizeDigits } from "@/domain/jalali";
import type { Tone } from "@/domain/defaults";

export const cx = clsx;
export const catColor = (slot: number) => `var(--cat-${slot % 8})`;

// ---------- Button ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "icon" | "icon-sm";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50",
          size === "md" && "h-9 px-3.5 text-sm",
          size === "sm" && "h-8 px-2.5 text-[13px]",
          size === "icon" && "size-9",
          size === "icon-sm" && "size-8",
          variant === "primary" && "bg-brand text-white shadow-card hover:bg-brand-hover",
          variant === "secondary" && "border border-line bg-surface text-ink shadow-card hover:bg-surface-2",
          variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
          variant === "soft" && "bg-brand-soft text-brand-ink hover:bg-brand-soft/70",
          variant === "danger" && "bg-critical text-white hover:opacity-90",
          className,
        )}
        {...rest}
      />
    );
  },
);

export function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant; size?: Size }) {
  return (
    <Tip label={label}>
      <Button size="icon" variant="ghost" aria-label={label} {...rest}>{children}</Button>
    </Tip>
  );
}

export function Tip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={6} className="anim-fade z-50 max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-xs leading-5 text-page shadow-pop">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ---------- Surfaces ----------

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-xl border border-line bg-surface shadow-card", className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-ink-3">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, step }: { title: string; description?: ReactNode; actions?: ReactNode; step?: number }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {step && <div className="mb-1 text-xs font-medium text-brand-ink">گام {faDigits(step)} از روش</div>}
        <h1 className="text-xl font-bold leading-8 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good-ink",
  warning: "bg-warning-soft text-warning-ink",
  serious: "bg-serious-soft text-serious-ink",
  critical: "bg-critical-soft text-critical-ink",
};
const toneDot: Record<Tone, string> = {
  neutral: "bg-ink-3", brand: "bg-brand", good: "bg-good", warning: "bg-warning", serious: "bg-serious", critical: "bg-critical",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium", toneClass[tone], className)}>
      {dot && <span className={cx("size-1.5 rounded-full", toneDot[tone])} />}
      {children}
    </span>
  );
}

export function CategoryDot({ slot, className }: { slot: number; className?: string }) {
  return <span className={cx("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: catColor(slot) }} />;
}

export function ProgressBar({ value, tone = "brand", color, className, height = 6, label }: { value: number; tone?: Tone; color?: string; className?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={cx("w-full overflow-hidden rounded-full bg-surface-3", className)} style={{ height }}
    >
      <div className={cx("h-full rounded-full transition-[width] duration-500", !color && toneDot[tone])} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-3">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm leading-6 text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Form controls ----------

const fieldBase =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors " +
  "hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Field({ label, hint, children, className, htmlFor, extra }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string; extra?: ReactNode }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">{label}</label>
        {extra}
      </div>
      {children}
      {hint && <p className="text-xs leading-5 text-ink-3">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, "h-9", className)} {...rest} />;
});

/** Textarea that grows with its content. */
export function Textarea({ className, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 320)}px`;
  }, [value]);
  return <textarea ref={ref} rows={2} value={value} className={cx(fieldBase, "resize-none py-2 leading-6", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, "h-9 cursor-pointer appearance-none bg-[length:16px] bg-[left_10px_center] bg-no-repeat pe-3 ps-8", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2375736d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}>
      {children}
    </select>
  );
}

/** Numeric input that accepts Persian digits and shows them back in Persian. */
export function NumberInput({ value, onChange, className, allowEmpty, suffix, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null; onChange: (v: number | null) => void; allowEmpty?: boolean; suffix?: string;
}) {
  const [text, setText] = useState(value === null ? "" : faDigits(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value === null ? "" : faDigits(value)); }, [value]);
  return (
    <div className={cx("relative", className)}>
      <input
        inputMode="decimal"
        className={cx(fieldBase, "h-9 tabular", suffix && "pe-14")}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => { focused.current = false; setText(value === null ? "" : faDigits(value)); }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = normalizeDigits(raw).replace(/,/g, "").trim();
          if (n === "") onChange(allowEmpty ? null : 0);
          else if (/^-?\d*\.?\d*$/.test(n) && Number.isFinite(parseFloat(n))) onChange(parseFloat(n));
        }}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md", label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; dot?: Tone }[]; size?: "sm" | "md"; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
            size === "md" ? "h-7 text-[13px]" : "h-6 text-xs",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.dot && <span className={cx("size-1.5 rounded-full", toneDot[o.dot])} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, onChange, label, step = 5 }: { value: number; onChange: (v: number) => void; label: string; step?: number }) {
  const id = useId();
  return (
    <input
      id={id} type="range" min={0} max={100} step={step} value={value} aria-label={label}
      onChange={(e) => onChange(+e.target.value)}
      className="range w-full" style={{ ["--fill" as string]: `${value}%` }}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-ink-3">{children}</kbd>;
}
