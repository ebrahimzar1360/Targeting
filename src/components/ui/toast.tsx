import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cx } from "./primitives";

interface ToastItem { id: number; text: string; tone: "good" | "info" | "error"; action?: { label: string; run: () => void } }
interface ToastState { items: ToastItem[]; push(t: Omit<ToastItem, "id">): void; dismiss(id: number): void }

let seq = 0;
const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = ++seq;
    set({ items: [...get().items.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.action ? 6000 : 3500);
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export const toast = {
  good: (text: string, action?: ToastItem["action"]) => useToasts.getState().push({ text, tone: "good", action }),
  info: (text: string, action?: ToastItem["action"]) => useToasts.getState().push({ text, tone: "info", action }),
  error: (text: string) => useToasts.getState().push({ text, tone: "error" }),
};

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:start-6 lg:items-start lg:px-0">
      {items.map((t) => (
        <div key={t.id} className="anim-rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-page shadow-pop">
          {t.tone === "good" && <CheckCircle2 className="size-4 shrink-0 text-good" />}
          {t.tone === "info" && <Info className="size-4 shrink-0 opacity-70" />}
          {t.tone === "error" && <AlertTriangle className="size-4 shrink-0 text-serious" />}
          <span className="flex-1 leading-6">{t.text}</span>
          {t.action && (
            <button
              className={cx("rounded-md px-2 py-1 font-semibold text-[#9ec5f4] hover:bg-white/10", "dark:text-[#1c5cab] dark:hover:bg-black/10")}
              onClick={() => { t.action!.run(); dismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
          <button aria-label="بستن" className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
