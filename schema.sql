-- quokka-agents D1. 입력값·IP·키 원문은 저장하지 않는다(src/usage.ts)
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,      -- 한국 날짜 YYYY-MM-DD
  server TEXT NOT NULL,   -- korea-tools …
  client TEXT NOT NULL,   -- a:<IP+UA 해시 16자> 또는 k:<키 해시 16자>
  tier TEXT NOT NULL,     -- free | paid
  tool TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  ref TEXT,               -- 유입 표시(?ref=gn 등), 11/14 추가
  PRIMARY KEY (day, server, client, tool)
);
CREATE INDEX IF NOT EXISTS usage_client ON usage (day, client);
CREATE TABLE IF NOT EXISTS clients (
  day TEXT NOT NULL,
  server TEXT NOT NULL,
  client TEXT NOT NULL,
  app TEXT NOT NULL,      -- initialize의 clientInfo.name (claude-code, cursor-vscode …)
  version TEXT,
  protocol TEXT,
  ref TEXT,
  PRIMARY KEY (day, server, client, app)
);
CREATE TABLE IF NOT EXISTS keys (
  key_hash TEXT PRIMARY KEY,
  instance_id TEXT,
  status TEXT NOT NULL,   -- active | not_found | inactive | wrong_product
  checked_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  ref TEXT NOT NULL,      -- ?ref= 값, 없으면 ''
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, ref)
);
CREATE TABLE IF NOT EXISTS callers (
  day TEXT NOT NULL,
  server TEXT NOT NULL,
  client TEXT NOT NULL,
  via TEXT NOT NULL,      -- mcp | api
  ua TEXT NOT NULL,       -- User-Agent 제품 이름만(curl, node, python-httpx, mozilla …), 11/15 추가
  PRIMARY KEY (day, server, client, via, ua)
);
