// 사람이 읽는 첫 페이지(영어 /, 한국어 /ko), 에이전트가 읽는 llms.txt, HTTP API 문서(OpenAPI). 모두 도구 목록(ServerInfo)에서 만든다.
// SEO·AEO팀 검토(11/12) 반영: canonical·hreflang·OG·JSON-LD, 한국어 페이지, llms.txt 링크 형식, sitemap lastmod.

import type { ServerInfo } from "./mcp";
import { DATA_UPDATED } from "./korea/holidays";
import { FIRST_YEAR, LAST_YEAR } from "./korea/dates";
import { COVER } from "./korea/tools";

const ORIGIN = "https://mcp.thequokkacompany.com";
/** 페이지 글을 고친 날. sitemap lastmod */
export const PAGES_UPDATED = "2026-11-14";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KO: Record<string, string> = {
  kr_holidays: "연도나 기간의 공휴일 목록(대체공휴일·선거일 포함)",
  kr_business_day: "그날이 영업일인지, 앞뒤 영업일",
  kr_add_business_days: "시작일에서 영업일 N일 뒤(음수면 앞)",
  kr_count_business_days: "두 날짜 사이 영업일 수",
  kr_amount_to_korean: "숫자를 한글 금액으로: 백이십삼만 원, 일금 일백이십삼만원정, 123만 원",
  kr_korean_to_amount: "1억 2천만 원, 삼백오십만원, 2.5억을 정확한 숫자로",
  kr_business_number_check: "사업자등록번호 검증번호 확인과 123-45-67890 모양 맞추기(휴·폐업 조회는 아님)",
  kr_age: "생년월일이나 주민번호 앞 7자리로 만 나이·연 나이",
  kr_phone_format: "전화번호 한 모양으로(+82, 엑셀이 지운 0, 내선)",
  kr_address_split: "주소를 시도·시군구·도로명·상세주소로",
  kr_name_split: "성과 이름 나누기(남궁·황보 같은 두 글자 성)",
  kr_mask_pii: "글 속 주민번호·전화·이메일·카드번호 가리기",
  kr_legal_deadline: "민법 기간 계산: 초일 불산입, 월·연은 달력대로, 말일이 토·공휴일이면 다음 날",
  kr_text_count: "글자 수(공백 포함·제외), 나이스 바이트, 문자 SMS·LMS 바이트",
  kr_relative_date: "내일모레·글피·다음 주 화요일·3영업일 후를 날짜와 요일로",
  kr_lunar_convert: "음력 ↔ 양력(천문연 기준, 윤달·간지), 해마다 음력 생일·제사 날짜",
  kr_amount_check: "계약서·견적서의 한글 금액(일금 …원정)과 숫자가 같은지 검산",
};

type Lang = "en" | "ko";

function head(lang: Lang, title: string, desc: string, path: string, alternates = true): string {
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: "Quokka Korea Tools",
    description: desc,
    url: `${ORIGIN}${path}`,
    documentation: `${ORIGIN}/openapi.json`,
    inLanguage: lang,
    provider: { "@type": "Organization", name: "The Quokka Studio", alternateName: "더쿼카스튜디오", email: "contact@thequokkacompany.com" },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free tier: 200 calls per day per client" },
  };
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${ORIGIN}${path}">
${alternates ? `<link rel="alternate" hreflang="en" href="${ORIGIN}/">
<link rel="alternate" hreflang="ko" href="${ORIGIN}/ko">
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">` : ""}
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${ORIGIN}${path}">
<meta property="og:locale" content="${lang === "ko" ? "ko_KR" : "en_US"}">
<meta property="og:image" content="${ORIGIN}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/thumb.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mute:#66645e;--line:#e4e1d8;--code:#f1eee6;--accent:#8a5a00}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ecebe6;--mute:#a3a197;--line:#33322d;--code:#23221f;--accent:#e2b04a}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",system-ui,sans-serif;word-break:keep-all}
main{max-width:760px;margin:0 auto;padding:40px 16px 80px}
h1{font-size:28px;line-height:1.25;margin:0 0 8px}h2{font-size:19px;margin:40px 0 8px}
.mute{color:var(--mute)}a{color:var(--accent)}nav{font-size:14px;margin-bottom:24px}
code,pre{font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);border-radius:6px}
code{padding:1px 5px;word-break:break-all}pre{padding:12px 14px;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14.5px}td{border-top:1px solid var(--line);padding:8px 6px;vertical-align:top}td:first-child{white-space:nowrap}
.url{font-size:17px;padding:10px 12px;display:block;margin:12px 0}
@media (max-width:560px){td:first-child{white-space:normal}}
</style></head><body><main>`;
}

const SETUP = (claudeLine: string, otherLine: string, webLine: string) => `<p>${claudeLine}</p>
<pre>claude mcp add --transport http korea-tools ${ORIGIN}/korea</pre>
<p>${otherLine}</p>
<pre>{
  "mcpServers": {
    "korea-tools": { "type": "http", "url": "${ORIGIN}/korea" }
  }
}</pre>
<p>${webLine}</p>`;

const CURL = `<pre>curl -s ${ORIGIN}/api/korea/kr_add_business_days \\
  -H 'content-type: application/json' -d '{"start":"2026-09-23","days":3}'</pre>`;

export function landing(s: ServerInfo): string {
  const rows = s.tools.map((t) => `<tr><td><code>${t.name}</code></td><td>${esc(t.description.split(". ")[0])}.</td></tr>`).join("");
  return `${head("en", "Quokka Korea Tools MCP", "Remote MCP server and HTTP API for South Korean holidays and business days, Korean won amounts in words, business registration number checks, 만 나이, and Korean phone/address/name cleanup.", "/")}
