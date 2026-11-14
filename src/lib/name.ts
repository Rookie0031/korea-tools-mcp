// 이름을 성과 이름으로 나눈다. 한국 이름은 두 글자 성(복성) 목록을 보고, 영문 이름은 띄어쓰기로.

/** 흔히 쓰는 두 글자 성. 길이가 긴 것부터 볼 필요는 없다(모두 두 글자) */
export const COMPOUND_SURNAMES = [
  "남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방", "어금", "망절",
  "무본", "장곡", "소봉", "강전", "공손", "을지", "황목",
];

/** 한 글자 성으로도 흔해서 세 글자 이름이면 어느 쪽인지 알 수 없는 것(선우진 = 선+우진 또는 선우+진) */
const AMBIGUOUS = new Set(["선우", "서문", "사공", "동방"]);

export interface NameParts {
  family: string;
  given: string;
  /** 두 글자 성인지 한 글자 성인지 글자만으로 정할 수 없을 때 true */
  unsure: boolean;
}

export function splitName(raw: string, useCompound = true): NameParts | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  // 영문(라틴 글자) 이름: 마지막 낱말을 성으로 본다(John Smith → Smith / John)
  if (/^[A-Za-z][A-Za-z.'\- ]*$/.test(s)) {
    const parts = s.split(" ");
    if (parts.length < 2) return null;
    return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" "), unsure: false };
  }
  if (!/^[가-힣]+( [가-힣]+)?$/.test(s)) return null;
  // 띄어 쓴 한국 이름은 띄어쓰기를 따른다(남궁 민수)
  if (s.includes(" ")) {
    const [f, g] = s.split(" ");
    return { family: f, given: g, unsure: false };
  }
  if (s.length < 2) return null;
  const two = s.slice(0, 2);
  if (useCompound && s.length >= 3 && COMPOUND_SURNAMES.includes(two)) {
    return { family: two, given: s.slice(2), unsure: s.length === 3 && AMBIGUOUS.has(two) };
  }
  return { family: s[0], given: s.slice(1), unsure: false };
}

const HINT = /성명|이름|성함|고객명|회원명|담당자|수령인|받는\s*분|name/i;

/** 이름 열로 보이는 첫 열. 머리말이 있어야 고른다(값만으로는 다른 한글 낱말과 헷갈림) */
export function pickNameColumn(rows: string[][], header: number): number {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const body = rows.slice(header + 1, header + 101);
  for (let c = 0; c < width; c++) {
    if (!HINT.test(rows[header]?.[c] ?? "")) continue;
    const vals = body.map((r) => (r[c] ?? "").trim()).filter(Boolean);
    if (vals.length && vals.filter((v) => splitName(v)).length / vals.length >= 0.6) return c;
  }
  return -1;
}
