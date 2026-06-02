// 必须在任何其他导入之前执行
// React 19 dev build 在 module 顶层求值 process.env.NODE_ENV,
// 但 vitest + vite 在 cjs→esm 包装过程中把 process.env 错误地
// 映射成 react 模块的 namespace exports。手动 polyfill process
// 让 dev 模式能够正常分支判断。
const g = globalThis as unknown as { process?: { env: Record<string, string> } };
if (!g.process) g.process = { env: {} } as { env: Record<string, string> };
g.process.env.NODE_ENV = g.process.env.NODE_ENV || "test";

import "@testing-library/jest-dom/vitest";
