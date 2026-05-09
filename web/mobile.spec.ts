import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const DEVICES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "iPad Mini", width: 768, height: 1024 },
];

test.describe("移动端适配测试", () => {
  for (const device of DEVICES) {
    test(`${device.name} (${device.width}x${device.height}) - 首页布局`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto(BASE);
      await page.waitForLoadState("networkidle");

      await page.screenshot({
        path: `/tmp/mobile-test/home-${device.name.replace(/\s/g, "-").toLowerCase()}.png`,
        fullPage: false,
      });

      const issues = await page.evaluate(({ vw, vh }) => {
        const problems: string[] = [];

        // 1. 检查水平滚动条
        if (document.documentElement.scrollWidth > vw) {
          problems.push(`水平溢出: scrollWidth=${document.documentElement.scrollWidth} > viewport=${vw}`);
        }

        // 2. 检查 header 是否换行/截断
        const header = document.querySelector("header");
        if (header) {
          const hr = header.getBoundingClientRect();
          if (hr.height > 120) problems.push(`header 过高: ${Math.round(hr.height)}px`);
          if (hr.width > vw + 5) problems.push(`header 超出视口宽度`);
        }

        // 3. 检查地图区域
        const mapSection = document.querySelector('section[aria-label="高校地图"]');
        if (mapSection) {
          const mr = mapSection.getBoundingClientRect();
          if (mr.height < 100) problems.push(`地图区域过矮: ${Math.round(mr.height)}px`);
        }

        // 4. 检查侧边栏（移动端应在下方）
        const aside = document.querySelector("aside");
        if (aside) {
          const ar = aside.getBoundingClientRect();
          const isBelowMap = ar.top > window.innerHeight * 0.5;
          if (!isBelowMap && vw < 768) {
            problems.push(`侧边栏未在下方: top=${Math.round(ar.top)}, 视口高度=${vh}`);
          }
          if (ar.width > vw - 20) problems.push(`侧边栏过宽: ${Math.round(ar.width)}px > 视口-${vw}`);
        }

        // 5. 检查搜索框
        const filterBar = document.querySelector('label input[placeholder*="搜索"]');
        if (filterBar) {
          const fr = filterBar.getBoundingClientRect();
          if (fr.width < 150) problems.push(`搜索框过窄: ${Math.round(fr.width)}px`);
        }

        return problems;
      }, { vw: device.width, vh: device.height });

      console.log(`[${device.name}] 问题: ${issues.length > 0 ? JSON.stringify(issues) : "无"}`);
    });

    test(`${device.name} (${device.width}x${device.height}) - 学校详情页`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto(`${BASE}/school/%E6%B8%85%E5%8D%8E%E5%A4%A7%E5%AD%A6`);
      await page.waitForLoadState("networkidle");

      await page.screenshot({
        path: `/tmp/mobile-test/detail-${device.name.replace(/\s/g, "-").toLowerCase()}.png`,
        fullPage: false,
      });

      const issues = await page.evaluate(({ vw, vh }) => {
        const problems: string[] = [];

        // 1. 水平溢出
        if (document.documentElement.scrollWidth > vw) {
          problems.push(`水平溢出: ${document.documentElement.scrollWidth} > ${vw}`);
        }

        // 2. Tab 导航是否可横向滚动或换行
        const tabNav = document.querySelector('[class*="TabNav"], [role="tablist"]');
        if (tabNav) {
          const tr = tabNav.getBoundingClientRect();
          if (tr.width > vw - 10) problems.push(`Tab导航超出视口: ${Math.round(tr.width)}px`);
        }

        // 3. 采集卡片按钮宽度
        const buttons = document.querySelectorAll('button[class*="rounded-lg"]');
        let minBtnWidth = Infinity;
        buttons.forEach((btn) => {
          const bw = btn.getBoundingClientRect().width;
          if (bw < minBtnWidth && bw > 0) minBtnWidth = bw;
        });
        if (minBtnWidth < 80 && vw < 450) {
          problems.push(`采集卡片按钮过窄: ${Math.round(minBtnWidth)}px`);
        }

        return problems;
      }, { vw: device.width, vh: device.height });

      console.log(`[${device.name}-detail] 问题: ${issues.length > 0 ? JSON.stringify(issues) : "无"}`);
    });
  }
});
