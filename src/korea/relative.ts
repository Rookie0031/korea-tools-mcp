// 한국어 상대 날짜("내일모레", "글피", "다음 주 화요일", "3영업일 뒤", "다음 달 말일")를 기준일(한국 시간) 기준 날짜로 바꾼다.
// 모델은 날짜에서 요일을 자주 틀린다(QUEUE.md #10 근거). 주는 월요일에 시작한다(이번 주 = 기준일이 든 월~일).

import { addBusinessDays, dayInfo, DateError } from "./dates";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const NATIVE: Record<string, number> = {
  하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 닷새: 5, 엿새: 6, 이레: 7, 여드레: 8, 아흐레: 9, 열흘: 10, 보름: 15,
};
const SINO: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10 };
const COUNTER: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10 };

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
const lastOfMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0));

function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = lastOfMonth(y, m).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/** "3", "삼", "세", "열" → 숫자 */
function num(s: string): number | null {
  if (/^\d+$/.test(s)) return +s;
  if (s in SINO) return SINO[s];
  if (s in COUNTER) return COUNTER[s];
  const m = /^([이삼사오육칠팔구])?십([일이삼사오육칠팔구])?$/.exec(s);
  if (m) return (m[1] ? SINO[m[1]] : 1) * 10 + (m[2] ? SINO[m[2]] : 0);
  return null;
}

/** 이번 주 월요일 */
function monday(d: Date): Date {
  return add(d, -((d.getUTCDay() + 6) % 7));
}

export interface Resolved {
  expression: string;
  base_date: string;
  date: string;
  weekday_ko: string;
  is_business_day: boolean | null;
  holidays: string[];
  interpretation: string;
  note?: string;
}

function done(expression: string, base: string, d: Date, interpretation: string, note?: string): Resolved {
  const date = fmt(d);
  let info: ReturnType<typeof dayInfo> | null = null;
  try {
    info = dayInfo(date);
  } catch {
    info = null; // 공휴일 표 밖이면 영업일 여부는 모름
  }
  return {
    expression,
    base_date: base,
    date,
    weekday_ko: WD[d.getUTCDay()],
    is_business_day: info ? info.is_business_day : null,
    holidays: info ? info.holidays : [],
    interpretation,
    ...(note ? { note } : {}),
  };
}

