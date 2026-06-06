/**
 * TDD 红测试:FuturShell 重构后应支持的契约。
 *
 * 这些断言覆盖了 Mission-Console 改造的核心改动点:
 *  1. 顶栏出现脉冲状态点(eyebrow 视觉化)
 *  2. FuturePanel 支持 tone 路径色编码
 *  3. SectionHeading 支持 kicker(uppercase tracking 标签)
 *  4. 整体走深色 surface,不再使用米黄 #f4f0e7
 *
 * 当前 FutureShell.tsx 是米黄配色、不支持 tone / kicker / as,所以这些测试会失败。
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FutureShell, FuturePanel, SectionHeading } from "./FutureShell";

describe("FutureShell — Mission Console 外壳", () => {
  it("渲染标题与返回链接", () => {
    render(
      <FutureShell title="未来路径推演" backLabel="返回">
        <p>child</p>
      </FutureShell>,
    );
    expect(screen.getByRole("heading", { name: "未来路径推演" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回/ })).toHaveAttribute("href", "/");
  });

  it("eyebrow 应渲染出脉冲状态点(framer-motion 之外用纯 CSS 实现)", () => {
    const { container } = render(
      <FutureShell title="X" eyebrow="推演控制台">
        <p>x</p>
      </FutureShell>,
    );
    // 状态点核心特征:有 animate-ping 类 + 一个相对定位的子元素
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeInTheDocument();
    expect(ping?.parentElement).toHaveClass("relative");
  });

  it("根容器走深色 surface token,而非米黄", () => {
    const { container } = render(
      <FutureShell title="X">
        <p>x</p>
      </FutureShell>,
    );
    const root = container.firstElementChild;
    expect(root).toHaveClass("bg-surface");
    expect(root).not.toHaveClass("bg-[#f4f0e7]");
  });

  it("subtitle 仍以副标题形式存在", () => {
    render(
      <FutureShell title="X" subtitle="先把一个志愿拆成几条路径">
        <p>x</p>
      </FutureShell>,
    );
    expect(screen.getByText(/先把一个志愿拆成几条路径/)).toBeInTheDocument();
  });
});

describe("FuturePanel — 玻璃面板", () => {
  it("tone=steady 应注入绿系 ring", () => {
    const { container } = render(<FuturePanel tone="steady">x</FuturePanel>);
    const panel = container.firstElementChild;
    expect(panel?.className).toMatch(/ring-brand-300\/40/);
  });

  it("tone=balanced 应注入金色 ring", () => {
    const { container } = render(<FuturePanel tone="balanced">x</FuturePanel>);
    expect(container.firstElementChild?.className).toMatch(/ring-accent-300\/45/);
  });

  it("tone=risky 应注入红色 ring", () => {
    const { container } = render(<FuturePanel tone="risky">x</FuturePanel>);
    expect(container.firstElementChild?.className).toMatch(/ring-danger-300\/40/);
  });

  it("顶部应存在 1px 高光线(inset-x-0 top-0 h-px)", () => {
    const { container } = render(<FuturePanel>x</FuturePanel>);
    const highlight = container.querySelector('span[class*="inset-x-0"][class*="top-0"][class*="h-px"]');
    expect(highlight).toBeInTheDocument();
  });
});

describe("SectionHeading — kicker 小标签", () => {
  it("kicker 应以 uppercase tracking 形式呈现", () => {
    const { container } = render(
      <SectionHeading kicker="quality" title="质量检查" />,
    );
    const kicker = container.querySelector('[class*="uppercase"][class*="tracking-"]');
    expect(kicker).toHaveTextContent("quality");
  });

  it("无 kicker 时不渲染 kicker 元素", () => {
    const { container } = render(<SectionHeading title="质量检查" />);
    expect(container.querySelector('[class*="uppercase"][class*="tracking-"]')).toBeNull();
  });
});
