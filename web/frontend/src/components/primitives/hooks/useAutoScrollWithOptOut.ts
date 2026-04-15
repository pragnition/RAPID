import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface UseAutoScrollWithOptOutArgs {
  /** Ref to the scrollable container. */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Dependency list (typically a message array or its length) whose changes
   * signal "new content was appended". When `pinned` is true, the container
   * scrolls to bottom; when false, `newCount` increments.
   */
  deps: ReadonlyArray<unknown>;
  /**
   * Pixel tolerance for "at bottom" detection. Defaults to 24px so typical
   * sub-pixel rounding and small overshoots still read as pinned.
   */
  bottomThresholdPx?: number;
}

export interface UseAutoScrollWithOptOutReturn {
  /** True when the user is at (or within threshold of) the bottom. */
  pinned: boolean;
  /** Count of new-content events observed while not pinned. */
  newCount: number;
  /** Imperatively scroll to bottom and reset `newCount`. */
  scrollToBottom: () => void;
}

/**
 * Auto-scroll behavior with manual opt-out for chat-like surfaces.
 *
 * Tracks user scroll position against the container's bottom edge.
 * When the user scrolls up, `pinned` flips to false and subsequent `deps`
 * changes increment `newCount` instead of auto-scrolling. Calling
 * `scrollToBottom` (or scrolling back to the bottom) re-pins and resets
 * the counter.
 *
 * Presentational — safe for primitive use (no store access).
 */
export function useAutoScrollWithOptOut({
  containerRef,
  deps,
  bottomThresholdPx = 24,
}: UseAutoScrollWithOptOutArgs): UseAutoScrollWithOptOutReturn {
  const [pinned, setPinned] = useState<boolean>(true);
  const [newCount, setNewCount] = useState<number>(0);
  // Keep latest pinned value readable inside the deps-effect without
  // invalidating its dependency list.
  const pinnedRef = useRef<boolean>(true);
  pinnedRef.current = pinned;

  const isAtBottom = useCallback((): boolean => {
    const el = containerRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= bottomThresholdPx;
  }, [containerRef, bottomThresholdPx]);

  const scrollToBottom = useCallback((): void => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setPinned(true);
    setNewCount(0);
  }, [containerRef]);

  // Track scroll position.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (): void => {
      const atBottom = isAtBottom();
      setPinned((prev) => (prev === atBottom ? prev : atBottom));
      if (atBottom) {
        setNewCount((prev) => (prev === 0 ? prev : 0));
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [containerRef, isAtBottom]);

  // React to content changes.
  useEffect(() => {
    if (pinnedRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else {
      setNewCount((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { pinned, newCount, scrollToBottom };
}
