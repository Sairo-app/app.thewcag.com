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

// Tool windows are created hidden (Rust: .visible(false)) and revealed here
// after the first painted frame, so the unpainted native frame never flashes.
// Two rAFs = React has committed AND the compositor has drawn that commit.
// The main window is visible from config (app launch) and needs no reveal.
function Reveal({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (label === "main") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const win = getCurrentWebviewWindow();
        void win.show().then(() => {
          // countdown is a passive HUD - never steal focus for it
          if (label !== "countdown") void win.setFocus();
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);
  return children;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Reveal>
      <View />
    </Reveal>
  </React.StrictMode>,
);
