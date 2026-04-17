export type SidebarState = "full" | "compact" | "hidden";

export type NavGroupId = "workspace" | "execution" | "library";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  shortcut?: string;
}

export interface NavGroupDef {
  id: NavGroupId;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "\u2302", path: "/", shortcut: "gd" },
      { id: "projects", label: "Projects", icon: "\u25A3", path: "/projects", shortcut: "gp" },
      { id: "codebase", label: "Codebase", icon: "\u2630", path: "/codebase" },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    items: [
      { id: "graph", label: "Knowledge Graph", icon: "\u25CB", path: "/graph", shortcut: "gh" },
      { id: "kanban", label: "Kanban", icon: "\u25A6", path: "/kanban", shortcut: "gk" },
      { id: "worktrees", label: "Worktrees", icon: "\u2442", path: "/worktrees", shortcut: "gw" },
      { id: "state", label: "State", icon: "\u25C9", path: "/state", shortcut: "gs" },
      { id: "agents", label: "Agents", icon: "\u2726", path: "/agents", shortcut: "ga" },
      { id: "chats", label: "Chats", icon: "\u2630", path: "/chats", shortcut: "gc" },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { id: "notes", label: "Notes", icon: "\u270E", path: "/notes" },
      { id: "settings", label: "Settings", icon: "\u2699", path: "/settings" },
    ],
  },
];

// Back-compat flat list for CommandPalette registry iteration.
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
