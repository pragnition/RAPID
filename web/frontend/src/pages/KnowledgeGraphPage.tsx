import { useRef, useEffect, useCallback, useState } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeFcose from "cytoscape-fcose";
import { useProjectStore } from "@/stores/projectStore";
import { useDagGraph } from "@/hooks/useViews";
import { useCodeGraph } from "@/hooks/useCodeGraph";
import { GraphTabBar } from "@/components/graph/GraphTabBar";
import type { DagGraph, CodeGraph as CodeGraphData } from "@/types/api";

// Register dagre layout extension once
let dagreRegistered = false;
function ensureDagre() {
  if (!dagreRegistered) {
    cytoscape.use(cytoscapeDagre);
    dagreRegistered = true;
  }
}

// Register fcose layout extension once
let fcoseRegistered = false;
function ensureFcose() {
  if (!fcoseRegistered) {
    cytoscape.use(cytoscapeFcose);
    fcoseRegistered = true;
  }
}

function getNodeColor(status: string): string {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const themeColors: Record<string, string> = {
    pending: style.getPropertyValue('--th-muted').trim() || '#859289',
    discussed: style.getPropertyValue('--th-warning').trim() || '#DBBC7F',
    planned: style.getPropertyValue('--th-info').trim() || '#7FBBB3',
    executing: style.getPropertyValue('--th-orange').trim() || '#E69875',
    executed: style.getPropertyValue('--th-orange').trim() || '#E69875',
    complete: style.getPropertyValue('--th-accent').trim() || '#A7C080',
    merged: style.getPropertyValue('--th-muted').trim() || '#859289',
  };
  return themeColors[status] || style.getPropertyValue('--th-muted').trim() || '#859289';
}

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    typescript: "#3178c6",
    tsx: "#3178c6",
    javascript: "#f7df1e",
    jsx: "#f7df1e",
    python: "#3776ab",
    go: "#00add8",
    rust: "#dea584",
    css: "#264de4",
    scss: "#264de4",
    html: "#e34c26",
    json: "#83a598",
    markdown: "#859289",
  };
  return (
    colors[language.toLowerCase()] ||
    getComputedStyle(document.documentElement)
      .getPropertyValue("--th-muted")
      .trim() ||
    "#859289"
  );
}

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

