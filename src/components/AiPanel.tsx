import { useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, KeyRound, Loader2, Sparkles } from "lucide-react";
import { Button, Tip, buttonClass, cx } from "./ui/primitives";
import { Modal } from "./ui/overlays";
import { isAiReady } from "@/ai/claude";
import { useStore } from "@/store/store";
import { navigate } from "@/router";
import { LINKS } from "@/platform";

/** Runs an AI task with loading/error state; shows a setup hint when no key is configured. */
export function useAi<T>() {
  const settings = useStore((s) => s.settings);
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: T | null }>({ loading: false, error: null, data: null });
  const [needsSetup, setNeedsSetup] = useState(false);
  const run = async (fn: (s: typeof settings) => Promise<T>) => {
    if (!isAiReady(settings)) { setNeedsSetup(true); return; }
    setState({ loading: true, error: null, data: null });
    try { setState({ loading: false, error: null, data: await fn(settings) }); }
    catch (e) { setState({ loading: false, error: (e as Error).message, data: null }); }
  };
  const reset = () => setState({ loading: false, error: null, data: null });
  const setupDialog = <AiSetupDialog open={needsSetup} onOpenChange={setNeedsSetup} />;
  return { ...state, run, reset, setupDialog };
}

export function AiButton({ onClick, loading, children, size = "sm" }: { onClick: () => void; loading?: boolean; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <Tip label="پیشنهاد با هوش مصنوعی (Claude)؛ فقط پیشنهاد می‌دهد و چیزی را خودکار تغییر نمی‌دهد.">
      <Button variant="soft" size={size} onClick={onClick} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {children}
      </Button>
    </Tip>
  );
}

export function AiBox({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("anim-fade rounded-xl border border-brand/25 bg-brand-soft/50 p-3", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-ink"><Sparkles className="size-3.5" />پیشنهاد هوش مصنوعی</div>
      {children}
    </div>
  );
}

export function AiError({ message }: { message: string }) {
  return <p className="anim-fade rounded-lg bg-critical-soft px-3 py-2 text-[13px] leading-6 text-critical-ink">{message}</p>;
}

/** Web build only: claude.ai runs the assistant without a key. */
function AiSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal
      open={open} onOpenChange={onOpenChange} title="دستیار هوش مصنوعی"
      description="برای پیشنهاد الزام، هدف، فعالیت و نقد برنامه، یکی از این دو راه را انتخاب کنید. برنامه بدون دستیار هم کامل کار می‌کند."
      footer={<Button onClick={() => onOpenChange(false)}>بعداً</Button>}
    >
      <div className="grid grid-cols-1 gap-3">
        <section className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-brand" />بدون کلید، با حساب Claude خودتان</h3>
          <p className="mt-1 text-[13px] leading-6 text-ink-2">
            نسخه‌ی claude.ai هدف‌نگار از Claude حساب خود شما استفاده می‌کند و هزینه‌ی جداگانه ندارد.
            برای بردن برنامه‌ها: در «تنظیمات» همین‌جا پشتیبان بگیرید و آنجا «وارد کردن فایل» را بزنید.
          </p>
          <a href={LINKS.claudeAi} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm", "mt-3")}>
            باز کردن نسخه‌ی claude.ai<ExternalLink className="size-3.5" />
          </a>
        </section>
        <section className="rounded-xl border border-line p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-ink-3" />با کلید API در همین نسخه</h3>
          <p className="mt-1 text-[13px] leading-6 text-ink-2">
            کلید را از console.anthropic.com بگیرید و در «تنظیمات» وارد کنید. هزینه جدا از اشتراک Claude حساب می‌شود و کلید فقط روی همین دستگاه می‌ماند.
          </p>
          <Button size="sm" className="mt-3" onClick={() => { onOpenChange(false); navigate("settings"); }}>رفتن به تنظیمات</Button>
        </section>
      </div>
    </Modal>
  );
}
