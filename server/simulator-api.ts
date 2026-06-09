/**
 * 大学人生模拟器 — 独立 Node.js 服务
 *
 * 从 Next.js API Route 中提取，避免 Next.js 请求管道开销。
 * 模式参照 server/future-api.ts
 *
 * 端口: 8602（通过 SIMULATOR_API_PORT 配置）
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  handleCreateSimulatorSession,
  handleSimulateStep,
  handleGetSimulatorSession,
} from "../web/src/lib/future/simulator-server";

// ── .env 加载（与 future-api.ts 一致）─────────────

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

// ── HTTP 工具函数 ───────────────────────────────────

function sendJson(
  res: Parameters<Parameters<typeof createServer>[0]>[1],
  status: number,
  body: unknown,
) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin":
      process.env.SIMULATOR_API_CORS_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
  });
  res.end(json);
}

async function readJson(
  req: Parameters<Parameters<typeof createServer>[0]>[0],
) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  return text ? JSON.parse(text) : {};
}

// ── 启动 ─────────────────────────────────────────────

loadEnv();
loadEnv("../.env");

const port = Number(process.env.SIMULATOR_API_PORT || 8602);

const server = createServer(async (req, res) => {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  // CORS preflight
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  // 健康检查
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", service: "simulator-api" });
    return;
  }

  // POST /api/simulator — 创建会话 + 第1轮
  if (req.method === "POST" && url.pathname === "/api/simulator") {
    try {
      const body = await readJson(req);
      const session = await handleCreateSimulatorSession(body);
      sendJson(res, 200, session);
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : "Failed to create session",
      });
    }
    return;
  }

  // GET /api/simulator/:sessionId — 获取会话状态
  const getSessionMatch =
    url.pathname.match(/^\/api\/simulator\/([^/]+)$/);
  if (req.method === "GET" && getSessionMatch) {
    try {
      const sessionId = decodeURIComponent(getSessionMatch[1]);
      const session = await handleGetSimulatorSession(sessionId);
      sendJson(res, 200, session);
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes("not found")
          ? 404
          : 500;
      sendJson(res, status, {
        error:
          error instanceof Error ? error.message : "Failed to get session",
      });
    }
    return;
  }

  // POST /api/simulator/:sessionId — 提交选择 → 推演下一步
  if (req.method === "POST" && getSessionMatch) {
    try {
      const sessionId = decodeURIComponent(getSessionMatch[1]);
      const body = await readJson(req);
      const { choiceId } = body as { choiceId?: string };

      if (!choiceId?.trim()) {
        sendJson(res, 400, { error: "choiceId is required" });
        return;
      }

      const result = await handleSimulateStep(sessionId, choiceId);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : "Simulation step failed",
      });
    }
    return;
  }

  // 404
  sendJson(res, 404, { error: "not found", availableRoutes: ["/api/health", "/api/simulator", "/api/simulator/:sessionId"] });
});

server.listen(port, () => {
  console.log(`🎮 Simulator API listening on http://localhost:${port}`);
});
