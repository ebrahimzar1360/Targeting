import { useState } from "react";
import { Copy, Download, Eye, EyeOff, FileSpreadsheet, FileUp, Loader2, Monitor, Moon, Pencil, Plus, Sparkles, Sun, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, IconButton, Input, PageHeader, Segmented, Select } from "@/components/ui/primitives";
import { Confirm } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { testConnection } from "@/ai/claude";
import { buildSampleConsultant } from "@/data/sampleConsultant";
import { exportExcel, exportJson, importFile, pickFile } from "@/io/files";
import { faNum, fmtJ, fromDate } from "@/domain/jalali";
import { AI_MODELS, useStore, usePlan } from "@/store/store";
import type { Theme } from "@/store/store";
import { NewPlanDialog } from "./NewPlanDialog";
import { navigate } from "@/router";
import { IS_ARTIFACT } from "@/platform";
import { useStorageMode } from "@/platform/storage";
import type { SaveResult } from "@/io/files";

export function Settings() {
  const plan = usePlan();
  const { plans, settings, setSettings, lastBackupAt, markBackup, addPlan, setActive, deletePlan, duplicatePlan } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const daysSinceBackup = lastBackupAt ? Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86_400_000) : null;
  const storageMode = useStorageMode((s) => s.mode);

  /** Runs a save and reports the outcome; on claude.ai the viewer may decline the download. */
  const save = async (run: () => Promise<SaveResult>, done: string, after?: () => void) => {
    try {
      if ((await run()) === "saved") { after?.(); toast.good(done); }
    } catch (e) { toast.error((e as Error).message); }
  };

  const doImport = async () => {
    const file = await pickFile(".json,.xlsx");
    if (!file) return;
    try {
      const imported = await importFile(file);
      imported.forEach(addPlan);
      toast.good(`${faNum(imported.length, 0)} برنامه وارد شد.`);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="تنظیمات و پشتیبان" description={storageMode === "account"
        ? "برنامه‌های شما در حساب claude.ai خودتان و به‌صورت خصوصی ذخیره می‌شوند و روی دستگاه‌های دیگر هم در دسترس‌اند. برای اشتراک با دیگران، فایل برنامه را بفرستید."
        : "داده‌ها فقط در مرورگر همین دستگاه ذخیره می‌شوند. برای انتقال به دستگاه دیگر یا اشتراک با دیگران، فایل پشتیبان بگیرید."} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="پشتیبان‌گیری و انتقال" subtitle={lastBackupAt ? `آخرین پشتیبان: ${fmtJ(fromDate(new Date(lastBackupAt)))}` : "هنوز پشتیبانی گرفته نشده"}
            action={daysSinceBackup === null || daysSinceBackup > 14 ? <Badge tone="warning" dot>پشتیبان بگیرید</Badge> : <Badge tone="good" dot>به‌روز</Badge>} />
          <div className="grid grid-cols-1 gap-2 p-4 sm:p-5">
            <Button className="justify-start" onClick={() => save(() => exportJson(plans, "hadafnegar-backup"), "فایل پشتیبان همه‌ی برنامه‌ها ذخیره شد.", markBackup)}>
              <Download className="size-4" />پشتیبان کامل (JSON) — همه‌ی برنامه‌ها
            </Button>
            <Button className="justify-start" onClick={() => save(() => exportJson([plan]), "فایل این برنامه ذخیره شد؛ می‌توانید آن را برای دیگران بفرستید.")}>
              <Download className="size-4" />فقط برنامه‌ی فعلی (JSON) — برای اشتراک‌گذاری
            </Button>
            <Button className="justify-start" onClick={() => save(() => exportExcel(plan), "فایل Excel ذخیره شد.")}>
              <FileSpreadsheet className="size-4" />خروجی Excel برنامه‌ی فعلی
            </Button>
            <Button className="justify-start" onClick={doImport}>
              <FileUp className="size-4" />وارد کردن فایل (JSON یا Excel)
            </Button>
            <p className="text-xs leading-5 text-ink-3">Excel با همان قالب «جدول الزامات» و «Action plan» خوانده می‌شود؛ فایل‌های قبلی‌تان را هم می‌توانید وارد کنید.</p>
          </div>
        </Card>

        <Card>
          {!IS_ARTIFACT && <>
          <CardHeader title="ظاهر" />
          <div className="p-4 sm:p-5">
            <Segmented<Theme> label="پوسته" value={settings.theme} onChange={(theme) => setSettings({ theme })}
              options={[
                { value: "system", label: <><Monitor className="size-3.5" />مثل سیستم</> },
                { value: "light", label: <><Sun className="size-3.5" />روشن</> },
                { value: "dark", label: <><Moon className="size-3.5" />تیره</> },
              ]} />
          </div>
          </>}
          {IS_ARTIFACT ? (
            <>
              <CardHeader title="دستیار هوش مصنوعی" subtitle="پیشنهاد الزام، هدف و فعالیت و نقد برنامه با Claude." icon={<Sparkles className="size-4" />} />
              <p className="p-4 text-sm leading-7 text-ink-2 sm:p-5">
                در claude.ai دستیار بدون کلید API کار می‌کند و از Claude حساب خود شما استفاده می‌کند. بار اول، برای اجازه‌ی استفاده سؤال می‌شود.
                پوسته‌ی روشن و تیره هم از تنظیمات claude.ai پیروی می‌کند.
              </p>
            </>
          ) : (<>
          <CardHeader title="دستیار هوش مصنوعی (اختیاری)" subtitle="پیشنهاد الزام، هدف و فعالیت و نقد برنامه با Claude. کلید فقط روی همین دستگاه ذخیره می‌شود." icon={<Sparkles className="size-4" />} />
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5">
            <Field label="کلید API (Anthropic)" hint={<>از console.anthropic.com بگیرید. هزینه‌ی هر پیشنهاد معمولاً چند سنت است.</>}>
              <div className="flex gap-2">
                <Input type={showKey ? "text" : "password"} dir="ltr" value={settings.aiKey} onChange={(e) => setSettings({ aiKey: e.target.value })} placeholder="sk-ant-..." autoComplete="off" />
                <IconButton label={showKey ? "پنهان کردن" : "نمایش"} variant="secondary" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</IconButton>
              </div>
            </Field>
            <Field label="مدل">
              <Select value={settings.aiModel} onChange={(e) => setSettings({ aiModel: e.target.value })}>
                {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
            </Field>
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-2">تنظیمات پیشرفته</summary>
              <Field label="آدرس سرویس سازگار با Anthropic (اختیاری)" hint="خالی = api.anthropic.com" className="mt-3">
                <Input dir="ltr" value={settings.aiBaseUrl} onChange={(e) => setSettings({ aiBaseUrl: e.target.value })} placeholder="https://api.anthropic.com" />
              </Field>
            </details>
            <div className="flex gap-2">
              <Button disabled={!settings.aiKey || testing} onClick={async () => {
                setTesting(true);
                try { await testConnection(settings); toast.good("اتصال برقرار است."); } catch (e) { toast.error((e as Error).message); } finally { setTesting(false); }
              }}>{testing && <Loader2 className="size-4 animate-spin" />}آزمایش اتصال</Button>
              {settings.aiKey && <Button variant="ghost" onClick={() => setSettings({ aiKey: "" })}>حذف کلید</Button>}
            </div>
          </div>
          </>)}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="برنامه‌ها" subtitle="می‌توانید چند برنامه‌ی جدا داشته باشید (مثلاً شخصی و کاری)."
          action={<div className="flex gap-2"><Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" />جدید</Button><Button size="sm" variant="ghost" onClick={() => { addPlan(buildSampleConsultant()); toast.good("نمونه اضافه شد."); }}>افزودن نمونه</Button></div>} />
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">{p.title || "بدون عنوان"}{p.id === plan.id && <Badge tone="brand">فعال</Badge>}</div>
                <div className="text-xs text-ink-3">{faNum(p.requirements.length, 0)} الزام · {faNum(p.activities.length, 0)} فعالیت · {fmtJ(p.start)} تا {fmtJ(p.end)}</div>
              </div>
              {p.id !== plan.id && <Button size="sm" onClick={() => setActive(p.id)}>فعال کن</Button>}
              {p.id === plan.id && (
                <IconButton label="ویرایش نام و چشم‌انداز" size="icon-sm" onClick={() => navigate("vision")}><Pencil className="size-4" /></IconButton>
              )}
              <IconButton label="کپی" size="icon-sm" onClick={() => { duplicatePlan(p.id); toast.good("کپی ساخته شد."); }}><Copy className="size-4" /></IconButton>
              <IconButton label="حذف" size="icon-sm" onClick={() => setToDelete(p.id)}><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-5 text-sm leading-7 text-ink-2">
        <h2 className="font-semibold text-ink">درباره</h2>
        <p className="mt-1">
          هدف‌نگار نسخه‌ی {__APP_VERSION__}، متن‌باز با مجوز MIT.{" "}
          {IS_ARTIFACT ? "این نسخه روی claude.ai اجرا می‌شود." : "بدون سرور و بدون ثبت‌نام. اپ را می‌توانید روی گوشی «نصب» کنید (Add to Home Screen) تا آفلاین هم کار کند."}
        </p>
        <p className="mt-1">کد منبع: <a className="text-brand-ink underline" href="https://github.com/ebrahimzar1360/Targeting" target="_blank" rel="noreferrer">github.com/ebrahimzar1360/Targeting</a></p>
      </Card>

      <Confirm open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} danger confirmLabel="حذف برنامه"
        title="این برنامه حذف شود؟" description="این کار برگشت‌پذیر نیست. اگر لازم دارید، اول از آن فایل پشتیبان بگیرید."
        onConfirm={() => { if (toDelete) deletePlan(toDelete); setToDelete(null); }} />
      <NewPlanDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
