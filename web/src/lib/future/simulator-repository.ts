/**
 * 大学人生模拟器 — PostgreSQL 持久化层
 *
 * 复用 PostgresFutureRepository 的 Queryable 模式，
 * 将会话数据持久化到 Neon，解决内存 Map 热重载丢失问题。
 */

import type { Queryable } from "./postgres";
import { createLogger } from "./logger";
import type {
  SimulateSession,
  SimulateStartInput,
  SimulateHistoryEntry,
} from "./simulator-types";

const log = createLogger("simulator:repo");

export const SIMULATOR_SCHEMA_SQL = `
create table if not exists simulator_sessions (
  id text primary key,
  status text not null default 'playing' check (status in ('playing', 'ended', 'error')),
  profile_json jsonb not null,
  total_rounds integer not null default 8,
  current_round integer not null default 0,
  history_json jsonb not null default '[]',
  current_scene_json jsonb,
  ending_json jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists simulator_sessions_created_at_idx on simulator_sessions(created_at desc);

create table if not exists simulator_shares (
  id text primary key,
  session_id text not null,
  school text not null,
  major text,
  ending_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists simulator_shares_session_id_idx on simulator_shares(session_id);
create index if not exists simulator_shares_created_at_idx on simulator_shares(created_at desc);
`;

/** 分享人设卡的轻量数据（公开页只需要这些） */
export interface SimulatorShareRecord {
  shareId: string;
  sessionId: string;
  school: string;
  major?: string;
  ending: Record<string, unknown>;
  createdAt: string;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function mapRowToSession(row: Record<string, unknown>): SimulateSession {
  return {
    sessionId: String(row.id),
    status: row.status as SimulateSession["status"],
    profile: parseJson<SimulateSession["profile"]>(row.profile_json),
    currentRound: typeof row.current_round === "number" ? row.current_round : 0,
    totalRounds: typeof row.total_rounds === "number" ? row.total_rounds : 8,
    history: parseJson<SimulateHistoryEntry[]>(row.history_json),
    currentScene: row.current_scene_json
      ? parseJson<SimulateSession["currentScene"]>(row.current_scene_json)
      : null,
    ending: row.ending_json
      ? parseJson<SimulateSession["ending"]>(row.ending_json)
      : null,
    error: row.error_text ? String(row.error_text) : null,
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export class SimulatorPostgresRepository {
  constructor(private readonly db: Queryable) {}

  /** 创建新会话 + 初始化第1轮场景 */
  async createSession(input: SimulateStartInput, initialScene: Record<string, unknown>): Promise<string> {
    const id = `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    await this.db.query(
      `insert into simulator_sessions (
        id, profile_json, total_rounds, current_round,
        history_json, current_scene_json, status
      ) values ($1, $2::jsonb, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        id,
        stringifyJson(input.profile),
        input.totalRounds ?? 8,
        0,
        stringifyJson([]),
        stringifyJson(initialScene),
        "playing",
      ],
    );

    log.info({ sessionId: id }, "Session created");
    return id;
  }

  /** 获取完整会话 */
  async getSession(sessionId: string): Promise<SimulateSession | null> {
    const result = await this.db.query(
      "select * from simulator_sessions where id = $1 limit 1",
      [sessionId],
    );

    if (result.rows.length === 0) {
      log.warn({ sessionId }, "Session not found");
      return null;
    }

    return mapRowToSession(result.rows[0]);
  }

  /** 推进一步：更新 history + currentScene + status */
  async advanceStep(
    sessionId: string,
    params: {
      newRound: number;
      historyEntry: SimulateHistoryEntry;
      nextScene: Record<string, unknown> | null;
      isFinal: boolean;
      ending?: Record<string, unknown>;
    },
  ): Promise<void> {
    // 先读取当前 history，追加新条目
    const current = await this.getSession(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);

    const updatedHistory = [...current.history, params.historyEntry];

    await this.db.query(
      `update simulator_sessions set
         current_round = $2,
         history_json = $3::jsonb,
         current_scene_json = $4::jsonb,
         status = $5,
         ending_json = $6::jsonb,
         updated_at = now()
       where id = $1`,
      [
        sessionId,
        params.newRound,
        stringifyJson(updatedHistory),
        params.nextScene ? stringifyJson(params.nextScene) : null,
        params.isFinal ? "ended" : "playing",
        params.ending ? stringifyJson(params.ending) : null,
      ],
    );

    log.debug({ sessionId, round: params.newRound, isFinal: params.isFinal }, "Step advanced");
  }

  /** 标记会话出错 */
  async markError(sessionId: string, error: string): Promise<void> {
    await this.db.query(
      `update simulator_sessions set status = 'error', error_text = $2, updated_at = now() where id = $1`,
      [sessionId, error],
    );
    log.warn({ sessionId, error }, "Session marked as error");
  }

  /** 创建分享记录（从已有 session 复制 ending + profile 的轻量快照） */
  async createShare(params: {
    sessionId: string;
    school: string;
    major?: string;
    ending: Record<string, unknown>;
  }): Promise<string> {
    const id = `shr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await this.db.query(
      `insert into simulator_shares (id, session_id, school, major, ending_json)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [id, params.sessionId, params.school, params.major ?? null, stringifyJson(params.ending)],
    );
    log.info({ shareId: id, sessionId: params.sessionId }, "Share created");
    return id;
  }

  /** 通过 shareId 获取分享记录 */
  async getShare(shareId: string): Promise<SimulatorShareRecord | null> {
    const result = await this.db.query(
      "select * from simulator_shares where id = $1 limit 1",
      [shareId],
    );
    const row = result.rows[0];
    if (!row) {
      log.warn({ shareId }, "Share not found");
      return null;
    }
    return {
      shareId: String(row.id),
      sessionId: String(row.session_id),
      school: String(row.school),
      major: row.major ? String(row.major) : undefined,
      ending: parseJson<Record<string, unknown>>(row.ending_json),
      createdAt: row.created_at ? String(row.created_at) : "",
    };
  }
}
