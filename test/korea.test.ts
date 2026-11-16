/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { addBusinessDays, countBusinessDays, dayInfo, holidaysBetween, todayKst } from "../src/korea/dates";
import { toKorean, fromKorean } from "../src/korea/amount";
import { TOOLS, maskText } from "../src/korea/tools";
import { handleMcp } from "../src/mcp";
import worker, { KOREA } from "../src/index";
import { pageSource, uaLabel } from "../src/usage";
import { deadlinesGuide, sitemap } from "../src/pages";

const tool = (n: string) => TOOLS.find((t) => t.name === n)!;

describe("영업일", () => {
  it("2026 노동절·제헌절은 공휴일", () => {
    expect(dayInfo("2026-05-01").is_business_day).toBe(false);
    expect(dayInfo("2026-05-01").holidays).toEqual(["노동절"]);
    expect(dayInfo("2026-07-17").holidays).toEqual(["제헌절"]);
    expect(dayInfo("2025-05-01").is_business_day).toBe(true); // 2025년엔 공휴일 아님
  });
  it("추석 연휴를 건너뛴다", () => {
    // 9/23(수) + 3 영업일: 9/24~26 추석, 9/27 일요일 → 9/28·29·30
    const r = addBusinessDays("2026-09-23", 3);
    expect(r.date).toBe("2026-09-30");
    expect(r.skipped.map((s) => s.date)).toEqual(["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  });
  it("뒤로 가기", () => {
    expect(addBusinessDays("2026-03-03", -1).date).toBe("2026-02-27"); // 3/2 대체공휴일, 3/1 일요일
  });
  it("영업일 수", () => {
    const r = countBusinessDays("2026-10-01", "2026-10-31");
    // 10월 평일 22일 − 개천절 대체(10/5) − 한글날(10/9) = 20
    expect(r.business_days).toBe(20);
    expect(r.calendar_days).toBe(31);
  });
  it("회사 휴무일", () => {
    expect(dayInfo("2026-11-13", new Set(["2026-11-13"])).is_business_day).toBe(false);
  });
  it("표 밖 연도는 오류", () => {
    expect(() => dayInfo("2030-01-02")).toThrow(/covers/);
  });
  it("2026 공휴일 수", () => {
    expect(holidaysBetween("2026-01-01", "2026-12-31")).toHaveLength(22);
  });
  it("오늘(KST)", () => {
    expect(todayKst(new Date("2026-11-12T15:30:00Z"))).toBe("2026-11-13");
  });
});

describe("금액", () => {
  it("한글로", () => {
    const r = toKorean("1,234,567");
    expect(r.reading).toBe("백이십삼만 사천오백육십칠");
    expect(r.formal).toBe("일금 일백이십삼만사천오백육십칠원정");
    expect(r.mixed).toBe("123만 4,567원");
    expect(toKorean(10000).reading).toBe("만");
    expect(toKorean(100000000).reading).toBe("일억");
    expect(toKorean(110010000).reading).toBe("일억 천일만");
    expect(toKorean(0).reading).toBe("영");
    expect(toKorean("1000000000000").formal).toBe("일금 일조원정");
  });
  it("숫자로", () => {
    expect(fromKorean("1억 2천만 원").amount).toBe("120000000");
    expect(fromKorean("삼백오십만원").amount).toBe("3500000");
    expect(fromKorean("일금 일백만원정(₩1,000,000)").amount).toBe("1000000");
    expect(fromKorean("2.5억").amount).toBe("250000000");
    expect(fromKorean("12만3천").amount).toBe("123000");
    expect(fromKorean("만").amount).toBe("10000");
    expect(fromKorean("천만").amount).toBe("10000000");
    expect(fromKorean("백이십삼만 사천오백육십칠").amount).toBe("1234567");
    expect(() => fromKorean("1.5원")).toThrow();
  });
  it("오가기", () => {
    for (const n of [1, 15, 101, 1001, 10001, 99999999, 1234567890123]) {
      expect(fromKorean(toKorean(n).reading).amount).toBe(String(n));
      expect(fromKorean(toKorean(n).formal).amount).toBe(String(n));
    }
  });
});

describe("도구", () => {
  it("사업자번호", () => {
    const r = tool("kr_business_number_check").run({ numbers: ["220-81-62517", "1234567890", "12"] }) as { results: { valid: boolean }[] };
    expect(r.results.map((x) => x.valid)).toEqual([true, false, false]);
  });
  it("만 나이", () => {
    const r = tool("kr_age").run({ birth: "2000-02-29", on: "2026-02-28" }) as { man_age: number; year_age: number };
    expect(r.man_age).toBe(25);
    expect(r.year_age).toBe(26);
    const s = tool("kr_age").run({ birth: "010203-4", on: "2026-11-12" }) as { birth_date: string; sex: string };
    expect(s.birth_date).toBe("2001-02-03");
    expect(s.sex).toBe("female");
  });
  it("글 속 개인정보 가리기", () => {
    const r = maskText("연락처 010-1234-5678, 주민 900101-1234567, 메일 abcdef@gmail.com, 카드 4111 1111 1111 1111");
    expect(r.masked).toBe("연락처 010-****-5678, 주민 900101-1******, 메일 ab****@gmail.com, 카드 4111 **** **** 1111");
    expect(r.found).toEqual({ rrn: 1, phone: 1, email: 1, card: 1 });
  });
  it("주소·전화·이름", () => {
    const a = tool("kr_address_split").run({ addresses: ["(06236) 서울 강남구 테헤란로 152 강남파이낸스센터 10층"] }) as { results: Record<string, string>[] };
    expect(a.results[0]).toMatchObject({ sido: "서울특별시", sigungu: "강남구", base: "테헤란로 152", detail: "강남파이낸스센터 10층" });
    const p = tool("kr_phone_format").run({ numbers: ["+82 10 1234 5678", "1012345678"] }) as { results: { formatted: string }[] };
    expect(p.results.map((x) => x.formatted)).toEqual(["010-1234-5678", "010-1234-5678"]);
    const n = tool("kr_name_split").run({ names: ["남궁민수", "선우진"] }) as { results: { family: string; ambiguous: boolean }[] };
    expect(n.results[0].family).toBe("남궁");
    expect(n.results[1].ambiguous).toBe(true);
  });
});

describe("MCP", () => {
  const h = { beforeCall: async () => null, afterCall: () => {}, onInitialize: () => {}, isUserError: () => true };
  const post = (body: unknown) => handleMcp(new Request("https://x/korea", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), KOREA, h);

  it("initialize → tools/list → tools/call", async () => {
    const init = await (await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "t" } } })).json() as any;
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect((await post({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    const list = await (await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json() as any;
    expect(list.result.tools.length).toBe(TOOLS.length);
    const call = await (await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "kr_business_day", arguments: { date: "2026-05-01" } } })).json() as any;
    expect(call.result.structuredContent.is_business_day).toBe(false);
  });
  it("잘못된 입력은 isError", async () => {
    const r = await (await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "kr_business_day", arguments: { date: "2026-13-01" } } })).json() as any;
    expect(r.result.isError).toBe(true);
  });
  it("한도 초과 글", async () => {
    const blocked = { ...h, beforeCall: async () => "limit" };
    const res = await handleMcp(new Request("https://x/korea", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "kr_holidays", arguments: {} } }) }), KOREA, blocked);
    const j = await res.json() as any;
    expect(j.result.isError).toBe(true);
    expect(j.result.content[0].text).toBe("limit");
  });
  it("GET은 405", async () => {
    expect((await handleMcp(new Request("https://x/korea"), KOREA, h)).status).toBe(405);
  });
});

