import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import MainWindow from "./windows/MainWindow";
import OverlayWindow from "./windows/OverlayWindow";
import AnnotateWindow from "./windows/AnnotateWindow";
import LensWindow from "./windows/LensWindow";
import CountdownWindow from "./windows/CountdownWindow";
import FindingsWindow from "./windows/FindingsWindow";
import ChecklistWindow from "./windows/ChecklistWindow";
import PaletteWindow from "./windows/PaletteWindow";
import "./styles.css";

// One bundle, many windows: route by the Tauri window label.
// Overlays are per-monitor: overlay-0, overlay-1, …
const label = getCurrentWebviewWindow().label;
const views: Record<string, React.ComponentType> = {
  main: MainWindow,
  annotate: AnnotateWindow,
  lens: LensWindow,
  countdown: CountdownWindow,
  findings: FindingsWindow,
  checklist: ChecklistWindow,
  palette: PaletteWindow,
};
const View = label.startsWith("overlay-") ? OverlayWindow : (views[label] ?? MainWindow);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <View />
  </React.StrictMode>,
);
