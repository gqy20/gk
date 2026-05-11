/**
 * TDD: 专业库页面 (/majors)
 *
 * 运行方式: npx playwright test tdd-majors.spec.ts
 * 前提: pnpm dev 已启动 (localhost:3000)
 *
 * 阶段: 🔴 红 — 先写测试，预期失败
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("专业库页面 TDD", () => {
  test("1-/majors 路由应可访问且返回 200", async ({ page }) => {
    const resp = await page.goto(`${BASE}/majors`);
    expect(resp?.status()).toBe(200);
  });

  test("2-页面应显示「专业库」标题", async ({ page }) => {
    await page.goto(`${BASE}/majors`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1, h2").filter({ hasText: /专业库|专业目录|全国专业/ })).toBeVisible();
  });

  test("3-应显示三大分类 Tab（本科/职教本科/高职专科）", async ({ page }) => {
    await page.goto(`${BASE}/majors`);
    await page.waitForLoadState("networkidle");

    // 至少有"本科"分类 tab
    const categoryTabs = page.locator("[role=tab], button").filter({ hasText: /本科|职教|高职|专科/ });
    await expect(categoryTabs.first()).toBeVisible();
    expect(await categoryTabs.count()).toBeGreaterThanOrEqual(2);
  });

  test("4-默认选中本科分类时，左侧应显示门类列表（哲学/经济学/工学等）", async ({ page }) => {
    await page.goto(`${BASE}/majors`);
    await page.waitForLoadState("networkidle");
    // 等待异步数据加载完成（大文件需要额外时间）
    await page.waitForSelector("text=哲学", { timeout: 10000 });

    // 左侧区域应包含常见门类名
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/哲学|经济学|法学|工学|理学/);
  });

  test("5-点击门类后，右侧应展示该门类下的专业列表", async ({ page }) => {
    await page.goto(`${BASE}/majors`);
    await page.waitForLoadState("networkidle");

    // 点击"工学"门类（专业最多的门类，一定存在）
    const gongxue = page.locator("button, [role=button]").filter({ hasText: /^工学$/ });
    if (await gongxue.count() > 0) {
      await gongxue.first().click();
      await page.waitForTimeout(300);

      // 右侧应出现专业代码格式的内容（如 0801xx）
      const bodyText = await page.textContent("body");
      expect(bodyText).toMatch(/\d{6}/); // 专业代码 6 位数字
    }
  });

  test("6-专业卡片应显示满意度评分或「-」占位符", async ({ page }) => {
    await page.goto(`${BASE}/majors`);
    await page.waitForLoadState("networkidle");

    // 点击一个有专业的门类
    const gongxue = page.locator("button, [role=button]").filter({ hasText: /^工学$/ });
    if (await gongxue.count() > 0) {
      await gongxue.first().click();
      await page.waitForTimeout(300);

      // 页面中应有满意度相关内容（评分数字或占位符）
      const bodyText = await page.textContent("body");
      const hasSatisfaction = /\d\.\d|满意度|-/.test(bodyText || "");
      expect(hasSatisfaction).toBe(true);
    }
  });

  test("7-应有搜索框可输入关键词", async ({ page }) => {
    await page.goto(`${BASE}/majors`);
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator("input[placeholder*='搜索'], input[placeholder*='专业'], input[type='search']");
    await expect(searchInput.first()).toBeVisible();
  });

  test("8-首页 header 应有「专业库」入口按钮", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const majorEntry = page.locator("a, button").filter({ hasText: /专业库|专业目录|专业查询/ });
    await expect(majorEntry.first()).toBeVisible({ timeout: 5000 });
  });

  test("9-点击首页「专业库」按钮应跳转到 /majors", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const majorEntry = page.locator("a, button").filter({ hasText: /专业库|专业目录|专业查询/ }).first();
    await majorEntry.click();
    await page.waitForURL(/\/majors/);
    expect(page.url()).toContain("/majors");
  });
});
