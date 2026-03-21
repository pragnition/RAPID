import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { StatePage } from "@/pages/StatePage";
import { WorktreePage } from "@/pages/WorktreePage";
import { KnowledgeGraphPage } from "@/pages/KnowledgeGraphPage";
import { CodebasePage } from "@/pages/CodebasePage";
import { KanbanBoard } from "@/pages/KanbanBoard";
import { NotesPage } from "@/pages/NotesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "state", element: <StatePage /> },
      { path: "worktrees", element: <WorktreePage /> },
      { path: "graph", element: <KnowledgeGraphPage /> },
      { path: "codebase", element: <CodebasePage /> },
      { path: "kanban", element: <KanbanBoard /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