<nav><a href="/ko" hreflang="ko">한국어</a></nav>
<h1>Quokka Korea Tools</h1>
<p class="mute">A remote MCP server for things about South Korea that a language model tends to get wrong when it guesses.</p>
<p>Labor Day (노동절, May 1) and Constitution Day (제헌절, Jul 17) became public holidays in Korea in 2026. Models trained before that may not know, and they cannot see substitute holidays or election days announced later. These tools answer from data and fixed rules instead.</p>
<code class="url">${ORIGIN}/korea</code>
<p>Streamable HTTP, no sign-up, no key needed for the free tier.</p>

<h2 id="korea">Connect</h2>
${SETUP("Claude Code", "Cursor, Windsurf, VS Code and other clients (<code>mcp.json</code>)", "Claude.ai and Claude Desktop: Settings → Connectors → Add custom connector, paste the URL above.")}

<h2>Tools</h2>
<table>${rows}</table>

<h2>HTTP API</h2>
<p>Every tool is also a plain endpoint: <code>POST ${ORIGIN}/api/korea/&lt;tool&gt;</code> with the arguments as a JSON body. Spec: <a href="/openapi.json">/openapi.json</a>. For agents: <a href="/llms.txt">/llms.txt</a>.</p>
${CURL}

<h2 id="pricing">Limits</h2>
<ul>
<li>Free: 200 calls per day per client, reset at 00:00 Korea time.</li>
<li>Paid keys with a higher daily limit are planned. Until they are on sale, the free tier is all there is.</li>
</ul>

<h2>What it does not do</h2>
<ul>
<li>Holiday data covers ${FIRST_YEAR}-${LAST_YEAR} (KASI special-day data, last updated ${DATA_UPDATED}). A temporary holiday announced after that date is missing until we add it. Other years return an error.</li>
<li>The business number check is the check-digit rule only. It does not ask the National Tax Service whether the business is open.</li>
<li>Address splitting is rule-based. It does not look up the official road-name address database.</li>
</ul>

<h2>Privacy</h2>
<p>Tool inputs are not stored or logged. For the daily limit we keep a salted hash of IP address and User-Agent, the tool name and a count per day. Nothing is sold or shared.</p>

<p class="mute" style="margin-top:48px">Made by The Quokka Studio · <a href="mailto:contact@thequokkacompany.com">contact@thequokkacompany.com</a></p>
</main></body></html>`;
}

export function landingKo(s: ServerInfo): string {
  const rows = s.tools.map((t) => `<tr><td><code>${t.name}</code></td><td>${esc(KO[t.name] ?? t.title)}</td></tr>`).join("");
  return `${head("ko", "한국 공휴일·영업일·한글 금액 MCP 서버 | Quokka Korea Tools", "AI 에이전트용 한국 공휴일·대체공휴일·영업일 계산, 숫자 한글 금액 변환, 사업자등록번호 검증, 만 나이 계산 API와 원격 MCP 서버. 키 없이 하루 200회 무료.", "/ko")}
