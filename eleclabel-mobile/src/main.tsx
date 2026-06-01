// Point d'entrée mobile — initialise les plugins natifs Capacitor avant de monter React
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { initNative } from "./services/native";
import "./index.css";

// Initialise barre de statut, clavier, deep links — non-bloquant
initNative().catch((err) => console.warn("Native init failed:", err));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* HashRouter (et non BrowserRouter) car Capacitor charge depuis file:// */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
