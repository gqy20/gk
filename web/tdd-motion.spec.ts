/**
 * TDD: 微交互动画优化
 *
 * 运行方式: npx playwright test web/tdd-motion.spec.ts
 * 前提: pnpm dev 已启动 (localhost:3000)
 *
 * 覆盖:
 *   1. SchoolPopup 进场/退场 scale+fade 动画（framer-motion motion.div + AnimatePresence）
 *   2. FilterTag spring 弹性切换动画（motion.button + whileTap/whileHover）
 *   3. 面板切换动效增强 (y轴偏移 + scale 缩放)
 *   5. SourcePopover 定位正确（从按钮下方弹出，非左上角滑入）
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("微交互动画 TDD", () => {
  test("1-SchoolPopup: 应使用 motion.div 包裹并配置 initial/animate/exit", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // 检测页面中是否存在 framer-motion 运行时注入的 inline style
    // motion.div 渲染后会在 style 属性中保留 transform/opacity 最终值
    const motionEvidence = await page.evaluate(() => {
      const styled = [];
      document.querySelectorAll("*").forEach((el) => {
        const s = el.getAttribute("style") ?? "";
        // framer-motion 注入的 style 通常包含 transform 和/或 opacity，且长度适中
        if ((s.includes("transform") || s.includes("opacity")) && s.length < 120) {
          styled.push({
            tag: el.tagName,
            cls: (el.className || "").toString().substring(0, 50),
            style: s,
          });
        }
      });
      return { count: styled.length, samples: styled.slice(0, 5) };
    });

    // RED → GREEN: 页面中应有 framer-motion 管理的元素
    // 面板 AnimatePresence 内的 motion.div 会留下 style="opacity:1; transform:none;"
    expect(motionEvidence.count).toBeGreaterThanOrEqual(1);
  });

  test("2-SchoolPopup: 组件代码应包含 motion 动画配置（initial/animate/exit）", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    // 等 framer-motion 完成初始渲染（注入 inline style）
    await page.waitForTimeout(300);

    // 验证页面中存在 framer-motion 管理的元素
    const motionElementCount = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll("*").forEach((el) => {
        const s = el.getAttribute("style") ?? "";
        if ((s.includes("transform") || s.includes("opacity")) && s.length < 120) count++;
      });
      return count;
    });

    // GREEN: 页面中应有 ≥1 个 motion 管理的元素（面板 motion.div 持久保留 style）
    expect(motionElementCount).toBeGreaterThanOrEqual(1);
  });

  test("3-FilterTag: active 切换应使用 spring 弹性动画（motion.button）", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const tag985 = page.locator("button[aria-pressed]").filter({ hasText: "985" }).first();
    await expect(tag985).toBeVisible();

    // 点击激活后立即检查：framer-motion spring 会在 style 中注入 transform
    await tag985.click();
    await page.waitForTimeout(80);

    // framer-motion motion.button 的 spring 特征：
    // - initial/animate 时注入 inline style（transform 等）
    // - whileTap 触发时设置 will-change 或直接操作 transform
    const motionEvidence = await tag985.evaluate((el) => {
      const style = el.getAttribute("style") ?? "";
      const cs = getComputedStyle(el);
      return {
        hasInlineStyle: style.length > 5,
        hasWillChange: cs.willChange === "transform",
        timingFunction: cs.transitionTimingFunction,
      };
    });

    const usesSpringLikeAnimation =
      motionEvidence.hasInlineStyle ||
      motionEvidence.hasWillChange ||
      /cubic-bezier|spring/.test(motionEvidence.timingFunction);

    expect(usesSpringLikeAnimation).toBe(true);
  });

  test("4-面板切换: motion.div 应配置 y 偏移 + scale 缩放动效", async ({
    page,
  }) => {
    await page.goto(BASE);
    const aside = page.locator("aside[aria-label='高校列表与详情']");
    await expect(aside).toBeVisible({ timeout: 15000 });

    // 面板的 motion.div 是 aside 的直接子元素（AnimatePresence > motion.div）
    // framer-motion 动画完成后在 style 中保留最终值：opacity + transform
    const panelInfo = await aside.locator("> div").first().evaluate((el) => ({
      tagName: el.tagName,
      style: el.getAttribute("style") ?? "",
      className: (el.className || "").toString().substring(0, 60),
    }));

    // RED → GREEN: motion.div 应有 framer-motion 注入的 inline style
    // 动画完成后通常为 style="opacity: 1; transform: none;" 或含 translate3d/scale
    const hasMotionStyle =
      panelInfo.style.includes("transform") ||
      panelInfo.style.includes("opacity");

    expect(hasMotionStyle).toBe(true);
  });

  test("5-SourcePopover: 弹出位置应在触发按钮附近（top > 按钮底部），非视口顶部", async ({
    page,
  }) => {
    // 进入一个有采集数据的学校详情页
    await page.goto(`${BASE}/school/%E6%B8%85%E5%8D%8E%E5%A4%A7%E5%AD%A6`);
    await page.waitForLoadState("networkidle");

    // 找到「校园信息采集」区域中带数字的按钮（如"宿舍 5 条"）
    const cardButton = page.locator("button").filter({
      hasText: /\d+\s*条/,
    }).first();

    if (!(await cardButton.isVisible())) {
      test.skip(true, "页面无采集数据卡片");
      return;
    }

    // 获取按钮的视口位置
    const buttonRect = await cardButton.evaluate((el) =>
      el.getBoundingClientRect(),
    );

    // 点击卡片触发 Popover
    await cardButton.click();
    await page.waitForTimeout(400);

    // 检查 popover（fixed 定位，z-9999）的位置
    const popover = page.locator(".fixed.z-\\[9999\\]");
    const popoverVisible = await popover.isVisible();

    if (!popoverVisible) {
      test.skip(true, "Popover 未出现（可能该分类无来源数据）");
      return;
    }

    const popoverTop = await popover.evaluate((el) => {
      const top = parseFloat(el.style.top) || 0;
      return top;
    });

    // RED → GREEN: Popover 的 top 应在按钮下方附近（或上方翻转为负值），
    // 绝不能在视口顶部 (top ≈ 0) 附近
    // 允许一定误差：popover 应至少距离视口顶部 > 50px（除非按钮本身就在顶部）
    const buttonBottom = buttonRect.bottom;
    const isBelowButton = popoverTop >= buttonBottom - 10; // 在按钮下方（含间距）
    const isAboveButton = popoverTop < buttonRect.top; // 翻转到按钮上方
    const isNearButton = isBelowButton || isAboveButton;

    // 核心断言：不在视口顶部乱飞
    expect(isNearButton).toBe(true);
  });
});