<nav><a href="/" hreflang="en">English</a></nav>
<h1>Quokka Korea Tools</h1>
<p class="mute">Claude·Cursor 같은 AI 에이전트가 한국 날짜·금액·번호를 추측하지 않고 계산하게 하는 원격 MCP 서버입니다.</p>
<p>2026년부터 노동절(5월 1일)과 제헌절(7월 17일)이 공휴일이 됐습니다. 그 전에 학습한 모델은 이걸 모를 수 있고, 나중에 정해지는 대체공휴일·선거일도 모릅니다. 이 서버는 한국천문연구원 특일 자료와 정해진 규칙으로 답합니다.</p>
<code class="url">${ORIGIN}/korea</code>
<p>가입 없이 주소 하나만 넣으면 됩니다. 무료 사용에는 키가 필요 없습니다.</p>

<h2 id="korea">연결</h2>
${SETUP("Claude Code", "Cursor·Windsurf·VS Code 등(<code>mcp.json</code>)", "Claude.ai·Claude 데스크톱: 설정 → 커넥터 → 커스텀 커넥터 추가에 위 주소를 넣습니다.")}

<h2>도구 ${s.tools.length}개</h2>
<table>${rows}</table>

<h2>HTTP API</h2>
<p>MCP를 못 쓰는 곳에서는 같은 도구를 일반 API로 부릅니다. <code>POST ${ORIGIN}/api/korea/&lt;도구 이름&gt;</code>에 인자를 JSON으로 보냅니다. 명세: <a href="/openapi.json">/openapi.json</a>, 에이전트용 설명: <a href="/llms.txt">/llms.txt</a>.</p>
${CURL}
<p class="mute">9월 23일에서 영업일 3일 뒤는 추석 연휴(9/24~26)와 일요일을 건너뛴 9월 30일입니다.</p>

<h2 id="pricing">사용 한도</h2>
<ul>
<li>무료: 클라이언트 하나당 하루 200회. 한국 시간 0시에 다시 셉니다.</li>
<li>한도를 늘리는 유료 키는 준비 중입니다. 판매 전까지는 무료만 있습니다.</li>
</ul>

<h2>하지 않는 것</h2>
<ul>
<li>공휴일 자료는 ${FIRST_YEAR}~${LAST_YEAR}년입니다(한국천문연구원 특일 자료, ${DATA_UPDATED} 갱신). 그 뒤에 정해진 임시공휴일은 저희가 넣기 전까지 빠져 있습니다. 범위 밖 연도는 추측하지 않고 오류를 돌려줍니다.</li>
<li>사업자등록번호는 검증번호 규칙만 봅니다. 국세청에 휴·폐업 여부를 묻지 않습니다.</li>
<li>주소 나누기는 규칙으로 합니다. 도로명주소 데이터베이스를 조회하지 않습니다.</li>
</ul>

<h2>개인정보</h2>
<p>도구에 넣은 값은 저장하거나 로그에 남기지 않습니다. 하루 한도를 세려고 IP 주소와 User-Agent를 비밀 값으로 해시한 문자열, 도구 이름, 날짜별 횟수만 둡니다.</p>

<p class="mute" style="margin-top:48px">더쿼카스튜디오 · <a href="mailto:contact@thequokkacompany.com">contact@thequokkacompany.com</a></p>
</main></body></html>`;
}

export const GUIDE_PATH = "/guides/korean-business-days";

/** 사용 사례 글(dev.to 영어 원고 research/agent-tools/launch/devto-business-days.md)과 같은 내용의 랜딩. 결과 값은 실주소 응답 그대로(11/14) */
export function guide(): string {
  const url = (ref: string) => `${ORIGIN}/korea?ref=${ref}`;
  return `${head("en", "Korean business days and legal deadlines in Claude and Cursor | Quokka Korea Tools", "Make Claude and Cursor calculate South Korean business days, public holidays and Civil Act deadlines from data instead of guessing. One MCP URL, free tier without a key.", GUIDE_PATH, false)}
