import { useRef, useState, useEffect, useCallback } from "react";
import type cytoscape from "cytoscape";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphSearchFilterProps {
  cyRef: React.RefObject<cytoscape.Core | null>;
  enabled: boolean; // false when tab is not active
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphSearchFilter({ cyRef, enabled }: GraphSearchFilterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restoreAll = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().style("opacity", 1);
      cy.edges().style("opacity", 1);
    });
    cy.fit(undefined, 50);
  }, [cyRef]);

  const applySearch = useCallback(
    (term: string) => {
      const cy = cyRef.current;
      if (!cy) return;

      if (!term) {
        restoreAll();
        return;
      }

      const lower = term.toLowerCase();
      const matchingNodes = cy.nodes().filter((n) => {
        const label = (n.data("label") as string) || "";
        const fullPath = (n.data("fullPath") as string) || "";
        return (
          label.toLowerCase().includes(lower) ||
          fullPath.toLowerCase().includes(lower)
        );
      });

      const matchingNodeIds = new Set(matchingNodes.map((n) => n.id()));

      cy.batch(() => {
        cy.nodes().forEach((n) => {
          n.style("opacity", matchingNodeIds.has(n.id()) ? 1 : 0.15);
        });

        cy.edges().forEach((e) => {
          const srcMatch = matchingNodeIds.has(e.data("source") as string);
          const tgtMatch = matchingNodeIds.has(e.data("target") as string);
          e.style("opacity", srcMatch || tgtMatch ? 1 : 0.1);
        });
      });

      if (matchingNodes.length > 0) {
        cy.fit(matchingNodes, 50);
      }
    },
    [cyRef, restoreAll],
  );

  // Debounced search
  const handleChange = useCallback(
    (value: string) => {
      setSearchTerm(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        applySearch(value);
      }, 200);
    },
    [applySearch],
  );

  // Clear search
  const handleClear = useCallback(() => {
    setSearchTerm("");
    restoreAll();
    inputRef.current?.blur();
  }, [restoreAll]);

  // Escape to clear and blur
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear],
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Reset when disabled (tab switch)
  useEffect(() => {
    if (!enabled && searchTerm) {
      setSearchTerm("");
      restoreAll();
    }
  }, [enabled, searchTerm, restoreAll]);

  if (!enabled) return null;

  return (
    <div className="absolute top-3 left-3 z-10" role="search" aria-label="Search graph nodes">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files..."
          className="w-64 bg-surface-1 border border-border rounded px-3 py-1.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition-colors"
            aria-label="Clear search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
