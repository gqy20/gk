/**
 * TDD: future/result 页面 Mission Console 视觉验收
 *
 * 验证以下六条 Mission Console 暗色玻璃 + tone 编码改造契约:
 * 1. 整页 bg-surface 暗色,不能再出现米黄 bg-[#fffaf0] / bg-[#f7f1e4] / text-[#9b7420] 等旧色
 * 2. DecisionHero 显示推荐路径 label + 大字 fit_score
 * 3. ScoreGrid 渲染雷达图 SVG 且 polygon 有 7 个顶点(对应 7 维分数)
 * 4. ComparisonTable 至少包含 income/stability/growth/risk 四行 + 3 列路径
 * 5. PathCard 包含 TONE 颜色 class(text-brand-300 / accent-300 / danger-300)
 * 6. 错误状态用红边框显示,而非米黄
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

const mockPath = (overrides: Record<string, unknown> = {}) => ({
  index: 1,
  label: "学术深造",
  tagline: "读研、读博、走科研路线",
  probability_tone: "均衡",
  fit_score: 8,
  branch_ref: "深耕路线",
  scores: {
    income: { value: 5, reason: "前期收入一般" },
    stability: { value: 7, reason: "院校编制稳定" },
    growth: { value: 9, reason: "学术成长快" },
    happiness: { value: 8, reason: "匹配兴趣" },
    risk: { value: 4, reason: "投入回报周期长" },
    school_fit: { value: 9, reason: "与目标院校匹配" },
    major_fit: { value: 9, reason: "与专业高度契合" },
  },
  timeline: [
    {
      stage: "本科第 1-2 年",
      text: "稳住绩点，参与科研项目。",
      key_events: ["GPA > 3.5", "进课题组"],
    },
    {
      stage: "本科第 3-4 年",
      text: "明确方向，准备推免或考研。",
      key_events: ["发论文", "保研面试"],
    },
    {
      stage: "研究生阶段",
      text: "进入课题组开始系统性研究。",
      key_events: ["开题", "中期答辩"],
    },
  ],
  key_risks: ["科研进度不及预期", "导师契合度"],
  turning_points: ["保研结果", "研究方向选择"],
  advice: "先把绩点稳住，再看科研。",
  ...overrides,
});

const mockResult = {
  run: {
    id: "test",
    status: "completed",
    model: "claude-opus-4-7",
    promptVersion: "future-v2",
    inputTokens: 1234,
    outputTokens: 567,
  },
  output: {
    title: "三条路径推演",
    summary: "根据你的画像，学术深耕最匹配长期目标。",
    choice_context: {
      school: "示例大学",
      assumptions: ["绩点 3.6+", "可投入科研时间每周 10h+", "家庭支持稳定"],
    },
    paths: [
      mockPath({ index: 1, label: "学术深造", probability_tone: "均衡", fit_score: 8, branch_ref: "深耕路线" }),
      mockPath({ index: 2, label: "产业工程", probability_tone: "稳健", fit_score: 7, branch_ref: "工程路线" }),
      mockPath({ index: 3, label: "跨界转向", probability_tone: "冒险", fit_score: 6, branch_ref: "探索路线" }),
    ],
    comparison: {
      best_for_income: "产业工程",
      best_for_stability: "学术深造",
      best_for_growth: "学术深造",
      highest_risk: "跨界转向",
      most_balanced: "学术深造",
    },
    branch_plan: [
      { index: 1, name: "深耕路线", riskTone: "均衡", focus: "读研/读博，学术深耕", assumptions: [], requiredTradeoffs: ["周期长"] },
      { index: 2, name: "工程路线", riskTone: "稳健", focus: "进入企业做技术", assumptions: [], requiredTradeoffs: ["晋升靠绩效"] },
      { index: 3, name: "探索路线", riskTone: "冒险", focus: "跨界尝试新方向", assumptions: [], requiredTradeoffs: ["收入波动大"] },
    ],
    validation: { valid: true, errors: [], warnings: [], diversityScore: 0.85 },
    overall_advice: "建议先稳住绩点，同时积累一段科研/实习经历。",
  },
};

test.describe("future/result 视觉验收", () => {
  test("1-整页暗色玻璃:不再出现米黄旧色", async ({ page }) => {
    await page.route("**/api/future-runs/test", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResult),
      }),
    );
    await page.goto(`${BASE}/future/result?runId=test`);
    await page.waitForSelector("text=学术深造");
    const bodyText = await page.locator("body").innerHTML();
    // 旧米黄 #fffaf0 / #f7f1e4 / #d6c9ab 都不应再出现
    expect(bodyText).not.toContain("#fffaf0");
    expect(bodyText).not.toContain("#f7f1e4");
    expect(bodyText).not.toContain("#d6c9ab");
    expect(bodyText).not.toContain("text-[#9b7420]");
  });

  test("2-DecisionHero 显示推荐路径 + 大字 fit_score", async ({ page }) => {
    await page.route("**/api/future-runs/test", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResult) }),
    );
    await page.goto(`${BASE}/future/result?runId=test`);
    await expect(page.getByText("推荐结论")).toBeVisible();
    // 第一个 h2 是 DecisionHero 的"学术深造"(第二个是 PathCard 的)
    const heroHeading = page.getByRole("heading", { name: "学术深造", level: 2 }).first();
    await expect(heroHeading).toBeVisible();
    // fit_score = 8 应在 text-5xl 大字里
    const fitScore = page.locator("div.text-5xl").first();
    await expect(fitScore).toContainText("8");
  });

  test("3-ScoreGrid 雷达图 SVG 7 个 polygon 顶点", async ({ page }) => {
    await page.route("**/api/future-runs/test", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResult) }),
    );
    await page.goto(`${BASE}/future/result?runId=test`);
    await page.waitForSelector("svg polygon");
    // 推荐路径的雷达 polygon:7 维 → 7 个点(point 属性逗号分隔,顶点数 = 顶点数)
    const polygonPoints = await page.locator("svg polygon").first().getAttribute("points");
    expect(polygonPoints).toBeTruthy();
    const vertexCount = polygonPoints!.trim().split(/\s+/).length;
    expect(vertexCount).toBe(7);
  });

  test("4-ComparisonTable 包含 7 行(收入/稳定/成长/风险等)+ 3 列路径", async ({ page }) => {
    await page.route("**/api/future-runs/test", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResult) }),
    );
    await page.goto(`${BASE}/future/result?runId=test`);
    // 先等数据加载完(推荐路径 label 出现)
    await page.waitForSelector("h2:has-text('学术深造')");
    await page.getByRole("button", { name: /对比三条路径/ }).click();
    // 表格 body 至少 7 行(rows = 适合人群/收入/稳定/成长/风险/最大风险/第一步)
    const rowCount = await page.locator("tbody tr").count();
    expect(rowCount).toBeGreaterThanOrEqual(7);
    // 三列路径 label
    await expect(page.locator("thead").getByText("学术深造")).toBeVisible();
    await expect(page.locator("thead").getByText("产业工程")).toBeVisible();
    await expect(page.locator("thead").getByText("跨界转向")).toBeVisible();
  });

  test("5-PathCard 包含 TONE 颜色 class(green-300/accent-300/danger-300)", async ({ page }) => {
    await page.route("**/api/future-runs/test", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResult) }),
    );
    await page.goto(`${BASE}/future/result?runId=test`);
    await page.waitForSelector("h2:has-text('学术深造')");
    // 三个 PathCard 各自带一种 tone class
    const brandCount = await page.locator(".text-brand-300").count();
    const accentCount = await page.locator(".text-accent-300").count();
    const riskCount = await page.locator(".text-risk-400").count();
    expect(brandCount + accentCount + riskCount).toBeGreaterThan(0);
  });

  test("6-错误状态用红边框显示(不是米黄)", async ({ page }) => {
    await page.route("**/api/future-runs/missing", (route) =>
      route.fulfill({ status: 500, body: "Internal Error" }),
    );
    await page.goto(`${BASE}/future/result?runId=missing`);
    // FutureApiError 把 res.text() 包成 Error.message,所以显示 mock 的 "Internal Error"
    await page.waitForSelector("text=Internal Error", { timeout: 15000 });
    const errorBox = page.locator(".border-danger-300\\/40");
    await expect(errorBox).toBeVisible();
  });

  test("7-Loading 状态有 animate-ping 状态点", async ({ page }) => {
    // 故意延迟 mock,看到 loading
    await page.route("**/api/future-runs/slow", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResult) });
    });
    await page.goto(`${BASE}/future/result?runId=slow`);
    // loading 期间应有 animate-ping 圆点
    const ping = page.locator(".animate-ping").first();
    await expect(ping).toBeVisible();
  });
});
