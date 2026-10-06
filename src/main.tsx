import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support; new versions activate on the next load.
if (import.meta.env.PROD && "serviceWorker" in navigator) registerSW({ immediate: true });
