import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoundSelector } from "./RoundSelector";

describe("RoundSelector", () => {
  it("marks the current round count as selected", () => {
    render(<RoundSelector value={8} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /8 轮/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /3 轮/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the selected round count", () => {
    const onChange = vi.fn();
    render(<RoundSelector value={8} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /20 轮/ }));

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("keeps all expected round choices visible", () => {
    render(<RoundSelector value={8} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /3 轮/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /8 轮/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /20 轮/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /50 轮/ })).toBeInTheDocument();
  });
});
