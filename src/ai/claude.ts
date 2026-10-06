import { z } from "zod";
import { budgetSummary, healthChecks, planProgress, weeklyLoad } from "@/domain/calc";
import { PRIORITIES, STATUSES } from "@/domain/defaults";
import { addDays, parseLooseJ, todayJ } from "@/domain/jalali";
import type { Plan, Requirement } from "@/domain/schema";
import type { Settings } from "@/store/store";

/**
 * Optional AI assistant. Calls the Claude API straight from the browser with the user's own
 * key (kept in this device's storage only). Every function returns structured data the UI
 * shows as suggestions; nothing is applied without the user's click.
 */

export const isAiReady = (s: Settings) => s.aiKey.trim().length > 10;

const SYSTEM = `You help a person plan with the "Design Structure Matrix" (ماتریس ساختار طراحی) goal-setting method:
1. Vision statement and a role model (الگو) that already has the desired state.
2. Requirements in 7 categories: knowledge, experience, skill, people, equipment & building, licenses, financial resources.
   For each requirement: desired state (what the vision / role model requires), current state (honest, today),
   and the goal: one measurable step that closes the gap within the plan horizon, with a number and a deadline.
3. Action plan: each goal becomes programs and dated activities with estimated hours of the owner's time and cost.
4. Monthly KPIs and a weekly review.
Write every user-facing string in natural, concise Persian (Farsi). Dates are Jalali (Solar Hijri), format YYYY/MM/DD with Latin digits.
Be practical and realistic for the owner's weekly capacity and budget. Prefer fewer, concrete items over many vague ones.
Never repeat items that already exist in the plan.`;

function planContext(plan: Plan): string {
  const cat = new Map(plan.categories.map((c) => [c.id, c.name]));
  const pr = new Map(PRIORITIES.map((p) => [p.key, p.label]));
  const reqs = plan.requirements.map((r) =>
    `- [${r.id}] (${cat.get(r.categoryId)} · ${pr.get(r.priority)}) ${r.title} | مطلوب: ${r.desired} | موجود: ${r.current} | هدف: ${r.goal || "—"} | موعد: ${r.dueDate || "—"}`);
  return [
    `امروز: ${todayJ()}`,
    `عنوان برنامه: ${plan.title}`,
    `چشم‌انداز: ${plan.vision}`,
    `الگو: ${plan.model || "—"}`,
    plan.focus && `تمرکز: ${plan.focus}`,
    `افق: ${plan.start} تا ${plan.end}`,
    `ظرفیت: ${plan.weeklyHours} ساعت در هفته`,
    plan.budgetMax ? `بودجه: ${plan.budgetMin} تا ${plan.budgetMax} ${plan.currency}` : "بودجه: تعیین نشده",
    plan.phases.length ? `فازها: ${plan.phases.map((p) => `${p.name} (${p.start}–${p.end})`).join("؛ ")}` : "",
    "",
    "الزامات فعلی:",
    reqs.length ? reqs.join("\n") : "(هنوز الزامی ثبت نشده)",
  ].filter(Boolean).join("\n");
}

/** The SDK is loaded on first use so the app itself stays small. */
async function loadSdk() {
  const [{ default: SDK }, { betaZodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/beta/zod"),
  ]);
  return { SDK, betaZodOutputFormat };
}

