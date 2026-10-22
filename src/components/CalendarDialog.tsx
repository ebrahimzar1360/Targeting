import { useMemo, useState } from "react";
import { CalendarClock, Download, ExternalLink, Flag, Play, Repeat } from "lucide-react";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Select, buttonClass } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { faDigits, faNum, fmtJ, todayJ } from "@/domain/jalali";
import type { Plan } from "@/domain/schema";
import { CALENDAR_DEFAULTS, KIND_OPTION, calendarEvents, googleCalendarUrl, overdueCount, toIcs } from "@/io/calendar";
import type { CalendarEvent, CalendarKind, CalendarOptions, Reminder } from "@/io/calendar";
import { exportCalendar } from "@/io/files";
import { IS_ARTIFACT, appUrl } from "@/platform";

const DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const KINDS: { kind: CalendarKind; label: string; icon: typeof Flag }[] = [
  { kind: "due", label: "موعد فعالیت‌ها", icon: CalendarClock },
  { kind: "start", label: "شروع فعالیت‌ها", icon: Play },
  { kind: "milestone", label: "نقاط عطف", icon: Flag },
  { kind: "review", label: "بازبینی هفتگی", icon: Repeat },
];
const REMINDERS: { value: Reminder; label: string }[] = [
  { value: "day-before", label: "یک روز قبل، ساعت ۹ صبح" },
  { value: "week-before", label: "یک هفته قبل، ساعت ۹ صبح" },
  { value: "same-day", label: "صبح همان روز، ساعت ۹" },
  { value: "none", label: "بدون یادآور" },
];

/**
 * Sends upcoming deadlines, milestones and the weekly review to the user's calendar.
 * The web build saves one .ics file; claude.ai cannot save .ics files, so there each event
 * gets its own Google Calendar link (also offered on the web, for Google users on a phone).
 */
export function CalendarDialog({ plan, open, onOpenChange }: { plan: Plan; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [opts, setOpts] = useState<CalendarOptions>(CALENDAR_DEFAULTS);
  const today = todayJ();
  const url = appUrl();
  const all = useMemo(() => calendarEvents(plan, today, { ...opts, deadlines: true, starts: true, milestones: true, review: true }, url), [plan, today, opts, url]);
  const events = all.filter((e) => opts[KIND_OPTION[e.kind]]);
  const overdue = overdueCount(plan, today);
  const set = (patch: Partial<CalendarOptions>) => setOpts({ ...opts, ...patch });

  const download = async () => {
    try {
      if ((await exportCalendar(toIcs(plan, events, opts.reminder, url))) === "saved") {
        toast.good("فایل تقویم ذخیره شد؛ بازش کنید تا رویدادها به تقویم اضافه شوند.");
        onOpenChange(false);
      }
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="افزودن به تقویم" size="lg"
      description="موعد فعالیت‌ها، نقاط عطف و یادآور بازبینی هفتگی را به تقویم گوشی یا کامپیوترتان بفرستید تا سر وقت یادآوری شوند."
      footer={IS_ARTIFACT
        ? <Button onClick={() => onOpenChange(false)}>بستن</Button>
        : <>
            <Button onClick={() => onOpenChange(false)}>بعداً</Button>
            <Button variant="primary" disabled={events.length === 0} onClick={download}><Download className="size-4" />دانلود فایل تقویم ({faNum(events.length, 0)} رویداد)</Button>
          </>}
    >
      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">چه چیزهایی به تقویم برود؟</legend>
        {KINDS.map(({ kind, label }) => {
          const n = all.filter((e) => e.kind === kind).length;
          return (
            <label key={kind} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand/50 has-[:checked]:bg-brand-soft/40">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={opts[KIND_OPTION[kind]]}
                onChange={(e) => set({ [KIND_OPTION[kind]]: e.target.checked } as Partial<CalendarOptions>)} />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-ink-3 tabular">{kind === "review" ? (n ? "هر هفته" : "برنامه تمام شده") : faNum(n, 0)}</span>
            </label>
          );
        })}
      </fieldset>

      {opts.review && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="روز بازبینی" htmlFor="cal-day">
            <Select id="cal-day" value={opts.reviewDay} onChange={(e) => set({ reviewDay: +e.target.value })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </Field>
          <Field label="ساعت" htmlFor="cal-time">
            <Input id="cal-time" type="time" dir="ltr" value={opts.reviewTime} onChange={(e) => e.target.value && set({ reviewTime: e.target.value })} />
          </Field>
        </div>
      )}

      {!IS_ARTIFACT && (
        <Field label="یادآور موعدها و نقاط عطف" htmlFor="cal-reminder" className="mt-3"
          hint={opts.review && opts.reminder !== "none" ? "یادآور بازبینی هفتگی سر همان ساعت می‌آید." : undefined}>
          <Select id="cal-reminder" value={opts.reminder} onChange={(e) => set({ reminder: e.target.value as Reminder })}>
            {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
      )}

      {overdue > 0 && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[13px] leading-6 text-warning-ink">
          {faNum(overdue, 0)} فعالیت عقب‌افتاده به تقویم نمی‌رود، چون موعدش گذشته است. اول تاریخ آن‌ها را در «برنامه عملیاتی» واقع‌بینانه کنید.
        </p>
      )}

      {IS_ARTIFACT ? (
        <>
          <p className="mt-4 text-[13px] leading-6 text-ink-2">
            در claude.ai ساختن فایل تقویم ممکن نیست؛ هر مورد را با دکمه‌ی «افزودن» در Google Calendar ذخیره کنید.
            برای گرفتن همه در یک فایل (برای تقویم آیفون یا Outlook)، پشتیبان برنامه را در نسخه‌ی وب وارد کنید.
          </p>
          <EventList events={events} opts={opts} />
        </>
      ) : (
        <>
          <p className="mt-4 text-[13px] leading-6 text-ink-2">
            فایل را باز کنید تا به تقویم آیفون، مک یا Outlook اضافه شود. در Google Calendar از کامپیوتر وارد کنید:
            تنظیمات ← «وارد کردن و صادر کردن» (Import).
          </p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-2">یا تک‌تک به Google Calendar (مناسب گوشی)</summary>
            <EventList events={events} opts={opts} />
          </details>
        </>
      )}
    </Modal>
  );
}

function EventList({ events, opts }: { events: CalendarEvent[]; opts: CalendarOptions }) {
  if (events.length === 0) return <p className="mt-3 text-sm text-ink-3">موردی برای تقویم نیست.</p>;
  return (
    <ul className="scrollbar-thin mt-3 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line" aria-label="رویدادها">
      {events.map((e) => {
        const Icon = KINDS.find((k) => k.kind === e.kind)!.icon;
        return (
          <li key={e.uid} className="flex items-center gap-3 px-3 py-2">
            <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{e.title}</div>
              <div className="text-xs text-ink-3">{e.time ? `هر ${DAYS[opts.reviewDay]}، ساعت ${faDigits(e.time)}، از ${fmtJ(e.date)}` : fmtJ(e.date)}</div>
            </div>
            <a href={googleCalendarUrl(e)} target="_blank" rel="noreferrer" className={buttonClass("soft", "sm")} aria-label={`افزودن «${e.title}» به Google Calendar`}>
              افزودن<ExternalLink className="size-3.5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
