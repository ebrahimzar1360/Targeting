import { toGregorian, toJalaali, jalaaliMonthLength, isValidJalaaliDate } from "jalaali-js";
import type { JDate } from "./schema";

export const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
/** Saturday-first, as in the Iranian week. */
export const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const DAY_MS = 86_400_000;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Converts Persian/Arabic-Indic digits to Latin and Persian separators to ASCII. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫]/g, ".")
    .replace(/[٬،]/g, ",");
}

export interface JParts { jy: number; jm: number; jd: number }

export function parseJ(j: JDate): JParts | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(j);
  if (!m) return null;
  const jy = +m[1], jm = +m[2], jd = +m[3];
  return isValidJalaaliDate(jy, jm, jd) ? { jy, jm, jd } : null;
}

export const formatJ = ({ jy, jm, jd }: JParts): JDate => `${pad(jy, 4)}/${pad(jm)}/${pad(jd)}`;

export const isValidJ = (j: string) => parseJ(j) !== null;

/** Accepts "1405/7/1", "۱۴۰۵/۰۷/۰۱", "1405-07-01" and returns a canonical JDate or null. */
export function parseLooseJ(s: string): JDate | null {
  const m = /^\s*(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*$/.exec(normalizeDigits(s));
  if (!m) return null;
  const p = { jy: +m[1], jm: +m[2], jd: +m[3] };
  return isValidJalaaliDate(p.jy, p.jm, p.jd) ? formatJ(p) : null;
}

export function fromDate(d: Date): JDate {
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return formatJ({ jy, jm, jd });
}

export const todayJ = (): JDate => fromDate(new Date());

/** Days since 1970-01-01 (UTC) for a Jalali date; the basis for all date arithmetic. */
export function dayNumber(j: JDate): number {
  const p = parseJ(j);
  if (!p) return NaN;
  const g = toGregorian(p.jy, p.jm, p.jd);
  return Math.round(Date.UTC(g.gy, g.gm - 1, g.gd) / DAY_MS);
}

export function fromDayNumber(n: number): JDate {
  const d = new Date(n * DAY_MS);
  const { jy, jm, jd } = toJalaali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return formatJ({ jy, jm, jd });
}

/** b - a in days. */
export const diffDays = (a: JDate, b: JDate) => dayNumber(b) - dayNumber(a);
export const addDays = (j: JDate, n: number) => fromDayNumber(dayNumber(j) + n);

export function addMonths(j: JDate, n: number): JDate {
  const p = parseJ(j);
  if (!p) return j;
  const idx = p.jy * 12 + (p.jm - 1) + n;
  const jy = Math.floor(idx / 12), jm = (idx % 12) + 1;
  return formatJ({ jy, jm, jd: Math.min(p.jd, jalaaliMonthLength(jy, jm)) });
}

export const monthLength = (jy: number, jm: number) => jalaaliMonthLength(jy, jm);
export const endOfMonth = (jy: number, jm: number): JDate => formatJ({ jy, jm, jd: jalaaliMonthLength(jy, jm) });

/** 0 = Saturday … 6 = Friday. */
export function weekday(j: JDate): number {
  const utcDay = new Date(dayNumber(j) * DAY_MS).getUTCDay(); // 0 = Sunday
  return (utcDay + 1) % 7;
}

export const weekStart = (j: JDate) => addDays(j, -weekday(j));

export interface MonthInfo { key: string; jy: number; jm: number; label: string; start: JDate; end: JDate }

export const monthKey = (j: JDate) => j.slice(0, 7).replace("/", "-");

/** Every Jalali month touched by [start, end]. */
export function monthsBetween(start: JDate, end: JDate): MonthInfo[] {
  const a = parseJ(start), b = parseJ(end);
  if (!a || !b) return [];
  const out: MonthInfo[] = [];
  let jy = a.jy, jm = a.jm;
  while (jy * 12 + jm <= b.jy * 12 + b.jm && out.length < 120) {
    out.push({
      key: `${jy}-${pad(jm)}`, jy, jm, label: MONTHS[jm - 1],
      start: formatJ({ jy, jm, jd: 1 }), end: endOfMonth(jy, jm),
    });
    if (++jm > 12) { jm = 1; jy++; }
  }
  return out;
}

// ---------- Display helpers (Persian digits) ----------

const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

export const faNum = (n: number, digits?: 0 | 1) => (Number.isFinite(n) ? (digits === 0 ? nf0 : nf).format(n) : "—");
export const faDigits = (s: string | number) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
export const faPct = (ratio: number) => `${faNum(Math.round(ratio * 100), 0)}٪`;

/** "۱۴ مهر ۱۴۰۵" (long) · "۱۴ مهر" (short) · "۱۴۰۵/۰۷/۱۴" (numeric) */
export function fmtJ(j: JDate, style: "long" | "short" | "numeric" = "long"): string {
  const p = parseJ(j);
  if (!p) return "—";
  if (style === "numeric") return faDigits(j);
  const base = `${faDigits(p.jd)} ${MONTHS[p.jm - 1]}`;
  return style === "short" ? base : `${base} ${faDigits(p.jy)}`;
}

export function fmtRange(a: JDate, b: JDate): string {
  const pa = parseJ(a), pb = parseJ(b);
  if (!pa || !pb) return `${fmtJ(a, "short")} تا ${fmtJ(b, "short")}`;
  if (pa.jy === pb.jy) return `${fmtJ(a, "short")} تا ${fmtJ(b, "long")}`;
  return `${fmtJ(a)} تا ${fmtJ(b)}`;
}

/** "امروز" · "فردا" · "۳ روز دیگر" · "۲ روز پیش" */
export function relDays(n: number): string {
  if (n === 0) return "امروز";
  if (n === 1) return "فردا";
  if (n === -1) return "دیروز";
  return n > 0 ? `${faNum(n, 0)} روز دیگر` : `${faNum(-n, 0)} روز پیش`;
}
