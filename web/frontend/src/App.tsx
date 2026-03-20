import { RouterProvider } from "react-router/dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { KeyboardProvider } from "@/context/KeyboardContext";
import { router } from "@/router";

function App() {
  return (
    <ThemeProvider>
      <KeyboardProvider>
        <RouterProvider router={router} />
      </KeyboardProvider>
    </ThemeProvider>
  );
}

export default App;
