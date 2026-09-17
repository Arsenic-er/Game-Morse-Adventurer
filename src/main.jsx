import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "./pixel-theme.css";
import "./chapter-one-review.css";
import "./visual-novel.css";
import "./review-incoming-caption.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
