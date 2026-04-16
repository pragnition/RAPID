import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useEffect, type RefObject } from "react";
import { useFocusTrap } from "../useFocusTrap";

// ---------------------------------------------------------------------------
// jsdom workaround: offsetParent is always null in jsdom. Override it so the
// focusable-element filter inside useFocusTrap does not exclude all elements.
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    get() {
      return this.parentNode;
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test component that wires useFocusTrap to a container div
// ---------------------------------------------------------------------------

function TrapContainer({
  enabled = true,
  onEscape,
  onRef,
}: {
  enabled?: boolean;
  onEscape?: () => void;
  onRef?: (ref: RefObject<HTMLDivElement | null>) => void;
}) {
  const ref = useFocusTrap<HTMLDivElement>({ enabled, onEscape });

  useEffect(() => {
    onRef?.(ref);
  }, [ref, onRef]);

  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn-first">First</button>
      <button data-testid="btn-second">Second</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFocusTrap", () => {
  it("focuses first focusable on mount", () => {
    render(<TrapContainer />);
    const btn = document.querySelector("[data-testid='btn-first']") as HTMLButtonElement;
    expect(document.activeElement).toBe(btn);
  });

  it("tab from last wraps to first", () => {
    render(<TrapContainer />);
    const btnSecond = document.querySelector("[data-testid='btn-second']") as HTMLButtonElement;
    const btnFirst = document.querySelector("[data-testid='btn-first']") as HTMLButtonElement;

    // Focus last button
    btnSecond.focus();
    expect(document.activeElement).toBe(btnSecond);

    // Press Tab -- should wrap to first
    fireEvent.keyDown(
      document.querySelector("[data-testid='trap-container']")!,
      { key: "Tab", shiftKey: false },
    );
    expect(document.activeElement).toBe(btnFirst);
  });

  it("shift+tab from first wraps to last", () => {
    render(<TrapContainer />);
    const btnFirst = document.querySelector("[data-testid='btn-first']") as HTMLButtonElement;
    const btnSecond = document.querySelector("[data-testid='btn-second']") as HTMLButtonElement;

    // The trap focuses first on mount, so activeElement should be btnFirst
    expect(document.activeElement).toBe(btnFirst);

    // Press Shift+Tab -- should wrap to last
    fireEvent.keyDown(
      document.querySelector("[data-testid='trap-container']")!,
      { key: "Tab", shiftKey: true },
    );
    expect(document.activeElement).toBe(btnSecond);
  });

  it("escape calls onEscape when provided", () => {
    const onEscape = vi.fn();
    render(<TrapContainer onEscape={onEscape} />);

    fireEvent.keyDown(
      document.querySelector("[data-testid='trap-container']")!,
      { key: "Escape" },
    );

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores focus on cleanup", () => {
    // Create a button that will be focused before the trap mounts
    const outerBtn = document.createElement("button");
    outerBtn.textContent = "Outer";
    document.body.appendChild(outerBtn);
    outerBtn.focus();
    expect(document.activeElement).toBe(outerBtn);

    const { unmount } = render(<TrapContainer />);

    // Focus should have moved into the trap
    const btnFirst = document.querySelector("[data-testid='btn-first']") as HTMLButtonElement;
    expect(document.activeElement).toBe(btnFirst);

    // On unmount, focus should be restored to outerBtn
    unmount();
    expect(document.activeElement).toBe(outerBtn);

    // Cleanup
    document.body.removeChild(outerBtn);
  });

  it("disabled when enabled=false", () => {
    // Create a button focused before trap
    const outerBtn = document.createElement("button");
    outerBtn.textContent = "Outer";
    document.body.appendChild(outerBtn);
    outerBtn.focus();

    render(<TrapContainer enabled={false} />);

    // Focus should NOT have moved into the trap
    expect(document.activeElement).toBe(outerBtn);

    document.body.removeChild(outerBtn);
  });
});
