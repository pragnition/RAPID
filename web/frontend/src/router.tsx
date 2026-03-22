import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { StatePage } from "@/pages/StatePage";
import { WorktreePage } from "@/pages/WorktreePage";
import { CodebasePage } from "@/pages/CodebasePage";
import { KanbanBoard } from "@/pages/KanbanBoard";
import { NotesPage } from "@/pages/NotesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const LazyKnowledgeGraphPage = lazy(() =>
  import("@/pages/KnowledgeGraphPage").then((m) => ({ default: m.KnowledgeGraphPage }))
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "state", element: <StatePage /> },
      { path: "worktrees", element: <WorktreePage /> },
      { path: "graph", element: <Suspense fallback={<div className="p-6 animate-pulse">Loading graph...</div>}><LazyKnowledgeGraphPage /></Suspense> },
      { path: "codebase", element: <CodebasePage /> },
      { path: "kanban", element: <KanbanBoard /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
