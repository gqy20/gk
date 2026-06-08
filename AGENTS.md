# Repository Guidelines

## 项目结构与模块组织

本仓库是 Python 数据/爬虫包与 Next.js 前端应用的组合项目。

- `src/gk/`：Python 包，包含 agent、crawler、配置、prompt 和 CLI 入口。
- `tests/`：Python pytest 测试，覆盖 agent、crawler 和 Playwright 会话逻辑。
- `web/src/app/`：Next.js App Router 页面，包括 `/future`、`/majors` 和学校详情页。
- `web/src/components/`：共享 React 组件、业务组件和 UI 基础组件。
- `web/src/lib/`：前端数据、地图、future 预演服务与工具函数。
- `web/public/`：静态数据、地图、纹理和装饰素材。
- `server/`：future 预演 API 与数据库迁移相关代码。
- `scripts/`：数据抓取、生成和维护脚本。

## 构建、测试与本地开发命令

- `uv run pytest`：运行 Python 测试。
- `uv run ruff check .`：按 `pyproject.toml` 中的 Ruff 配置检查 Python 代码。
- `pnpm --dir web dev`：启动 Next.js 本地开发服务。
- `pnpm --dir web typecheck`：运行 TypeScript 类型检查。
- `pnpm --dir web lint`：运行 Next/ESLint 检查。
- `pnpm --dir web build`：生成数据并构建生产版前端。
- `pnpm exec vitest run web/src/...`：从仓库根目录运行指定前端测试。
- `pnpm --dir web data:generate`：重新生成 `web/public/data` 下的数据文件。

## 编码风格与命名规范

Python 目标版本为 3.12，使用 Ruff，行宽限制为 100。优先编写类型清晰、职责单一的小函数，包内导入使用 `gk` 路径。

前端使用 TypeScript + React。组件使用 PascalCase，变量和函数使用 camelCase。路由目录遵循 Next.js 约定。用户界面文案应简洁、贴合高考生和家长的语境。

## 测试规范

Python 测试使用 pytest，文件位于 `tests/`，命名为 `test_*.py`。前端测试使用 Vitest，命名为 `*.test.ts` 或 `*.test.tsx`；端到端或视觉验收规格使用 `*.spec.ts`。共享 helper、service、validation 和用户可见流程变更应补充聚焦测试。

## 易耗时与易出错工作流

- 地图与视觉改动容易反复返工。修改 `ChinaMap`、地图纹理、缩放、跳转、省份视图或装饰元素后，应启动前端并用浏览器核对实际效果；不要只依赖代码推断。
- future/预演功能的核心对象是高考生和家长。文案应优先回答“这个志愿以后大学四年怎么过”，避免“产业工程”“复合发展”“路径模式”等咨询内部术语。
- 学校坐标改动必须优先核对主校区和阳光高考等来源。不要只按学校名称粗略地理编码；多校区学校要明确选择依据。
- 涉及 LLM 结构化输出时，先检查 prompt、schema、validation 是否一致。不要用宽泛 fallback 掩盖模型返回为空或字段不匹配的问题。
- 提交前先查看 `git status --short`，只 `git add` 本次相关文件。当前仓库经常存在其他未提交 UI 或实验性改动，禁止顺手带入。

## 提交与 Pull Request 规范

提交信息应使用约定式提交格式：`type: summary`。常用类型包括 `feat`、`fix`、`refactor`、`docs`、`test`、`chore`。示例：`feat: refine future preview for gaokao students`、`fix: correct school campus coordinates`。提交应保持范围清晰，避免混入无关改动。

PR 应包含变更摘要、已执行的测试、UI 变更截图，以及是否影响数据生成、数据库迁移或部署配置。有关联 issue 时应在 PR 中链接。

## 安全与配置提示

密钥和连接信息应放在本地 `.env` 文件中，不要提交凭据。future 预演的数据库功能依赖 Postgres 环境和 `server/migrations` 中的迁移脚本。
