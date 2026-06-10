import { createLogger } from "./logger";

const log = createLogger("anthropic");

type FetchLike = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status?: number;
  text?: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

/** LLM 结构化工具的通用形状（name + description + input_schema） */
export interface StructuredToolShape {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  anthropicVersion?: string;
  fetchImpl?: FetchLike;
}

export interface GenerateStructuredInput<TTool extends StructuredToolShape = StructuredToolShape> {
  system: string;
  user: string;
  tool: TTool;
  temperature?: number;
  maxTokens?: number;
  /** 请求超时时间（毫秒），默认 90s；复杂请求（如 3+ 路径）建议传 180_000 */
  timeoutMs?: number;
  /** 关联标识（如 sessionId），用于日志追踪，非必填 */
  traceId?: string;
}

export interface GenerateStructuredResult<T> {
  data: T;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
}

// ── 流式事件类型 ────────────────────────────────────

/** 业务级流式事件（从 Anthropic SSE 原始事件转换而来） */
export type StreamEventType =
  | "thinking_start"
  | "thinking_delta"
  | "text_start"
  | "text_delta"
  | "tool_use_start"
  | "tool_use_delta"
  | "done"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  /** thinking_start / thinking_delta: 累积的思考 token 数 */
  thinkingTokens?: number;
  /** text_start / text_delta: 累积的文本内容 */
  textContent?: string;
  /** tool_use_start / tool_use_delta: 工具名称 */
  toolName?: string;
  /** tool_use_delta: 累积的工具输入 JSON 字符串 */
  toolInputPartial?: string;
  /** done: 完整的结构化结果 */
  result?: Record<string, unknown>;
  /** done: token 用量 */
  usage?: { inputTokens: number; outputTokens: number };
  /** error: 错误信息 */
  error?: string;
  /** error: 是否建议降级到非流式 */
  fallback?: boolean;
}

