import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import "./i18n/config";
import { bootstrapNativeAuth } from "./lib/nativeAuthPersistence";

// Restore native-persisted auth session before React mounts, so iOS users
// stay logged in across app launches and go straight to the dashboard.
bootstrapNativeAuth().finally(() => {
  const root = document.getElementById("root");
  if (!root) return;
  createRoot(root).render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
});
