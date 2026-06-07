import { buildFuturePrompt, getFuturePromptVersion } from "./prompt";
import { planFutureBranches } from "./branch-planner";
import type { futurePathsTool } from "./schema";
import { futurePathsTool as defaultFuturePathsTool } from "./schema";
import type { FutureRepository } from "./repository";
import type { FuturePath, FutureRunInput, FutureStructuredOutput } from "./types";
import { validateFutureOutput } from "./validation";
import { createLogger, withRunId } from "./logger";

const log = createLogger("service");

interface Provider {
  generateStructured(input: {
    system: string;
    user: string;
    tool: typeof futurePathsTool;
    temperature?: number;
    maxTokens?: number;
    /** 请求超时时间（毫秒） */
    timeoutMs?: number;
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

export interface StartFutureRunOptions {
  input: FutureRunInput;
  repository: FutureRepository;
  model?: string;
}

export interface GenerateFutureRunOptions {
  runId: string;
  input: FutureRunInput;
  repository: FutureRepository;
  provider: Provider;
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
    branch_ref: path.branch_ref || "",
    scores: path.scores || {},
    timeline: Array.isArray(path.timeline) ? path.timeline : [],
    key_risks: Array.isArray(path.key_risks) ? path.key_risks : [],
    turning_points: Array.isArray(path.turning_points) ? path.turning_points : [],
    advice: path.advice || "",
  } as FuturePath;
}

function normalizeOutput(output: FutureStructuredOutput, input: FutureRunInput): FutureStructuredOutput {
  const branchPlan = planFutureBranches(input);
  const paths = Array.isArray(output.paths)
    ? output.paths.map((path, index) => {
        const branch = branchPlan[index];
        return {
          ...normalizePath(path, index),
          branch_ref: path.branch_ref || branch?.name || "",
        };
      })
    : [];
  const normalized = {
    ...output,
    choice_context: {
      school: output.choice_context?.school || input.choiceContext.school,
      major: output.choice_context?.major || input.choiceContext.major,
      city: output.choice_context?.city || input.choiceContext.city,
      assumptions: Array.isArray(output.choice_context?.assumptions)
        ? output.choice_context.assumptions
        : [],
    },
    paths,
    branch_plan: branchPlan,
  };

  return {
    ...normalized,
    validation: validateFutureOutput(normalized, input.pathCount),
  };
}

export async function createFutureRun({
  input,
  repository,
  provider,
  model = "anthropic-compatible",
  maxTokens = 4096,
}: CreateFutureRunOptions) {
  log.info({ pathCount: input.pathCount, school: input.choiceContext.school, major: input.choiceContext.major }, "createFutureRun started");
  buildFuturePrompt(input);
  const started = await startFutureRun({ input, repository, model });

  await generateFutureRun({
    runId: started.runId,
    input,
    repository,
    provider,
    maxTokens,
  });

  const result = await repository.getRunResult(started.runId);
  log.info({ runId: started.runId, status: result?.run.status }, "createFutureRun completed");
  return {
    runId: started.runId,
    status: "completed" as const,
    output: result?.output ?? null,
  };
}

export async function startFutureRun({
  input,
  repository,
  model = "anthropic-compatible",
}: StartFutureRunOptions) {
  const { id: runId } = await repository.createRun({
    status: "generating",
    input,
    model,
    promptVersion: getFuturePromptVersion(),
  });

  log.info({ runId, model }, "startFutureRun created run");
  return { runId, status: "generating" as const };
}

/** 根据请求复杂度计算合理的 LLM 超时时间 */
function resolveTimeoutMs(pathCount: number): number {
  // 基准：2 路径 ≈ 26-38s → 90s 够用（2.5x 余量）
  // 复杂：3+ 路径 ≈ 45-50s+，历史有超时案例 → 180s（~4x 余量）
  return pathCount >= 3 ? 180_000 : 90_000;
}

export async function generateFutureRun({
  runId,
  input,
  repository,
  provider,
  maxTokens = 4096,
}: GenerateFutureRunOptions) {
  const runLog = withRunId(log, runId);
  const timeoutMs = resolveTimeoutMs(input.pathCount);
  runLog.info({ maxTokens, timeoutMs, pathCount: input.pathCount }, "generateFutureRun started");

  const prompt = buildFuturePrompt(input);
  const startTime = Date.now();
  try {
    const result = await provider.generateStructured({
      system: prompt.system,
      user: prompt.user,
      tool: defaultFuturePathsTool,
      temperature: 0.75,
      maxTokens,
      timeoutMs,
    });

    const elapsed = Date.now() - startTime;
    runLog.info({ elapsed, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }, "LLM call completed");

    const output = normalizeOutput(result.data, input);

    runLog.info({
      pathCount: output.paths.length,
      valid: output.validation?.valid,
      errorCount: output.validation?.errors?.length,
      warningCount: output.validation?.warnings?.length,
    }, "normalizeOutput completed");

    await repository.completeRun(runId, {
      output,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });

    runLog.info("generateFutureRun completed successfully");
    return output;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown future generation error";
    runLog.error({
      err: message,
      stack: error instanceof Error ? error.stack : undefined,
      elapsed,
    }, "generateFutureRun FAILED");
    await repository.failRun(runId, message);
    throw error;
  }
}

export async function getFutureRunResult(runId: string, repository: FutureRepository) {
  return repository.getRunResult(runId);
}