<nav><a href="/">Quokka Korea Tools</a> · <a href="/ko" hreflang="ko">한국어</a></nav>
<h1>Korean business days and legal deadlines in Claude and Cursor</h1>
<p class="mute">Updated ${PAGES_UPDATED}. Every result below is the server's actual response.</p>

<p>If you ask a model "is May 1, 2026 a business day in Korea?" it has to rely on what it learned. Korea added two public holidays in 2026: Labor Day (May 1) and Constitution Day (July 17). Substitute holidays and election days are announced year by year. A model trained before those decisions may count them as working days, and a deadline that crosses one of those days moves.</p>
<p>This server has the official calendar and the counting rules. The model calls it and writes the answer from the result.</p>

<h2>Set it up</h2>
<p>Claude Code</p>
<pre>claude mcp add --transport http korea-tools "${url("guide")}"</pre>
<p>Claude.ai or Claude Desktop: Settings → Connectors → Add custom connector, paste <code>${url("guide")}</code>.</p>
<p>Cursor (<code>.cursor/mcp.json</code>)</p>
<pre>{ "mcpServers": { "korea-tools": { "type": "http", "url": "${url("guide")}" } } }</pre>
<p class="mute"><code>?ref=guide</code> only tells us which page you came from. The server works the same without it. No account or key for up to 200 calls a day.</p>

<h2>1. Is it a business day?</h2>
<p>Prompt: <em>Is 2026-05-01 a business day in Korea? If not, what is the next one?</em></p>
<pre>kr_business_day {"date": "2026-05-01"}
→ is_business_day: false, holidays: ["노동절"], next_business_day: "2026-05-04"</pre>
<p>May 1 is a Friday. The next business day is Monday, May 4.</p>

<h2>2. A deadline in business days</h2>
<p>Prompt: <em>Payment is due 3 business days after 2026-09-23. Which date?</em></p>
<pre>kr_add_business_days {"start": "2026-09-23", "days": 3}
→ result: "2026-09-30"
  skipped: 09-24 추석 전날, 09-25 추석, 09-26 추석 다음 날, 09-27 Sunday</pre>
<p>Chuseok takes three days that year, so a "3 business days" deadline lands a full week later.</p>
<p>Across New Year it looks like this: 5 business days after 2026-12-24 is 2027-01-04, skipping Christmas, two weekends and January 1.</p>

<h2>3. A legal deadline under the Civil Act</h2>
<p>When a law or contract says "within 14 days" or "within 1 month" and gives no other rule, Korea's Civil Act (articles 155-161) applies. The first day is not counted. Months follow the calendar, and the period ends the day before the same date. If that date does not exist, the period ends on the last day of the month. If the last day is a Saturday or a public holiday, the deadline moves to the next day.</p>
<p>Prompt: <em>A notice arrived on 2026-04-17. When does a 14-day period end?</em></p>
<pre>kr_legal_deadline {"event_date": "2026-04-17", "amount": 14, "unit": "day"}
→ nominal_last_day: "2026-05-01", deadline: "2026-05-04"
  extended over: 05-01 노동절, 05-02 Saturday, 05-03 Sunday</pre>
<p>Prompt: <em>One month from 2026-01-30?</em></p>
<pre>kr_legal_deadline {"event_date": "2026-01-30", "amount": 1, "unit": "month"}
→ nominal_last_day: "2026-02-28", deadline: "2026-03-03"
  extended over: 02-28 Saturday, 03-01 3ㆍ1절, 03-02 대체공휴일(3ㆍ1절)</pre>
<p>Counting starts on January 31. February has no 31st, so the nominal last day is February 28. That is a Saturday, March 1 is Independence Movement Day (a Sunday), and March 2 is its substitute holiday. The deadline is Tuesday, March 3.</p>

<h2>4. Counting business days in a range</h2>
<pre>kr_count_business_days {"from": "2026-10-01", "to": "2026-10-31"}
→ business_days: 20 (31 calendar days, 9 weekend days, 2 weekday holidays)</pre>

<h2>What it does not do</h2>
<ul>
<li>Holiday data covers 2024-2027 (Korea Astronomy and Space Science Institute data). Other years return an error.</li>
<li>Some statutes and court rules set their own counting rules. The deadline tool applies the Civil Act default and is not legal advice.</li>
<li>Company holidays are not known to it. Pass them as <code>extra_closed_dates</code>.</li>
</ul>

