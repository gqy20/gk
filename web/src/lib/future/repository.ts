import type { FutureRunInput, FutureRunRecord, FutureRunResult, FutureRunStatus, FutureStructuredOutput } from "./types";

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

export interface FutureRepository {
  createRun(params: CreateRunParams): Promise<{ id: string }>;
  completeRun(runId: string, params: CompleteRunParams): Promise<void>;
  failRun(runId: string, error: string): Promise<void>;
  getRunResult(runId: string): Promise<FutureRunResult | null>;
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
}
