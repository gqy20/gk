# 中国高校信息地图

基于 Next.js 的静态前端，用于展示双一流高校的省份分布、学校状态和抓取详情。

## 开发

```bash
pnpm install
pnpm dev
```

开发服务默认运行在 `http://localhost:3000`。当前 dev 脚本固定使用 webpack 和 polling，以避开本机文件监听数量限制下的 Turbopack `Too many open files` 问题。

## 数据

前端数据由根目录的 `data/92_list.csv` 和 `data/output/*.json` 生成：

```bash
pnpm data:generate
```

生成结果写入 `public/data/schools.json`。`pnpm build` 会通过 `prebuild` 自动重新生成该文件；如果部署环境没有提交 `data/output/*.json`，脚本会保留已提交的 `public/data/schools.json`，避免把完整详情覆盖成空数据。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm build
```
