import { buildFuturePrompt, getFuturePromptVersion } from "./prompt";
import type { futurePathsTool } from "./schema";
import { futurePathsTool as defaultFuturePathsTool } from "./schema";
import type { FutureRepository } from "./repository";
import type { FutureRunInput, FutureStructuredOutput } from "./types";

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

    await repository.completeRun(runId, {
      output: result.data,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });

    return { runId, status: "completed" as const, output: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown future generation error";
    await repository.failRun(runId, message);
    throw error;
  }
}

export async function getFutureRunResult(runId: string, repository: FutureRepository) {
  return repository.getRunResult(runId);
}
