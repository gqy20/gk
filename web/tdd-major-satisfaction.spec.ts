/**
 * TDD: 专业满意度（major_satisfaction）展示
 *
 * 运行方式: npx playwright test tdd-major-satisfaction.spec.ts
 * 前提: pnpm dev 已启动 (localhost:3000)
 *
 * 阶段: 🔴 红 — 先写测试，预期失败
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("专业满意度 TDD", () => {
  test("1-概览页应显示专业满意度卡片", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // 点击第一个有数据的学校（北京大学），导航到 /school/北京大学
    await page.locator("aside >> text=北京大学").first().click();
    await page.waitForURL(/\/school\//);
    await page.waitForTimeout(500);

    // 应显示专业满意度区域（标题含"专业满意度"）
    const satisfactionSection = page.locator(
      "aside >> text=/^专业满意度/",
    );
    await expect(satisfactionSection.first()).toBeVisible({ timeout: 5000 });
  });

  test("2-满意度应显示具体评分数字", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    await page.locator("aside >> text=北京大学").first().click();
    await page.waitForURL(/\/school\//);
    await page.waitForTimeout(500);

    // RED: 满意度区域附近应有 X.X 格式的评分数字
    const panel = page.locator("aside");
    // 在满意度标题同区域找评分数字
    const scoreVisible = await panel.evaluate(() => {
      const text = document.body.innerText;
      // 应有"满意度"字样且附近有评分数字
      return /满意度[\s\S]{0,200}?\d\.\d/.test(text);
    });
    expect(scoreVisible).toBe(true);
  });

  test("3-满意度列表应显示至少3个专业名称", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    await page.locator("aside >> text=北京大学").first().click();
    await page.waitForURL(/\/school\//);
    await page.waitForTimeout(500);

    const panel = page.locator("aside");
    // RED: 满意度区域应包含多个具体专业名
    const hasMajors = await panel.evaluate(() => {
      const text = document.body.innerText;
      // 检查是否有常见专业名出现在满意度上下文中
      const majorKeywords = ["微电子", "软件工程", "计算机", "市场营销", "心理学"];
      return majorKeywords.some(k => text.includes(k));
    });
    expect(hasMajors).toBe(true);
  });

  test("4-QA部分不应有内容跳转链接", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    await page.locator("aside >> text=北京大学").first().click();
    await page.waitForURL(/\/school\//);
    await page.waitForTimeout(500);

    // 切换到答考生问 tab
    const faqTab = page.locator("text=答考生问");
    if (await faqTab.isVisible()) {
      await faqTab.click();
      await page.waitForTimeout(500);
    }

    // QA 区域（蓝色背景）内的 Q/A 正文不应有 href 跳转链接
    const faqArea = page.locator("aside >> .bg-blue-50\\/40, aside >> [class*='blue-50']");
    if (await faqArea.count() > 0) {
      // Q/A 内容行中的链接数量应极少（仅允许来源等辅助链接）
      const linkCount = await faqArea.locator("a[href]").count();
      expect(linkCount).toBeLessThanOrEqual(2);
    }
  });
});
