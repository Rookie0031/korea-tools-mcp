// 호출 수 세기·무료 한도·유료 키. 설계: research/agent-tools/PRICING.md
// - 키 없이: 클라이언트(IP+User-Agent를 비밀 소금으로 해시한 16자) 하나당 한국 날짜 하루 FREE_DAILY회.
// - 유료 키: Dodo 라이선스 키를 API 키로 쓴다(Authorization: Bearer <키> 또는 ?key=<키>). 키 하나당 하루 PAID_DAILY회.
// IP·키 원문·도구 입력값은 저장하지 않는다. D1에는 해시와 날짜별 횟수만 남는다.

export interface Env {
  DB: D1Database;
  CLIENT_SALT?: string;
  DODO_API_KEY?: string;
  DODO_ENV?: string;
  /** 쉼표로 나눈 유료 상품 번호. 비어 있으면 유료 키를 받지 않는다(판매 전) */
  PAID_PRODUCT_IDS?: string;
  FREE_DAILY?: string;
  PAID_DAILY?: string;
}

export const PRICING_URL = "https://mcp.thequokkacompany.com/#pricing";

async function sha(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function keyFrom(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S{8,200})$/i.exec(auth);
  if (m) return m[1];
  const q = new URL(req.url).searchParams.get("key");
  return q && q.length >= 8 && q.length <= 200 ? q : null;
}

/** 설정 예시 주소에 단 유입 표시(?ref=gn). 글자·숫자·-_ 20자까지만 받는다 */
export function refFrom(req: Request): string | null {
  const r = new URL(req.url).searchParams.get("ref");
  return r && /^[A-Za-z0-9_-]{1,20}$/.test(r) ? r.toLowerCase() : null;
}

export type Caller = { kind: "free"; id: string } | { kind: "paid"; id: string } | { kind: "bad_key"; id: string; reason: string };

function dodoBase(env: Env) {
  return env.DODO_ENV === "test" ? "https://test.dodopayments.com" : "https://live.dodopayments.com";
}

