// 한국 전화번호·사업자등록번호를 한 모양으로 맞춘다. 숫자만 남긴 뒤 앞자리로 자릿수를 정한다.

export type PhoneStyle = "hyphen" | "digits" | "intl";

/** 숫자만. +82·82로 시작하면 0으로, 엑셀이 지운 앞자리 0은 되살린다 */
export function phoneDigits(raw: string): string | null {
  const s = raw.trim();
  if (!s || /[a-zA-Z가-힣]/.test(s.replace(/^tel:/i, ""))) return null;
  let d = s.replace(/\D/g, "");
  if (/^\+?\s*82/.test(s) || (d.startsWith("82") && (d.length === 11 || d.length === 12))) d = "0" + d.slice(2).replace(/^0/, "");
  // 대표번호 1588-1234 같은 8자리는 0을 붙이지 않는다
  if (/^1[5-9]\d{6}$/.test(d)) return d;
  if (!d.startsWith("0") && d.length >= 8 && d.length <= 10 && /^[1-6]/.test(d)) d = "0" + d;
  return d.length >= 8 && d.length <= 12 ? d : null;
}

/** 자리 나누기. 모르는 모양이면 null */
export function phoneParts(d: string): string[] | null {
  if (/^1[5-9]\d{6}$/.test(d)) return [d.slice(0, 4), d.slice(4)];
  if (d.startsWith("02")) {
    if (d.length === 9) return ["02", d.slice(2, 5), d.slice(5)];
    if (d.length === 10) return ["02", d.slice(2, 6), d.slice(6)];
    return null;
  }
  if (/^050\d/.test(d)) {
    if (d.length === 12) return [d.slice(0, 4), d.slice(4, 8), d.slice(8)];
    if (d.length === 11) return [d.slice(0, 4), d.slice(4, 7), d.slice(7)];
    return null;
  }
  if (/^0(1[016789]|[3-6]\d|70|80)/.test(d)) {
    if (d.length === 10) return [d.slice(0, 3), d.slice(3, 6), d.slice(6)];
    if (d.length === 11) return [d.slice(0, 3), d.slice(3, 7), d.slice(7)];
  }
  return null;
}

// 앞에 붙은 이름표(TEL. 02-…, HP 010-…, 휴대폰: 010-…)와 뒤에 붙은 내선(02-… 내선 101, ext.12)
const LABEL = /^(?:tel|t|hp|h\.p|phone|mobile|mob|m|fax|f|전화(?:번호)?|휴대(?:폰|전화)|핸드폰|연락처|대표(?:번호)?|팩스)\s*[.:)]?\s*(?=[+(\d])/i;
const EXT = /\s*[(\[]?\s*(?:내선|ext\.?|x)\s*\d{1,5}\s*[)\]]?$/i;

export function formatPhone(raw: string, style: PhoneStyle = "hyphen"): string | null {
  let s = raw.trim().replace(LABEL, "");
  // 내선은 지우지 않고 바꾼 번호 뒤에 그대로 붙인다
  const ext = s.match(EXT)?.[0].trim();
  if (ext) s = s.slice(0, s.length - s.match(EXT)![0].length);
  const d = phoneDigits(s);
  if (!d) return null;
  const p = phoneParts(d);
  if (!p) return null;
  const out = style === "digits" ? p.join("") : style === "intl" ? (p.length === 2 ? `+82 ${p.join("-")}` : `+82 ${p[0].slice(1)}-${p[1]}-${p[2]}`) : p.join("-");
  return ext ? `${out} ${ext}` : out;
}

/** 사업자등록번호 끝자리 검사(국세청 가중치 1,3,7,1,3,7,1,3,5) */
export function bizValid(d: string): boolean {
  if (!/^\d{10}$/.test(d)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * w[i];
  sum += Math.floor((+d[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === +d[9];
}

/** 123-45-67890. 숫자가 10자리가 아니면 null. 끝자리 검사는 따로(bizValid) */
export function formatBiz(raw: string, style: PhoneStyle = "hyphen"): string | null {
  const s = raw.trim();
  if (/[a-zA-Z가-힣]/.test(s)) return null;
  let d = s.replace(/\D/g, "");
  if (d.length === 9) d = "0" + d; // 엑셀이 앞자리 0을 지운 경우
  if (d.length !== 10) return null;
  return style === "digits" ? d : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}
