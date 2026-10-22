import { isOverdue } from "@/domain/calc";
import { addDays, dayNumber, faDigits, faNum, fmtRange, isValidJ, weekday } from "@/domain/jalali";
import type { JDate, Plan } from "@/domain/schema";

/**
 * Calendar export: activity deadlines and starts, milestones and the weekly review as
 * calendar events, either as one .ics file (RFC 5545) or as one Google Calendar link each.
 * Dates are converted from Jalali to Gregorian; all-day events and the review's local time
 * are "floating", so every calendar shows them on the same day and hour wherever it is.
 */

export type Reminder = "none" | "same-day" | "day-before" | "week-before";

export interface CalendarOptions {
  deadlines: boolean;
  starts: boolean;
  milestones: boolean;
  review: boolean;
  /** 0 = Saturday … 6 = Friday, as in `weekday`. */
  reviewDay: number;
  /** "HH:MM", local time. */
  reviewTime: string;
  /** When deadlines, starts and milestones remind; the review reminds at its own time. */
  reminder: Reminder;
}

export const CALENDAR_DEFAULTS: CalendarOptions = {
  deadlines: true, starts: false, milestones: true, review: true, reviewDay: 6, reviewTime: "10:00", reminder: "day-before",
};

export type CalendarKind = "due" | "start" | "milestone" | "review";

/** Which option turns each kind of event on. */
export const KIND_OPTION = { due: "deadlines", start: "starts", milestone: "milestones", review: "review" } as const satisfies Record<CalendarKind, keyof CalendarOptions>;

export interface CalendarEvent {
  uid: string;
  kind: CalendarKind;
  title: string;
  /** The day of an all-day event, or the first day of the weekly review. */
  date: JDate;
  /** "HH:MM" for the weekly review; all-day otherwise. */
  time?: string;
  /** The weekly review repeats until this day (inclusive). */
  until?: JDate;
  details: string;
}

const REVIEW_MINUTES = 30;

/**
 * The plan's upcoming events: the weekly review first, then by date. Done items and dates already past are left out:
 * an overdue activity needs a new date before it belongs in a calendar.
 */
export function calendarEvents(plan: Plan, today: JDate, opts: CalendarOptions, appUrl = ""): CalendarEvent[] {
  const reqById = new Map(plan.requirements.map((r) => [r.id, r]));
  const footer = [`از برنامه‌ی «${plan.title || "بدون عنوان"}» در هدف‌نگار`, appUrl].filter(Boolean).join("\n");
  const out: CalendarEvent[] = [];

  for (const a of plan.activities) {
    if (a.status === "done") continue;
    const r = a.requirementId ? reqById.get(a.requirementId) : undefined;
    const details = [
      r ? (r.goal ? `هدف: ${r.goal}` : `الزام: ${r.title}`) : "",
      a.program ? `برنامه: ${a.program}` : "",
      a.start && a.end ? `بازه: ${fmtRange(a.start, a.end)}` : "",
      a.hours ? `زمان لازم: ${faNum(a.hours)} ساعت` : "",
      a.cost ? `هزینه: ${faNum(a.cost)} ${plan.currency}` : "",
      a.owner ? `مسئول: ${a.owner}` : "",
      footer,
    ].filter(Boolean).join("\n");
    if (opts.deadlines && isValidJ(a.end) && a.end >= today) {
      out.push({ uid: `due-${a.id}-${plan.id}@hadafnegar`, kind: "due", title: `موعد: ${a.title}`, date: a.end, details });
    }
    if (opts.starts && isValidJ(a.start) && a.start >= today) {
      out.push({ uid: `start-${a.id}-${plan.id}@hadafnegar`, kind: "start", title: `شروع: ${a.title}`, date: a.start, details });
    }
  }

  if (opts.milestones) {
    for (const m of plan.milestones) {
      if (m.done || !m.title.trim() || !isValidJ(m.date) || m.date < today) continue;
      out.push({ uid: `milestone-${m.id}-${plan.id}@hadafnegar`, kind: "milestone", title: `نقطه عطف: ${m.title}`, date: m.date, details: footer });
    }
  }

  if (opts.review) {
    const first = addDays(today, (opts.reviewDay - weekday(today) + 7) % 7);
    const until = isValidJ(plan.end) ? plan.end : undefined;
    if (!until || first <= until) {
      out.push({
        uid: `review-${plan.id}@hadafnegar`, kind: "review", title: `بازبینی هفتگی: ${plan.title || "هدف‌نگار"}`,
        date: first, time: opts.reviewTime, until,
        details: [`حدود ${faDigits(REVIEW_MINUTES)} دقیقه: پیشرفت فعالیت‌ها را به‌روز کنید، بار کاری هفته‌ی بعد را ببینید و تمرکز هفته را بنویسید.`, footer].join("\n"),
      });
    }
  }

  const order: CalendarKind[] = ["review", "milestone", "start", "due"];
  const rank = (e: CalendarEvent) => (e.kind === "review" ? 0 : 1);
  return out.sort((x, y) => rank(x) - rank(y) || x.date.localeCompare(y.date) || order.indexOf(x.kind) - order.indexOf(y.kind));
}

