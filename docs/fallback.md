# Fallback 机制总览

> 本文档整理了项目中所有 fallback（降级/兜底/容错）机制，按类别分类，便于维护和排查问题。

---

## 目录

- [一、UI 加载降级（React Suspense）](#一ui-加载降级react-suspense)
- [二、数据源多级降级](#二数据源多级降级)
- [三、API 调用重试与退避](#三api-调用重试与退避)
- [四、LLM 输出归一化](#四llm-输出归一化)
- [五、枚举映射兜底](#五枚举映射兜底)
- [六、存储引擎切换](#六存储引擎切换)
- [七、环境变量 / 配置默认值](#七环境变量--配置默认值)
- [八、Try-Catch 容错处理](#八try-catch-容错处理)
- [九、爬虫工具链兜底策略](#九爬虫工具链兜底策略)

---

## 一、UI 加载降级（React Suspense）

### 1.1 Future 推演页面

| 文件 | 组件 | 说明 |
|------|------|------|
| `web/src/app/future/page.tsx:23` | `FuturePageShell` | 推演表单页加载骨架屏，显示"正在加载推演表单…" |
| `web/src/app/future/result/page.tsx:26` | `FutureLoadingFallback` | 推演结果页紧凑模式加载态 |
| `web/src/app/future/FutureLoading.tsx:306` | `FutureLoadingFallback` | 加载组件导出，支持自定义 message |

**关键参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `message` | `"正在加载…"` | 加载提示文案 |
| `timeoutMs` | `180_000` (3分钟) | 超时阈值 |
| `maxWaitMs` | `300_000` (5分钟) | 最大等待时间 |

超时后触发 `onTimeout` 回调，显示"刷新重试"按钮。

---

## 二、数据源多级降级

### 2.1 学校坐标数据源

**文件:** `web/scripts/geocode-schools.ts:220`

```
优先级链: schools.json（精确坐标） → CSV（基础坐标）
```

- 优先从 `public/data/schools.json` 读取（信息更全）
- 失败或为空时回退到 `data/92_list.csv`

### 2.2 学校详情数据合并

**文件:** `web/scripts/generate-data.ts`

**学校名称 fallback** (`:113-116`)：
```typescript
const fallbackName = path.basename(file, ".json");
const name = raw.university || fallbackName;  // 文件名作为兜底
```

**Agent 数据 + 阳光高考三级合并** (`:226-253`)：

> Agent 数据优先，阳光高考作为 fallback/补充

| 字段 | 合并策略 |
|------|----------|
| `basic_info` | Agent 没有时注入阳光高考数据（100% 覆盖） |
| `faq` | Agent 未抓到时用阳光高考补充 |
| `major_satisfaction` | 全新字段，无冲突直接合并 |

**坐标数据 fallback 链** (`:332`)：
```typescript
coord: coordsCache?.[m.name] ?? getSchoolCoord(prov, idx, provinceTotals.get(prov) || 1)
// 精确缓存坐标 → 省会估算坐标
```

### 2.3 省份坐标兜底

**文件:** `web/src/lib/provinces.ts:70`

```typescript
const base = PROVINCE_COORDS[province] || [104.065735, 30.659462]; // 成都坐标兜底
```

未知省份默认使用四川成都坐标。

### 2.4 专业名称解析

**文件:** `web/src/components/majors/MajorList.tsx:17-22`

```
zymc 有效值 → 专业类名去掉"类"字 → "专业 {zydm}"
```

三级 fallback，确保专业名称始终有可展示的文本。

---

## 三、API 调用重试与退避

### 3.1 Future 轮询客户端

**文件:** `web/src/lib/future/client.ts:19-26, :104-166`

**配置常量：**

| 常量 | 值 | 说明 |
|------|-----|------|
| `POLL_INTERVALS` | `[3000, 4000, 5000]` | 阶梯轮询间隔（ms） |
| `MAX_RETRIES` | `2` | 最大瞬态错误重试次数 |
| `DEFAULT_MAX_WAIT_MS` | `300_000` (5分钟) | 默认最大等待时间 |

**重试逻辑流程：**

```
API 调用
  ├─ 成功 → 重置 retryCount = 0，继续轮询
  ├─ 瞬态错误 → retryCount++，指数退避 min(1000 * 2^retryCount, 8000)ms
  │   └─ retryCount >= MAX_RETRIES → 抛出错误
  └─ 超时 > maxWaitMs → 直接抛出错误
```

支持 `AbortSignal` 取消。

### 3.2 结果页面内联轮询

**文件:** `web/src/app/future/result/page.tsx:19-22, :52-89`

与 `client.ts` 的工具函数存在重复实现，配置相同：
- `POLL_INTERVALS = [3000, 4000, 5000]`
- `MAX_RETRIES = 2`
- `MAX_WAIT_MS = 300_000`

> ⚠️ **待优化**: 两处轮询逻辑重复，建议统一到 `client.ts`。

---

## 四、LLM 输出归一化

**文件:** `web/src/lib/future/service.ts:52-88`

LLM 返回的路径数据可能字段缺失或不规范，`normalizePath()` 对每个字段提供默认值：

| 字段 | Fallback 值 | 说明 |
|------|-------------|------|
| `index` | `index + 1` | 自动编号 |
| `label` | `"路径 {n}"` | 默认标签 |
| `tagline` | `""` | 空字符串 |
| `probability_tone` | `"均衡"` | 默认均衡型 |
| `fit_score` | `0` | 默认 0 分 |
| `branch_ref` | `""` | 空字符串 |
| `scores` | `{}` | 空对象 |
| `timeline` | `[]` | 空数组 |
| `key_risks` | `[]` | 空数组 |
| `turning_points` | `[]` | 空数组 |
| `advice` | `""` | 空字符串 |

`normalizeOutput()` 中的三级 fallback：
```typescript
branch_ref: path.branch_ref || branch?.name || ""   // 字段 → 分支名 → 空串
school: output.choice_context?.school || input.choiceContext.school  // LLM输出 → 用户输入
major: output.choice_context?.major || input.choiceContext.major
city: output.choice_context?.city || input.choiceContext.city
```

---

## 五、枚举映射兜底

### 5.1 Tone 映射

**文件:** `web/src/app/future/_tone.ts:20-27`

> 未知值兜底为 balanced，避免组件渲染时炸掉

| LLM 输出 | 映射值 |
|----------|--------|
| `"稳健"` | `steady` |
| `"冒险"` | `risky` |
| `"均衡"` | `balanced` |
| 其他任意值 | `balanced` （兜底） |

雷达图分数也使用 `?? 0` 兜底（`:48`）。

### 5.2 省份配色

**文件:** `web/src/lib/map-style.ts:16-53, :371-381`

未知省份名称时，通过哈希取模从 4 套备用色板中选择：

```typescript
const FALLBACK_PROVINCE_PALETTES: ProvincePalette[] = [/* 4 套色板 */];

export function getProvincePalette(name: string): ProvincePalette {
  return PROVINCE_PALETTES[name] || fallbackProvincePalette(name);  // 哈希兜底
}
```

---

## 六、存储引擎切换

**文件:** `web/src/lib/future/server.ts:19-28`

根据环境变量自动选择数据库后端：

```
DATABASE_URL 已配置 → PostgreSQL（持久化）
DATABASE_URL 未配置 → MemoryFutureRepository（内存，开发/测试兜底）
```

所有 handler 函数中参数缺省时也会 fallback 到默认实现：
```typescript
repository: options.repository || getDefaultFutureRepository()
provider: options.provider || getDefaultAnthropicProvider()
model: process.env.ANTHROPIC_MODEL || "anthropic-compatible"
```

---

## 七、环境变量 / 配置默认值

### 7.1 Anthropic API 配置

**文件:** `web/src/lib/future/server.ts:32-47`

| 变量 | Fallback | 说明 |
|------|----------|------|
| `ANTHROPIC_API_KEY` | `ANTHROPIC_AUTH_TOKEN` | 双 Key 兜底 |
| `ANTHROPIC_MODEL` | `"claude-sonnet-4-5"` | 默认模型 |
| `ANTHROPIC_BASE_URL` | `"https://api.anthropic.com"` | 官方 API |

### 7.2 Provider 构造参数

**文件:** `web/src/lib/future/anthropic.ts:74-77`

| 参数 | Fallback | 说明 |
|------|----------|------|
| `baseUrl` | `"https://api.anthropic.com"` | 官方端点 |
| `anthropicVersion` | `"2023-06-01"` | API 版本 |
| `fetchImpl` | `fetch` | 全局 fetch |

### 7.3 前端 API 地址

**文件:** `web/src/lib/future/client.ts:28`

```typescript
process.env.NEXT_PUBLIC_FUTURE_API_BASE_URL || ""  // 未设置则同源请求
```

### 7.4 高德地图 API Key

| 文件 | 行号 | Fallback 链 |
|------|------|-------------|
| `web/scripts/geocode-schools.ts` | 27 | `AMAP_GEOCODE_KEY` → `NEXT_PUBLIC_AMAP_WEB_SERVICE_KEY` → `""` |
| `web/src/components/school-panel/SchoolMap.tsx` | 136 | `NEXT_PUBLIC_AMAP_WEB_SERVICE_KEY` → `""` |

### 7.5 服务端配置

**文件:** `server/future-api.ts`

| 配置 | 行号 | 默认值 | 说明 |
|------|------|--------|------|
| CORS Origin | 27 | `"*"` | 允许所有来源 |
| 服务端口 | 46 | `8601` | Future API 端口 |

---

## 八、Try-Catch 容错处理

### 8.1 前端页面层

| 文件 | 场景 | 降级行为 |
|------|------|----------|
| `web/src/app/page.tsx:67-75` | 学校列表加载失败 | `setSchools([])` 空数组兜底 |
| `web/src/app/future/page.tsx:96-100` | 历史记录拉取失败 | 设置错误信息 + 空数组 |
| `web/src/app/future/page.tsx:175-179` | 推演提交失败 | 显示错误消息 |
| `web/src/app/future/result/page.tsx:70-79` | 结果轮询瞬态错误 | 自动重试（指数退避） |
| `web/src/app/future/result/page.tsx:127` | 缺少 runId | 显示提示文字 |
| `web/src/components/school-panel/SchoolMap.tsx:122-124` | 地图加载失败 | `console.error`，UI 不崩溃 |
| `web/src/app/school/[name]/SchoolDetailClient.tsx:28-52` | crawl 数据加载失败 | 双层 try/catch + `Promise.allSettled`，静默忽略 |
| `web/src/app/majors/page.tsx:26` | 专业数据加载失败 | `.catch(() => {})` 静默忽略 |

### 8.2 后端 / Service 层

| 文件 | 场景 | 降级行为 |
|------|------|----------|
| `web/src/lib/future/service.ts:194-204` | LLM 生成失败 | 记录 failed 状态到 repository，再抛出 |
| `web/src/lib/future/client.ts:147-163` | API 调用失败 | 取消检查 → 重试 → 最终抛出 |
| `web/src/app/api/future-runs/route.ts:22-28` | 后台任务异常 | 日志记录，after() 中吞掉 |
| `web/src/app/api/future-runs/route.ts:31-36` | POST 异常 | 返回 500 JSON |
| `web/src/app/api/future-runs/route.ts:48-53` | GET 异常 | 返回 500 JSON |
| `web/src/app/api/future-runs/[runId]/route.ts:24-30` | 单条查询异常 | 返回 500 JSON |
| `server/future-api.ts:66-67` | 创建 run 异常 | 返回 500 `{ error }` |
| `server/future-api.ts:81-82` | 查询 run 异常 | 返回 500 `{ error }` |

### 8.3 构建脚本层

| 文件 | 场景 | 降级行为 |
|------|------|----------|
| `web/scripts/generate-data.ts:117-119` | 单个 JSON 解析失败 | `console.warn` 跳过，不阻断 |
| `web/scripts/generate-data.ts:136-138` | 已有输出读取失败 | 返回 0 |
| `web/scripts/generate-data.ts:326` | 单校阳光高考合并失败 | 静默跳过 |
| `web/scripts/generate-data.ts:351-354` | SQLite 导出失败 | 静默跳过 |
| `web/scripts/geocode-schools.ts:254-256` | 单校地理编码失败 | 计入失败数，继续下一所 |

### 8.4 Repository 层

**文件:** `web/src/lib/future/repository.ts`

| 位置 | 字段 | Fallback |
|------|------|----------|
| `:99` | `output` | `run.output ?? null` |
| `:104-105` | `createdAt` 排序 | 无值时用 `0` 兜底 |
| `:122` | `paths` | `output?.paths ?? []` |
| `:139` | `errorMessage` | `run.error ?? null` |
| `:140` | `createdAt` | `run.createdAt ?? new Date().toISOString()` |

---

## 九、爬虫工具链兜底策略

**文件:** `src/gk/prompts/crawl.yml`

| 策略 | 说明 |
|------|------|
| Playwright 兜底 | 处理 JS 渲染页面时使用浏览器模拟（`playwright-cli`） |
| 搜索兜底 | 官网找不到时用 `search_text("XX大学 2024 招生计划")` 兜底 |

---

## 统计汇总

| Fallback 类别 | 涉及文件数 | 关键特征 |
|---------------|-----------|---------|
| UI 加载降级（Suspense） | 3 | 骨架屏 + 超时重试 |
| 数据源多级降级 | 4 | JSON→CSV、Agent→阳光高考、精确→估算坐标 |
| API 重试/退避 | 2 | 指数退避、AbortSignal、⚠️ 存在重复实现 |
| LLM 输出归一化 | 1 | 9+ 字段 `\|\|` 默认值 |
| 枚举映射兜底 | 2 | tone→balanced、省份→哈希色板 |
| 存储引擎切换 | 1 | PostgreSQL ↔ Memory |
| 环境变量默认值 | 6 | API Key/URL/端口/CORS 等 |
| Try-Catch 容错 | 18+ 处 | 静默忽略 / 降级返回 / 错误上报 |
| 爬虫工具链兜底 | 1 | playwright + search_text 双重兜底 |

---

## 待优化项

1. **[ ] 轮询逻辑去重**: `client.ts` 和 `result/page.tsx` 存在两套相同的轮询+重试逻辑，应统一
2. **[ ] 静默 catch 审计**: 部分 `.catch(() => {})` 和空 catch 块可能隐藏真实错误，建议至少加日志
3. **[ ] 内存存储警告**: `MemoryFutureRepository` 作为 fallback 在生产环境可能导致数据丢失，建议启动时检测并告警
