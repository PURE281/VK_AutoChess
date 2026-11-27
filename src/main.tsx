import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { assetUrl } from "./config";
import "./styles.css";

document.documentElement.style.setProperty("--arena-bg", `url("${assetUrl("assets/scenes/arena-bg.png")}")`);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
