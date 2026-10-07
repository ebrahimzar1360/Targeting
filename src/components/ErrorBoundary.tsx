import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Download, RotateCcw } from "lucide-react";
import { Button, Card } from "./ui/primitives";
import { exportJson } from "@/io/files";
import { useStore } from "@/store/store";

/**
 * Keeps one broken screen from blanking the whole app. Saved plans are not touched by a
 * rendering error, so the fallback offers a way back and a backup download.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("هدف‌نگار:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="mx-auto mt-10 max-w-lg p-6 text-center" role="alert">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-serious-soft text-serious-ink"><AlertTriangle className="size-6" /></div>
        <h2 className="mt-4 text-lg font-bold">این صفحه با خطا روبه‌رو شد</h2>
        <p className="mt-2 text-sm leading-7 text-ink-2">
          برنامه‌های ذخیره‌شده‌ی شما سالم‌اند. به داشبورد برگردید؛ اگر خطا تکرار شد، یک فایل پشتیبان بگیرید و مشکل را گزارش کنید.
        </p>
        <p className="mt-2 break-words text-xs text-ink-3" dir="ltr">{this.state.error.message}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}><RotateCcw className="size-4" />بازگشت به داشبورد</Button>
          <Button onClick={() => exportJson(useStore.getState().plans, "hadafnegar-backup").catch(() => {})}><Download className="size-4" />دانلود پشتیبان</Button>
        </div>
      </Card>
    );
  }
}
