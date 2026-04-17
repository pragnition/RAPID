import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCallDrawer } from "../ToolCallDrawer";

describe("ToolCallDrawer", () => {
  it("renders nothing when statuses is empty", () => {
    const { container } = render(
      <ToolCallDrawer statuses={[]}>
        <div>child</div>
      </ToolCallDrawer>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows count + glyphs in summary row; body hidden by default", () => {
    render(
      <ToolCallDrawer statuses={["complete", "complete", "error"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );

    expect(screen.getByText("3 tool calls")).toBeInTheDocument();
    expect(screen.getAllByLabelText("complete")).toHaveLength(2);
    expect(screen.getByLabelText("error")).toBeInTheDocument();
    expect(screen.queryByText("body-content")).toBeNull();
  });

  it("uses singular form when count is 1", () => {
    render(
      <ToolCallDrawer statuses={["complete"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );
    expect(screen.getByText("1 tool call")).toBeInTheDocument();
    expect(screen.queryByText("1 tool calls")).toBeNull();
  });

  it("click toggles expansion", () => {
    render(
      <ToolCallDrawer statuses={["complete"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );

    const button = screen.getByRole("button", { name: /toggle tool calls/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body-content")).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body-content")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body-content")).toBeNull();
  });

  it("auto-opens on rising edge of running and does not auto-close", () => {
    const { rerender } = render(
      <ToolCallDrawer statuses={["complete", "complete"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );

    const button = screen.getByRole("button", { name: /toggle tool calls/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body-content")).toBeNull();

    // Rising edge: a running tool appears -- drawer auto-opens.
    rerender(
      <ToolCallDrawer statuses={["complete", "running"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body-content")).toBeInTheDocument();

    // All tools settle -- drawer stays open.
    rerender(
      <ToolCallDrawer statuses={["complete", "complete"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body-content")).toBeInTheDocument();
  });

  it("defaultOpen starts expanded", () => {
    render(
      <ToolCallDrawer statuses={["complete"]} defaultOpen>
        <div>body-content</div>
      </ToolCallDrawer>,
    );
    const button = screen.getByRole("button", { name: /toggle tool calls/i });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body-content")).toBeInTheDocument();
  });

  it("running spinner renders for running status", () => {
    render(
      <ToolCallDrawer statuses={["running"]}>
        <div>body-content</div>
      </ToolCallDrawer>,
    );
    expect(screen.getByLabelText("running")).toBeInTheDocument();
  });
});
