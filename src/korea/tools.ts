// Korea Tools MCP 서버의 도구 목록. 규칙은 src/lib/에 있다(tools.thequokkacompany.com 웹 도구와 같은 코드).
// 도구는 모두 읽기 전용이고 바깥으로 요청을 보내지 않는다. 입력값은 저장하지 않는다.

import { formatPhone, formatBiz, bizValid, type PhoneStyle } from "../lib/phone";
import { splitAddress, splitDetail } from "../lib/address";
import { splitName } from "../lib/name";
import { fromRrn, fromDate, manAge, birthText } from "../lib/age";
import { maskName, maskPhone, maskRrn, maskEmail } from "../lib/mask";
import { addBusinessDays, countBusinessDays, dayInfo, holidaysBetween, normDate, todayKst, FIRST_YEAR, LAST_YEAR, DateError } from "./dates";
import { DATA_SOURCE, DATA_UPDATED } from "./holidays";
import { toKorean, fromKorean, AmountError, checkText, checkPair } from "./amount";
import { legalDeadline, type Unit } from "./deadline";
import { countText } from "./text";
import { resolveRelative } from "./relative";
import { solarToLunar, lunarToSolar, LUNAR_RANGE } from "./lunar";
import type { ToolDef } from "../mcp";

/** 도구 안에서 던지면 isError 결과로 돌려준다(모델이 고쳐서 다시 부를 수 있게) */
export class InputError extends Error {}

const MAX_ITEMS = 1000;

function list(v: unknown, name: string): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new InputError(`${name} must be a non-empty array of strings`);
  if (v.length > MAX_ITEMS) throw new InputError(`${name} may hold at most ${MAX_ITEMS} items per call`);
  return v.map((x) => String(x ?? ""));
}

function closedSet(v: unknown): Set<string> {
  if (v === undefined) return new Set();
  if (!Array.isArray(v)) throw new InputError("extra_closed_dates must be an array of YYYY-MM-DD strings");
  return new Set(v.map((x) => normDate(String(x))));
}

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DATE = { type: "string", description: "YYYY-MM-DD. Omit for today in Korea (KST)." };
const EXTRA = {
  type: "array",
  items: { type: "string" },
  description: "Optional extra non-working dates (YYYY-MM-DD), e.g. company holidays.",
};
export const COVER = `Holiday data covers ${FIRST_YEAR}-${LAST_YEAR} (source: KASI; updated ${DATA_UPDATED}). It includes substitute holidays and election days, and the 2026 additions Labor Day (May 1) and Constitution Day (Jul 17).`;

