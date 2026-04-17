import { useState, useMemo, useCallback } from "react";
import { Outlet, useNavigate } from "react-router";
import { useRegisterBindings } from "@/context/KeyboardContext";
import { useLayoutStore } from "@/hooks/useLayoutStore";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { TooltipOverlay } from "@/components/ui/TooltipOverlay";
import type { KeyBinding } from "@/types/keyboard";

export function AppLayout() {
  const navigate = useNavigate();
  const sidebarState = useLayoutStore((s) => s.sidebarState);
  const cycleSidebarForward = useLayoutStore((s) => s.cycleSidebarForward);
  const cycleSidebarBack = useLayoutStore((s) => s.cycleSidebarBack);
  const closeMobileDrawer = useLayoutStore((s) => s.closeMobileDrawer);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const closeAllOverlays = useCallback(() => {
    setShowCommandPalette(false);
    setShowShortcuts(false);
    closeMobileDrawer();
  }, [closeMobileDrawer]);

  const toggleShortcuts = useCallback(() => {
    setShowShortcuts((prev) => !prev);
  }, []);

  const openPalette = useCallback(() => setShowCommandPalette(true), []);

  const bindings = useMemo<KeyBinding[]>(
    () => [
      // Sidebar
      {
        key: "l",
        description: "Expand sidebar",
        category: "sidebar",
        action: cycleSidebarForward,
      },
      {
        key: "h",
        description: "Collapse sidebar",
        category: "sidebar",
        action: cycleSidebarBack,
      },
      // Global
      {
        key: "/",
        description: "Open command palette",
        category: "global",
        action: openPalette,
      },
      {
        key: "k",
        ctrl: true,
        description: "Open command palette (Ctrl+K)",
        category: "global",
        action: openPalette,
      },
      {
        key: "k",
        meta: true,
        description: "Open command palette (⌘K)",
        category: "global",
        action: openPalette,
      },
      {
        key: "?",
        shift: true,
        description: "Toggle shortcut overlay",
        category: "global",
        action: toggleShortcuts,
      },
      {
        key: "Escape",
        description: "Close overlay / blur input",
        category: "global",
        action: closeAllOverlays,
      },
      // Navigation chords
      {
        key: "gg",
        description: "Scroll to top",
        category: "navigation",
        action: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      },
      {
        key: "gd",
        description: "Go to Dashboard",
        category: "navigation",
        action: () => navigate("/"),
      },
      {
        key: "gp",
        description: "Go to Projects",
        category: "navigation",
        action: () => navigate("/projects"),
      },
      {
        key: "gh",
        description: "Go to Knowledge Graph",
        category: "navigation",
        action: () => navigate("/graph"),
      },
      {
        key: "gk",
        description: "Go to Kanban",
        category: "navigation",
        action: () => navigate("/kanban"),
      },
      {
        key: "gw",
        description: "Go to Worktrees",
        category: "navigation",
        action: () => navigate("/worktrees"),
      },
      {
        key: "gs",
        description: "Go to State",
        category: "navigation",
        action: () => navigate("/state"),
      },
      {
        key: "ga",
        description: "Go to Agents",
        category: "navigation",
        action: () => navigate("/agents"),
      },
      {
        key: "gc",
        description: "Go to Chats",
        category: "navigation",
        action: () => navigate("/chats"),
      },
    ],
    [cycleSidebarForward, cycleSidebarBack, closeAllOverlays, toggleShortcuts, navigate, openPalette],
  );

  useRegisterBindings(bindings);

  // Content area margin based on sidebar state
  const marginClass =
    sidebarState === "full"
      ? "md:ml-[232px]"
      : sidebarState === "compact"
        ? "md:ml-16"
        : "md:ml-0";

  return (
    <div className="min-h-screen bg-bg-0">
      <Sidebar />
      <Header onToggleShortcuts={toggleShortcuts} onOpenPalette={openPalette} />

      {/* Main content area */}
      <main
        className={`
          pt-14 transition-all duration-200
          ${marginClass}
        `}
      >
        <Outlet />
      </main>

      {/* Overlays */}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
      {showShortcuts && (
        <TooltipOverlay onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
