import { AnthropicProvider } from "./anthropic";
import { MemoryFutureRepository } from "./repository";
import { getPostgresPool } from "./pg-client";
import { PostgresFutureRepository } from "./postgres";
import { createFutureRun, generateFutureRun, getFutureRunResult, startFutureRun } from "./service";
import type { FutureRepository, ListRunsOptions } from "./repository";
import type { FutureRunInput, FutureRunListItem } from "./types";

export interface FutureServerOptions {
  repository?: FutureRepository;
  provider?: AnthropicProvider;
}

let sharedRepository: FutureRepository | null = null;

export function getDefaultFutureRepository() {
  if (!sharedRepository) {
    sharedRepository = process.env.DATABASE_URL
      ? new PostgresFutureRepository(getPostgresPool())
      : new MemoryFutureRepository();
  }
  return sharedRepository;
}

export function getDefaultAnthropicProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  return new AnthropicProvider({
    apiKey,
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    model,
    anthropicVersion: process.env.ANTHROPIC_VERSION || "2023-06-01",
  });
}

export async function handleCreateFutureRun(input: FutureRunInput, options: FutureServerOptions = {}) {
  return createFutureRun({
    input,
    repository: options.repository || getDefaultFutureRepository(),
    provider: options.provider || getDefaultAnthropicProvider(),
    model: process.env.ANTHROPIC_MODEL || "anthropic-compatible",
  });
}

export async function handleStartFutureRun(input: FutureRunInput, options: FutureServerOptions = {}) {
  return startFutureRun({
    input,
    repository: options.repository || getDefaultFutureRepository(),
    model: process.env.ANTHROPIC_MODEL || "anthropic-compatible",
  });
}

export async function handleGenerateFutureRun(
  runId: string,
  input: FutureRunInput,
  options: FutureServerOptions = {},
) {
  return generateFutureRun({
    runId,
    input,
    repository: options.repository || getDefaultFutureRepository(),
    provider: options.provider || getDefaultAnthropicProvider(),
  });
}

export async function handleGetFutureRun(runId: string, options: FutureServerOptions = {}) {
  return getFutureRunResult(runId, options.repository || getDefaultFutureRepository());
}

export async function handleListFutureRuns(
  opts: ListRunsOptions = {},
  options: FutureServerOptions = {},
): Promise<FutureRunListItem[]> {
  return options.repository
    ? options.repository.listRuns(opts)
    : getDefaultFutureRepository().listRuns(opts);
}
