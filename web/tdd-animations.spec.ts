/**
 * TDD: 体验优化 — 动画与过渡
 *
 * 运行方式: npx playwright test tdd-animations.spec.ts
 * 前提: pnpm dev 已启动 (localhost:3000)
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("体验优化 TDD", () => {
  test("1-Popover: 应有过渡动画类（opacity + transform，非位置滑动）", async ({ page }) => {
    await page.goto(`${BASE}/school/%E6%B8%85%E5%8D%8E%E5%A4%A7%E5%AD%A6`);
    // 点击宿舍卡片触发 Popover
    await page.click("button:has-text('5 条')");

    // 检查 Popover 元素存在
    const popover = page.locator(".fixed.z-\\[9999\\]");
    await expect(popover).toBeVisible();

    // RED: 验证包含过渡动画 CSS 类（opacity + transform，不含 transition-all 避免位置滑动）
    const classes = await popover.getAttribute("class") ?? "";
    const hasTransition =
      classes.includes("transition-[opacity,transform]") ||
      classes.includes("transition-all");
    // 关键：不应有 transition-all（会导致从左上角滑入的 bug）
    expect(hasTransition).toBe(true);
    expect(classes).not.toContain("transition-all");
  });

  test("2-Popover: 关闭后应从 DOM 移除（支持退场动画）", async ({ page }) => {
    await page.goto(`${BASE}/school/%E6%B8%85%E5%8D%8E%E5%A4%A7%E5%AD%A6`);
    await page.click("button:has-text('5 条')");
    const popover = page.locator(".fixed.z-\\[9999\\]");
    await expect(popover).toBeVisible();

    // 点击关闭按钮
    await page.click("button:has-text('✕')");

    // RED: Popover 应从 DOM 中移除
    await expect(popover).not.toBeAttached();
  });

  test("3-TAB 切换: 内容区域应有过渡效果（非硬切）", async ({ page }) => {
    await page.goto(`${BASE}/school/%E6%B8%85%E5%8D%8E%E5%A4%A7%E5%AD%A6`);

    // 目标 SchoolPanel 内容区（右侧面板的滚动区域）
    const panel = page.locator("aside.bg-surface-light");
    const content = panel.locator(".overflow-y-auto");
    const beforeText = await content.textContent();

    // 切换到「招生章程」tab
    await page.click("button:has-text('分类')");
    await page.click("text=招生章程");

    // RED: 内容应该变化（不是同一内容）
    const afterText = await content.textContent();
    expect(afterText).not.toBe(beforeText);

    // GREEN: 验证内容区有过渡动画类
    const contentEl = panel.locator(".overflow-y-auto");
    const classes = await contentEl.getAttribute("class") ?? "";
    expect(classes.split(/\s+/)).toContainEqual("transition-opacity");
    expect(classes.split(/\s+/)).toContainEqual("duration-200");
  });

  test("4-滚动记忆: 省份列表滚动后进入详情，返回时位置保持", async ({ page }) => {
    await page.goto(BASE);
    // 等待省份列表渲染完成（数据异步加载）
    const list = page.locator(".overflow-y-auto.bg-surface-light");
    await expect(list).toBeVisible({ timeout: 15000 });

    // 用 mouse.wheel 模拟真实滚动（触发 scroll 事件）
    await list.hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400); // 等待防抖保存完成

    const scrollBefore = await list.evaluate((el) => el.scrollTop);
    expect(scrollBefore).toBeGreaterThan(0);

    // 进入学校详情页
    await page.click("text=清华大学");
    await page.waitForURL("**/school/**");

    // 返回地图
    await page.click("button[aria-label='返回地图']");
    await page.waitForURL("**/");

    // 等待省份列表重新渲染 + 滚动恢复
    const listAfter = page.locator(".overflow-y-auto.bg-surface-light");
    await expect(listAfter).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    const scrollAfter = await listAfter.evaluate((el) => el.scrollTop);
    expect(scrollAfter).toEqual(scrollBefore);
  });
});
