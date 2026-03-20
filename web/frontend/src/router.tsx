import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { GraphPage } from "@/pages/GraphPage";
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
      { path: "graph", element: <GraphPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
