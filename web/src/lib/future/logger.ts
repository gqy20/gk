import pino from "pino";
import fs from "fs";
import path from "path";

// ── 配置 ──────────────────────────────────────────────
const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as pino.Level;
const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), "..", "logs");
const IS_VERCEL = process.env.VERCEL === "1";
const LOG_TO_CONSOLE = process.env.LOG_CONSOLE !== "0";
const LOG_TO_FILE = process.env.LOG_FILE === "1" || (!IS_VERCEL && process.env.LOG_FILE !== "0");

// ── 时间戳文件名（与 Python 端 crawl_*.log 风格对齐） ─
function getLogFilePath(): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").replace(/\..+$/, "");
  // 例: future_20260606143022.log
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return path.join(LOG_DIR, `future_${ts}.log`);
}

// ── 单例 root logger ─────────────────────────────────
let _rootLogger: pino.Logger | null = null;

function getRootLogger(): pino.Logger {
  if (_rootLogger) return _rootLogger;

  const streams: Array<{ level: string; stream: NodeJS.WritableStream }> = [];

  if (LOG_TO_CONSOLE) {
    streams.push({ level: LOG_LEVEL, stream: process.stdout });
  }

  if (LOG_TO_FILE) {
    try {
      streams.push({
        level: LOG_LEVEL,
        stream: fs.createWriteStream(getLogFilePath(), { flags: "a" }),
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "WARN",
          module: "logger",
          msg: "File logging disabled",
          err: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  _rootLogger = pino(
    {
      level: LOG_LEVEL,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label.toUpperCase() };
        },
      },
      // 去掉 pid/hostname 噪音
      base: undefined,
    },
    streams.length > 0 ? pino.multistream(streams) : undefined,
  );

  return _rootLogger;
}

// ── 公共 API ──────────────────────────────────────────

/** 创建带 module 字段的子 logger */
export function createLogger(moduleName: string): pino.Logger {
  return getRootLogger().child({ module: moduleName });
}

/** 创建绑定 runId 的子 logger（用于关联单次请求的所有日志） */
export function withRunId(parent: pino.Logger, runId: string): pino.Logger {
  return parent.child({ runId });
}
