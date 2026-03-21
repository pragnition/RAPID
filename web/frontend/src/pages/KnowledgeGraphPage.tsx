import { useRef, useEffect, useCallback } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import { useProjectStore } from "@/stores/projectStore";
import { useDagGraph } from "@/hooks/useViews";
import type { DagGraph } from "@/types/api";

// Register dagre layout extension once
let dagreRegistered = false;
function ensureDagre() {
  if (!dagreRegistered) {
    cytoscape.use(cytoscapeDagre);
    dagreRegistered = true;
  }
}

const NODE_COLORS: Record<string, string> = {
  pending: "#6b7280",
  discussed: "#eab308",
  planned: "#3b82f6",
  executing: "#f97316",
  complete: "#22c55e",
  merged: "#4b5563",
};

function darken(hex: string): string {
  // Darken by roughly 20% for border
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - 40);
  const g = Math.max(0, ((num >> 8) & 0xff) - 40);
  const b = Math.max(0, (num & 0xff) - 40);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function buildElements(data: DagGraph): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  for (const node of data.nodes) {
    elements.push({
      data: {
        id: node.id,
        status: node.status,
        wave: node.wave,
      },
    });
  }

  for (const edge of data.edges) {
    elements.push({
      data: {
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
      },
    });
  }

  return elements;
}

function GraphControls({ onFit, onReset }: { onFit: () => void; onReset: () => void }) {
  return (
    <div className="absolute top-3 right-3 flex gap-1 z-10">
      <button
        type="button"
        onClick={onFit}
        className="bg-surface-1 border border-border rounded px-2 py-1 text-xs text-fg hover:bg-surface-2 transition-colors"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onReset}
        className="bg-surface-1 border border-border rounded px-2 py-1 text-xs text-fg hover:bg-surface-2 transition-colors"
      >
        Reset
      </button>
    </div>
  );
}

export function KnowledgeGraphPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error } = useDagGraph(activeProjectId);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Update graph when data changes
  useEffect(() => {
    if (!containerRef.current || !data) return;

    ensureDagre();

    const elements = buildElements(data);

    if (cyRef.current) {
      // Update elements in place to preserve zoom/pan state
      const cy = cyRef.current;
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elements);
      });
      cy.layout({
        name: "dagre",
        rankDir: "TB",
        nodeSep: 60,
        rankSep: 80,
        padding: 30,
        animate: false,
      } as cytoscape.LayoutOptions).run();
      return;
    }

    // Create new cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.3,
      maxZoom: 3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
      style: [
        {
          selector: "node",
          style: {
            shape: "roundrectangle",
            width: 140,
            height: 40,
            label: "data(id)",
            "font-size": 12,
            "text-valign": "center",
            "text-halign": "center",
            color: "#ffffff",
            "background-color": (ele: cytoscape.NodeSingular) => {
              const status = ele.data("status") as string;
              return NODE_COLORS[status] ?? NODE_COLORS.pending;
            },
            "border-width": 2,
            "border-color": (ele: cytoscape.NodeSingular) => {
              const status = ele.data("status") as string;
              return darken(NODE_COLORS[status] ?? NODE_COLORS.pending);
            },
          } as cytoscape.Css.Node,
        },
        {
          selector: "edge",
          style: {
            "line-color": "#4b5563",
            "target-arrow-color": "#4b5563",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            width: 2,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#a78bfa",
          } as cytoscape.Css.Node,
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#a78bfa",
            "target-arrow-color": "#a78bfa",
            width: 3,
          },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "TB",
        nodeSep: 60,
        rankSep: 80,
        padding: 30,
      } as cytoscape.LayoutOptions,
    });

    // Node click: select node and connected edges
    cy.on("tap", "node", (evt) => {
      cy.elements().unselect();
      const node = evt.target as cytoscape.NodeSingular;
      node.select();
      node.connectedEdges().select();
    });

    // Background click: deselect all
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.elements().unselect();
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data]);

  const handleFit = useCallback(() => {
    cyRef.current?.fit();
  }, []);

  const handleReset = useCallback(() => {
    cyRef.current?.reset();
  }, []);

  if (!activeProjectId) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Knowledge Graph</h1>
        <p className="text-muted">Select a project from the sidebar to view the dependency graph</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Knowledge Graph</h1>
        <div className="h-[calc(100vh-8rem)] bg-surface-0 border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  if (isError) {
    const is404 = error && "status" in error && error.status === 404;
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Knowledge Graph</h1>
        {is404 ? (
          <p className="text-muted">No DAG.json found for this project</p>
        ) : (
          <p className="text-red-400">
            Failed to load DAG data. Check that the backend is running and try again.
          </p>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Knowledge Graph</h1>
        <p className="text-muted">No DAG.json found for this project</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Knowledge Graph</h1>
      <p className="text-muted mb-4">
        {data.nodes.length} node{data.nodes.length !== 1 ? "s" : ""},{" "}
        {data.edges.length} edge{data.edges.length !== 1 ? "s" : ""}
      </p>
      <div className="relative">
        <GraphControls onFit={handleFit} onReset={handleReset} />
        <div
          ref={containerRef}
          className="h-[calc(100vh-12rem)] border border-border rounded-lg bg-surface-0"
        />
      </div>
    </div>
  );
}
