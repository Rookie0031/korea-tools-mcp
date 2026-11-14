// 한국 주소 글자를 시도·시군구·나머지로 나눈다. 외부 주소 DB 없이 시도 이름표와 글자 모양만 쓴다.
// 우편번호(앞 5자리)는 떼어 낸다. 세종특별자치시는 시군구가 없다.

const SIDO: [string, string[]][] = [
  ["서울특별시", ["서울특별시", "서울시", "서울"]],
  ["부산광역시", ["부산광역시", "부산시", "부산"]],
  ["대구광역시", ["대구광역시", "대구시", "대구"]],
  ["인천광역시", ["인천광역시", "인천시", "인천"]],
  ["광주광역시", ["광주광역시", "광주"]],
  ["대전광역시", ["대전광역시", "대전시", "대전"]],
  ["울산광역시", ["울산광역시", "울산시", "울산"]],
  ["세종특별자치시", ["세종특별자치시", "세종시", "세종"]],
  ["경기도", ["경기도", "경기"]],
  ["강원특별자치도", ["강원특별자치도", "강원도", "강원"]],
  ["충청북도", ["충청북도", "충북"]],
  ["충청남도", ["충청남도", "충남"]],
  ["전북특별자치도", ["전북특별자치도", "전라북도", "전북"]],
  ["전라남도", ["전라남도", "전남"]],
  ["경상북도", ["경상북도", "경북"]],
  ["경상남도", ["경상남도", "경남"]],
  ["제주특별자치도", ["제주특별자치도", "제주도", "제주"]],
];

// 긴 이름부터 맞춘다(서울특별시가 서울보다 먼저)
const ALIASES = SIDO.flatMap(([full, names]) => names.map((n) => [n, full] as const)).sort((a, b) => b[0].length - a[0].length);

export interface SplitAddress {
  sido: string;
  /** 시도를 적힌 그대로(서울, 서울특별시…) */
  sidoRaw: string;
  sigungu: string;
  rest: string;
}

export function splitAddress(raw: string): SplitAddress | null {
  let s = raw.replace(/\s+/g, " ").trim();
  // 우편번호: "(06236) 서울…", "06236 서울…", "[06236]서울…"
  s = s.replace(/^[([]?\d{5}[)\]]?\s*/, "");
  let sido = "";
  let sidoRaw = "";
  for (const [alias, full] of ALIASES) {
    if (s.startsWith(alias)) {
      const next = s.slice(alias.length);
      // "광주시"는 경기도 광주시다
      if (alias === "광주" && /^시/.test(next)) break;
      // 붙여 쓴 주소(서울강남구…)는 바로 뒤가 시군구일 때만 시도로 본다
      if (next !== "" && !/^[\s,]/.test(next) && !/^[가-힣]{1,5}?[시군구]/.test(next)) continue;
      sido = full;
      sidoRaw = alias;
      s = next.replace(/^[\s,]+/, "");
      break;
    }
  }
  if (sido === "" && s.startsWith("광주시")) sido = "경기도";

  let sigungu = "";
  if (sido !== "세종특별자치시") {
    // 띄어 쓴 경우와 붙여 쓴 경우(강남구테헤란로) 둘 다
    const m = s.match(/^(\S+?[시군구])(?=[\s,]|$)/) ?? s.match(/^([가-힣]{1,5}?[시군구])(?=[가-힣])/);
    if (m) {
      let tail = s.slice(m[1].length).replace(/^[\s,]+/, "");
      sigungu = m[1];
      // 일반구가 있는 시: 수원시 영통구, 고양시 일산동구, 포항시 남구
      if (m[1].endsWith("시")) {
        const g = tail.match(/^(\S{1,5}?구)(?=[\s,]|$)/) ?? tail.match(/^([가-힣]{1,4}?구)(?=[가-힣]+(?:로|길|동|읍|면))/);
        if (g) {
          sigungu = `${m[1]} ${g[1]}`;
          tail = tail.slice(g[1].length).replace(/^[\s,]+/, "");
        }
      }
      s = tail;
    }
  }
  if (sido === "" && sigungu === "") return null;
  return { sido, sidoRaw, sigungu, rest: s.trim() };
}

/** 나머지 주소를 기본주소(도로명·지번 + 건물번호)와 상세주소로 */
export function splitDetail(rest: string): [string, string] {
  const s = rest.trim();
  // 읍·면 + 도로명/지번, 또는 도로명/지번 바로
  const m =
    s.match(/^((?:\S+[읍면]\s)?\S+?(?:로|길)(?:\s?\d+(?:번)?길)?\s?(?:지하\s?)?\d+(?:-\d+)?)(.*)$/) ??
    s.match(/^((?:\S+[읍면]\s)?\S+?(?:동|리|가)\d*\s?(?:산\s?)?\d+(?:-\d+)?(?:번지)?)(.*)$/);
  if (!m) return [s, ""];
  return [m[1].trim(), m[2].replace(/^[\s,]+/, "").trim()];
}

const HINT = /주소|address|배송지|거주지|소재지|주거지|사업장/i;

export function looksLikeAddress(v: string): boolean {
  const r = splitAddress(v);
  return !!r && r.sido !== "" && /\d/.test(v);
}

/** 주소 열로 보이는 첫 열. 머리말 힌트가 있으면 그 열 */
export function pickAddressColumn(rows: string[][], header: number): number {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const body = rows.slice(header + 1, header + 101);
  let fallback = -1;
  for (let c = 0; c < width; c++) {
    const vals = body.map((r) => (r[c] ?? "").trim()).filter(Boolean);
    if (vals.length === 0) continue;
    const ratio = vals.filter(looksLikeAddress).length / vals.length;
    if (ratio >= 0.5 && HINT.test(rows[header]?.[c] ?? "")) return c;
    if (ratio >= 0.6 && fallback === -1) fallback = c;
  }
  return fallback;
}