async function dodoJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 키를 Dodo에 처음 확인할 때 자리 하나를 잡고(activate), 그 자리 → 키 → 상품을 따라가 우리 상품인지 본다 */
async function checkKey(key: string, keyHash: string, env: Env, f: typeof fetch): Promise<"active" | "not_found" | "wrong_product" | "inactive" | "upstream"> {
  const products = (env.PAID_PRODUCT_IDS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const base = dodoBase(env);
  const row = await env.DB.prepare("SELECT instance_id, status, checked_at FROM keys WHERE key_hash = ?").bind(keyHash).first<{ instance_id: string | null; status: string; checked_at: number }>();
  const now = Date.now();
  if (row && now - row.checked_at < 6 * 3600_000) return row.status as "active";
  const post = (path: string, body: object) => f(`${base}/licenses/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const save = (status: string, instance: string | null) =>
    env.DB.prepare("INSERT INTO keys (key_hash, instance_id, status, checked_at) VALUES (?, ?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET instance_id = excluded.instance_id, status = excluded.status, checked_at = excluded.checked_at")
      .bind(keyHash, instance, status, now)
      .run();
  try {
    if (row?.instance_id && row.status === "active") {
      const r = await post("validate", { license_key: key, license_key_instance_id: row.instance_id });
      if (!r.ok) return r.status >= 500 ? "active" : "inactive";
      const v = await dodoJson(r);
      const status = v.valid === true ? "active" : "inactive";
      await save(status, row.instance_id);
      return status;
    }
    const r = await post("activate", { license_key: key, name: "mcp.thequokkacompany.com" });
    if (r.status === 404) return (await save("not_found", null), "not_found");
    if (r.status === 403 || r.status === 422) return (await save("inactive", null), "inactive");
    if (!r.ok) return "upstream";
    const inst = await dodoJson(r);
    const instanceId = String(inst.id ?? "");
    const keyId = String(inst.license_key_id ?? "");
    const k = await f(`${base}/license_keys/${encodeURIComponent(keyId)}`, { headers: { Authorization: `Bearer ${env.DODO_API_KEY ?? ""}` } });
    const product = String((await dodoJson(k)).product_id ?? "");
    if (!products.includes(product)) {
      if (instanceId) await post("deactivate", { license_key: key, license_key_instance_id: instanceId });
      await save("wrong_product", null);
      return "wrong_product";
    }
    await save("active", instanceId);
    return "active";
  } catch {
    return row?.status === "active" ? "active" : "upstream";
  }
}

export async function identify(req: Request, env: Env, f: typeof fetch = fetch): Promise<Caller> {
  const key = keyFrom(req);
  if (key && (env.PAID_PRODUCT_IDS ?? "").trim()) {
    const keyHash = await sha(`key|${key}`);
    const id = `k:${keyHash.slice(0, 16)}`;
    const st = await checkKey(key, keyHash, env, f);
    if (st === "active") return { kind: "paid", id };
    if (st !== "upstream") return { kind: "bad_key", id, reason: st };
  }
  const ip = req.headers.get("cf-connecting-ip") ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  return { kind: "free", id: `a:${(await sha(`${env.CLIENT_SALT ?? "quokka"}|${ip}|${ua}`)).slice(0, 16)}` };
}

export function limitFor(c: Caller, env: Env): number {
  return c.kind === "paid" ? Number(env.PAID_DAILY ?? 10000) : Number(env.FREE_DAILY ?? 200);
}

/** 한도 안이면 null, 넘었으면 모델이 사용자에게 그대로 전할 글 */
export async function checkQuota(c: Caller, server: string, env: Env): Promise<string | null> {
  if (c.kind === "bad_key") {
    return `The API key was not accepted (${c.reason}). Remove the key to use the free tier, or see ${PRICING_URL}.`;
  }
  const day = kstDay();
  const used = await env.DB.prepare("SELECT COALESCE(SUM(calls), 0) AS n FROM usage WHERE day = ? AND client = ?").bind(day, c.id).first<{ n: number }>();
  const limit = limitFor(c, env);
  if ((used?.n ?? 0) >= limit) {
    return c.kind === "paid"
      ? `Daily limit of ${limit} calls for this key reached (resets at 00:00 KST). Contact contact@thequokkacompany.com for a higher limit.`
      : `Free daily limit of ${limit} calls reached for this client (resets at 00:00 Korea time). A paid key raises the limit: ${PRICING_URL}`;
  }
  return null;
}

export function recordCall(c: Caller, server: string, tool: string, ok: boolean, ref: string | null, env: Env): Promise<unknown> {
  return env.DB.prepare(
    "INSERT INTO usage (day, server, client, tier, tool, calls, errors, ref) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(day, server, client, tool) DO UPDATE SET calls = calls + 1, errors = errors + excluded.errors, ref = COALESCE(usage.ref, excluded.ref)",
  )
    .bind(kstDay(), server, c.id, c.kind, tool, ok ? 0 : 1, ref)
    .run();
}

export function recordClient(c: Caller, server: string, app: string, version: string, protocol: string, ref: string | null, env: Env): Promise<unknown> {
  return env.DB.prepare("INSERT OR IGNORE INTO clients (day, server, client, app, version, protocol, ref) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(kstDay(), server, c.id, app, version, protocol, ref)
    .run();
}

const BOT = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|go-http|headless|lighthouse|monitor|scan/i;

export function recordPageview(req: Request, path: string, env: Env): Promise<unknown> {
  if (BOT.test(req.headers.get("user-agent") ?? "")) return Promise.resolve();
  return env.DB.prepare("INSERT INTO pages (day, path, ref, views) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, ref) DO UPDATE SET views = views + 1")
    .bind(kstDay(), path, pageSource(req))
    .run();
}

/** 페이지 방문 출처: ?ref가 있으면 그 값, 없으면 바깥 Referer 호스트("r:forum.cursor.com"),
 *  둘 다 없는데 Sec-Fetch-Mode가 없으면 "x:nosf"(브라우저가 아닌 스크립트일 가능성이 큼), 나머지는 "" */
export function pageSource(req: Request): string {
  const ref = refFrom(req);
  if (ref) return ref;
  try {
    const host = new URL(req.headers.get("referer") ?? "").hostname;
    if (host && host !== new URL(req.url).hostname) return `r:${host}`.slice(0, 60);
  } catch {}
  return req.headers.get("sec-fetch-mode") ? "" : "x:nosf";
}
