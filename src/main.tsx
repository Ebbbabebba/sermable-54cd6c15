import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { bootstrapNativeAuth } from "./lib/nativeAuthPersistence";

// Restore native-persisted auth session before React mounts, so iOS users
// stay logged in across app launches and go straight to the dashboard.
bootstrapNativeAuth().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
});
