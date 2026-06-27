# GK — 高考志愿探索工具

面向高考生和家长的高校与专业选择工具：**学校数据地图、未来预演、专业查询、大学生活模拟器**，把抽象的志愿填报变成可感知的探索体验。

> 🌐 部署地址：[https://gk.gqy20.top](https://gk.gqy20.top)

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **高校地图** | 基于 MapLibre GL 的中国双一流高校省份分布可视化，支持学校详情跳转 |
| **未来预演 (/future)** | 输入学校 + 专业，生成大学四年生活场景预览（学习、住宿、就业方向） |
| **专业查询 (/majors)** | 专业数据浏览与满意度参考 |
| **学校详情 (/school/[id])** | 单所学校完整信息展示 |
| **模拟器 (/simulator)** | 大学生活模拟器 — 基于人设卡进行多轮情境推演，支持结果分享 |
| **数据抓取 (Python Agent)** | 基于 Claude Agent SDK 的高校信息智能抓取，结构化输出至 JSON / SQLite |

## 技术栈

### 前端 (`web/`)

- **框架**：Next.js 16 (App Router) + React 19 + TypeScript
- **样式**：Tailwind CSS v4 + Framer Motion + GSAP
- **地图**：MapLibre GL（高校分布）、高德 JS API
- **3D**：Three.js
- **表单**：React Hook Form + Valibot 校验
- **UI 原语**：Radix UI + CVA + class-variance-authority
- **测试**：Vitest + Testing Library + Playwright

### 后端 & 数据 (`src/gk/`, `server/`)

- **语言**：Python 3.12（uv 管理）
- **Agent**：Claude Agent SDK（结构化输出、并发调度）
- **API**：Node.js (tsx) — Future 预演 API / Simulator API
- **数据库**：PostgreSQL（迁移脚本在 `server/migrations/`）+ SQLite（本地数据）
- **爬虫**：Playwright + Puppeteer
- **工具**：Ruff（lint）、pytest（测试）

## 项目结构

```
gk/
├── web/                      # Next.js 前端应用
│   ├── src/app/              # 页面路由（/, /future, /majors, /school, /simulator）
│   ├── src/components/       # 共享组件 / 业务组件 / UI 原语
│   ├── src/lib/              # 数据服务、地图、Future 预演逻辑
│   ├── public/data/          # 前端静态数据（schools.json 等）
│   └── scripts/              # 数据生成脚本
├── src/gk/                   # Python 包（agent / crawler / prompt / CLI）
├── server/                   # Future 预演 API + Simulator API + 数据库迁移
├── data/                     # 原始数据（CSV / JSON / SQLite）
├── scripts/                  # 数据抓取与维护脚本
├── tests/                    # Python pytest 测试
├── AGENTS.md                 # 仓库开发规范
├── PRODUCT.md                # 产品定义与设计原则
└── vercel.json               # Vercel 部署配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Python 3.12 + uv（如需运行数据抓取）

### 安装依赖

```bash
# 前端
pnpm install

# Python（可选）
uv sync
```

### 本地开发

```bash
# 启动前端开发服务（默认 http://localhost:3000）
pnpm --dir web dev

# 运行前端测试
pnpm exec vitest run web/src/

# 类型检查 / Lint
pnpm --dir web typecheck
pnpm --dir web lint
```

### 数据生成

```bash
# 从 data/output/*.json 重新生成前端静态数据
pnpm --dir web data:generate
```

### Python 测试与检查

```bash
uv run pytest          # 运行 Python 测试
uv run ruff check .    # Ruff 代码检查
```

## 部署

项目通过 **Vercel** 部署（配置见 `vercel.json`）。`pnpm build` 会自动执行 `prebuild` 数据生成步骤。

生产环境变量见 `.env.production`，本地开发使用 `.env`（参考 `.env.example`）。

## 开发规范

详见 [AGENTS.md](./AGENTS.md)，要点：

- **提交格式**：约定式提交 (`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`)
- **文案原则**：面向高考生和家长，避免咨询术语，用直白语言解释"选了这个志愿以后怎么过"
- **地图改动**：修改后必须启动浏览器核对实际效果，不要只靠代码推断
- **LLM 结构化输出**：先检查 prompt / schema / validation 一致性，不用宽泛 fallback 掩盖问题

## License

（待补充）
