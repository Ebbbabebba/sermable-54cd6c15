import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
