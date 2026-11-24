import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration skipped:", err.message);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
