// 한국어 글자 수·바이트. 자기소개서·생활기록부(NEIS)·문자메시지 제한을 맞출 때 쓴다.
// 글자는 화면에 보이는 한 글자(문자소) 단위로 센다. 모델은 토큰을 보므로 글자 수를 자주 틀린다.

const seg = new Intl.Segmenter("ko", { granularity: "grapheme" });

function graphemes(s: string): string[] {
  return [...seg.segment(s)].map((x) => x.segment);
}

/** EUC-KR(완성형)로 쓸 수 있는 글자인지 대충: ASCII 1바이트, 그 밖은 2바이트로 센다(문자 서비스가 흔히 쓰는 방식) */
function smsBytes(g: string): number {
  return /^[\x00-\x7f]$/.test(g) ? 1 : 2;
}

export function countText(raw: string) {
  const text = raw.replace(/\r\n?/g, "\n");
  const gs = graphemes(text);
  const newlines = gs.filter((g) => g === "\n").length;
  const spaces = gs.filter((g) => /^\s$/.test(g) && g !== "\n").length;
  const hangul = gs.filter((g) => /^[ᄀ-ᇿ㄰-㆏가-힣]/.test(g)).length;
  const ascii = gs.filter((g) => /^[\x00-\x7f]$/.test(g)).length;
  const other = gs.length - hangul - ascii;
  // NEIS: 한글 3바이트, 영문·숫자·공백 1바이트. 줄바꿈은 1바이트라는 안내와 2바이트라는 안내가 섞여 있어 둘 다 준다
  const neisBase = hangul * 3 + (ascii - newlines) + other * 3;
  const sms = gs.reduce((n, g) => n + smsBytes(g), 0) + newlines; // 줄바꿈은 CRLF 2바이트
  return {
    chars_with_spaces: gs.length - newlines,
    chars_without_spaces: gs.length - newlines - spaces,
    chars_including_line_breaks: gs.length,
    line_breaks: newlines,
    lines: text === "" ? 0 : newlines + 1,
    words: text.trim() === "" ? 0 : text.trim().split(/\s+/).length,
    hangul_chars: hangul,
    utf8_bytes: new TextEncoder().encode(text).length,
    neis_bytes: neisBase + newlines * 2,
    neis_bytes_if_enter_is_1: neisBase + newlines,
    sms_bytes: sms,
    message_type: sms <= 90 ? "SMS (90 bytes or less)" : sms <= 2000 ? "LMS (91-2000 bytes)" : "over LMS limit (2000 bytes)",
    notes: [
      "NEIS: Hangul 3 bytes, ASCII 1 byte. Guides disagree on whether Enter is 1 or 2 bytes; check in the NEIS input screen before submitting.",
      "SMS bytes count non-ASCII as 2 bytes and line breaks as 2 bytes; carriers and senders may differ slightly.",
    ],
  };
}