/** Activities left out of the calendar because their end date has passed. */
export const overdueCount = (plan: Plan, today: JDate) => plan.activities.filter((a) => isOverdue(a, today)).length;

// ---------- formats ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYYMMDD" (Gregorian) for a Jalali date. */
export function gregorian(j: JDate): string {
  const d = new Date(dayNumber(j) * 86_400_000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

const clock = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  const h = m ? Math.min(23, +m[1]) : 10, min = m ? Math.min(59, +m[2]) : 0;
  return h * 60 + min;
};
/** Local "YYYYMMDDTHHMMSS" at `minutes` past the start of day `j` (may roll into the next day). */
const localStamp = (j: JDate, minutes: number) =>
  `${gregorian(addDays(j, Math.floor(minutes / 1440)))}T${pad(Math.floor((minutes % 1440) / 60))}${pad(minutes % 60)}00`;

const rrule = (e: CalendarEvent) => `RRULE:FREQ=WEEKLY${e.until ? `;UNTIL=${gregorian(e.until)}T235959` : ""}`;

/** Reminder offsets from the start (00:00) of an all-day event, at 9 in the morning. */
const TRIGGER: Record<Exclude<Reminder, "none">, string> = { "same-day": "PT9H", "day-before": "-PT15H", "week-before": "-P6DT15H" };

const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a content line at 75 octets without splitting a UTF-8 character (RFC 5545 §3.1). */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "", size = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > limit) { parts.push(cur); cur = ""; size = 0; limit = 74; } // continuation lines start with a space
    cur += ch;
    size += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function toIcs(plan: Plan, events: CalendarEvent[], reminder: Reminder, appUrl = "", now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hadafnegar//FA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`هدف‌نگار: ${plan.title || "بدون عنوان"}`)}`,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`, `SUMMARY:${escapeText(e.title)}`, `DESCRIPTION:${escapeText(e.details)}`);
    if (e.time) {
      lines.push(`DTSTART:${localStamp(e.date, clock(e.time))}`, `DURATION:PT${REVIEW_MINUTES}M`, rrule(e));
    } else {
      // A deadline marks a day; it doesn't block time in the calendar.
      lines.push(`DTSTART;VALUE=DATE:${gregorian(e.date)}`, `DTEND;VALUE=DATE:${gregorian(addDays(e.date, 1))}`, "TRANSP:TRANSPARENT");
    }
    if (appUrl) lines.push(`URL:${appUrl}`);
    if (reminder !== "none") {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:${e.time ? "PT0S" : TRIGGER[reminder]}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A link that opens Google Calendar with the event filled in, ready to save. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, details: e.details });
  if (e.time) {
    const start = clock(e.time);
    q.set("dates", `${localStamp(e.date, start)}/${localStamp(e.date, start + REVIEW_MINUTES)}`);
    q.set("recur", rrule(e));
  } else {
    q.set("dates", `${gregorian(e.date)}/${gregorian(addDays(e.date, 1))}`);
  }
  return `https://calendar.google.com/calendar/render?${q}`;
}
