import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider, AnthropicResponseError } from "./anthropic";
import { futurePathsTool } from "./schema";

describe("AnthropicProvider", () => {
  it("parses the forced tool_use input as structured output", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [
          { type: "text", text: "ok" },
          {
            type: "tool_use",
            name: "generate_future_paths",
            input: {
              title: "浙江大学计算机类的未来路径",
              summary: "强平台和强专业共同提高上限。",
              choice_context: {
                school: "浙江大学",
                major: "计算机类",
                city: "杭州",
                assumptions: ["进入目标专业"],
              },
              paths: [],
              comparison: {
                best_for_income: "大厂工程型",
                best_for_stability: "选调体制型",
                best_for_growth: "科研深造型",
                highest_risk: "创业型",
                most_balanced: "技术专家型",
              },
              overall_advice: "先建立可迁移能力。",
            },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    }));

    const provider = new AnthropicProvider({
      apiKey: "test-key",
      baseUrl: "https://anthropic.test",
      model: "claude-test",
      fetchImpl,
    });

    const result = await provider.generateStructured<{
      title: string;
      usage?: unknown;
    }>({
      system: "你是志愿咨询师",
      user: "生成未来路径",
      tool: futurePathsTool,
      maxTokens: 2048,
    });

    expect(result.data.title).toBe("浙江大学计算机类的未来路径");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://anthropic.test/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );
  });

  it("throws a typed error when no matching tool_use block is returned", async () => {
    const provider = new AnthropicProvider({
      apiKey: "test-key",
      baseUrl: "https://anthropic.test/v1",
      model: "claude-test",
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "plain text" }] }),
      })),
    });

    await expect(
      provider.generateStructured({
        system: "system",
        user: "user",
        tool: futurePathsTool,
      }),
    ).rejects.toBeInstanceOf(AnthropicResponseError);
  });
});
