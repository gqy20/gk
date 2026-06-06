import type { futurePathsTool } from "./schema";
import { createLogger } from "./logger";

const log = createLogger("anthropic");

type FetchLike = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status?: number;
  text?: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

export interface AnthropicProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  anthropicVersion?: string;
  fetchImpl?: FetchLike;
}

export interface GenerateStructuredInput<TTool extends typeof futurePathsTool = typeof futurePathsTool> {
  system: string;
  user: string;
  tool: TTool;
  temperature?: number;
  maxTokens?: number;
  /** 请求超时时间（毫秒），默认 90s；复杂请求（如 3+ 路径）建议传 180_000 */
  timeoutMs?: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
}

export class AnthropicResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnthropicResponseError";
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function findToolInput(body: unknown, toolName: string) {
  if (!body || typeof body !== "object") return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  const block = content.find((item) => {
    if (!item || typeof item !== "object") return false;
    const typed = item as { type?: unknown; name?: unknown };
    return typed.type === "tool_use" && typed.name === toolName;
  });

  if (!block || typeof block !== "object") return null;
  return (block as { input?: unknown }).input ?? null;
}

export class AnthropicProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly anthropicVersion: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl || "https://api.anthropic.com");
    this.model = options.model;
    this.anthropicVersion = options.anthropicVersion || "2023-06-01";
    this.fetchImpl = options.fetchImpl || fetch;
    log.debug({ baseUrl: this.baseUrl, model: this.model, anthropicVersion: this.anthropicVersion }, "AnthropicProvider initialized");
  }

  async generateStructured<T>({
    system,
    user,
    tool,
    temperature = 0.75,
    maxTokens = 4096,
    timeoutMs = 90_000,
  }: GenerateStructuredInput): Promise<GenerateStructuredResult<T>> {
    const startTime = Date.now();
    log.info({
      tool: tool.name,
      maxTokens,
      temperature,
      timeoutMs,
      systemLen: system.length,
      userLen: user.length,
    }, "LLM generateStructured start");

    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      signal: AbortSignal.timeout(timeoutMs),
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion,
        // MiniMax 网关在 HTTP/2 keep-alive 下偶发挂起;显式关连接,每次新建 TCP,
        // 单次 30-60s 内的请求不会被长连接池化阻塞。
        connection: "close",
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: [{ role: "user", content: user }],
        temperature,
        max_tokens: maxTokens,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      }),
    });

    if (!response.ok) {
      const detail = response.text ? await response.text() : "";
      const elapsed = Date.now() - startTime;
      log.error({
        status: response.status,
        detail: detail.slice(0, 500),
        elapsed,
        tool: tool.name,
      }, "Anthropic API HTTP error");
      throw new AnthropicResponseError(`Anthropic API error ${response.status ?? ""}: ${detail}`);
    }

    const body = await response.json();
    const input = findToolInput(body, tool.name);
    if (!input) {
      log.error({ tool: tool.name, hasContent: !!(body && typeof body === "object" && "content" in (body as Record<string, unknown>)) }, "Anthropic response missing tool_use block");
      throw new AnthropicResponseError(`Anthropic response did not include tool_use:${tool.name}`);
    }

    const usage = body && typeof body === "object"
      ? (body as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
      : undefined;

    const elapsed = Date.now() - startTime;
    log.info({
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      elapsed,
    }, "LLM call completed");

    return {
      data: input as T,
      usage: {
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
      },
    };
  }
}
