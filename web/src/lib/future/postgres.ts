import type { CompleteRunParams, CreateRunParams, FutureRepository, ListRunsOptions } from "./repository";
import type { FuturePath, FutureRunListItem, FutureRunRecord, FutureRunResult, FutureStructuredOutput } from "./types";
import { createLogger } from "./logger";

const log = createLogger("postgres");

export const FUTURE_SCHEMA_SQL = `
create table if not exists future_runs (
  id text primary key default ('run_' || replace(gen_random_uuid()::text, '-', '')),
  status text not null check (status in ('generating', 'completed', 'failed')),
  profile_json jsonb not null,
  choice_context_json jsonb not null,
  input_json jsonb not null,
  output_json jsonb,
  model text not null,
  prompt_version text not null,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists future_paths (
  id text primary key default ('path_' || replace(gen_random_uuid()::text, '-', '')),
  run_id text not null references future_runs(id) on delete cascade,
  path_index integer not null,
  label text not null,
  summary text,
  scores_json jsonb not null,
  timeline_json jsonb not null,
  risks_json jsonb not null,
  advice text not null,
  raw_output_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, path_index)
);

create table if not exists llm_events (
  id text primary key default ('evt_' || replace(gen_random_uuid()::text, '-', '')),
  run_id text references future_runs(id) on delete cascade,
  event_type text not null,
  model text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists future_runs_created_at_idx on future_runs(created_at desc);
create index if not exists future_paths_run_id_idx on future_paths(run_id);
create index if not exists llm_events_run_id_idx on llm_events(run_id);
`;

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function parseMaybeJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function mapRunRow(row: Record<string, unknown>): FutureRunRecord {
  return {
    id: String(row.id),
    status: row.status as FutureRunRecord["status"],
    input: parseMaybeJson(row.input_json),
    output: row.output_json ? parseMaybeJson(row.output_json) : null,
    model: String(row.model || ""),
    promptVersion: String(row.prompt_version || ""),
    error: row.error ? String(row.error) : null,
    inputTokens: typeof row.input_tokens === "number" ? row.input_tokens : null,
    outputTokens: typeof row.output_tokens === "number" ? row.output_tokens : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/** 把 listRuns 的 select 行压成列表卡片项 */
function mapListRow(row: Record<string, unknown>): FutureRunListItem {
  const paths = parseMaybeJson<Array<{ fit_score: number; probability_tone: "稳健" | "均衡" | "冒险" }>>(row.output_paths ?? []);
  const fitScores = paths.map((p) => p?.fit_score ?? 0);
  const fitScoreMax = fitScores.length ? Math.max(...fitScores) : 0;
  const top = fitScoreMax > 0
    ? paths.reduce<typeof paths[number] | null>((best, p) => (best && best.fit_score >= p.fit_score ? best : p), null)
    : null;
  const summary = String(row.output_summary || "");
  return {
    id: String(row.id),
    title: String(row.output_title || ""),
    summary: summary.length > 80 ? `${summary.slice(0, 79)}…` : summary,
    school: String(row.school || ""),
    major: row.major ? String(row.major) : undefined,
    status: row.status as FutureRunListItem["status"],
    fitScoreMax,
    toneTop: top?.probability_tone ?? null,
    errorMessage: row.error ? String(row.error) : null,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

export class PostgresFutureRepository implements FutureRepository {
  constructor(private readonly db: Queryable) {}

  async createRun(params: CreateRunParams) {
    const result = await this.db.query<{ id: string }>(
      `insert into future_runs (
        status,
        profile_json,
        choice_context_json,
        input_json,
        model,
        prompt_version
      ) values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6)
      returning id`,
      [
        params.status,
        stringifyJson(params.input.profile),
        stringifyJson(params.input.choiceContext),
        stringifyJson(params.input),
        params.model,
        params.promptVersion,
      ],
    );

    const runId = result.rows[0].id;
    log.debug({ runId, status: params.status, model: params.model }, "createRun inserted");
    return { id: runId };
  }

  async completeRun(runId: string, params: CompleteRunParams) {
    const pathCount = params.output.paths?.length ?? 0;
    log.info({ runId, pathCount, inputTokens: params.inputTokens, outputTokens: params.outputTokens }, "completeRun updating");

    await this.db.query(
      `update future_runs
       set status = 'completed',
           output_json = $2::jsonb,
           input_tokens = $3,
           output_tokens = $4,
           completed_at = now(),
           updated_at = now()
       where id = $1`,
      [runId, stringifyJson(params.output), params.inputTokens, params.outputTokens],
    );

    await this.db.query("delete from future_paths where run_id = $1", [runId]);

    for (const path of params.output.paths) {
      await this.insertPath(runId, path);
    }

    await this.db.query(
      `insert into llm_events (
        run_id,
        event_type,
        input_tokens,
        output_tokens
      ) values ($1, 'completed', $2, $3)`,
      [runId, params.inputTokens, params.outputTokens],
    );
  }

  async failRun(runId: string, error: string) {
    log.error({ runId, error }, "failRun marking run as failed");
    await this.db.query(
      `update future_runs
       set status = 'failed',
           error = $2,
           updated_at = now()
       where id = $1`,
      [runId, error],
    );
    await this.db.query(
      `insert into llm_events (run_id, event_type, error) values ($1, 'failed', $2)`,
      [runId, error],
    );
  }

  async getRunResult(runId: string): Promise<FutureRunResult | null> {
    const result = await this.db.query<Record<string, unknown>>(
      "select * from future_runs where id = $1 limit 1",
      [runId],
    );
    const row = result.rows[0];
    if (!row) {
      log.warn({ runId }, "getRunResult: run not found");
      return null;
    }
    const run = mapRunRow(row);
    return {
      run,
      output: row.output_json ? parseMaybeJson<FutureStructuredOutput>(row.output_json) : null,
    };
  }

  async listRuns(opts: ListRunsOptions = {}): Promise<FutureRunListItem[]> {
    const limit = opts.limit ?? 20;
    const result = await this.db.query<Record<string, unknown>>(
      `select id,
              status,
              error,
              created_at,
              input_json->'choiceContext'->>'school' as school,
              input_json->'choiceContext'->>'major' as major,
              output_json->>'title' as output_title,
              output_json->>'summary' as output_summary,
              output_json->'paths' as output_paths
       from future_runs
       order by created_at desc
       limit $1`,
      [limit],
    );
    log.debug({ limit, count: result.rows.length }, "listRuns queried");
    return result.rows.map(mapListRow);
  }

  private async insertPath(runId: string, path: FuturePath) {
    const scores = path.scores || {};
    const timeline = Array.isArray(path.timeline) ? path.timeline : [];
    const risks = Array.isArray(path.key_risks) ? path.key_risks : [];

    await this.db.query(
      `insert into future_paths (
        run_id,
        path_index,
        label,
        summary,
        scores_json,
        timeline_json,
        risks_json,
        advice,
        raw_output_json
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb)`,
      [
        runId,
        path.index,
        path.label,
        path.tagline,
        stringifyJson(scores),
        stringifyJson(timeline),
        stringifyJson(risks),
        path.advice || "",
        stringifyJson(path),
      ],
    );
  }
}
