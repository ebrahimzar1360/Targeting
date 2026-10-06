import { IS_ARTIFACT, capability, errorCode } from "@/platform";
import { makeBackup, readBackup } from "@/domain/migrate";
import { todayJ } from "@/domain/jalali";
import type { Plan } from "@/domain/schema";

export type SaveResult = "saved" | "declined";

/**
 * Gives the user a file. On claude.ai the frame cannot download by itself, so the file goes
 * through the `downloads` capability, which asks the viewer to confirm.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (IS_ARTIFACT) {
    const downloads = await capability("downloads");
    if (!downloads) throw new Error("دانلود فایل در این نما در دسترس نیست.");
    try {
      await downloads.save({ filename, data: blob });
      return "saved";
    } catch (e) {
      if (errorCode(e) === "declined") return "declined";
      if (errorCode(e) === "rate_limited") throw new Error("یک دانلود دیگر در جریان است؛ کمی بعد دوباره امتحان کنید.");
      throw new Error("دانلود فایل در این نما در دسترس نیست.");
    }
  }
  downloadBlob(blob, filename);
  return "saved";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ASCII file names: some browsers replace non-Latin download names with "download". */
const safeName = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "hadafnegar-plan";
const stamp = () => todayJ().replace(/\//g, "-");

export function exportJson(plans: Plan[], name = plans.length > 1 ? "hadafnegar-backup" : "hadafnegar-plan") {
  const blob = new Blob([JSON.stringify(makeBackup(plans), null, 2)], { type: "application/json" });
  return saveFile(blob, `${safeName(name)}-${stamp()}.json`);
}

export async function exportExcel(plan: Plan) {
  const { planToWorkbook } = await import("./excel");
  const buf = await planToWorkbook(plan);
  return saveFile(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `hadafnegar-plan-${stamp()}.xlsx`);
}

/** Reads a backup (.json) or a spreadsheet in the method's template layout (.xlsx). */
export async function importFile(file: File): Promise<Plan[]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { workbookToPlan } = await import("./excel");
    return [await workbookToPlan(await file.arrayBuffer(), file.name.replace(/\.xlsx$/i, ""))];
  }
  let json: unknown;
  try { json = JSON.parse(await file.text()); } catch { throw new Error("فایل JSON قابل خواندن نیست."); }
  return readBackup(json);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept });
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
