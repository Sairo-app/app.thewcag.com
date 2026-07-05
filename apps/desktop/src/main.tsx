import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import MainWindow from "./windows/MainWindow";
import OverlayWindow from "./windows/OverlayWindow";
import AnnotateWindow from "./windows/AnnotateWindow";
import LensWindow from "./windows/LensWindow";
import "./styles.css";

// One bundle, four windows: route by the Tauri window label.
const views: Record<string, React.ComponentType> = {
  main: MainWindow,
  overlay: OverlayWindow,
  annotate: AnnotateWindow,
  lens: LensWindow,
};

const label = getCurrentWebviewWindow().label;
const View = views[label] ?? MainWindow;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <View />
  </React.StrictMode>,
);
