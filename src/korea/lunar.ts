// 한국 음력 ↔ 양력. 한국천문연구원 기준 표를 담은 korean-lunar-calendar(MIT, usingsky)를 쓴다.
// 한국(UTC+9)과 중국(UTC+8)은 삭 시각이 달라 음력 날짜가 하루 어긋나는 해가 있다(예: 2027 설날 한국 2/7, 중국 2/6). 중국 음력 라이브러리로 계산하면 틀린다.

import KoreanLunarCalendar from "korean-lunar-calendar";
import { DateError } from "./dates";

export const LUNAR_RANGE = { solar: ["1000-02-13", "2050-12-31"], lunar: ["1000-01-01", "2050-11-18"] };

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: { year: number; month: number; day: number }) => `${d.year}-${p2(d.month)}-${p2(d.day)}`;

function parse(s: string): [number, number, number] {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) throw new DateError(`date must be YYYY-MM-DD, got "${s}"`);
  return [+m[1], +m[2], +m[3]];
}

function gapja(c: KoreanLunarCalendar) {
  const g = c.getKoreanGapja();
  return [g.year, g.month, g.day, g.intercalation].filter(Boolean).join(" ");
}

export function solarToLunar(solar: string) {
  const [y, m, d] = parse(solar);
  const c = new KoreanLunarCalendar();
  if (!c.setSolarDate(y, m, d)) throw new DateError(`solar date out of range or invalid: ${solar} (supported ${LUNAR_RANGE.solar.join(" to ")})`);
  const l = c.getLunarCalendar();
  return {
    solar: ymd(c.getSolarCalendar()),
    lunar: ymd(l),
    leap_month: !!l.intercalation,
    lunar_text: `음력 ${l.year}년 ${l.intercalation ? "윤" : ""}${l.month}월 ${l.day}일`,
    gapja: gapja(c),
  };
}

export function lunarToSolar(lunar: string, leap = false) {
  const [y, m, d] = parse(lunar);
  const c = new KoreanLunarCalendar();
  if (!c.setLunarDate(y, m, d, leap)) {
    // 작은달(29일)에 30일을 넣었거나, 그해에 그 윤달이 없는 경우가 흔하다
    const alt = new KoreanLunarCalendar();
    const hint =
      leap && alt.setLunarDate(y, m, d, false)
        ? ` Year ${y} has no leap month ${m}; try leap_month false.`
        : d === 30 && alt.setLunarDate(y, m, 29, leap)
          ? ` Lunar month ${m} of ${y} has only 29 days; many families use day 29 in that case.`
          : "";
    throw new DateError(`no such lunar date: ${lunar}${leap ? " (leap)" : ""}.${hint} Supported ${LUNAR_RANGE.lunar.join(" to ")}.`);
  }
  const s = c.getSolarCalendar();
  const date = ymd(s);
  return {
    lunar: `${lunar}${leap ? " (leap)" : ""}`,
    lunar_text: `음력 ${y}년 ${leap ? "윤" : ""}${m}월 ${d}일`,
    solar: date,
    weekday_ko: "일월화수목금토"[new Date(`${date}T00:00:00Z`).getUTCDay()],
    gapja: gapja(c),
  };
}
