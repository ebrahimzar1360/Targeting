import { useState } from "react";
import { FileUp, Sparkles, Target, Wand2, Telescope, Grid3x3, ListChecks, TrendingUp, ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { buildSampleConsultant } from "@/data/sampleConsultant";
import { importFile, pickFile } from "@/io/files";
import { useStore } from "@/store/store";
import { navigate } from "@/router";
import { IS_ARTIFACT } from "@/platform";
import { NewPlanDialog } from "./NewPlanDialog";

export const METHOD_STEPS = [
  { icon: Telescope, title: "چشم‌انداز و الگو", text: "مقصد را در یک جمله بنویسید و الگویی که امروز آنجاست را مشخص کنید." },
  { icon: Grid3x3, title: "ماتریس الزامات", text: "در ۷ دسته (دانش، تجربه، مهارت، نیروی انسانی، تجهیزات، مجوزها، منابع مالی) وضعیت مطلوب و موجود را کنار هم بگذارید؛ فاصله‌ی آن دو، هدف شماست." },
  { icon: ListChecks, title: "برنامه عملیاتی", text: "هر هدف را به برنامه و فعالیت‌های تاریخ‌دار با ساعت و هزینه تبدیل کنید." },
  { icon: TrendingUp, title: "پیگیری", text: "هر هفته پیشرفت را به‌روز کنید و هر ماه شاخص‌ها را بسنجید و برنامه را اصلاح کنید." },
];

export function Welcome() {
  const addPlan = useStore((s) => s.addPlan);
  const [creating, setCreating] = useState(false);

  const loadSample = () => {
    addPlan(buildSampleConsultant());
    toast.good("نمونه بارگذاری شد. بخش «سلامت برنامه» را در داشبورد ببینید.");
    navigate("dashboard");
  };
  const doImport = async () => {
    const file = await pickFile(".json,.xlsx");
    if (!file) return;
    try {
      const plans = await importFile(file);
      plans.forEach(addPlan);
      toast.good(`${plans.length === 1 ? "برنامه" : `${plans.length} برنامه`} وارد شد.`);
      navigate("dashboard");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-card"><Target className="size-5" /></div>
          <div>
            <div className="text-lg font-bold">هدف‌نگار</div>
            <div className="text-xs text-ink-3">هدف‌گذاری به روش ماتریس ساختار طراحی</div>
          </div>
        </div>

        <h1 className="mt-10 max-w-2xl text-3xl font-extrabold leading-[1.5] sm:text-4xl sm:leading-[1.5]">
          از چشم‌انداز تا اقدام؛ <span className="text-brand">هدفی که واقعاً اجرا می‌شود.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-ink-2">
          هدف‌ها از فاصله‌ی «وضعیت موجود» تا «وضعیت مطلوب» بیرون می‌آیند، به فعالیت‌های تاریخ‌دار وصل می‌شوند،
          و اپ خودش بودجه، ظرفیت زمانی و ناهماهنگی‌ها را حساب می‌کند.{" "}
          {IS_ARTIFACT ? "برنامه‌ها به‌صورت خصوصی در حساب claude.ai شما ذخیره می‌شوند." : "داده‌ها فقط روی دستگاه شما ذخیره می‌شوند."}
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <Card className="group flex flex-col p-5">
            <Wand2 className="size-5 text-brand" />
            <h2 className="mt-3 font-semibold">شروع از صفر</h2>
            <p className="mt-1 flex-1 text-sm leading-6 text-ink-3">راهنمای سه‌گامی؛ از صفر یا با یکی از ۵ قالب آماده (کسب‌وکار خدماتی، فروشگاه اینترنتی، دوره‌ی آنلاین، کارگاه تولیدی، ارتقای شغلی).</p>
            <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>ساخت برنامه<ArrowLeft className="size-4" /></Button>
          </Card>
          <Card className="flex flex-col p-5">
            <Sparkles className="size-5 text-[var(--cat-1)]" />
            <h2 className="mt-3 font-semibold">نمونه‌ی آماده</h2>
            <p className="mt-1 flex-1 text-sm leading-6 text-ink-3">«مشاور کسب‌وکار و سیستم‌سازی با AI»؛ یک برنامه‌ی یک‌ساله‌ی کامل با ۳۶ الزام و ۶۰ فعالیت.</p>
            <Button className="mt-4" onClick={loadSample}>بارگذاری نمونه</Button>
          </Card>
          <Card className="flex flex-col p-5">
            <FileUp className="size-5 text-[var(--cat-2)]" />
            <h2 className="mt-3 font-semibold">وارد کردن فایل</h2>
            <p className="mt-1 flex-1 text-sm leading-6 text-ink-3">فایل پشتیبان (JSON) یا فایل Excel با قالب «جدول الزامات» و «Action plan».</p>
            <Button className="mt-4" onClick={doImport}>انتخاب فایل</Button>
          </Card>
        </div>

        <h2 className="mt-14 text-lg font-bold">روش در چهار گام</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METHOD_STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-surface/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-xs text-brand-ink">{"۱۲۳۴"[i]}</span>
                {s.title}
              </div>
              <p className="mt-2 text-[13px] leading-6 text-ink-3">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <NewPlanDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
