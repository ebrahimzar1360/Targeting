import { Card, PageHeader } from "@/components/ui/primitives";
import { DEFAULT_CATEGORIES } from "@/domain/defaults";
import { faDigits } from "@/domain/jalali";
import { METHOD_STEPS } from "./Welcome";

const FIELDS = [
  { name: "وضعیت مطلوب", text: "آنچه چشم‌انداز لازم دارد؛ بهترین منبعش «الگو» است: کسی که امروز همان‌جاست چه دارد؟ بلندمدت و بدون محدودیت افق برنامه." },
  { name: "وضعیت موجود", text: "صادقانه و مشخص؛ دارایی‌هایی که دارید را هم بنویسید (✓). هرچه دقیق‌تر، هدف واقعی‌تر." },
  { name: "هدف", text: "یک گام قابل‌سنجش در افق همین برنامه که فاصله را کم می‌کند: عدد + خروجی مشخص + موعد. لازم نیست کل فاصله را پر کند." },
  { name: "اولویت", text: "بحرانی یعنی بدون آن چشم‌انداز محقق نمی‌شود؛ اول این‌ها را برنامه‌ریزی کنید." },
];

const RULES = [
  "هر هدف حداقل یک فعالیت داشته باشد و هر فعالیت به یک هدف وصل باشد؛ اپ موارد جامانده را در «سلامت برنامه» نشان می‌دهد.",
  "ساعت و هزینه را عددی وارد کنید، نه داخل متن. بودجه و بار کاری از همین عددها حساب می‌شوند و دیگر ناهماهنگ نمی‌شوند.",
  "مجموع ساعت فعالیت‌ها را با ظرفیت واقعی‌تان مقایسه کنید. برنامه‌ای که دو برابر ظرفیت است، اجرا نمی‌شود؛ کوچکش کنید یا واگذار کنید.",
  "تاریخ پایان فعالیت نباید بعد از موعد هدفش باشد؛ یکی از دو تاریخ را واقع‌بینانه کنید.",
  "هر جمعه ۳۰ دقیقه بازبینی هفتگی، آخر هر ماه ۹۰ دقیقه بازبینی شاخص‌ها و اصلاح برنامه‌ی ماه بعد.",
];

export function Guide() {
  return (
    <>
      <PageHeader title="راهنمای روش" description="ماتریس ساختار طراحی: هدف‌گذاری از روی فاصله‌ی وضعیت موجود تا وضعیت مطلوب، در ۷ دسته‌ی الزامات." />
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold">چهار گام</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2">
            {METHOD_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">{faDigits(i + 1)}</span>
                <div><div className="text-sm font-semibold">{s.title}</div><p className="mt-0.5 text-[13px] leading-6 text-ink-2">{s.text}</p></div>
              </li>
            ))}
          </ol>
        </Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">هفت دسته‌ی الزامات</h2>
            <dl className="mt-3 grid gap-3">
              {DEFAULT_CATEGORIES.map((c, i) => (
                <div key={c.key} className="flex gap-3">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: `var(--cat-${i})` }} />
                  <div><dt className="text-sm font-semibold">{c.name}</dt><dd className="text-[13px] leading-6 text-ink-2">{c.question}</dd></div>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">ستون‌های ماتریس</h2>
            <dl className="mt-3 grid gap-3">
              {FIELDS.map((f) => <div key={f.name}><dt className="text-sm font-semibold">{f.name}</dt><dd className="text-[13px] leading-6 text-ink-2">{f.text}</dd></div>)}
            </dl>
            <h2 className="mt-6 font-semibold">قاعده‌های طلایی</h2>
            <ul className="mt-2 grid list-disc gap-1.5 ps-5 text-[13px] leading-6 text-ink-2">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
          </Card>
        </div>
      </div>
    </>
  );
}
