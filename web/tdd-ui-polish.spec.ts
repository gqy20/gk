/**
 * TDD: UI 打磨 — 骨架屏 / 中文字体 / 色板
 *
 * 运行方式: npx playwright test tdd-ui-polish.spec.ts
 * 前提: pnpm dev 已启动 (localhost:3000)
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("UI 打磨 TDD", () => {
  test("5-首页加载: 应显示骨架屏而非纯文字", async ({ page }) => {
    // 拦截 schools.json 让它延迟返回，确保看到加载态
    await page.route("**/schools.json", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.goto(BASE);

    // RED: 加载期间应存在骨架屏元素（animate-pulse 或 shimmer 类）
    const skeleton = page.locator("[class*='animate-pulse'], [class*='skeleton'], [class*='shimmer']");
    // 至少应有 3 个以上骨架块（地图区 + 列表行）
    const count = await skeleton.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("6-中文字体: 页面应加载 CJK 字体", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // GREEN: body 或 html 应包含中文字体族
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily,
    );
    // 应该包含 Noto、PingFang、Microsoft YaHei 等中文字体，不能只有 Geist
    const hasChineseFont =
      /Noto|PingFang|Hiragino|Microsoft YaHei|Source Han|WenQuanYi/.test(
        fontFamily,
      );
    expect(hasChineseFont).toBe(true);
  });

  test("7-色板语义: gold 色阶应从浅到深递进", async ({ page }) => {
    await page.goto(BASE);

    // Accent and danger scales should be distinct semantic tokens.
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        accent50: style.getPropertyValue("--color-accent-50").trim(),
        accent300: style.getPropertyValue("--color-accent-300").trim(),
        accent500: style.getPropertyValue("--color-accent-500").trim(),
        danger500: style.getPropertyValue("--color-danger-500").trim(),
        neutral800: style.getPropertyValue("--color-neutral-800").trim(),
      };
    });

    expect(colors.accent50).not.toBe(colors.accent300);
    expect(colors.accent500).not.toBe(colors.danger500);
    expect(colors.danger500).not.toContain("d887");
    expect(colors.danger500).not.toContain("f2c4");
    expect(colors.neutral800).not.toContain("dfeee");
  });
});
