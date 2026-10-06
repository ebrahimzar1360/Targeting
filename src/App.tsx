import { useEffect } from "react";
import { Direction, Tooltip } from "radix-ui";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster, toast } from "@/components/ui/toast";
import { useStore, useActivePlan } from "@/store/store";
import { useRoute } from "@/router";
import { Welcome } from "@/pages/Welcome";
import { Dashboard } from "@/pages/Dashboard";
import { Vision } from "@/pages/Vision";
import { Requirements } from "@/pages/Requirements";
import { ActionPlan } from "@/pages/ActionPlan";
import { Kpis } from "@/pages/Kpis";
import { Budget } from "@/pages/Budget";
import { Review } from "@/pages/Review";
import { Settings } from "@/pages/Settings";
import { Guide } from "@/pages/Guide";
import { Report } from "@/pages/Report";

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    // Always print in the light theme.
    const light = () => document.documentElement.classList.remove("dark");
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("beforeprint", light);
    window.addEventListener("afterprint", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("beforeprint", light);
      window.removeEventListener("afterprint", apply);
    };
  }, [theme]);
}

/** Ctrl/Cmd+Z anywhere outside a text field undoes the last change. */
function useUndoShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true]")) return;
      const undone = useStore.getState().undo();
      if (undone) { e.preventDefault(); toast.info(`برگردانده شد: ${undone.label}`); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const PAGES = {
  dashboard: Dashboard, vision: Vision, requirements: Requirements, plan: ActionPlan,
  kpi: Kpis, budget: Budget, review: Review, report: Report, settings: Settings, guide: Guide,
};

export default function App() {
  useTheme();
  useUndoShortcut();
  const plan = useActivePlan();
  const { page } = useRoute();
  const PageComp = PAGES[page];
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);

  return (
    <Direction.Provider dir="rtl">
      <Tooltip.Provider>
        {plan ? (
          // Remount pages on plan switch so local editor state never leaks across plans.
          <AppShell><PageComp key={plan.id} /></AppShell>
        ) : (
          <Welcome />
        )}
        <Toaster />
      </Tooltip.Provider>
    </Direction.Provider>
  );
}