export const TOOLS: ToolDef[] = [
  {
    name: "kr_holidays",
    title: "Korean public holidays",
    description: `List South Korean public holidays (공휴일) for a year or a date range, with Korean names. ${COVER}`,
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: `Year ${FIRST_YEAR}-${LAST_YEAR}. Ignored if from/to are given.` },
        from: { type: "string", description: "Range start YYYY-MM-DD" },
        to: { type: "string", description: "Range end YYYY-MM-DD" },
      },
    },
    annotations: RO,
    run(a) {
      let from: string, to: string;
      if (a.from || a.to) {
        from = normDate(String(a.from ?? a.to));
        to = normDate(String(a.to ?? a.from));
      } else {
        const y = a.year === undefined ? +todayKst().slice(0, 4) : Number(a.year);
        if (!Number.isInteger(y)) throw new InputError("year must be an integer");
        from = `${y}-01-01`;
        to = `${y}-12-31`;
      }
      const holidays = holidaysBetween(from, to);
      return { from, to, count: holidays.length, holidays, source: DATA_SOURCE, data_updated: DATA_UPDATED };
    },
  },
  {
    name: "kr_business_day",
    title: "Is it a Korean business day?",
    description: `Check whether a date is a business day in South Korea (not a weekend and not a public holiday), and give the previous and next business days. ${COVER}`,
    inputSchema: { type: "object", properties: { date: DATE, extra_closed_dates: EXTRA } },
    annotations: RO,
    run(a) {
      const extra = closedSet(a.extra_closed_dates);
      const date = normDate(a.date as string | undefined);
      const info = dayInfo(date, extra);
      return {
        ...info,
        today_kst: todayKst(),
        previous_business_day: addBusinessDays(date, -1, extra).date,
        next_business_day: addBusinessDays(date, 1, extra).date,
      };
    },
  },
  {
    name: "kr_add_business_days",
    title: "Add Korean business days",
    description: `Move forward (or back, with negative days) a number of South Korean business days from a start date, skipping weekends and public holidays. The start date itself is not counted. Use for deadlines like "within 7 business days". ${COVER}`,
    inputSchema: {
      type: "object",
      properties: {
        start: DATE,
        days: { type: "integer", description: "Business days to add; negative goes back." },
        extra_closed_dates: EXTRA,
      },
      required: ["days"],
    },
    annotations: RO,
    run(a) {
      const extra = closedSet(a.extra_closed_dates);
      const start = normDate(a.start as string | undefined);
      const days = Number(a.days);
      const r = addBusinessDays(start, days, extra);
      return { start, days, result: r.date, result_info: dayInfo(r.date, extra), skipped_days: r.skipped };
    },
  },
  {
    name: "kr_count_business_days",
    title: "Count Korean business days",
    description: `Count South Korean business days between two dates (both ends included by default). Also returns weekend and weekday-holiday counts. ${COVER}`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start YYYY-MM-DD" },
        to: { type: "string", description: "End YYYY-MM-DD" },
        include_start: { type: "boolean", description: "Count the start date (default true)" },
        include_end: { type: "boolean", description: "Count the end date (default true)" },
        extra_closed_dates: EXTRA,
      },
      required: ["from", "to"],
    },
    annotations: RO,
    run(a) {
      const from = normDate(String(a.from));
      const to = normDate(String(a.to));
      const r = countBusinessDays(from, to, {
        includeStart: a.include_start !== false,
        includeEnd: a.include_end !== false,
        extraClosed: closedSet(a.extra_closed_dates),
      });
      return { from, to, ...r, holidays_in_range: holidaysBetween(from, to) };
    },
  },
  {
    name: "kr_amount_to_korean",
    title: "Number to Korean amount words",
    description:
      'Write a won amount in Korean words exactly: reading form ("백이십삼만 사천오백육십칠 원", spaced every 만 per Korean orthography), contract/receipt form ("일금 일백이십삼만사천오백육십칠원정"), and mixed form ("123만 4,567원"). Whole numbers below 10^20.',
    inputSchema: {
      type: "object",
      properties: { amount: { type: ["string", "integer"], description: "Whole number; commas allowed, e.g. \"1,234,567\"" } },
      required: ["amount"],
    },
    annotations: RO,
    run(a) {
      return toKorean(a.amount as string | number);
    },
  },
  {
    name: "kr_korean_to_amount",
    title: "Korean amount words to number",
    description:
      'Read a Korean money expression as an exact number: "1억 2천만 원", "삼백오십만원", "일금 일백만원정", "2.5억", "12만3천". Returns digits and comma form.',
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Korean amount text" } },
      required: ["text"],
    },
    annotations: RO,
    run(a) {
      return { text: String(a.text ?? ""), ...fromKorean(String(a.text ?? "")) };
    },
  },
  {
    name: "kr_business_number_check",
    title: "Check Korean business registration numbers",
    description:
      "Validate the format and check digit of South Korean business registration numbers (사업자등록번호, 10 digits, NTS weights 1,3,7,1,3,7,1,3,5) and format them as 123-45-67890. This is an offline checksum test only: it does not tell whether the business is open or closed.",
    inputSchema: {
      type: "object",
      properties: { numbers: { type: "array", items: { type: "string" }, description: "Up to 1000 numbers, any punctuation" } },
      required: ["numbers"],
    },
    annotations: RO,
    run(a) {
      const results = list(a.numbers, "numbers").map((input) => {
        const formatted = formatBiz(input);
        const digits = formatted?.replace(/\D/g, "") ?? null;
        return { input, formatted, valid: digits ? bizValid(digits) : false, reason: digits ? (bizValid(digits) ? null : "check digit mismatch") : "not 10 digits" };
      });
      return { count: results.length, valid_count: results.filter((r) => r.valid).length, results };
    },
  },
  {
    name: "kr_age",
    title: "Korean age (만 나이)",
    description:
      "Compute international age (만 나이, the legal standard in Korea since June 2023) and year age (연 나이, used by the Youth Protection Act and military service) on a reference date. Input a birth date, or the first 7 digits of a resident registration number (YYMMDD-G) to also get sex and century. Feb 29 birthdays turn a year older on Mar 1 in common years. The input is not stored.",
    inputSchema: {
      type: "object",
      properties: {
        birth: { type: "string", description: "1990-01-02, 19900102, 900102, or RRN front 900102-1" },
        on: DATE,
      },
      required: ["birth"],
    },
    annotations: RO,
    run(a) {
      const raw = String(a.birth ?? "").trim();
      const on = normDate(a.on as string | undefined);
      const [y, m, d] = on.split("-").map(Number);
      const b = (/^\d{6}\s*-?\s*\d/.test(raw) ? fromRrn(raw) : null) ?? fromDate(raw, y);
      if (!b) throw new InputError(`cannot read birth date "${raw.slice(0, 8)}…"`);
      const man = manAge(b, { y, m, d });
      if (man === null) throw new InputError("reference date is before the birth date");
      return {
        birth_date: birthText(b),
        on,
        man_age: man,
        year_age: y - b.y,
        traditional_korean_age: y - b.y + 1,
        sex: b.sex === "남" ? "male" : b.sex === "여" ? "female" : null,
        foreign_registration: b.foreign ?? null,
      };
    },
  },
  {
    name: "kr_phone_format",
    title: "Normalize Korean phone numbers",
    description:
      "Normalize South Korean phone numbers (mobile 010, Seoul 02, regional 031-064, 070, 050x safe numbers, 15xx/16xx/18xx company numbers) to one style. Restores a leading 0 dropped by Excel, converts +82, keeps extensions. Unknown shapes return null.",
    inputSchema: {
      type: "object",
      properties: {
        numbers: { type: "array", items: { type: "string" }, description: "Up to 1000 numbers" },
        style: { type: "string", enum: ["hyphen", "digits", "intl"], description: "hyphen 010-1234-5678 (default), digits 01012345678, intl +82 10-1234-5678" },
      },
      required: ["numbers"],
    },
    annotations: RO,
    run(a) {
      const style = (["hyphen", "digits", "intl"].includes(String(a.style)) ? a.style : "hyphen") as PhoneStyle;
      const results = list(a.numbers, "numbers").map((input) => ({ input, formatted: formatPhone(input, style) }));
      return { style, count: results.length, unrecognized: results.filter((r) => !r.formatted).length, results };
    },
  },
  {
    name: "kr_address_split",
    title: "Split Korean addresses",
    description:
      "Split South Korean addresses into province/city (시도, normalized to the official name such as 서울특별시), district (시군구, including 일반구 like 수원시 영통구), base address (road name + building number) and detail (unit). Handles leading postal codes and addresses written without spaces. Rule-based; does not look up a database.",
    inputSchema: {
      type: "object",
      properties: { addresses: { type: "array", items: { type: "string" }, description: "Up to 1000 addresses" } },
      required: ["addresses"],
    },
    annotations: RO,
    run(a) {
      const results = list(a.addresses, "addresses").map((input) => {
        const r = splitAddress(input);
        if (!r) return { input, sido: null, sigungu: null, base: null, detail: null };
        const [base, detail] = splitDetail(r.rest);
        return { input, sido: r.sido || null, sigungu: r.sigungu || null, base: base || null, detail: detail || null };
      });
      return { count: results.length, results };
    },
  },
  {
    name: "kr_name_split",
    title: "Split Korean names",
    description:
      "Split Korean full names into family name and given name, recognizing two-character surnames (남궁, 황보, 제갈, 선우 …). Flags names that are ambiguous from the characters alone (선우진 = 선 + 우진 or 선우 + 진). Latin-script names use the last word as family name.",
    inputSchema: {
      type: "object",
      properties: { names: { type: "array", items: { type: "string" }, description: "Up to 1000 names" } },
      required: ["names"],
    },
    annotations: RO,
    run(a) {
      const results = list(a.names, "names").map((input) => {
        const r = splitName(input);
        return r ? { input, family: r.family, given: r.given, ambiguous: r.unsure } : { input, family: null, given: null, ambiguous: false };
      });
      return { count: results.length, results };
    },
  },
  {
    name: "kr_mask_pii",
    title: "Mask Korean personal data",
    description:
      "Mask Korean personal data before you store, log or share it. Text mode finds and masks resident registration numbers (900101-1******), phone numbers (010-****-5678), emails (ab****@x.com) and 16-digit card numbers inside free text. Item mode masks given values by kind, including names (홍*동). Nothing is stored or logged.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Free text to scan (up to 100,000 characters)" },
        items: {
          type: "array",
          description: "Values with a known kind (up to 1000)",
          items: {
            type: "object",
            properties: { value: { type: "string" }, kind: { type: "string", enum: ["name", "phone", "rrn", "email"] } },
            required: ["value", "kind"],
          },
        },
      },
    },
    annotations: RO,
    run(a) {
      const out: Record<string, unknown> = {};
      if (typeof a.text === "string") {
        if (a.text.length > 100_000) throw new InputError("text may be at most 100,000 characters");
        out.text_result = maskText(a.text);
      }
      if (a.items !== undefined) {
        if (!Array.isArray(a.items) || a.items.length > MAX_ITEMS) throw new InputError(`items must be an array of at most ${MAX_ITEMS}`);
        const fn = { name: maskName, phone: maskPhone, rrn: maskRrn, email: maskEmail } as Record<string, (v: string) => string>;
        out.items = a.items.map((it: { value?: unknown; kind?: unknown }) => {
          const f = fn[String(it?.kind)];
          if (!f) throw new InputError("each item needs kind: name | phone | rrn | email");
          return { kind: it.kind, masked: f(String(it.value ?? "")) };
        });
      }
      if (!("text_result" in out) && !("items" in out)) throw new InputError("give text or items");
      return out;
    },
  },
  {
    name: "kr_legal_deadline",
    title: "Korean legal deadline (민법 기간 계산)",
    description: `Compute when a period expires under the Korean Civil Act (arts. 155-161), the default rule when a law or contract does not say otherwise: the first day is not counted unless the period starts at 00:00; weeks, months and years follow the calendar and end the day before the corresponding date (or at month end if that date does not exist); if the last day is a Saturday, Sunday or public holiday the deadline moves to the next working day. Use for "within 14 days of receipt", "1 month from notice", contract terms. Not legal advice; some statutes set their own rules. ${COVER}`,
    inputSchema: {
      type: "object",
      properties: {
        event_date: { type: "string", description: "Date of the triggering event (notice received, contract signed), YYYY-MM-DD" },
        amount: { type: "integer", description: "Length of the period" },
        unit: { type: "string", enum: ["day", "week", "month", "year"] },
        starts_at_midnight: { type: "boolean", description: "True if the period starts at 00:00 of event_date (e.g. a date fixed in advance); then the first day counts. Default false." },
        extra_closed_dates: EXTRA,
      },
      required: ["event_date", "amount", "unit"],
    },
    annotations: RO,
    run(a) {
      return legalDeadline(normDate(String(a.event_date)), Number(a.amount), String(a.unit) as Unit, a.starts_at_midnight === true, closedSet(a.extra_closed_dates));
    },
  },
  {
    name: "kr_text_count",
    title: "Korean character and byte count",
    description:
      "Count Korean text exactly: characters with and without spaces (as Korean job sites count 자기소개서), lines, words, UTF-8 bytes, NEIS school-record bytes (Hangul 3, ASCII 1), and SMS/LMS bytes with the message type. Models see tokens, not characters, so use this instead of estimating length.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to count (up to 100,000 characters)" } },
      required: ["text"],
    },
    annotations: RO,
    run(a) {
      if (typeof a.text !== "string") throw new InputError("text must be a string");
      if (a.text.length > 100_000) throw new InputError("text may be at most 100,000 characters");
      return countText(a.text);
    },
  },
  {
    name: "kr_relative_date",
    title: "Korean relative date to calendar date",
    description:
      'Turn a Korean relative date expression into an exact date and weekday, counted from a base date in Korea time: 오늘/내일/모레/내일모레/글피, 어제/그제, "3일 뒤", "이틀 후", "2주 후", "한 달 뒤", "3영업일 후", "다음 주 화요일", "지난주 금요일", "이번 주말", "금요일", "다음 달 말일", "이번 달 25일", "내년 3월 1일", "연말". Weeks start on Monday. Also says whether the result is a Korean business day. Use this instead of working out weekdays yourself.',
    inputSchema: {
      type: "object",
      properties: {
        expressions: { type: "array", items: { type: "string" }, description: "Up to 100 Korean expressions" },
        base_date: DATE,
      },
      required: ["expressions"],
    },
    annotations: RO,
    run(a) {
      const base = normDate(a.base_date as string | undefined);
      const items = list(a.expressions, "expressions");
      if (items.length > 100) throw new InputError("expressions may hold at most 100 items per call");
      const results = items.map((e) => {
        try {
          return resolveRelative(e, base);
        } catch (err) {
          if (isUserError(err)) return { expression: e, error: (err as Error).message };
          throw err;
        }
      });
      return { base_date: base, base_weekday_ko: "일월화수목금토"[new Date(`${base}T00:00:00Z`).getUTCDay()], results };
    },
  },
  {
    name: "kr_lunar_convert",
    title: "Korean lunar calendar conversion (음력 ↔ 양력)",
    description: `Convert between the Korean lunar calendar (음력) and the Gregorian calendar using the Korea Astronomy and Space Science Institute standard, with leap months (윤달) and 간지. Korean and Chinese lunar dates differ in some years (2027 Lunar New Year: Korea Feb 7, China Feb 6), so do not use a Chinese lunar library for Korean dates. For a lunar birthday or memorial day (제사) give lunar_month_day and years to get the solar date in each year. With no arguments it returns today's lunar date in Korea. Range: lunar ${LUNAR_RANGE.lunar.join(" to ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        solar_date: { type: "string", description: "Gregorian date YYYY-MM-DD to convert to lunar" },
        lunar_date: { type: "string", description: "Lunar date YYYY-MM-DD to convert to Gregorian" },
        leap_month: { type: "boolean", description: "lunar_date is in a leap month (윤달). Default false." },
        lunar_month_day: { type: "string", description: "Lunar MM-DD repeated every year, e.g. 08-15; use with years" },
        years: { type: "array", items: { type: "integer" }, description: "Years for lunar_month_day (up to 30)" },
      },
    },
    annotations: RO,
    run(a) {
      if (typeof a.solar_date === "string") return solarToLunar(a.solar_date);
      if (typeof a.lunar_date === "string") return lunarToSolar(a.lunar_date, a.leap_month === true);
      if (typeof a.lunar_month_day === "string") {
        const md = /^(\d{1,2})-(\d{1,2})$/.exec(a.lunar_month_day.trim());
        if (!md) throw new InputError("lunar_month_day must be MM-DD");
        const years = a.years === undefined ? [+todayKst().slice(0, 4)] : a.years;
        if (!Array.isArray(years) || years.length === 0 || years.length > 30) throw new InputError("years must be an array of 1-30 integers");
        return {
          lunar_month_day: a.lunar_month_day,
          results: years.map((y: unknown) => {
            try {
              return lunarToSolar(`${Number(y)}-${md[1]}-${md[2]}`, a.leap_month === true);
            } catch (e) {
              if (isUserError(e)) return { year: Number(y), error: (e as Error).message };
              throw e;
            }
          }),
        };
      }
      // 아무것도 안 주면 오늘(한국 시간)의 음력
      return solarToLunar(todayKst());
    },
  },
  {
    name: "kr_amount_check",
    title: "Check Korean amount words against digits",
    description:
      'Find amounts written both in Korean words and in digits in a contract, quote or IOU, e.g. "일금 일백이십삼만원정(₩1,230,000)" or "1,230,000원(금 일백이십삼만원)", and check that the two agree. Mismatches come back with both values and the correct Korean words for the digits. You can also pass explicit pairs. Use before sending or signing a Korean document with amounts.',
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Document text to scan (up to 100,000 characters)" },
        pairs: {
          type: "array",
          description: "Explicit pairs to check (up to 1000)",
          items: { type: "object", properties: { korean: { type: "string" }, number: { type: "string" } }, required: ["korean", "number"] },
        },
      },
    },
    annotations: RO,
    run(a) {
      const results: ReturnType<typeof checkText> = [];
      if (typeof a.text === "string") {
        if (a.text.length > 100_000) throw new InputError("text may be at most 100,000 characters");
        results.push(...checkText(a.text));
      }
      if (a.pairs !== undefined) {
        if (!Array.isArray(a.pairs) || a.pairs.length > MAX_ITEMS) throw new InputError(`pairs must be an array of at most ${MAX_ITEMS}`);
        for (const p of a.pairs as { korean?: unknown; number?: unknown }[]) {
          const raw = String(p?.number ?? "");
          const n = raw.replace(/[₩￦\s원]/g, "");
          // 한 짝이 잘못돼도 나머지는 계속 본다
          if (!/^[0-9][0-9,]*$/.test(n)) {
            results.push({ found: `${String(p?.korean ?? "")} / ${raw}`, korean: String(p?.korean ?? ""), number: raw, korean_value: null, number_value: "", match: false, note: `number must be digits, got "${raw}"` });
            continue;
          }
          results.push(checkPair(String(p?.korean ?? ""), n));
        }
      }
      if (typeof a.text !== "string" && a.pairs === undefined) throw new InputError("give text or pairs");
      return { found: results.length, mismatches: results.filter((r) => !r.match).length, results };
    },
  },
];

function luhn(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

export function maskText(text: string): { masked: string; found: Record<string, number> } {
  const found = { rrn: 0, phone: 0, email: 0, card: 0 };
  let s = text.replace(/(?<!\d)(\d{6})(\s?-\s?)([1-8])(\d{6})(?!\d)/g, (_m, a, sep, g) => {
    found.rrn++;
    return `${a}${sep}${g}******`;
  });
  s = s.replace(/(?<!\d)(\d{4})([- ]?)(\d{4})\2(\d{4})\2(\d{4})(?!\d)/g, (m, a, sep, b, c, d) => {
    if (!luhn(a + b + c + d)) return m;
    found.card++;
    return [a, "****", "****", d].join(sep);
  });
  s = s.replace(/(?<![\d*])(01[016789]|02|0[3-6][1-5]|070|050\d)([-.\s]?)(\d{3,4})([-.\s]?)(\d{4})(?![\d*])/g, (_m, a, s1, b, s2, c) => {
    found.phone++;
    return `${a}${s1}${"*".repeat(b.length)}${s2}${c}`;
  });
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => {
    found.email++;
    return maskEmail(m);
  });
  return { masked: s, found };
}

export function isUserError(e: unknown): boolean {
  return e instanceof InputError || e instanceof DateError || e instanceof AmountError;
}