<h2>Other tools on the same server</h2>
<p>Korean lunar calendar conversion (2027 Lunar New Year is Feb 7 in Korea and Feb 6 in China), phrases like "다음 주 화요일" to dates, won amounts in Korean words, character and NEIS byte counts, business registration number check digits, and phone/address/name cleanup. Full list: <a href="/">home</a>, <a href="/openapi.json">OpenAPI</a>, <a href="/llms.txt">llms.txt</a>.</p>

<p class="mute" style="margin-top:48px">The Quokka Studio · <a href="mailto:contact@thequokkacompany.com">contact@thequokkacompany.com</a></p>
</main></body></html>`;
}

export function llmsTxt(s: ServerInfo): string {
  const tools = s.tools.map((t) => `- ${t.name}: ${t.description.replace(` ${COVER}`, "")}`).join("\n");
  return `# Quokka Korea Tools

> Remote MCP server and HTTP API with exact tools for South Korean data: public holidays and business days, won amounts in Korean words, business registration number check digits, 만 나이, and phone/address/name normalization and PII masking. Free tier needs no key.
> 한국 공휴일·대체공휴일·영업일 계산, 민법 기간(기한) 계산, 숫자 한글 금액 변환, 글자 수·나이스 바이트, 사업자등록번호 검증, 만 나이 계산을 하는 원격 MCP 서버와 API.

MCP endpoint (Streamable HTTP, stateless): ${ORIGIN}/korea
HTTP API: POST ${ORIGIN}/api/korea/<tool_name> with a JSON body of arguments.
Dates are YYYY-MM-DD and default to today in Korea (KST, UTC+9). ${COVER} Other years return an error.
Free tier: 200 calls per day per client. Errors come back as {"error": "..."} (HTTP API) or isError results (MCP).

## Docs

- [Home](${ORIGIN}/): setup for Claude Code, Claude.ai, Cursor, VS Code
- [한국어 안내](${ORIGIN}/ko): 설정 방법과 도구 목록
- [Guide: Korean business days and legal deadlines](${ORIGIN}${GUIDE_PATH}): worked examples with real outputs
- [OpenAPI](${ORIGIN}/openapi.json): HTTP API schema for every tool
- [MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=com.thequokkacompany/korea-tools): com.thequokkacompany/korea-tools

## Tools

${tools}

## Examples

- POST ${ORIGIN}/api/korea/kr_business_day {"date":"2026-05-01"} → is_business_day false, holidays ["노동절"]
- POST ${ORIGIN}/api/korea/kr_add_business_days {"start":"2026-09-23","days":3} → 2026-09-30, skips 추석 (Sep 24-26) and Sunday
- POST ${ORIGIN}/api/korea/kr_amount_to_korean {"amount":"1234567"} → formal "일금 일백이십삼만사천오백육십칠원정"
- POST ${ORIGIN}/api/korea/kr_korean_to_amount {"text":"1억 2천만 원"} → 120000000
`;
}

export function sitemap(): string {
  const url = (loc: string, alt = true) =>
    `<url><loc>${ORIGIN}${loc}</loc><lastmod>${PAGES_UPDATED}</lastmod>${
      alt ? `<xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/"/><xhtml:link rel="alternate" hreflang="ko" href="${ORIGIN}/ko"/>` : ""
    }</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${url("/")}${url("/ko")}${url(GUIDE_PATH, false)}${url("/llms.txt", false)}</urlset>
`;
}

export function openapi(s: ServerInfo) {
  const paths: Record<string, unknown> = {};
  for (const t of s.tools) {
    paths[`/api/korea/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: t.title,
        description: t.description,
        requestBody: { required: true, content: { "application/json": { schema: t.inputSchema } } },
        responses: {
          "200": { description: "Result", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Bad input; body {error}" },
          "429": { description: "Daily limit reached; body {error}" },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: s.title, version: s.version, description: s.instructions, contact: { email: "contact@thequokkacompany.com" } },
    servers: [{ url: ORIGIN }],
    paths,
    components: { securitySchemes: { key: { type: "http", scheme: "bearer", description: "Optional paid key. Omit for the free tier." } } },
  };
}
