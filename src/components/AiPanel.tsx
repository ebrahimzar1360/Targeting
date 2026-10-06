import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button, Tip, cx } from "./ui/primitives";
import { Modal } from "./ui/overlays";
import { isAiReady } from "@/ai/claude";
import { useStore } from "@/store/store";
import { navigate } from "@/router";

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

function AiSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal
      open={open} onOpenChange={onOpenChange} title="دستیار هوش مصنوعی"
      footer={<><Button onClick={() => onOpenChange(false)}>بعداً</Button><Button variant="primary" onClick={() => { onOpenChange(false); navigate("settings"); }}>رفتن به تنظیمات</Button></>}
    >
      <p className="text-sm leading-7 text-ink-2">
        برای پیشنهاد هدف، فعالیت و نقد برنامه، یک کلید API از Claude لازم است. کلید را در «تنظیمات» وارد کنید؛
        فقط روی همین دستگاه ذخیره می‌شود و برنامه بدون آن هم کامل کار می‌کند.
      </p>
    </Modal>
  );
}
