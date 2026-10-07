import { expect, test } from "@playwright/test";

const loadSample = async (page: import("@playwright/test").Page) => {
  await page.goto("./");
  await page.getByRole("button", { name: "بارگذاری نمونه" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مشاور کسب‌وکار و سیستم‌سازی با AI");
};

test("sample plan shows the dashboard and plan health, and survives a reload", async ({ page }) => {
  await loadSample(page);
  await expect(page.getByRole("heading", { name: "سلامت برنامه" })).toBeVisible();
  await expect(page.getByText("هفته‌های بیش از ظرفیت")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مشاور کسب‌وکار و سیستم‌سازی با AI");
});

test("a new plan from a template fills the requirements matrix", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "ساخت برنامه" }).click();
  await page.getByRole("radio", { name: /فروشگاه اینترنتی/ }).click();
  await expect(page.getByLabel("نام برنامه")).toHaveValue("راه‌اندازی فروشگاه اینترنتی");
  await page.getByRole("button", { name: "بعدی" }).click();
  await page.getByRole("button", { name: "بعدی" }).click();
  await page.getByRole("button", { name: "ساخت برنامه" }).click();
  await expect(page.getByRole("heading", { name: "ماتریس الزامات" })).toBeVisible();
  await expect(page.locator("#cat-knowledge li")).toHaveCount(2);
});

test("an activity can be deleted and brought back with undo", async ({ page }) => {
  await loadSample(page);
  await page.goto("./#/plan");
  const title = "مصاحبه تشخیصی با ۱۰ مدیر کسب‌وکار برای اعتبارسنجی درد بازار و قیمت‌پذیری";
  await page.getByText(title).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.getByRole("button", { name: "برگرداندن" }).click();
  await expect(page.getByText(title)).toHaveCount(1);
});

test("dragging a timeline bar reschedules the activity", async ({ page }) => {
  await loadSample(page);
  await page.goto("./#/plan");
  await page.getByRole("radio", { name: "زمان‌بندی" }).click();
  const bar = page.locator('[data-track] > button[aria-label^="گذراندن دوره مشاوره مدیریت"]');
  await expect(bar).toHaveAttribute("aria-label", /۱ مهر تا ۳۰ آذر ۱۴۰۵/);
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 8 }); // RTL: left = later
  await page.mouse.up();
  await expect(bar).not.toHaveAttribute("aria-label", /۱ مهر تا ۳۰ آذر ۱۴۰۵/);
  await expect(page.getByRole("dialog")).toHaveCount(0); // a drag is not a click
});

test("Excel export downloads a workbook", async ({ page }) => {
  await loadSample(page);
  await page.goto("./#/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "خروجی Excel برنامه‌ی فعلی" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^hadafnegar-plan-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test("@phone no page scrolls sideways on a phone", async ({ page }) => {
  await loadSample(page);
  for (const p of ["dashboard", "vision", "requirements", "plan", "kpi", "budget", "review", "report", "settings", "guide"]) {
    await page.goto(`./#/${p}`);
    await page.waitForLoadState("networkidle");
    const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(width, p).toBeLessThanOrEqual(0);
  }
});
