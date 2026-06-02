import type {
  FutureRunInput,
  FutureRunListItem,
  FutureRunRecord,
  FutureRunResult,
  FutureRunStatus,
  FutureStructuredOutput,
} from "./types";

export interface CreateRunParams {
  status: FutureRunStatus;
  input: FutureRunInput;
  model: string;
  promptVersion: string;
}

export interface CompleteRunParams {
  output: FutureStructuredOutput;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ListRunsOptions {
  limit?: number;
}

export interface FutureRepository {
  createRun(params: CreateRunParams): Promise<{ id: string }>;
  completeRun(runId: string, params: CompleteRunParams): Promise<void>;
  failRun(runId: string, error: string): Promise<void>;
  getRunResult(runId: string): Promise<FutureRunResult | null>;
  listRuns(opts?: ListRunsOptions): Promise<FutureRunListItem[]>;
}

export class MemoryFutureRepository implements FutureRepository {
  private readonly runs = new Map<string, FutureRunRecord>();

  async createRun(params: CreateRunParams) {
    const id = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    this.runs.set(id, {
      id,
      status: params.status,
      input: params.input,
      model: params.model,
      promptVersion: params.promptVersion,
      output: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  }

  async completeRun(runId: string, params: CompleteRunParams) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Future run not found: ${runId}`);
    this.runs.set(runId, {
      ...run,
      status: "completed",
      output: params.output,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      updatedAt: new Date().toISOString(),
    });
  }

  async failRun(runId: string, error: string) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Future run not found: ${runId}`);
    this.runs.set(runId, {
      ...run,
      status: "failed",
      error,
      updatedAt: new Date().toISOString(),
    });
  }

  async getRunResult(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return null;
    return { run, output: run.output ?? null };
  }

  async listRuns(opts: ListRunsOptions = {}): Promise<FutureRunListItem[]> {
    const limit = opts.limit ?? 20;
    // 按 createdAt 倒序;没有 createdAt 的用空串兜底
    const sorted = [...this.runs.values()].sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    return sorted.slice(0, limit).map(toListItem);
  }
}

/** 把 run 记录压成列表卡片用的轻量项 */
function toListItem(run: FutureRunRecord): FutureRunListItem {
  const output = run.output;
  const title = output?.title?.trim() || "";
  const summary = output?.summary?.trim() || "";
  const paths = output?.paths ?? [];
  const fitScores = paths.map((p) => p.fit_score ?? 0);
  const fitScoreMax = fitScores.length ? Math.max(...fitScores) : 0;
  const topPath = paths.length
    ? paths.reduce<FutureStructuredOutput["paths"][number]>(
        (best, p) => (best.fit_score >= p.fit_score ? best : p),
        paths[0],
      )
    : null;
  return {
    id: run.id,
    title,
    summary: clip(summary, 80),
    school: run.input?.choiceContext?.school || "",
    major: run.input?.choiceContext?.major,
    status: run.status,
    fitScoreMax,
    toneTop: topPath ? topPath.probability_tone : null,
    errorMessage: run.error ?? null,
    createdAt: run.createdAt ?? new Date().toISOString(),
  };
}

function clip(text: string, max: number) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
