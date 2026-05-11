/**
 * TDD: 专业库显示深度优化
 *
 * 运行: npx playwright test tdd-majors-polish.spec.ts
 * 阶段: 🔴 红 — 针对显示质量的严格测试
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("专业库显示优化 TDD", () => {
  test("1-初始空状态应有引导 UI（图标+提示文字），不是空白", async ({ page }) => {
    await page.goto(`${BASE}/majors`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=哲学", { timeout: 10000 });

    // 右侧区域应有引导提示（含图标或明确文案）
    const guide = page.locator("text=选择左侧门类开始浏览");
    await expect(guide.first()).toBeVisible({ timeout: 5000 });
  });

  test("2-点击门类后右侧应显示统计条（当前门类名 + 专业数量）", async ({ page }) => {
    await page.goto(`${BASE}/majors`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=哲学", { timeout: 10000 });

    const gongxue = page.locator("aside button").filter({ hasText: /^工学$/ });
    if (await gongxue.count() > 0) {
      await gongxue.first().click();
      await page.waitForTimeout(500);

      // 应包含当前门类名「工学」在统计区域
      const statsArea = page.textContent("body") || "";
      expect(statsArea).toContain("工学");
    }
  });

  test("3-专业名称不应出现 fallback 文本「专业 XXXXXX」", async ({ page }) => {
    await page.goto(`${BASE}/majors`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=哲学", { timeout: 10000 });

    const gongxue = page.locator("aside button").filter({ hasText: /^工学$/ });
    if (await gongxue.count() > 0) {
      await gongxue.first().click();
      await page.waitForTimeout(500);

      // 严格检查：正则匹配「专业 + 6位数字」
      const bodyText = await page.textContent("body") || "";
      expect(bodyText).not.toMatch(/专业\s+\d{6}/);
    }
  });

  test("4-满意度应有可视化进度条（不仅是纯文本数字）", async ({ page }) => {
    await page.goto(`${BASE}/majors`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=哲学", { timeout: 10010 });

    const gongxue = page.locator("aside button").filter({ hasText: /^工学$/ });
    if (await gongxue.count() > 0) {
      await gongxue.first().click();
      await page.waitForTimeout(500);

      // 检查满意度区域有宽度样式的元素（进度条）
      const hasBar = await page.evaluate(() => {
        const all = document.querySelectorAll("[style*='width']");
        for (const el of all) {
          const cls = el.className || "";
          const w = el.style.width || "";
          // 进度条特征：width 是百分比且父级与满意度相关
          if (/^\d+%$/.test(w) && /satisfaction|score|rating|progress/i.test(cls)) {
            return true;
          }
        }
        return false;
      });
      expect(hasBar).toBe(true);
    }
  });

  test("5-专业卡片应展示专业类归属（如「计算机类」）", async ({ page }) => {
    await page.goto(`${BASE}/majors`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=哲学", { timeout: 10000 });

    const gongxue = page.locator("aside button").filter({ hasText: /^工学$/ });
    if (await gongxue.count() > 0) {
      await gongxue.first().click();
      await page.waitForTimeout(500);

      // 卡片中应出现专业类名称（以「类」结尾的词）
      const bodyText = await page.textContent("body") || "";
      expect(bodyText).toMatch(/类\s*[\d（]/); // 如「计算机类 (13)」或类似格式
    }
  });

  test("6-无数据专业（满意度 0.0）应有特殊标识", async ({ page }) => {
    await page.goto(`${BASE}/majors`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=哲学", { timeout: 10000 });

    // 哲学门类少，可能有 0.0 数据的专业
    const zhexue = page.locator("aside button").filter({ hasText: /^哲学$/ });
    if (await zhexue.count() > 0) {
      await zhexue.first().click();
      await page.waitForTimeout(500);

      // 页面中如有 0.0 满意度，该行应有特殊视觉区分（非普通数字样式）
      const hasZeroStyle = await page.evaluate(() => {
        const text = document.body.innerText;
        if (!text.includes("0.0")) return true; // 没有 0.0 也算通过
        // 有 0.0 时检查是否有区分样式
        const els = document.querySelectorAll("*");
        for (const el of els) {
          if (el.childNodes.length === 1 && el.textContent === "0.0") {
            const cls = el.className || "";
            return /muted|empty|none|no-data|dash|-/i.test(cls);
          }
        }
        return false;
      });
      expect(hasZeroStyle).toBe(true);
    }
  });
});