describe("민법 기간", () => {
  const dl = (e: string, n: number, u: "day" | "week" | "month" | "year", mid = false) => tool("kr_legal_deadline").run({ event_date: e, amount: n, unit: u, starts_at_midnight: mid }) as any;
  it("초일 불산입 + 말일 공휴일이면 다음 날", () => {
    // 4/16(목) 수령 + 14일: 4/17부터 세어 4/30(목) 만료
    expect(dl("2026-04-16", 14, "day").deadline).toBe("2026-04-30");
    // 4/17(금) + 14일: 5/1(노동절) → 5/2 토 → 5/3 일 → 5/4(월)
    const r = dl("2026-04-17", 14, "day");
    expect(r.nominal_last_day).toBe("2026-05-01");
    expect(r.deadline).toBe("2026-05-04");
    expect(r.extended_over.map((x: any) => x.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });
  it("월 단위: 해당일 전날, 해당일 없으면 말일", () => {
    expect(dl("2026-01-30", 1, "month").nominal_last_day).toBe("2026-02-28"); // 기산 1/31 → 2/31 없음
    expect(dl("2026-01-14", 1, "month").nominal_last_day).toBe("2026-02-14"); // 기산 1/15 → 2/15 전날
    expect(dl("2025-12-31", 1, "month").nominal_last_day).toBe("2026-01-31");
    expect(dl("2026-03-02", 1, "year").nominal_last_day).toBe("2027-03-02");
  });
  it("0시 시작이면 첫날 산입", () => {
    expect(dl("2026-06-01", 10, "day", true).nominal_last_day).toBe("2026-06-10");
  });
  it("안내 페이지(/guides/korean-legal-deadlines)의 예와 도구 결과가 같다", () => {
    const page = deadlinesGuide();
    const cases: [string, number, "day" | "week" | "month" | "year", boolean][] = [
      ["2026-07-10", 7, "day", false],
      ["2026-09-10", 2, "week", false],
      ["2026-11-30", 3, "month", false],
      ["2026-10-10", 1, "year", false],
      ["2026-12-01", 1, "month", true],
      ["2026-12-01", 1, "month", false],
    ];
    for (const [e, n, u, mid] of cases) expect(page).toContain(`deadline: "${dl(e, n, u, mid).deadline}"`);
    expect(sitemap()).toContain("/guides/korean-legal-deadlines");
  });
});

describe("글자 수", () => {
  it("공백·바이트", () => {
    const r = tool("kr_text_count").run({ text: "안녕하세요 AI\n반가워요" }) as any;
    expect(r.chars_with_spaces).toBe(12);
    expect(r.chars_without_spaces).toBe(11);
    expect(r.lines).toBe(2);
    expect(r.neis_bytes).toBe(9 * 3 + 3 + 2);
    expect(r.sms_bytes).toBe(9 * 2 + 3 + 2);
    expect(r.message_type).toMatch(/^SMS/);
  });
  it("이모지는 한 글자", () => {
    expect((tool("kr_text_count").run({ text: "👍🏽가" }) as any).chars_with_spaces).toBe(2);
  });
});

describe("상대 날짜", () => {
  // 기준 2026-11-12(목)
  const r = (e: string) => (tool("kr_relative_date").run({ expressions: [e], base_date: "2026-11-12" }) as any).results[0];
  it("하루 단위", () => {
    expect(r("내일모레").date).toBe("2026-11-14");
    expect(r("글피").date).toBe("2026-11-15");
    expect(r("그저께").date).toBe("2026-11-10");
    expect(r("이틀 뒤").date).toBe("2026-11-14");
    expect(r("보름 후").date).toBe("2026-11-27");
    expect(r("3일 후").date).toBe("2026-11-15");
    expect(r("일주일 뒤").date).toBe("2026-11-19");
    expect(r("한 달 뒤").date).toBe("2026-12-12");
  });
  it("주·요일", () => {
    expect(r("다음 주 화요일").date).toBe("2026-11-17");
    expect(r("이번 주 월요일").date).toBe("2026-11-09");
    expect(r("지난주 금요일").date).toBe("2026-11-06");
    expect(r("다다음 주 월요일").date).toBe("2026-11-23");
    expect(r("금요일까지").date).toBe("2026-11-13");
    expect(r("목요일").note).toMatch(/base date/);
    expect(r("주말").date).toBe("2026-11-14");
    expect(r("다음 주 금요일").weekday_ko).toBe("금");
  });
  it("영업일·달·해", () => {
    expect(r("3영업일 후").date).toBe("2026-11-17");
    expect(r("다음 달 말일").date).toBe("2026-12-31");
    expect(r("이번 달 25일").date).toBe("2026-11-25");
    expect(r("내년 3월 1일").holidays).toEqual(["3ㆍ1절"]);
    expect(r("연말").date).toBe("2026-12-31");
    expect(r("1월 1일").note).toMatch(/passed/);
  });
  it("못 읽으면 항목별 오류", () => {
    expect(r("언젠가").error).toMatch(/cannot read/);
  });
});

describe("음력", () => {
  const t = (a: object) => tool("kr_lunar_convert").run(a) as any;
  it("설날·추석", () => {
    expect(t({ lunar_date: "2026-01-01" }).solar).toBe("2026-02-17");
    expect(t({ lunar_date: "2027-01-01" }).solar).toBe("2027-02-07"); // 중국은 2/6
    expect(t({ lunar_date: "2026-08-15" }).solar).toBe("2026-09-25");
    expect(t({ solar_date: "2026-09-25" }).lunar).toBe("2026-08-15");
  });
  it("공휴일 표와 맞는다", () => {
    for (const y of [2024, 2025, 2026, 2027]) {
      const seol = t({ lunar_date: `${y}-01-01` }).solar;
      expect(dayInfo(seol).holidays).toContain("설날");
      const chuseok = t({ lunar_date: `${y}-08-15` }).solar;
      expect(dayInfo(chuseok).holidays).toContain("추석");
    }
  });
  it("해마다 음력 생일", () => {
    const r = t({ lunar_month_day: "08-15", years: [2026, 2027] });
    expect(r.results.map((x: any) => x.solar)).toEqual(["2026-09-25", "2027-09-15"]);
  });
  it("없는 날짜는 이유와 함께 오류", () => {
    expect(() => t({ lunar_date: "2026-01-01", leap_month: true })).toThrow(/leap/);
  });
});

it("음력: 인자 없으면 오늘", () => {
  expect((tool("kr_lunar_convert").run({}) as any).solar).toBe(todayKst());
});

describe("금액 검산", () => {
  const t = (a: object) => tool("kr_amount_check").run(a) as any;
  it("문서에서 짝을 찾아 맞는지 본다", () => {
    const r = t({
      text: "제2조 대금은 일금 일백이십삼만원정(₩1,230,000)으로 한다. 계약금은 300,000원(금 삼십만원), 잔금은 일금 구십만원정(₩930,000)이다.",
    });
    expect(r.found).toBe(3);
    expect(r.mismatches).toBe(1);
    expect(r.results.map((x: any) => x.match)).toEqual([true, true, false]);
    expect(r.results[2].note).toMatch(/900,000.*930,000.*일금 구십삼만원정/);
  });
  it("짝 직접", () => {
    const r = t({ pairs: [{ korean: "1억 2천만 원", number: "120,000,000" }, { korean: "삼백오십만", number: "3,050,000" }] });
    expect(r.results.map((x: any) => x.match)).toEqual([true, false]);
  });
  it("한글 없는 괄호는 건너뛴다", () => {
    expect(t({ text: "금액 1,000원(부가세 포함)" }).found).toBe(0);
  });
});

it("금액 검산: 앞 낱말이 섞여도 읽는다", () => {
  const r = tool("kr_amount_check").run({ text: "총액은 이 일백만원정(₩1,000,000)" }) as any;
  expect(r.results[0].match).toBe(true);
  expect(() => fromKorean("이일백만")).toThrow();
});

it("금액 검산: 잘못된 짝은 그 항목만 표시", () => {
  const r = tool("kr_amount_check").run({ pairs: [{ korean: "string", number: "string" }, { korean: "만", number: "10000" }] }) as any;
  expect(r.results.map((x: any) => x.match)).toEqual([false, true]);
  expect(r.results[0].note).toMatch(/digits/);
});

describe("페이지 방문 출처", () => {
  const at = (h: Record<string, string>, q = "") => new Request(`https://mcp.thequokkacompany.com/${q}`, { headers: h });
  it("?ref가 먼저", () => expect(pageSource(at({ referer: "https://forum.cursor.com/t/1", "sec-fetch-mode": "navigate" }, "?ref=gn"))).toBe("gn"));
  it("바깥 Referer 호스트", () => expect(pageSource(at({ referer: "https://forum.cursor.com/t/1", "sec-fetch-mode": "navigate" }))).toBe("r:forum.cursor.com"));
  it("우리 Referer는 빈 값", () => expect(pageSource(at({ referer: "https://mcp.thequokkacompany.com/ko", "sec-fetch-mode": "navigate" }))).toBe(""));
  it("Sec-Fetch-Mode 없으면 x:nosf", () => expect(pageSource(at({}))).toBe("x:nosf"));
});

describe("도구 호출 UA 이름", () => {
  it("알려진 제품 이름", () => {
    expect(uaLabel("curl/8.7.1")).toBe("curl");
    expect(uaLabel("python-httpx/0.27.0")).toBe("python-httpx");
    expect(uaLabel("Mozilla/5.0 AppleWebKit/537.36; compatible; ChatGPT-User/1.0")).toBe("chatgpt-user");
  });
  it("모르면 첫 토큰, 비면 -", () => {
    expect(uaLabel("Mozilla/5.0 (Macintosh)")).toBe("mozilla");
    expect(uaLabel("")).toBe("-");
  });
});

describe("브라우저로 연 MCP 주소", () => {
  it("?ref를 붙인 채 설명 페이지로 보낸다", async () => {
    const r = await worker.fetch(new Request("https://mcp.thequokkacompany.com/korea?ref=mail-mcpnl"), {} as any, {} as any);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://mcp.thequokkacompany.com/?ref=mail-mcpnl#korea");
  });
  it("ref가 없으면 그대로", async () => {
    const r = await worker.fetch(new Request("https://mcp.thequokkacompany.com/korea"), {} as any, {} as any);
    expect(r.headers.get("location")).toBe("https://mcp.thequokkacompany.com/#korea");
  });
});
