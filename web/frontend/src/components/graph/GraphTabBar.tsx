interface GraphTabBarProps {
  activeTab: "code-graph" | "set-dag";
  onTabChange: (tab: "code-graph" | "set-dag") => void;
  codeGraphStats?: { nodes: number; edges: number } | null;
  dagStats?: { nodes: number; edges: number } | null;
}

export function GraphTabBar({
  activeTab,
  onTabChange,
  codeGraphStats,
  dagStats,
}: GraphTabBarProps) {
  const tabs: {
    id: "code-graph" | "set-dag";
    label: string;
    statLabel: string | null;
  }[] = [
    {
      id: "code-graph",
      label: "Code Graph",
      statLabel: codeGraphStats
        ? `${codeGraphStats.nodes} file${codeGraphStats.nodes !== 1 ? "s" : ""}`
        : null,
    },
    {
      id: "set-dag",
      label: "Set DAG",
      statLabel: dagStats
        ? `${dagStats.nodes} set${dagStats.nodes !== 1 ? "s" : ""}`
        : null,
    },
  ];

  return (
    <div
      role="tablist"
      className="flex border-b border-border mb-4"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
            activeTab === tab.id
              ? "border-b-2 border-accent text-fg"
              : "text-muted hover:text-fg"
          }`}
        >
          {tab.label}
          {tab.statLabel && (
            <span className="ml-1 text-xs text-muted">({tab.statLabel})</span>
          )}
        </button>
      ))}
    </div>
  );
}