/** 流式事件回调 */
export type StreamEventCallback = (event: StreamEvent) => void;

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
    traceId,
  }: GenerateStructuredInput): Promise<GenerateStructuredResult<T>> {
    const startTime = Date.now();
    log.info({
      tool: tool.name,
      model: this.model,
      baseUrl: this.baseUrl,
      maxTokens,
      temperature,
      timeoutMs,
      effort: "medium",
      ...(traceId ? { traceId } : {}),
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
        // 阶跃网关 keep-alive 偶发挂起，显式 close 每次新建连接更稳定
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
        // 阶跃 step-3.7-flash 支持 output_config.effort
        // medium 在速度和质量间取得最佳平衡，减少长尾延迟
        output_config: { effort: "medium" },
      }),
    });

    if (!response.ok) {
      const detail = response.text ? await response.text() : "";
      const elapsed = Date.now() - startTime;
      log.error({
        model: this.model,
        baseUrl: this.baseUrl,
        status: response.status,
        detail: detail.slice(0, 1000),
        elapsed,
        tool: tool.name,
        ...(traceId ? { traceId } : {}),
      }, "Anthropic API HTTP error");
      throw new AnthropicResponseError(`Anthropic API error ${response.status ?? ""}: ${detail}`);
    }

    const body = await response.json();
    const input = findToolInput(body, tool.name);
    if (!input) {
      // 记录模型实际返回的内容，方便排查为什么没返回 tool_use
      const rawContent = body && typeof body === "object" ? JSON.stringify(body).slice(0, 1500) : "null";
      log.error({
        model: this.model,
        baseUrl: this.baseUrl,
        tool: tool.name,
        hasContent: !!(body && typeof body === "object" && "content" in (body as Record<string, unknown>)),
        rawContent,
        ...(traceId ? { traceId } : {}),
      }, "Anthropic response missing tool_use block");
      throw new AnthropicResponseError(`Anthropic response did not include tool_use:${tool.name}`);
    }

    const usage = body && typeof body === "object"
      ? (body as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
      : undefined;

    const elapsed = Date.now() - startTime;
    log.info({
      model: this.model,
      baseUrl: this.baseUrl,
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      elapsed,
      ...(traceId ? { traceId } : {}),
    }, "LLM call completed");

    return {
      data: input as T,
      usage: {
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
      },
    };
  }

  // ── 流式调用 ─────────────────────────────────────

  /**
   * 流式结构化输出 — 解析 SSE 事件流，通过 onEvent 回调逐个转发业务事件。
   *
   * 与 generateStructured 的区别：
   * - 请求体加 stream: true
   * - 直接用原生 fetch（需要 response.body.getReader()）
   * - 通过回调实时推送 StreamEvent，不阻塞到完整响应
   *
   * @returns 最终的完整结构化结果（与 generateStructured 返回值一致）
   */
  async generateStructuredStream<T>({
    system,
    user,
    tool,
    temperature = 0.75,
    maxTokens = 4096,
    timeoutMs = 90_000,
    traceId,
    onEvent,
  }: GenerateStructuredInput & { onEvent: StreamEventCallback }): Promise<GenerateStructuredResult<T>> {
    const startTime = Date.now();
    log.info({
      tool: tool.name,
      model: this.model,
      baseUrl: this.baseUrl,
      stream: true,
      maxTokens,
      temperature,
      timeoutMs,
      effort: "medium",
      ...(traceId ? { traceId } : {}),
      systemLen: system.length,
      userLen: user.length,
    }, "LLM generateStructuredStream start");

    // 流式场景固定用原生 fetch（需要 response.body.getReader()）
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      signal: AbortSignal.timeout(timeoutMs),
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion,
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
        output_config: { effort: "medium" },
        stream: true,
      }),
    });

    if (!response.ok) {
      const detail = response.text ? await response.text() : "";
      const elapsed = Date.now() - startTime;
      log.error({
        model: this.model, baseUrl: this.baseUrl, status: response.status,
        detail: detail.slice(0, 1000), elapsed, tool: tool.name,
        ...(traceId ? { traceId } : {}),
      }, "Anthropic API streaming HTTP error");
      throw new AnthropicResponseError(`Anthropic API streaming error ${response.status ?? ""}: ${detail}`);
    }

    return this.parseSSEStream<T>(response, tool.name, onEvent, startTime, traceId);
  }

  /**
   * 解析 Anthropic SSE 流，转换为业务级 StreamEvent 回调。
   *
   * Anthropic Streaming Events 典型顺序:
   *   message_start → content_block_start(thinking) → thinking_delta × N → content_block_stop
   *   → [content_block_start(text) → text_delta × N → content_block_stop]  (可选)
   *   → content_block_start(tool_use) → input_json_delta × N → content_block_stop
   *   → message_delta(usage) → message_stop
   */
  private async parseSSEStream<T>(
    response: Response,
    toolName: string,
    onEvent: StreamEventCallback,
    startTime: number,
    traceId?: string,
  ): Promise<GenerateStructuredResult<T>> {
    const responseBody = response.body as ReadableStream<Uint8Array> | null;
    if (!responseBody) {
      throw new AnthropicResponseError("Streaming response has no body");
    }

    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentBlockType: string | null = null;
    let thinkingTokenCount = 0;
    let textContent = "";
    let toolInputPartial = "";
    const usage = { inputTokens: 0, outputTokens: 0 };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(dataStr);
          } catch {
            continue;
          }

          switch (event.type) {
            case "message_start":
              usage.inputTokens = ((event.message as Record<string, unknown>)?.usage as Record<string, number> | undefined)?.input_tokens ?? 0;
              break;

            case "content_block_start":
              currentBlockType = ((event.content_block as Record<string, unknown>)?.type as string) ?? null;
              if (currentBlockType === "thinking") {
                onEvent({ type: "thinking_start", thinkingTokens: 0 });
              } else if (currentBlockType === "text") {
                onEvent({ type: "text_start", textContent: "" });
              } else if (currentBlockType === "tool_use") {
                onEvent({ type: "tool_use_start", toolName });
              }
              break;

            case "content_block_delta": {
              const delta = event.delta as Record<string, unknown> | undefined;
              if (!delta) break;

              const deltaType = delta.type as string | undefined;

              if (currentBlockType === "thinking" && deltaType === "thinking_delta") {
                thinkingTokenCount++;
                onEvent({ type: "thinking_delta", thinkingTokens: thinkingTokenCount });
              } else if (currentBlockType === "text" && deltaType === "text_delta") {
                textContent += (delta.text as string) ?? "";
                onEvent({ type: "text_delta", textContent });
              } else if (currentBlockType === "tool_use" && deltaType === "input_json_delta") {
                toolInputPartial += (delta.partial_json as string) ?? "";
                onEvent({
                  type: "tool_use_delta",
                  toolName,
                  toolInputPartial,
                });
              }
              break;
            }

            case "content_block_stop":
              currentBlockType = null;
              break;

            case "message_delta":
              usage.outputTokens = ((event.usage as Record<string, number> | undefined)?.output_tokens ?? usage.outputTokens);
              break;

            case "message_stop":
              break;
          }
        }
      }

      // 解析完整的 tool_use JSON
      let input: T;
      try {
        input = JSON.parse(toolInputPartial) as T;
      } catch (parseErr) {
        log.error({
          model: this.model, rawPartial: toolInputPartial.slice(0, 500),
          ...(traceId ? { traceId } : {}),
        }, "Failed to parse tool_use JSON from stream");
        throw new AnthropicResponseError(
          `Failed to parse streamed tool_use JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        );
      }

      if (!input || typeof input !== "object") {
        throw new AnthropicResponseError("Streamed tool_use result is empty or invalid");
      }

      const elapsed = Date.now() - startTime;
      log.info({
        model: this.model, baseUrl: this.baseUrl,
        inputTokens: usage.inputTokens || null,
        outputTokens: usage.outputTokens || null,
        elapsed,
        ...(traceId ? { traceId } : {}),
      }, "LLM stream completed");

      // 发送 done 事件
      onEvent({
        type: "done",
        usage: {
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
        },
      });

      return {
        data: input,
        usage: {
          inputTokens: usage.inputTokens || null,
          outputTokens: usage.outputTokens || null,
        },
      };
    } finally {
      reader.releaseLock();
    }
  }
}
