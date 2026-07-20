import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { AppView, PlatformInfo } from "../shared/desktop";
import { desktop } from "./api";
import { Workspace } from "./Workspace";
import { OverlayView } from "./OverlayView";
import { LensView } from "./LensView";
import { AnnotateView } from "./AnnotateView";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Renderer failure", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="fatal-screen"><WarningCircle size={34} weight="duotone" /><h1>The workspace could not open</h1><p>{this.state.error.message}</p><button className="button button-primary" onClick={() => location.reload()}>Reload workspace</button></main>;
  }
}

export function App() {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const queryView = (new URLSearchParams(location.search).get("view") || "main") as AppView;
  useEffect(() => { void desktop.invoke<PlatformInfo>("app:platform").then((info) => {
    document.documentElement.dataset.platform = info.platform;
    document.documentElement.dataset.motion = info.reduceMotion ? "reduced" : "full";
    setPlatform(info);
  }); }, []);

  if (!platform) return <div className="boot-screen"><img className="brand-mark" src="/logo.png" alt="" aria-hidden draggable={false} /><span>Opening workspace</span></div>;
  return <ErrorBoundary>{queryView === "overlay" ? <OverlayView /> : queryView === "lens" ? <LensView /> : queryView === "annotate" ? <AnnotateView /> : <Workspace platform={platform} />}</ErrorBoundary>;
}
