// 금액 ↔ 한글. 계약서·영수증의 "일금 일백이십삼만원정"과 읽는 말 "백이십삼만 원"을 만든다.
// 거꾸로 "1억 2천만 원", "삼백오십만원", "일금 일백만원정", "2.5억" 같은 글을 숫자로 읽는다.
// 큰 수는 BigInt로 계산한다(경 단위, 10^20 미만).

const DIGIT = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL = ["", "십", "백", "천"];
const BIG = ["", "만", "억", "조", "경"];
const MAX = 10n ** 20n;

export class AmountError extends Error {}

function parseInput(v: string | number): bigint {
  const s = String(v).trim().replace(/[,\s_]/g, "").replace(/^₩|원$/g, "");
  if (!/^-?\d+$/.test(s)) throw new AmountError(`amount must be a whole number (digits, commas allowed), got "${v}"`);
  const n = BigInt(s);
  if (n < 0n) throw new AmountError("negative amounts are not supported");
  if (n >= MAX) throw new AmountError("amount must be below 10^20");
  return n;
}

/** 4자리 묶음 하나(0~9999). formal이면 십·백·천 앞에도 "일"을 쓴다 */
function group(n: number, formal: boolean): string {
  let out = "";
  const s = String(n).padStart(4, "0");
  for (let i = 0; i < 4; i++) {
    const d = +s[i];
    if (d === 0) continue;
    const unit = SMALL[3 - i];
    out += (d === 1 && unit && !formal ? "" : DIGIT[d]) + unit;
  }
  return out;
}

function groups(n: bigint): number[] {
  const g: number[] = [];
  while (n > 0n) {
    g.push(Number(n % 10000n));
    n /= 10000n;
  }
  return g; // 낮은 묶음부터
}

/** 읽는 말: 만 단위로 띄어 쓴다(한글 맞춤법 제44항). 12345678 → "천이백삼십사만 오천육백칠십팔" */
export function readKorean(n: bigint): string {
  if (n === 0n) return "영";
  const g = groups(n);
  const parts: string[] = [];
  for (let i = g.length - 1; i >= 0; i--) {
    if (g[i] === 0) continue;
    // 맨 앞 "만"은 "일만"이 아니라 "만"으로 읽는다. 억·조·경은 "일억"
    const word = i === 1 && g[i] === 1 && i === g.length - 1 ? "" : group(g[i], false);
    parts.push(word + BIG[i]);
  }
  return parts.join(" ");
}

/** 계약서·영수증 모양: 띄어 쓰지 않고 모든 자리에 숫자를 붙인다. 1234567 → "일백이십삼만사천오백육십칠" */
export function formalKorean(n: bigint): string {
  if (n === 0n) return "영";
  const g = groups(n);
  let out = "";
  for (let i = g.length - 1; i >= 0; i--) if (g[i] !== 0) out += group(g[i], true) + BIG[i];
  return out;
}

/** 숫자 + 한글 단위 섞어 쓰기: 123456789 → "1억 2,345만 6,789" */
export function mixedKorean(n: bigint): string {
  if (n === 0n) return "0";
  const g = groups(n);
  const parts: string[] = [];
  for (let i = g.length - 1; i >= 0; i--) if (g[i] !== 0) parts.push(g[i].toLocaleString("en-US") + BIG[i]);
  return parts.join(" ");
}

export function toKorean(v: string | number) {
  const n = parseInput(v);
  const read = readKorean(n);
  const formal = formalKorean(n);
  const mixed = mixedKorean(n);
  const comma = n.toLocaleString("en-US");
  return {
    amount: n.toString(),
    comma,
    reading: read,
    reading_won: `${read} 원`,
    formal: `일금 ${formal}원정`,
    formal_with_number: `일금 ${formal}원정(₩${comma})`,
    mixed: `${mixed}원`,
  };
}

const DIGIT_VALUE: Record<string, number> = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
const SMALL_VALUE: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
const BIG_VALUE: Record<string, bigint> = { 만: 10n ** 4n, 억: 10n ** 8n, 조: 10n ** 12n, 경: 10n ** 16n };

