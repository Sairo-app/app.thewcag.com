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
// once React has committed the UI, so the unpainted native frame never
// flashes. IMPORTANT: this must NOT wait on requestAnimationFrame - a hidden
// WKWebView suspends rendering, so rAF never fires and the window would stay
// invisible forever. An effect + microtask-ish timeout runs regardless of
// visibility; the DOM is fully built by then, so the first shown frame has
// real content. The main window is visible from config and needs no reveal.
function Reveal({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (label === "main") return;
    // Direct call: effects always run after commit, even in a hidden webview
    // (setTimeout can be throttled there too). The DOM exists at this point,
    // so the first visible frame has real content.
    const win = getCurrentWebviewWindow();
    void win.show().then(() => {
      // countdown is a passive HUD - never steal focus for it
      if (label !== "countdown") void win.setFocus();
    });
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
