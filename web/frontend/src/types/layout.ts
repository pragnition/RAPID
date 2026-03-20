export type SidebarState = "full" | "compact" | "hidden";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  shortcut?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "\u2302", path: "/", shortcut: "gd" },
  { id: "projects", label: "Projects", icon: "\u25A3", path: "/projects", shortcut: "gp" },
  { id: "graph", label: "Graph", icon: "\u25CB", path: "/graph" },
  { id: "notes", label: "Notes", icon: "\u270E", path: "/notes" },
  { id: "settings", label: "Settings", icon: "\u2699", path: "/settings" },
];
