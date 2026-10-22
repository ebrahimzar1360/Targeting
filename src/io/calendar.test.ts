import { describe, expect, it } from "vitest";
import { createPlan, newActivity } from "@/domain/factory";
import { CALENDAR_DEFAULTS, calendarEvents, fold, googleCalendarUrl, gregorian, overdueCount, toIcs } from "./calendar";

const TODAY = "1405/07/30"; // Thursday 22 Oct 2026

function plan() {
  const p = createPlan({ title: "برنامه, آزمایشی; نمونه", vision: "", model: "", start: "1405/07/01", months: 12, weeklyHours: 15, budgetMin: 0, budgetMax: 0, withPhases: false });
  p.activities = [
    newActivity(p, { id: "a1", title: "طراحی سایت", start: "1405/08/01", end: "1405/08/15", hours: 10, cost: 5 }),
    newActivity(p, { id: "a2", title: "عقب‌افتاده", start: "1405/07/01", end: "1405/07/10" }),
    newActivity(p, { id: "a3", title: "تمام‌شده", start: "1405/08/01", end: "1405/08/20", status: "done" }),
  ];
  p.milestones = [
    { id: "m1", date: "1405/09/30", title: "پایان فاز ۱", done: false },
    { id: "m2", date: "1405/07/15", title: "گذشته", done: false },
  ];
  return p;
}

const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("calendar export", () => {
  it("converts Jalali dates to Gregorian", () => {
    expect(gregorian(TODAY)).toBe("20261022");
    expect(gregorian("1405/12/29")).toBe("20270320");
    expect(gregorian("1406/01/01")).toBe("20270321");
  });

  it("lists upcoming items only, the weekly review first", () => {
    const p = plan();
    const events = calendarEvents(p, TODAY, CALENDAR_DEFAULTS);
    expect(events.map((e) => e.kind)).toEqual(["review", "due", "milestone"]);
    expect(events[0]).toMatchObject({ date: "1405/08/01", time: "10:00", until: "1406/06/31" }); // next Friday
    expect(events[1].title).toBe("موعد: طراحی سایت");
    expect(overdueCount(p, TODAY)).toBe(1);

    const withStarts = calendarEvents(p, TODAY, { ...CALENDAR_DEFAULTS, starts: true, reviewDay: 5 }); // review today, start a1 tomorrow
    expect(withStarts.map((e) => e.kind)).toEqual(["review", "start", "due", "milestone"]);
    expect(withStarts[0].date).toBe(TODAY);

    const lateReview = calendarEvents(p, "1405/08/10", { ...CALENDAR_DEFAULTS, reviewDay: 0 }); // review 16 Aban, a1 due 15 Aban
    expect(lateReview[0].kind).toBe("review"); // pinned first though a deadline comes sooner
    expect(lateReview[0].date > lateReview[1].date).toBe(true);
  });

  it("leaves the weekly review out once the plan has ended", () => {
    const p = plan();
    p.end = "1405/07/29";
    expect(calendarEvents(p, TODAY, CALENDAR_DEFAULTS).some((e) => e.kind === "review")).toBe(false);
  });

  it("writes a valid .ics file", () => {
    const p = plan();
    const ics = toIcs(p, calendarEvents(p, TODAY, CALENDAR_DEFAULTS), "day-before", "https://example.org/app/", new Date("2026-10-22T08:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/); // CRLF only
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);

    const text = unfold(ics);
    expect(text).toContain("X-WR-CALNAME:هدف‌نگار: برنامه\\, آزمایشی\\; نمونه");
    expect(text).toContain(`UID:due-a1-${p.id}@hadafnegar`);
    expect(text).toContain("DTSTART;VALUE=DATE:20261106\r\nDTEND;VALUE=DATE:20261107");
    expect(text).toContain("DTSTART:20261023T100000\r\nDURATION:PT30M\r\nRRULE:FREQ=WEEKLY;UNTIL=20270922T235959");
    expect(text).toContain("TRIGGER:-PT15H");
    expect(text).toContain("TRIGGER:PT0S");
    expect(text).toContain("DTSTAMP:20261022T080000Z");
    expect(text).toContain("زمان لازم: ۱۰ ساعت\\nهزینه: ۵ میلیون تومان");
    expect(text).not.toContain("تمام‌شده");
    expect(text).not.toContain("عقب‌افتاده");
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3);

    expect(toIcs(p, calendarEvents(p, TODAY, CALENDAR_DEFAULTS), "none")).not.toContain("VALARM");
  });

  it("folds long lines without splitting a character", () => {
    const line = `DESCRIPTION:${"هدف‌گذاری به روش ماتریس ساختار طراحی، ".repeat(6)}`;
    const folded = fold(line);
    expect(folded.split("\r\n").length).toBeGreaterThan(1);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("builds Google Calendar links", () => {
    const [review, due] = calendarEvents(plan(), TODAY, CALENDAR_DEFAULTS);
    const r = new URL(googleCalendarUrl(review)).searchParams;
    expect(r.get("dates")).toBe("20261023T100000/20261023T103000");
    expect(r.get("recur")).toBe("RRULE:FREQ=WEEKLY;UNTIL=20270922T235959");
    const d = new URL(googleCalendarUrl(due)).searchParams;
    expect(d.get("action")).toBe("TEMPLATE");
    expect(d.get("text")).toBe("موعد: طراحی سایت");
    expect(d.get("dates")).toBe("20261106/20261107");
    expect(d.get("recur")).toBeNull();
  });

  it("rolls a late review into the next day", () => {
    const [review] = calendarEvents(plan(), TODAY, { ...CALENDAR_DEFAULTS, reviewTime: "23:45" });
    expect(new URL(googleCalendarUrl(review)).searchParams.get("dates")).toBe("20261023T234500/20261024T001500");
  });
});