/** 한글·숫자 섞인 금액 글을 숫자로. 못 읽으면 AmountError */
export function fromKorean(text: string): { amount: string; comma: string } {
  let s = text.trim().replace(/^(일금|금)\s*/, "");
  // 끝에 붙은 "원정", "(₩1,000,000)", "원", "KRW"를 차례로 떼어 낸다
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.trim().replace(/(원정|원整|원|정|KRW|\([^()]*\))$/i, "");
  }
  s = s.replace(/[,\s_]/g, "").replace(/^₩/, "");
  if (!s) throw new AmountError("empty amount");
  // 소수는 단위 앞에서만(2.5억): 열 배씩 키워 정수로 계산한다
  let total = 0n;
  let section = 0n; // 만 미만 묶음, 단위 10^scale 배
  let num: { v: bigint; scale: number } | null = null;
  const SCALE = 6;
  const one = 10n ** BigInt(SCALE);
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (m) {
      const [ip, fp = ""] = m[0].split(".");
      if (fp.length > SCALE) throw new AmountError("too many decimal places");
      num = { v: BigInt(ip) * one + BigInt((fp + "0".repeat(SCALE)).slice(0, SCALE)), scale: SCALE };
      i += m[0].length;
      continue;
    }
    if (c in DIGIT_VALUE) {
      // "이일백만"처럼 숫자 뒤에 단위 없이 또 숫자가 오면 읽지 않는다(앞 낱말이 섞인 경우)
      if (num) throw new AmountError(`two digits in a row at "${c}" in "${text}"`);
      num = { v: BigInt(DIGIT_VALUE[c]) * one, scale: SCALE };
    } else if (c in SMALL_VALUE) {
      section += (num ? num.v : one) * BigInt(SMALL_VALUE[c]);
      num = null;
    } else if (c in BIG_VALUE) {
      section += num ? num.v : 0n;
      if (section === 0n) section = one;
      total += section * BIG_VALUE[c];
      section = 0n;
      num = null;
    } else {
      throw new AmountError(`cannot read "${c}" in "${text}"`);
    }
    i++;
  }
  section += num ? num.v : 0n;
  total += section;
  if (total % one !== 0n) throw new AmountError("amount is not a whole number of won");
  const n = total / one;
  if (n >= MAX) throw new AmountError("amount must be below 10^20");
  return { amount: n.toString(), comma: n.toLocaleString("en-US") };
}

// 문서 속 "일금 일백만원정(₩1,000,000)"·"1,000,000원(금 일백만원)" 짝을 찾아 한글과 숫자가 같은지 본다.
// 계약서·견적서·차용증에서 한글 금액과 숫자가 어긋나는 오타를 잡으려는 것이다.
const HAN = "[영일이삼사오육륙칠팔구십백천만억조경\\s]+";
const NUM = "[0-9][0-9,]*";
const PAIRS = [
  // 한글 먼저: 일금 일백만원정(₩1,000,000) / 금 일백만 원(1,000,000원)
  new RegExp(`((?:일금|금)?\\s*(${HAN})\\s*원\\s*(?:정|整)?)\\s*[(（]\\s*(?:₩|￦|\\\\|KRW)?\\s*(${NUM})\\s*원?\\s*(?:정)?\\s*[)）]`, "g"),
  // 숫자 먼저: 1,000,000원(일금 일백만원정) / ₩1,000,000(금 일백만원)
  new RegExp(`((?:₩|￦|KRW\\s?)?(${NUM})\\s*원?)\\s*[(（]\\s*((?:일금|금)?\\s*(${HAN})\\s*원?\\s*(?:정|整)?)\\s*[)）]`, "g"),
];

export interface AmountPair {
  found: string;
  korean: string;
  number: string;
  korean_value: string | null;
  number_value: string;
  match: boolean;
  note?: string;
}

function digits(s: string): string {
  return BigInt(s.replace(/,/g, "")).toString();
}

export function checkPair(korean: string, number: string, found = `${korean} / ${number}`): AmountPair {
  korean = korean.trim();
  const num = digits(number);
  let kv: string | null = null;
  let note: string | undefined;
  // 앞 낱말이 붙어 잡혔을 수 있다("이 일백만원정"): 못 읽으면 앞 낱말을 하나씩 떼어 다시 읽는다
  const words = korean.trim().split(/\s+/);
  for (let i = 0; i < words.length && kv === null; i++) {
    try {
      kv = fromKorean(words.slice(i).join(" ")).amount;
      if (i > 0) korean = words.slice(i).join(" ");
    } catch (e) {
      if (i === 0) note = `cannot read the Korean amount: ${(e as Error).message}`;
    }
  }
  if (kv !== null) note = undefined;
  const match = kv === num;
  if (kv !== null && !match) note = `Korean words say ${BigInt(kv).toLocaleString("en-US")}, digits say ${BigInt(num).toLocaleString("en-US")}; correct words for the digits: ${toKorean(num).formal}`;
  return { found: found.trim(), korean: korean.trim(), number, korean_value: kv, number_value: num, match, ...(note ? { note } : {}) };
}

export function checkText(text: string): AmountPair[] {
  const out: { at: number; pair: AmountPair }[] = [];
  const seen = new Set<number>();
  PAIRS[0].lastIndex = 0;
  for (const m of text.matchAll(PAIRS[0])) {
    if (!/[일이삼사오육륙칠팔구십백천만억조경]/.test(m[2])) continue;
    seen.add(m.index!);
    out.push({ at: m.index!, pair: checkPair(m[1], m[3], m[0]) });
  }
  for (const m of text.matchAll(PAIRS[1])) {
    if (!/[일이삼사오육륙칠팔구십백천만억조경]/.test(m[4]) || seen.has(m.index!)) continue;
    out.push({ at: m.index!, pair: checkPair(m[3], m[2], m[0]) });
  }
  return out.sort((a, b) => a.at - b.at).map((x) => x.pair);
}
