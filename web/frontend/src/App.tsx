import { RouterProvider } from "react-router/dom";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/hooks/useTheme";
import { KeyboardProvider } from "@/context/KeyboardContext";
import { router } from "@/router";

function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <KeyboardProvider>
          <Toaster position="top-right" richColors />
          <RouterProvider router={router} />
        </KeyboardProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

export default App;
