# Quokka Korea Tools (MCP)

Remote MCP server for South Korean data that language models tend to get wrong when they guess: public holidays and business days, won amounts in Korean words, business registration number check digits, 만 나이, and phone/address/name cleanup.

Endpoint: `https://mcp.thequokkacompany.com/korea` (Streamable HTTP, stateless). Free up to 200 calls a day, no account or key.

Claude Code:

```bash
claude mcp add --transport http korea-tools "https://mcp.thequokkacompany.com/korea?ref=github"
```

Cursor (`.cursor/mcp.json`) or VS Code (`.vscode/mcp.json`, key `servers`):

```json
{ "mcpServers": { "korea-tools": { "type": "http", "url": "https://mcp.thequokkacompany.com/korea?ref=github" } } }
```

`?ref=github` only tells us where you found the server. It works the same without it.

Official MCP Registry: `com.thequokkacompany/korea-tools`. HTTP API twin: `POST /api/korea/<tool>`, spec at `/openapi.json`. Agent docs: `/llms.txt`.

## Tools
| Tool | What it does |
|---|---|
| `kr_holidays` | Public holidays for a year or range (KASI data 2024-2027, incl. substitute holidays, election days, 2026 노동절·제헌절) |
| `kr_business_day` | Is a date a business day; previous and next business day |
| `kr_add_business_days` | Start date + N business days (negative goes back) |
| `kr_count_business_days` | Business days between two dates |
| `kr_amount_to_korean` | 1234567 → 백이십삼만 사천오백육십칠 원 / 일금 일백이십삼만사천오백육십칠원정 / 123만 4,567원 |
| `kr_amount_check` | Finds 일금 …원정(₩…) pairs in a contract and checks words against digits |
| `kr_korean_to_amount` | 1억 2천만 원, 삼백오십만원, 2.5억 → exact number |
| `kr_business_number_check` | 사업자등록번호 check digit + 123-45-67890 format (offline; not an open/closed lookup) |
| `kr_age` | 만 나이, 연 나이 on a date, from a birth date or RRN front 7 digits |
| `kr_phone_format` | Normalize Korean phone numbers (+82, dropped leading 0, extensions) |
| `kr_address_split` | 시도 / 시군구 / base / detail |
| `kr_name_split` | Family / given name with two-character surnames |
| `kr_legal_deadline` | 민법 기간 계산: first day not counted, months by calendar, last day on Sat/holiday moves to next day |
| `kr_text_count` | Characters with/without spaces, NEIS bytes, SMS/LMS bytes |
| `kr_relative_date` | 내일모레, 글피, 다음 주 화요일, 3영업일 후, 다음 달 말일 → date + weekday |
| `kr_lunar_convert` | Korean lunar ↔ Gregorian (KASI standard, leap months, 간지); lunar birthday across years |
| `kr_mask_pii` | Mask RRN, phone, email, card numbers in free text, or values by kind |

## Develop
```bash
npm install
npm test           # vitest
npx wrangler dev   # local server on :8787
npm run deploy     # needs CLOUDFLARE_API_TOKEN
```
Phone, address, name, age and mask rules are in `src/lib` (the same code as the web tools at tools.thequokkacompany.com).

Usage counting and limits: `src/usage.ts`, D1 schema `schema.sql`.

## Privacy
Tool arguments are not logged. To apply the daily limit the server keeps a per-day call count for each client, keyed by a salted hash of IP and user agent, plus the client name and version from `initialize`, the product name from the User-Agent (such as `curl`), and the `ref` value if the URL has one.

## Data and license
Holiday data: Korea Astronomy and Space Science Institute (KASI) special-day data via [hyunbinseo/holidays-kr](https://github.com/hyunbinseo/holidays-kr) (MIT). Lunar conversion: [korean-lunar-calendar](https://www.npmjs.com/package/korean-lunar-calendar) (MIT). Code: MIT, see `LICENSE`.