async function ask<T>(s: Settings, schema: z.ZodType<T>, prompt: string, effort: "low" | "medium"): Promise<T> {
  const custom = !!s.aiBaseUrl.trim();
  const { SDK, betaZodOutputFormat } = await loadSdk();
  const client = new SDK({ apiKey: s.aiKey.trim(), baseURL: s.aiBaseUrl.trim() || undefined, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const res = await client.beta.messages.parse({
      model: s.aiModel,
      max_tokens: 16000,
      // Server-side fallback re-runs a declined request on another model; skipped for custom endpoints.
      ...(custom ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") throw new Error("مدل به این درخواست پاسخ نداد. متن را کمی تغییر دهید و دوباره امتحان کنید.");
    if (res.stop_reason === "max_tokens") throw new Error("پاسخ ناقص ماند. دوباره امتحان کنید.");
    if (!res.parsed_output) throw new Error("پاسخ مدل قابل خواندن نبود. دوباره امتحان کنید.");
    return res.parsed_output as T;
  } catch (e) {
    throw new Error(explain(SDK, e));
  }
}

type Sdk = typeof import("@anthropic-ai/sdk").default;

function explain(Anthropic: Sdk, e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "کلید API نامعتبر است. آن را در تنظیمات بررسی کنید.";
  if (e instanceof Anthropic.PermissionDeniedError) return "این کلید اجازه‌ی استفاده از این مدل را ندارد.";
  if (e instanceof Anthropic.NotFoundError) return "مدل یا آدرس سرویس پیدا نشد. تنظیمات هوش مصنوعی را بررسی کنید.";
  if (e instanceof Anthropic.RateLimitError) return "تعداد درخواست‌ها زیاد شد؛ کمی بعد دوباره امتحان کنید.";
  if (e instanceof Anthropic.APIConnectionError) return "اتصال به سرویس برقرار نشد. اینترنت و آدرس سرویس را بررسی کنید.";
  if (e instanceof Anthropic.APIError) return `خطای سرویس (${e.status ?? "?"}): ${e.message}`;
  return (e as Error)?.message || "خطای ناشناخته";
}

/** Keeps AI dates inside the plan horizon and well-formed. */
function fixDate(s: string, plan: Plan, fallback: string): string {
  const j = parseLooseJ(s) ?? fallback;
  if (plan.start && j < plan.start) return plan.start;
  if (plan.end && j > plan.end) return plan.end;
  return j;
}

// ---------- Tasks ----------

const RequirementIdeas = z.object({
  items: z.array(z.object({ title: z.string(), desired: z.string(), why: z.string() })),
});
export type RequirementIdea = z.infer<typeof RequirementIdeas>["items"][number];

export async function suggestRequirements(s: Settings, plan: Plan, categoryId: string) {
  const cat = plan.categories.find((c) => c.id === categoryId)!;
  const out = await ask(s, RequirementIdeas, `${planContext(plan)}

دسته‌ی «${cat.name}» (${cat.question}).
۳ تا ۵ الزام مهم این دسته را پیشنهاد بده که برای رسیدن به چشم‌انداز لازم است و در فهرست بالا نیست.
برای هر کدام: عنوان کوتاه، وضعیت مطلوب (یک جمله‌ی مشخص)، و دلیل کوتاه.`, "low");
  return out.items;
}

const GoalIdeas = z.object({
  options: z.array(z.object({ goal: z.string(), due_date: z.string(), why: z.string() })),
});
export type GoalIdea = z.infer<typeof GoalIdeas>["options"][number];

export async function suggestGoals(s: Settings, plan: Plan, r: Requirement) {
  const out = await ask(s, GoalIdeas, `${planContext(plan)}

الزام مورد نظر: «${r.title}»
وضعیت مطلوب: ${r.desired || "—"}
وضعیت موجود: ${r.current || "—"}
هدف فعلی: ${r.goal || "—"}

۳ گزینه برای «هدف» این الزام بنویس: هر کدام یک گام قابل‌سنجش (با عدد) که فاصله‌ی وضعیت موجود تا مطلوب را در افق برنامه کم کند،
با موعد واقع‌بینانه داخل افق (YYYY/MM/DD)، و یک دلیل کوتاه. گزینه‌ها از محتاط تا بلندپروازانه باشند.`, "low");
  return out.options.map((o) => ({ ...o, due_date: fixDate(o.due_date, plan, plan.end) }));
}

const ActivityIdeas = z.object({
  activities: z.array(z.object({
    program: z.string(), title: z.string(), start: z.string(), end: z.string(),
    hours: z.number(), cost: z.number(), resources: z.string(),
  })),
});
export type ActivityIdea = z.infer<typeof ActivityIdeas>["activities"][number];

export async function suggestActivities(s: Settings, plan: Plan, r: Requirement) {
  const existing = plan.activities.filter((a) => a.requirementId === r.id).map((a) => `- ${a.title} (${a.start}–${a.end})`);
  const out = await ask(s, ActivityIdeas, `${planContext(plan)}

هدف: «${r.goal || r.title}» (الزام: ${r.title}${r.dueDate ? `، موعد ${r.dueDate}` : ""})
فعالیت‌های موجود این هدف:
${existing.join("\n") || "(هیچ)"}

۳ تا ۵ فعالیت مشخص و تاریخ‌دار برای رسیدن به این هدف پیشنهاد بده که با فعالیت‌های موجود تکراری نباشد.
برای هر کدام: نام برنامه (گروه کوتاه)، عنوان فعالیت (فعل‌محور)، شروع و پایان داخل افق و ترجیحاً قبل از موعد هدف،
ساعت تخمینی وقت صاحب برنامه، هزینه به ${plan.currency} (۰ اگر هزینه ندارد)، و منابع لازم.
ظرفیت ${plan.weeklyHours} ساعت در هفته را در نظر بگیر.`, "low");
  const today = todayJ();
  return out.activities.map((a) => {
    const start = fixDate(a.start, plan, today > plan.start ? today : plan.start);
    const end = fixDate(a.end, plan, addDays(start, 14));
    return { ...a, start, end: end < start ? addDays(start, 14) : end, hours: Math.max(0, Math.round(a.hours)), cost: Math.max(0, a.cost) };
  });
}

const Review = z.object({
  summary: z.string(),
  findings: z.array(z.object({ severity: z.enum(["high", "medium", "low"]), title: z.string(), detail: z.string(), suggestion: z.string() })),
});
export type PlanReview = z.infer<typeof Review>;

export async function reviewPlan(s: Settings, plan: Plan): Promise<PlanReview> {
  const reqTitle = new Map(plan.requirements.map((r) => [r.id, r.title]));
  const st = new Map(STATUSES.map((x) => [x.key, x.label]));
  const acts = plan.activities.map((a) =>
    `- ${a.title} | هدف: ${a.requirementId ? reqTitle.get(a.requirementId) : "بدون اتصال"} | ${a.start}–${a.end} | ${a.hours} ساعت | ${a.cost} ${plan.currency} | ${st.get(a.status)} ${a.progress}٪`);
  const issues = healthChecks(plan, todayJ()).map((i) => `- ${i.title}: ${i.detail} (${i.items.length} مورد)`);
  const weeks = weeklyLoad(plan);
  const over = weeks.filter((w) => w.hours > plan.weeklyHours).length;
  const { planned } = budgetSummary(plan);
  return ask(s, Review, `${planContext(plan)}

فعالیت‌ها:
${acts.join("\n") || "(هیچ)"}

محاسبات اپ: پیشرفت کل ${Math.round(planProgress(plan) * 100)}٪ · جمع ساعت ${plan.activities.reduce((x, a) => x + a.hours, 0)} · ${over} هفته از ${weeks.length} هفته بیش از ظرفیت · جمع هزینه ${planned} ${plan.currency}
بررسی‌های خودکار:
${issues.join("\n") || "(موردی نیست)"}

مثل یک مشاور باتجربه این برنامه را نقد کن: آیا هدف‌ها واقعاً از فاصله‌ی وضعیت موجود و مطلوب آمده‌اند؟ آیا با ظرفیت و بودجه شدنی است؟
چه چیزی جا افتاده یا اضافه است؟ ترتیب و وابستگی‌ها منطقی است؟ یک جمع‌بندی دو سه جمله‌ای و حداکثر ۷ یافته‌ی مشخص با پیشنهاد عملی بده.`, "medium");
}

/** Cheap call to verify the key and model. */
export async function testConnection(s: Settings): Promise<void> {
  await ask(s, z.object({ ok: z.boolean() }), "فقط ok را true برگردان.", "low");
}
