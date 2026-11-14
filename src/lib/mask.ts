// 개인정보 가리기 규칙. 모양을 알아볼 수 있게 일부만 남기고 *로 바꾼다.
// 법령 기준을 맞춘다고 말하지 않는다. 남기는 자리는 흔히 쓰는 모양(홍*동, 010-****-1234)을 따른다.

export type MaskKind = "name" | "phone" | "rrn" | "email";

export const KIND_LABEL: Record<MaskKind, string> = {
  name: "이름",
  phone: "전화번호",
  rrn: "주민등록번호",
  email: "이메일",
};

const STAR = "*";

/** 홍길동 → 홍*동, 이름 → 이*, 남궁민수 → 남**수, John Smith → J*** ****h */
export function maskName(v: string): string {
  const s = v.trim();
  const chars = [...s];
  if (chars.length <= 1) return s;
  if (chars.length === 2) return chars[0] + STAR;
  return chars[0] + chars.slice(1, -1).map((c) => (c === " " ? " " : STAR)).join("") + chars[chars.length - 1];
}

/** 010-1234-5678 → 010-****-5678, 02-123-4567 → 02-***-4567, 01012345678 → 010****5678 */
export function maskPhone(v: string): string {
  const s = v.trim();
  const m = s.match(/^(\(?(?:\+82[-\s]?\d{1,2}|0\d{1,2})\)?)([-.\s)]*)(\d{3,4})([-.\s]+)(\d{4})$/);
  if (m) return m[1] + m[2] + STAR.repeat(m[3].length) + m[4] + m[5];
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 9 && digits.length <= 11 && /^[\d\s\-.()+]+$/.test(s)) {
    // 구분자 없는 번호: 앞 2~3자리(지역·통신사)와 끝 4자리를 남긴다
    const head = digits.startsWith("02") ? 2 : 3;
    return digits.slice(0, head) + STAR.repeat(digits.length - head - 4) + digits.slice(-4);
  }
  return s;
}

/** 900101-1234567 → 900101-1******, 9001011234567 → 9001011****** */
export function maskRrn(v: string): string {
  const s = v.trim();
  const m = s.match(/^(\d{6})(\s*-?\s*)(\d)(\d{6})$/);
  if (!m) return s;
  return m[1] + m[2] + m[3] + STAR.repeat(6);
}

/** abcdef@gmail.com → ab****@gmail.com, a@b.com → *@b.com */
export function maskEmail(v: string): string {
  const s = v.trim();
  const at = s.lastIndexOf("@");
  if (at < 1) return s;
  const local = s.slice(0, at);
  const keep = local.length <= 2 ? 0 : Math.min(2, local.length - 1);
  return local.slice(0, keep) + STAR.repeat(local.length - keep) + s.slice(at);
}

export const MASKERS: Record<MaskKind, (v: string) => string> = {
  name: maskName,
  phone: maskPhone,
  rrn: maskRrn,
  email: maskEmail,
};

const LOOKS: Record<MaskKind, RegExp> = {
  name: /^[가-힣]{2,5}$/,
  phone: /^(?:\+?82[-\s]?)?0?\d{1,2}[-.\s)]*\d{3,4}[-.\s]*\d{4}$/,
  rrn: /^\d{6}\s*-?\s*[1-8]\d{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

/** 값이 그 종류의 모양인지(머리말 줄 판단에도 쓴다) */
export function looksLike(kind: MaskKind, v: string): boolean {
  return LOOKS[kind].test(v.trim());
}

const HEADER_HINTS: [MaskKind, RegExp][] = [
  ["rrn", /주민|생년월일.*번호|rrn|resident/i],
  ["email", /메일|e-?mail/i],
  ["phone", /전화|연락처|휴대|핸드폰|폰번호|phone|mobile|tel|contact/i],
  ["name", /이름|성명|성함|담당자|고객명|회원명|수령인|받는\s*분|^name$|full\s*name/i],
];

/**
 * 열 머리말과 값 몇 개로 어떤 개인정보 열인지 추측한다. 모르면 null.
 * 머리말이 맞고 값의 절반 이상이 그 모양이면 확정, 머리말이 없어도 값의 80% 이상이 모양에 맞으면 확정.
 */
export function detectKind(header: string, samples: string[]): MaskKind | null {
  const vals = samples.map((s) => s.trim()).filter(Boolean);
  const ratio = (k: MaskKind) => (vals.length ? vals.filter((v) => LOOKS[k].test(v)).length / vals.length : 0);
  for (const [k, re] of HEADER_HINTS) {
    if (re.test(header.trim()) && (vals.length === 0 || ratio(k) >= 0.5 || k === "name")) return k;
  }
  // 이름은 머리말 없이 값만으로는 다른 한글 낱말과 헷갈려서 추측하지 않는다
  for (const k of ["rrn", "email", "phone"] as MaskKind[]) {
    if (vals.length >= 3 && ratio(k) >= 0.8) return k;
  }
  return null;
}
