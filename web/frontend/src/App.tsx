import { RouterProvider } from "react-router/dom";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/hooks/useTheme";
import { KeyboardProvider } from "@/context/KeyboardContext";
import { router } from "@/router";

function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <KeyboardProvider>
          <RouterProvider router={router} />
        </KeyboardProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

export default App;