export function resolveRelative(expression: string, base: string): Resolved {
  const raw = expression.trim();
  const s = raw.replace(/\s+/g, "").replace(/(까지|부터|에|쯤|경|날)$/, "");
  const b = toDate(base);
  const D = (d: Date, why: string, note?: string) => done(raw, base, d, why, note);

  const fixed: Record<string, [number, string]> = {
    오늘: [0, "today"], 금일: [0, "today"], 내일: [1, "tomorrow (+1)"], 명일: [1, "tomorrow (+1)"],
    모레: [2, "the day after tomorrow (+2)"], 내일모레: [2, "the day after tomorrow (+2); 내일모레 means 모레"], 낼모레: [2, "the day after tomorrow (+2)"],
    글피: [3, "three days later (+3)"], 그글피: [4, "four days later (+4)"],
    어제: [-1, "yesterday (-1)"], 어저께: [-1, "yesterday (-1)"], 그제: [-2, "two days ago (-2)"], 그저께: [-2, "two days ago (-2)"],
    그끄저께: [-3, "three days ago (-3)"], 그끄제: [-3, "three days ago (-3)"],
  };
  if (s in fixed) return D(add(b, fixed[s][0]), fixed[s][1]);

  // N영업일 후/전
  let m = /^(\S+?)영업일(후|뒤|이후|전|이전)$/.exec(s);
  if (m) {
    const n = num(m[1]);
    if (n === null) throw new DateError(`cannot read number "${m[1]}"`);
    const sign = /전/.test(m[2]) ? -1 : 1;
    const r = addBusinessDays(base, sign * n);
    return D(toDate(r.date), `${n} Korean business days ${sign > 0 ? "after" : "before"} the base date (weekends and public holidays skipped)`);
  }

  // 하루·이틀·사흘·열흘·보름 뒤/전
  m = /^(하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레|열흘|보름)(후|뒤|이후|전|이전|만에)$/.exec(s);
  if (m) {
    const n = NATIVE[m[1]];
    const sign = /전/.test(m[2]) ? -1 : 1;
    return D(add(b, sign * n), `${m[1]} = ${n} day(s) ${sign > 0 ? "after" : "before"}`);
  }

  // N일/주/개월/달/년 후·전
  m = /^(\S+?)(일|주일?|주|개월|달|년)(후|뒤|이후|전|이전)$/.exec(s);
  if (m) {
    const n = num(m[1]);
    if (n === null) throw new DateError(`cannot read number "${m[1]}"`);
    const sign = /전/.test(m[3]) ? -1 : 1;
    const u = m[2];
    if (u === "일") return D(add(b, sign * n), `${n} calendar day(s) ${sign > 0 ? "after" : "before"}`);
    if (u.startsWith("주")) return D(add(b, sign * n * 7), `${n} week(s) ${sign > 0 ? "after" : "before"}`);
    if (u === "년") return D(addMonths(b, sign * n * 12), `${n} year(s) ${sign > 0 ? "after" : "before"} (clamped to month end if the day does not exist)`);
    return D(addMonths(b, sign * n), `${n} month(s) ${sign > 0 ? "after" : "before"} (clamped to month end if the day does not exist)`);
  }

  // (이번|다음|다다음|지난|저번)주 X요일, 주말
  m = /^(이번|금|다음|담|차|다다음|지난|저번|전)?주?(월|화|수|목|금|토|일)요일$/.exec(s);
  if (m && (m[1] || /주/.test(s))) {
    const off = { 이번: 0, 금: 0, 다음: 1, 담: 1, 차: 1, 다다음: 2, 지난: -1, 저번: -1, 전: -1 }[m[1] ?? "이번"] ?? 0;
    const d = add(monday(b), off * 7 + ((WD.indexOf(m[2]) + 6) % 7));
    return D(d, `${m[2]}요일 of ${["last", "this", "next", "the week after next"][off + 1]} week (weeks start on Monday)`);
  }
  m = /^(이번|다음|지난)?주말$/.exec(s);
  if (m) {
    const off = { 이번: 0, 다음: 1, 지난: -1 }[m[1] ?? "이번"]!;
    return D(add(monday(b), off * 7 + 5), `Saturday of ${["last", "this", "next"][off + 1]} week (weekend = Sat-Sun)`, "The weekend also includes the following Sunday.");
  }
  // 요일만: 다가오는 그 요일. 오늘이 그 요일이면 오늘
  m = /^(월|화|수|목|금|토|일)요일$/.exec(s);
  if (m) {
    const diff = (WD.indexOf(m[1]) - b.getUTCDay() + 7) % 7;
    return D(add(b, diff), `the next ${m[1]}요일 on or after the base date`, diff === 0 ? "The base date is that weekday, so it resolves to the base date itself; if the next week was meant, add 7 days." : undefined);
  }

  // 이번 달/다음 달/지난달 + 말(일)/초/N일
  m = /^(이번|이|금|다음|담|지난|저번)?달(말일?|초|(\S+?)일)$/.exec(s.replace(/^월말$/, "이번달말"));
  if (m) {
    const off = { 이번: 0, 이: 0, 금: 0, 다음: 1, 담: 1, 지난: -1, 저번: -1 }[m[1] ?? "이번"] ?? 0;
    const first = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + off, 1));
    if (m[2].startsWith("말")) return D(lastOfMonth(first.getUTCFullYear(), first.getUTCMonth()), "last day of the month");
    if (m[2] === "초") return D(first, "first day of the month", "초 usually means the first few days; this returns the 1st.");
    const n = num(m[3]);
    if (n === null || n < 1 || n > lastOfMonth(first.getUTCFullYear(), first.getUTCMonth()).getUTCDate()) throw new DateError(`no such day: ${raw}`);
    return D(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), n)), `day ${n} of the month`);
  }

  // (올해|내년|작년|내후년) N월 N일 / 연말 / 연초
  m = /^(올해|금년|내년|명년|작년|지난해|내후년)?(?:(\d{1,2})월(\d{1,2})일|(말|연말)|(초|연초))$/.exec(s.replace(/^(올해|내년|작년)?연(말|초)$/, "$1$2"));
  if (m && (m[1] || m[2] || m[4] || m[5])) {
    const off = { 올해: 0, 금년: 0, 내년: 1, 명년: 1, 작년: -1, 지난해: -1, 내후년: 2 }[m[1] ?? "올해"] ?? 0;
    const y = b.getUTCFullYear() + off;
    if (m[4]) return D(new Date(Date.UTC(y, 11, 31)), "December 31");
    if (m[5]) return D(new Date(Date.UTC(y, 0, 1)), "January 1");
    const mo = +m[2];
    const day = +m[3];
    const d = new Date(Date.UTC(y, mo - 1, day));
    if (d.getUTCMonth() !== mo - 1) throw new DateError(`no such date: ${raw}`);
    const note = !m[1] && d < b ? "No year given and the date has passed this year; if the next one was meant, it is a year later." : undefined;
    return D(d, `${mo}/${day} of ${y}`, note);
  }

  throw new DateError(
    `cannot read "${raw}". Supported: 오늘/내일/모레/글피/어제/그제, N일·주·개월·년 후/전, 하루·이틀·사흘·열흘·보름 뒤, N영업일 후, 이번·다음·지난 주 X요일, X요일, 이번·다음 달 말/초/N일, 올해·내년 M월 D일, 연말`,
  );
}
