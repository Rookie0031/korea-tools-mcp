// 주민등록번호·생년월일에서 생년월일, 만 나이, 성별을 계산한다.
// 만 나이는 기준일에 생일이 지났는지로 센다. 2월 29일생은 평년에 3월 1일부터 한 살 더한다.

export interface Birth {
  y: number;
  m: number;
  d: number;
  /** 주민번호에서만 알 수 있다 */
  sex?: "남" | "여";
  foreign?: boolean;
}

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

/**
 * 주민등록번호(하이픈 있어도 없어도). 뒷자리 첫 숫자:
 * 1·2 1900년대 내국인, 3·4 2000년대 내국인, 5·6 1900년대 외국인, 7·8 2000년대 외국인, 9·0 1800년대(9 남, 0 여)
 */
export function fromRrn(raw: string): Birth | null {
  const m = raw.trim().match(/^(\d{2})(\d{2})(\d{2})\s*-?\s*(\d)(\d{0,6})(?:\*+)?$/);
  if (!m) return null;
  const g = +m[4];
  const century = [1800, 1900, 1900, 2000, 2000, 1900, 1900, 2000, 2000, 1800][g];
  const y = century + +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (!valid(y, mo, d)) return null;
  return { y, m: mo, d, sex: g % 2 === 1 ? "남" : "여", foreign: g >= 5 && g <= 8 };
}

/**
 * 생년월일 글자: 1990-01-02, 1990.1.2, 1990/1/2, 1990년 1월 2일, 19900102.
 * 6자리 900102는 기준 연도 뒤 두 자리보다 크면 1900년대로 본다.
 */
export function fromDate(raw: string, refYear = new Date().getFullYear()): Birth | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?\.?(?:[ T].*)?$/);
  if (m) return valid(+m[1], +m[2], +m[3]) ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]) ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const yy = +m[1];
    const y = yy > refYear % 100 ? 1900 + yy : 2000 + yy;
    return valid(y, +m[2], +m[3]) ? { y, m: +m[2], d: +m[3] } : null;
  }
  return null;
}

export interface Ref {
  y: number;
  m: number;
  d: number;
}

/** 기준일의 만 나이. 기준일이 생일보다 앞이면 null */
export function manAge(b: Birth, ref: Ref): number | null {
  let age = ref.y - b.y;
  // 2월 29일생은 평년에 2월 28일까지 생일 전으로 본다
  const bm = b.m;
  const bd = b.m === 2 && b.d === 29 && !valid(ref.y, 2, 29) ? 30 : b.d;
  if (ref.m < bm || (ref.m === bm && ref.d < bd)) age--;
  return age < 0 ? null : age;
}

export function birthText(b: Birth): string {
  return `${b.y}-${String(b.m).padStart(2, "0")}-${String(b.d).padStart(2, "0")}`;
}

/** 열 하나가 주민번호인지 생년월일인지 값으로 추측 */
export function sourceKind(samples: string[]): "rrn" | "date" | null {
  const vals = samples.map((v) => v.trim()).filter(Boolean).slice(0, 50);
  if (vals.length === 0) return null;
  const r = vals.filter((v) => /^\d{6}\s*-?\s*\d/.test(v) && fromRrn(v)).length / vals.length;
  if (r >= 0.6) return "rrn";
  const d = vals.filter((v) => fromDate(v)).length / vals.length;
  return d >= 0.6 ? "date" : null;
}
