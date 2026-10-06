import type { Priority, Status } from "./schema";

/** The seven requirement categories of the method, each with the question that fills it. */
export const DEFAULT_CATEGORIES = [
  { key: "knowledge", name: "دانش", question: "برای رسیدن به چشم‌انداز، چه چیزهایی را باید بدانید؟ (مفاهیم، چارچوب‌ها، دانش صنعت)" },
  { key: "experience", name: "تجربه", question: "چه کارهایی را باید قبلاً واقعاً انجام داده باشید؟ (سابقه، پروژه، نمونه‌کار)" },
  { key: "skill", name: "مهارت", question: "چه کارهایی را باید بتوانید خوب و قابل‌اتکا انجام دهید؟" },
  { key: "people", name: "نیروی انسانی", question: "چه کسانی باید کنار شما باشند؟ (همکار، تیم، منتور، شریک)" },
  { key: "equipment", name: "تجهیزات و ساختمان", question: "به چه فضا، ابزار و زیرساختی نیاز دارید؟" },
  { key: "licenses", name: "مجوزها", question: "چه مجوز، ثبت یا سند رسمی‌ای لازم است؟" },
  { key: "finance", name: "منابع مالی", question: "چه مقدار پول، از چه منبعی و در چه زمانی لازم است؟" },
] as const;

export const PRIORITIES: { key: Priority; label: string; tone: Tone }[] = [
  { key: "critical", label: "بحرانی", tone: "critical" },
  { key: "high", label: "بالا", tone: "serious" },
  { key: "medium", label: "متوسط", tone: "warning" },
  { key: "low", label: "پایین", tone: "neutral" },
];
export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const priorityLabel = (p: Priority) => PRIORITIES.find((x) => x.key === p)!.label;

export const STATUSES: { key: Status; label: string; tone: Tone }[] = [
  { key: "todo", label: "شروع نشده", tone: "neutral" },
  { key: "doing", label: "در حال اجرا", tone: "brand" },
  { key: "done", label: "انجام شد", tone: "good" },
  { key: "postponed", label: "به تعویق افتاد", tone: "warning" },
];
export const statusLabel = (s: Status) => STATUSES.find((x) => x.key === s)!.label;

export type Tone = "neutral" | "brand" | "good" | "warning" | "serious" | "critical";

export const KPI_MODES = [
  { key: "sum", label: "جمع ماه‌ها", hint: "عدد هر ماه را وارد کنید؛ جمع آن‌ها با هدف مقایسه می‌شود." },
  { key: "last", label: "تجمعی (آخرین عدد)", hint: "عدد کل تا پایان هر ماه را وارد کنید؛ آخرین عدد ملاک است." },
  { key: "avg", label: "میانگین", hint: "مثلاً امتیاز رضایت؛ میانگین ماه‌ها با هدف مقایسه می‌شود." },
] as const;

/** Phase colors reuse the categorical palette slots in a fixed order. */
export const PHASE_COLOR_SLOTS = [0, 1, 5, 6, 2, 3, 4, 7];