function extractFilename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function buildCodeGraphElements(
  data: CodeGraphData,
): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  for (const node of data.nodes) {
    elements.push({
      data: {
        id: node.id,
        label: extractFilename(node.path),
        fullPath: node.path,
        language: node.language,
        size: node.size,
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

function GraphControls({
  onFit,
  onReset,
  layoutDir,
  onToggleLayout,
}: {
  onFit: () => void;
  onReset: () => void;
  layoutDir?: "TB" | "LR";
  onToggleLayout?: () => void;
}) {
  return (
    <div className="absolute top-3 right-3 flex gap-1 z-10">
      <button
        type="button"
        onClick={onFit}
        className="bg-surface-1 border border-border rounded px-2 py-1 text-xs text-fg hover:bg-surface-2 transition-colors"
      >
        Fit
      </button>
      {onToggleLayout && layoutDir && (
        <button
          type="button"
          onClick={onToggleLayout}
          className="bg-surface-1 border border-border rounded px-2 py-1 text-xs text-fg hover:bg-surface-2 transition-colors"
        >
          {layoutDir === "TB" ? "Horizontal" : "Vertical"}
        </button>
      )}
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

export function CodeGraphPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const dagQuery = useDagGraph(activeProjectId);
  const codeGraphQuery = useCodeGraph(activeProjectId);

  const [activeTab, setActiveTab] = useState<"code-graph" | "set-dag">(
    "code-graph",
  );

  // DAG refs and state
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [layoutDir, setLayoutDir] = useState<"TB" | "LR">("TB");
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    status: string;
    wave: number;
    deps: string[];
  } | null>(null);

  // Code graph refs
  const codeGraphContainerRef = useRef<HTMLDivElement>(null);
  const codeGraphCyRef = useRef<cytoscape.Core | null>(null);

  // Update DAG graph when data changes
  useEffect(() => {
    if (!containerRef.current || !dagQuery.data) return;

    ensureDagre();

    const elements = buildElements(dagQuery.data);

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
              return getNodeColor(status);
            },
            "border-width": 2,
            "border-color": (ele: cytoscape.NodeSingular) => {
              const status = ele.data("status") as string;
              return darken(getNodeColor(status));
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

    // Node click: select node and connected edges, show details
    cy.on("tap", "node", (evt) => {
      cy.elements().unselect();
      const node = evt.target as cytoscape.NodeSingular;
      node.select();
      node.connectedEdges().select();
      const id = node.data("id") as string;
      const status = node.data("status") as string;
      const wave = (node.data("wave") as number) ?? 0;
      const deps = node.incomers("edge").map((e) => e.data("source") as string);
      setSelectedNode({ id, status, wave, deps });
    });

    // Background click: deselect all
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.elements().unselect();
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [dagQuery.data]);

  // Code graph useEffect
  useEffect(() => {
    if (!codeGraphContainerRef.current || !codeGraphQuery.data) return;

    ensureFcose();

    const elements = buildCodeGraphElements(codeGraphQuery.data);

    if (codeGraphCyRef.current) {
      const cy = codeGraphCyRef.current;
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elements);
      });
      cy.layout({
        name: "fcose",
        animate: false,
        quality: "default",
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 100,
        nodeRepulsion: 4500,
        edgeElasticity: 0.45,
      } as cytoscape.LayoutOptions).run();
      return;
    }

    const cy = cytoscape({
      container: codeGraphContainerRef.current,
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
            width: 120,
            height: 32,
            label: "data(label)",
            "font-size": 11,
            "text-valign": "center",
            "text-halign": "center",
            color: "#ffffff",
            "background-color": (ele: cytoscape.NodeSingular) => {
              return getLanguageColor(ele.data("language") as string);
            },
            "border-width": 2,
            "border-color": (ele: cytoscape.NodeSingular) => {
              return darken(
                getLanguageColor(ele.data("language") as string),
              );
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
            width: 1.5,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#a78bfa",
          } as cytoscape.Css.Node,
        },
      ],
      layout: {
        name: "fcose",
        animate: false,
        quality: "default",
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 100,
        nodeRepulsion: 4500,
        edgeElasticity: 0.45,
      } as cytoscape.LayoutOptions,
    });

    codeGraphCyRef.current = cy;

    return () => {
      cy.destroy();
      codeGraphCyRef.current = null;
    };
  }, [codeGraphQuery.data]);

  // Resize visible graph on tab switch -- critical for display:none toggling
  useEffect(() => {
    requestAnimationFrame(() => {
      if (activeTab === "set-dag" && cyRef.current) {
        cyRef.current.resize();
      } else if (activeTab === "code-graph" && codeGraphCyRef.current) {
        codeGraphCyRef.current.resize();
      }
    });
  }, [activeTab]);

  // DAG controls
  const handleFit = useCallback(() => {
    cyRef.current?.fit();
  }, []);

  const handleReset = useCallback(() => {
    cyRef.current?.reset();
  }, []);

  const toggleLayout = useCallback(() => {
    setLayoutDir((prev) => {
      const next = prev === "TB" ? "LR" : "TB";
      if (cyRef.current) {
        cyRef.current
          .layout({
            name: next === "TB" ? "dagre" : "breadthfirst",
            ...(next === "TB"
              ? { rankDir: "TB", nodeSep: 60, rankSep: 80, padding: 30 }
              : { directed: true, padding: 30, spacingFactor: 1.5 }),
            animate: true,
            animationDuration: 300,
          } as cytoscape.LayoutOptions)
          .run();
      }
      return next;
    });
  }, []);

  // Code graph controls
  const handleCodeGraphFit = useCallback(() => {
    codeGraphCyRef.current?.fit();
  }, []);

  const handleCodeGraphReset = useCallback(() => {
    codeGraphCyRef.current?.reset();
  }, []);

  if (!activeProjectId) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Code Graph</h1>
        <p className="text-muted">Select a project from the sidebar to view the dependency graph</p>
      </div>
    );
  }

  // Derive stats for tab bar
  const dagStats = dagQuery.data
    ? { nodes: dagQuery.data.nodes.length, edges: dagQuery.data.edges.length }
    : null;
  const codeGraphStats = codeGraphQuery.data
    ? {
        nodes: codeGraphQuery.data.nodes.length,
        edges: codeGraphQuery.data.edges.length,
      }
    : null;

  // Dynamic subtitle based on active tab
  const statsText =
    activeTab === "code-graph" && codeGraphQuery.data
      ? `${codeGraphQuery.data.nodes.length} file${codeGraphQuery.data.nodes.length !== 1 ? "s" : ""}, ${codeGraphQuery.data.edges.length} edge${codeGraphQuery.data.edges.length !== 1 ? "s" : ""}`
      : activeTab === "set-dag" && dagQuery.data
        ? `${dagQuery.data.nodes.length} node${dagQuery.data.nodes.length !== 1 ? "s" : ""}, ${dagQuery.data.edges.length} edge${dagQuery.data.edges.length !== 1 ? "s" : ""}`
        : null;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Code Graph</h1>
      {statsText && <p className="text-muted mb-4">{statsText}</p>}

      <GraphTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        codeGraphStats={codeGraphStats}
        dagStats={dagStats}
      />

      {/* Code Graph tab */}
      <div style={{ display: activeTab === "code-graph" ? "block" : "none" }}>
        {codeGraphQuery.isLoading && (
          <div className="h-[calc(100vh-16rem)] bg-surface-0 border border-border rounded-lg animate-pulse" />
        )}
        {codeGraphQuery.isError && (
          <p className="text-red-400">
            Failed to load code graph data. Check that the backend is running
            and try again.
          </p>
        )}
        {!codeGraphQuery.isLoading &&
          !codeGraphQuery.isError &&
          !codeGraphQuery.data && (
            <p className="text-muted">
              No code graph data available for this project
            </p>
          )}
        {codeGraphQuery.data && (
          <div className="relative">
            {codeGraphQuery.data.truncated && (
              <div className="mb-2 px-3 py-2 text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-700/50 rounded">
                Graph is truncated -- showing a subset of files. Increase
                max_files for a complete view.
              </div>
            )}
            <GraphControls
              onFit={handleCodeGraphFit}
              onReset={handleCodeGraphReset}
            />
            <div
              ref={codeGraphContainerRef}
              className="h-[calc(100vh-16rem)] border border-border rounded-lg bg-surface-0"
            />
          </div>
        )}
      </div>

      {/* Set DAG tab */}
      <div style={{ display: activeTab === "set-dag" ? "block" : "none" }}>
        {dagQuery.isLoading && (
          <div className="h-[calc(100vh-16rem)] bg-surface-0 border border-border rounded-lg animate-pulse" />
        )}
        {dagQuery.isError && (() => {
          const is404 =
            dagQuery.error &&
            "status" in dagQuery.error &&
            dagQuery.error.status === 404;
          return is404 ? (
            <p className="text-muted">No DAG.json found for this project</p>
          ) : (
            <p className="text-red-400">
              Failed to load DAG data. Check that the backend is running and
              try again.
            </p>
          );
        })()}
        {!dagQuery.isLoading && !dagQuery.isError && !dagQuery.data && (
          <p className="text-muted">No DAG.json found for this project</p>
        )}
        {dagQuery.data && (
          <div className="relative">
            <GraphControls
              onFit={handleFit}
              onReset={handleReset}
              layoutDir={layoutDir}
              onToggleLayout={toggleLayout}
            />
            <div
              ref={containerRef}
              className="h-[calc(100vh-16rem)] border border-border rounded-lg bg-surface-0"
            />
            {selectedNode && (
              <div className="absolute bottom-3 left-3 z-10 bg-surface-1 border border-border rounded-lg p-4 min-w-[200px] shadow-lg">
                <h3 className="text-sm font-bold text-fg mb-2">
                  {selectedNode.id}
                </h3>
                <dl className="text-xs text-muted space-y-1">
                  <div>
                    <dt className="inline font-medium">Status:</dt>{" "}
                    <dd className="inline">{selectedNode.status}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Wave:</dt>{" "}
                    <dd className="inline">{selectedNode.wave}</dd>
                  </div>
                  {selectedNode.deps.length > 0 && (
                    <div>
                      <dt className="inline font-medium">Depends on:</dt>{" "}
                      <dd className="inline">
                        {selectedNode.deps.join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
