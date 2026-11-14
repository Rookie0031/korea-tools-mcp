// 원격 MCP(Streamable HTTP) 최소 구현. 세션을 두지 않는다(stateless): POST 하나에 JSON 응답 하나.
// 규격: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
// GET(서버 → 클라이언트 스트림)은 쓰지 않으므로 405를 돌려준다.

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(args: Record<string, any>): unknown | Promise<unknown>;
}

export interface ServerInfo {
  name: string;
  title: string;
  version: string;
  instructions: string;
  tools: ToolDef[];
}

/** 도구 호출 직전에 부른다. 문자열을 돌려주면 그 글을 오류 결과로 내고 도구는 돌리지 않는다(한도 초과 등) */
export interface CallHooks {
  beforeCall(tool: string): Promise<string | null>;
  afterCall(tool: string, ok: boolean, ms: number): void;
  onInitialize(clientName: string, clientVersion: string, protocol: string): void;
  isUserError(e: unknown): boolean;
}

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function rpcError(id: Msg["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleOne(m: Msg, s: ServerInfo, h: CallHooks): Promise<object | null> {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return rpcError(m?.id, -32600, "Invalid Request");
  const isNote = m.id === undefined;
  const id = m.id;
  switch (m.method) {
    case "initialize": {
      const p = m.params ?? {};
      const asked = String(p.protocolVersion ?? "");
      const protocol = VERSIONS.includes(asked) ? asked : VERSIONS[1];
      const ci = (p.clientInfo ?? {}) as { name?: string; version?: string };
      h.onInitialize(String(ci.name ?? "unknown").slice(0, 60), String(ci.version ?? "").slice(0, 30), protocol);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: protocol,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: s.name, title: s.title, version: s.version },
          instructions: s.instructions,
        },
      };
    }
    case "ping":
      return isNote ? null : { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: s.tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: { title: t.title, ...t.annotations } })),
        },
      };
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const tool = s.tools.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      const blocked = await h.beforeCall(name);
      if (blocked) return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: blocked }], isError: true } };
      const t0 = Date.now();
      try {
        const out = await tool.run((m.params?.arguments ?? {}) as Record<string, unknown>);
        h.afterCall(name, true, Date.now() - t0);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: out, isError: false },
        };
      } catch (e) {
        h.afterCall(name, false, Date.now() - t0);
        if (!h.isUserError(e)) console.error(JSON.stringify({ tool: name, crash: String(e) }));
        const msg = h.isUserError(e) ? (e as Error).message : "internal error";
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Error: ${msg}` }], isError: true } };
      }
    }
    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: [] } };
    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: [] } };
    default:
      if (isNote) return null; // notifications/initialized, notifications/cancelled …
      return rpcError(id, -32601, `Method not found: ${m.method}`);
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export async function handleMcp(req: Request, s: ServerInfo, h: CallHooks): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify(rpcError(null, -32000, "Method not allowed: this server is stateless; POST JSON-RPC messages")), {
      status: 405,
      headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "application/json" },
    });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Msg[];
  if (msgs.length === 0 || msgs.length > 50) return Response.json(rpcError(null, -32600, "Invalid Request"), { status: 400, headers: CORS });
  const out = (await Promise.all(msgs.map((m) => handleOne(m, s, h)))).filter((x): x is object => x !== null);
  if (out.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? out : out[0], { headers: { ...CORS, "Cache-Control": "no-store" } });
}
