import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveRegion } from "../LiveRegion";

describe("LiveRegion", () => {
  it("renders aria-live=polite by default", () => {
    render(<LiveRegion>Update</LiveRegion>);
    const el = screen.getByText("Update");
    expect(el.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("renders aria-live=assertive when mode is set", () => {
    render(<LiveRegion mode="assertive">Error!</LiveRegion>);
    const el = screen.getByText("Error!");
    expect(el.closest("[aria-live]")).toHaveAttribute("aria-live", "assertive");
  });

  it("aria-busy attribute reflects prop", () => {
    const { rerender } = render(<LiveRegion busy={false}>Text</LiveRegion>);
    const el = screen.getByText("Text").closest("[aria-live]")!;
    expect(el).toHaveAttribute("aria-busy", "false");

    rerender(<LiveRegion busy={true}>Text</LiveRegion>);
    expect(el).toHaveAttribute("aria-busy", "true");
  });

  it("sr-only class applied", () => {
    render(<LiveRegion>Hidden</LiveRegion>);
    const el = screen.getByText("Hidden").closest("[aria-live]")!;
    expect(el.className).toContain("sr-only");
  });

  it("renders children text", () => {
    render(<LiveRegion>Agent is thinking...</LiveRegion>);
    expect(screen.getByText("Agent is thinking...")).toBeInTheDocument();
  });
});
