import React from "react";
import ReactDOM from "react-dom/client";

import AuthGate from "./components/Auth/AuthGate";

import "./App.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("FlowMind: root element not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);
