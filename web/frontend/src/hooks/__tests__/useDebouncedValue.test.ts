import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update until delay has elapsed", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    // Not yet — only 100ms
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("a");

    // Still not — 200ms
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("a");

    // Now — 300ms
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("b");
  });

  it("resets the timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a");

    // Change again before the timer fires
    rerender({ value: "c" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a"); // still waiting

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("c"); // skipped "b" entirely
  });

  it("uses default delay of 500ms", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe(1);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe(2);
  });
});
