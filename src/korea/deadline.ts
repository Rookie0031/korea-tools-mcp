// 민법 기간 계산(제155~161조). 기간이 법령·계약에 따로 정해져 있지 않을 때의 기본 규칙이다.
// 157조 초일 불산입(0시부터 시작하면 산입), 159조 말일의 종료로 만료, 160조 주·월·연은 달력으로(해당일 전날, 해당일이 없으면 그 달 말일),
// 161조 말일이 토요일이나 공휴일이면 다음 날 만료. 일요일은 관공서 공휴일이다.

import { dayInfo, DateError } from "./dates";

export type Unit = "day" | "week" | "month" | "year";

const toDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new DateError(`date must be YYYY-MM-DD, got "${s}"`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1) throw new DateError(`no such date: ${s}`);
  return d;
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);

/** 기산일 b에서 n개월 뒤 같은 날의 전날. 해당일이 없으면(1/31 → 2월) 그 달 말일 */
function monthsEnd(b: Date, n: number): Date {
  const y = b.getUTCFullYear();
  const m = b.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  if (b.getUTCDate() > last) return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), last));
  return addDays(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), b.getUTCDate())), -1);
}

export function legalDeadline(event: string, amount: number, unit: Unit, startsAtMidnight = false, extraClosed: Set<string> = new Set()) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 3650) throw new DateError("amount must be an integer from 1 to 3650");
  if (!["day", "week", "month", "year"].includes(unit)) throw new DateError("unit must be day, week, month or year");
  const e = toDate(event);
  const first = startsAtMidnight ? e : addDays(e, 1);
  let end: Date;
  if (unit === "day") end = addDays(first, amount - 1);
  else if (unit === "week") end = addDays(first, amount * 7 - 1);
  else end = monthsEnd(first, unit === "month" ? amount : amount * 12);
  const raw = fmt(end);
  const extended: { date: string; reason: string }[] = [];
  let d = end;
  // 161조: 말일이 토요일·공휴일(일요일 포함)이면 다음 날. 연휴면 이어서 민다
  for (;;) {
    const info = dayInfo(fmt(d), extraClosed);
    const wd = d.getUTCDay();
    if (wd !== 6 && wd !== 0 && info.holidays.length === 0 && !extraClosed.has(info.date)) break;
    extended.push({ date: info.date, reason: info.holidays.length ? info.holidays.join(", ") : wd === 6 ? "Saturday" : wd === 0 ? "Sunday" : "extra closed day" });
    d = addDays(d, 1);
  }
  return {
    event_date: event,
    period: `${amount} ${unit}${amount > 1 ? "s" : ""}`,
    first_day_counted: fmt(first),
    first_day_rule: startsAtMidnight ? "starts at 00:00, so the first day counts (Civil Act art. 157 proviso)" : "first day not counted (Civil Act art. 157)",
    nominal_last_day: raw,
    deadline: fmt(d),
    deadline_weekday: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()],
    extended_over: extended,
    expires: `end of ${fmt(d)} (24:00 KST)`,
  };
}
