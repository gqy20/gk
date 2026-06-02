import { buildFuturePrompt, getFuturePromptVersion } from "./prompt";
import type { futurePathsTool } from "./schema";
import { futurePathsTool as defaultFuturePathsTool } from "./schema";
import type { FutureRepository } from "./repository";
import type { FuturePath, FutureRunInput, FutureStructuredOutput } from "./types";

interface Provider {
  generateStructured(input: {
    system: string;
    user: string;
    tool: typeof futurePathsTool;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    data: FutureStructuredOutput;
    usage: {
      inputTokens: number | null;
      outputTokens: number | null;
    };
  }>;
}

export interface CreateFutureRunOptions {
  input: FutureRunInput;
  repository: FutureRepository;
  provider: Provider;
  model?: string;
  maxTokens?: number;
}

function normalizePath(path: FuturePath, index: number): FuturePath {
  return {
    ...path,
    index: Number(path.index || index + 1),
    label: path.label || `路径 ${index + 1}`,
    tagline: path.tagline || "",
    probability_tone: path.probability_tone || "均衡",
    fit_score: Number(path.fit_score || 0),
    scores: path.scores || {},
    timeline: Array.isArray(path.timeline) ? path.timeline : [],
    key_risks: Array.isArray(path.key_risks) ? path.key_risks : [],
    turning_points: Array.isArray(path.turning_points) ? path.turning_points : [],
    advice: path.advice || "",
  } as FuturePath;
}

function normalizeOutput(output: FutureStructuredOutput): FutureStructuredOutput {
  return {
    ...output,
    paths: Array.isArray(output.paths)
      ? output.paths.map((path, index) => normalizePath(path, index))
      : [],
  };
}

export async function createFutureRun({
  input,
  repository,
  provider,
  model = "anthropic-compatible",
  maxTokens = 8192,
}: CreateFutureRunOptions) {
  const prompt = buildFuturePrompt(input);
  const { id: runId } = await repository.createRun({
    status: "generating",
    input,
    model,
    promptVersion: getFuturePromptVersion(),
  });

  try {
    const result = await provider.generateStructured({
      system: prompt.system,
      user: prompt.user,
      tool: defaultFuturePathsTool,
      temperature: 0.75,
      maxTokens,
    });

    const output = normalizeOutput(result.data);

    await repository.completeRun(runId, {
      output,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });

    return { runId, status: "completed" as const, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown future generation error";
    await repository.failRun(runId, message);
    throw error;
  }
}

export async function getFutureRunResult(runId: string, repository: FutureRepository) {
  return repository.getRunResult(runId);
}
