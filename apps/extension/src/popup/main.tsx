import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "../sidepanel/App";
import "../sidepanel/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App surface="popup" />
  </React.StrictMode>,
);
