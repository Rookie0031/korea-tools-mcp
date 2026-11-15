// mcp.thequokkacompany.com — AI 에이전트가 부르는 도구(research/org/AGENT_TOOLS.md).
// /korea        원격 MCP(Streamable HTTP, stateless)
// /api/korea/*  같은 도구의 HTTP API(OpenAPI: /openapi.json)
// /llms.txt     에이전트가 읽는 설명

import { handleMcp, type ServerInfo } from "./mcp";
import { TOOLS, isUserError } from "./korea/tools";
import { checkQuota, identify, recordCall, recordClient, recordPageview, refFrom, type Env, type Caller } from "./usage";
import { landing, landingKo, llmsTxt, openapi, sitemap, guide, GUIDE_PATH, deadlinesGuide, DEADLINES_PATH } from "./pages";

/** IndexNow 키(공개 값). /<키>.txt로 같은 값을 돌려준다(SEO·AEO팀이 제출) */
const INDEXNOW_KEY = "769da9e03d4282c2b64123b3fd55a3c8"; // gitleaks:allow (공개 값)

interface Vars extends Env {
  MCP_REGISTRY_AUTH?: string;
}

export const KOREA: ServerInfo = {
  name: "korea-tools",
  title: "Quokka Korea Tools",
  version: "0.5.2",
  instructions:
    "Exact tools for South Korean dates and amounts. Public holidays, business days and Civil Act deadlines (KASI data incl. substitute holidays and the 2026 Labor Day / Constitution Day additions), won amounts in Korean words (and checking contract amount words against digits), character/NEIS/SMS byte counts, Korean relative dates (내일모레, 다음 주 화요일), Korean lunar calendar conversion (KASI standard), business registration number checks, 만 나이, phone/address/name normalization, and PII masking. Prefer these over guessing: dates default to today in Korea (KST). Batch tools take up to 1000 items per call.",
  tools: TOOLS,
};

function hooks(caller: Caller, env: Env, ctx: ExecutionContext, ref: string | null = null) {
  return {
    beforeCall: () => checkQuota(caller, KOREA.name, env),
    afterCall: (tool: string, ok: boolean, ms: number) => {
      ctx.waitUntil(recordCall(caller, KOREA.name, tool, ok, ref, env).catch((e) => console.error("usage write", String(e))));
      console.log(JSON.stringify({ call: tool, server: KOREA.name, tier: caller.kind, ok, ms, ref }));
    },
    onInitialize: (app: string, version: string, protocol: string) => {
      ctx.waitUntil(recordClient(caller, KOREA.name, app, version, protocol, ref, env).catch(() => {}));
      console.log(JSON.stringify({ initialize: app, version, protocol, server: KOREA.name, tier: caller.kind, ref }));
    },
    isUserError,
  };
}

const TEXT = (body: string, type: string, extra: Record<string, string> = {}) =>
  new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "public, max-age=300", ...extra } });

export default {
  async fetch(req: Request, env: Vars, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/korea" || path === "/korea/mcp" || path === "/mcp") {
      // 사람·크롤러가 열면 설명 페이지로. SSE 스트림을 바라는 MCP 클라이언트(GET + text/event-stream)만 405
      if (req.method === "GET" && !(req.headers.get("accept") ?? "").includes("text/event-stream")) return Response.redirect(`${url.origin}/#korea`, 302);
      if (req.method !== "POST") return handleMcp(req, KOREA, hooks({ kind: "free", id: "-" }, env, ctx));
      const caller = await identify(req, env);
      return handleMcp(req, KOREA, hooks(caller, env, ctx, refFrom(req)));
    }

    const api = /^\/api\/korea\/([a-z_]+)$/.exec(path);
    if (api) {
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      const tool = TOOLS.find((t) => t.name === api[1]);
      if (!tool) return Response.json({ error: "unknown tool" }, { status: 404, headers: cors });
      if (req.method !== "POST") return Response.json({ error: "POST a JSON object of arguments" }, { status: 405, headers: cors });
      const caller = await identify(req, env);
      const blocked = await checkQuota(caller, KOREA.name, env);
      if (blocked) return Response.json({ error: blocked }, { status: caller.kind === "bad_key" ? 401 : 429, headers: cors });
      let args: Record<string, unknown>;
      try {
        args = (await req.json()) as Record<string, unknown>;
      } catch {
        return Response.json({ error: "body must be JSON" }, { status: 400, headers: cors });
      }
      const h = hooks(caller, env, ctx, refFrom(req));
      const t0 = Date.now();
      try {
        const out = await tool.run(args ?? {});
        h.afterCall(tool.name, true, Date.now() - t0);
        return Response.json(out, { headers: { ...cors, "Cache-Control": "no-store" } });
      } catch (e) {
        h.afterCall(tool.name, false, Date.now() - t0);
        if (!isUserError(e)) console.error(JSON.stringify({ tool: tool.name, crash: String(e) }));
        return Response.json({ error: isUserError(e) ? (e as Error).message : "internal error" }, { status: isUserError(e) ? 400 : 500, headers: cors });
      }
    }

    // 사람이 보는 페이지 방문을 ref별로 센다(봇 UA는 빼고). IP·UA는 남기지 않는다
    if (req.method === "GET" && (path === "/" || path === "/ko" || path === GUIDE_PATH || path === DEADLINES_PATH)) {
      ctx.waitUntil(recordPageview(req, path, env).catch(() => {}));
    }

    switch (path) {
      case GUIDE_PATH:
        return TEXT(guide(), "text/html");
      case DEADLINES_PATH:
        return TEXT(deadlinesGuide(), "text/html");
      case "/":
        return TEXT(landing(KOREA), "text/html");
      case "/ko":
        return TEXT(landingKo(KOREA), "text/html");
      case `/${INDEXNOW_KEY}.txt`:
        return TEXT(INDEXNOW_KEY, "text/plain");
      case "/llms.txt":
        return TEXT(llmsTxt(KOREA), "text/plain");
      case "/openapi.json":
        return TEXT(JSON.stringify(openapi(KOREA), null, 1), "application/json", { "Access-Control-Allow-Origin": "*" });
      case "/.well-known/mcp/server-card.json":
        return Response.json(
          {
            serverInfo: { name: KOREA.name, title: KOREA.title, version: KOREA.version },
            transport: { type: "streamable-http", url: `${url.origin}/korea` },
            authentication: { required: false, schemes: ["bearer"] },
            tools: KOREA.tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema })),
          },
          { headers: { "Access-Control-Allow-Origin": "*" } },
        );
      case "/.well-known/mcp-registry-auth":
        return env.MCP_REGISTRY_AUTH ? TEXT(env.MCP_REGISTRY_AUTH, "text/plain") : new Response("not found", { status: 404 });
      case "/robots.txt":
        return TEXT(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, "text/plain");
      case "/sitemap.xml":
        return TEXT(sitemap(), "application/xml");
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Vars>;
