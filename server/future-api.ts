import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { handleCreateFutureRun, handleGetFutureRun } from "../web/src/lib/future/server";

function loadEnv(path = ".env") {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) return;

  const text = readFileSync(fullPath, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = raw.replace(/^['"]|['"]$/g, "");
  }
}

function sendJson(res: Parameters<Parameters<typeof createServer>[0]>[1], status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.FUTURE_API_CORS_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
  });
  res.end(json);
}

async function readJson(req: Parameters<Parameters<typeof createServer>[0]>[0]) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  return text ? JSON.parse(text) : {};
}

loadEnv();
loadEnv("../.env");

const port = Number(process.env.FUTURE_API_PORT || 8601);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/future-runs") {
    try {
      const body = await readJson(req);
      const result = await handleCreateFutureRun(body);
      sendJson(res, 200, { runId: result.runId, status: result.status });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "future generation failed" });
    }
    return;
  }

  const match = url.pathname.match(/^\/api\/future-runs\/([^/]+)$/);
  if (req.method === "GET" && match) {
    try {
      const result = await handleGetFutureRun(decodeURIComponent(match[1]));
      if (!result) {
        sendJson(res, 404, { error: "run not found" });
        return;
      }
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "future result lookup failed" });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(port, () => {
  console.log(`Future API listening on http://localhost:${port}`);
});
