// 한국 영업일 계산. 영업일 = 토·일·공휴일(HOLIDAYS)이 아닌 날. 날짜는 모두 "YYYY-MM-DD" 글자로 받고 돌려준다.
// 시간대는 한국(KST, UTC+9) 기준이다. 표에 없는 연도는 틀린 답을 내지 않도록 오류로 돌려준다.

import { HOLIDAYS } from "./holidays";

export const YEARS = [...new Set(Object.keys(HOLIDAYS).map((d) => +d.slice(0, 4)))].sort();
export const FIRST_YEAR = YEARS[0];
export const LAST_YEAR = YEARS[YEARS.length - 1];

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export class DateError extends Error {}

/** 오늘(한국 시간) */
export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function toUtc(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new DateError(`date must be YYYY-MM-DD, got "${s}"`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1) throw new DateError(`no such date: ${s}`);
  return d;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inRange(s: string) {
  const y = +s.slice(0, 4);
  if (y < FIRST_YEAR || y > LAST_YEAR) {
    throw new DateError(`holiday data covers ${FIRST_YEAR}-${LAST_YEAR} only; ${s} is outside it`);
  }
}

export function normDate(s: string | undefined, now?: Date): string {
  if (s === undefined || s === "" || s === "today") return todayKst(now);
  return fmt(toUtc(s));
}

export interface DayInfo {
  date: string;
  weekday: string;
  weekday_ko: string;
  is_weekend: boolean;
  holidays: string[];
  is_business_day: boolean;
}

export function dayInfo(s: string, extraClosed: Set<string> = new Set()): DayInfo {
  const d = toUtc(s);
  const date = fmt(d);
  inRange(date);
  const wd = d.getUTCDay();
  const holidays = HOLIDAYS[date] ?? [];
  const weekend = wd === 0 || wd === 6;
  return {
    date,
    weekday: WEEKDAY_EN[wd],
    weekday_ko: WEEKDAY_KO[wd],
    is_weekend: weekend,
    holidays,
    is_business_day: !weekend && holidays.length === 0 && !extraClosed.has(date),
  };
}

export function holidaysBetween(from: string, to: string): { date: string; weekday_ko: string; names: string[] }[] {
  const a = fmt(toUtc(from));
  const b = fmt(toUtc(to));
  if (a > b) throw new DateError("from must be on or before to");
  inRange(a);
  inRange(b);
  return Object.keys(HOLIDAYS)
    .filter((d) => d >= a && d <= b)
    .sort()
    .map((d) => ({ date: d, weekday_ko: WEEKDAY_KO[toUtc(d).getUTCDay()], names: HOLIDAYS[d] }));
}

function step(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400_000);
}

/** start에서 영업일 n일 뒤(음수면 앞). start 자체는 세지 않는다 */
export function addBusinessDays(start: string, n: number, extraClosed: Set<string> = new Set()): { date: string; skipped: { date: string; reason: string }[] } {
  if (!Number.isInteger(n) || Math.abs(n) > 3000) throw new DateError("days must be an integer between -3000 and 3000");
  let d = toUtc(start);
  inRange(fmt(d));
  const dir = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  const skipped: { date: string; reason: string }[] = [];
  while (left > 0) {
    d = step(d, dir);
    const info = dayInfo(fmt(d), extraClosed);
    if (info.is_business_day) left--;
    else skipped.push({ date: info.date, reason: info.holidays.length ? info.holidays.join(", ") : info.is_weekend ? info.weekday : "extra closed day" });
  }
  return { date: fmt(d), skipped };
}

/** from과 to 사이 영업일 수. 양 끝을 넣을지 고른다 */
export function countBusinessDays(
  from: string,
  to: string,
  opts: { includeStart?: boolean; includeEnd?: boolean; extraClosed?: Set<string> } = {},
): { business_days: number; calendar_days: number; weekend_days: number; holiday_days: number } {
  const a = toUtc(from);
  const b = toUtc(to);
  if (a > b) throw new DateError("from must be on or before to");
  if ((b.getTime() - a.getTime()) / 86400_000 > 3660) throw new DateError("range must be 10 years or less");
  const extra = opts.extraClosed ?? new Set<string>();
  let business = 0;
  let weekend = 0;
  let holiday = 0;
  let calendar = 0;
  for (let d = a; d <= b; d = step(d, 1)) {
    const s = fmt(d);
    if ((s === fmt(a) && opts.includeStart === false) || (s === fmt(b) && opts.includeEnd === false)) continue;
    const info = dayInfo(s, extra);
    calendar++;
    if (info.is_business_day) business++;
    else if (info.is_weekend) weekend++;
    else holiday++;
  }
  return { business_days: business, calendar_days: calendar, weekend_days: weekend, holiday_days: holiday };
}
