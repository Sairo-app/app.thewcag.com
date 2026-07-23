import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { WarningCircle } from "./Icon";
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
    return <StartupFailure message={this.state.error.message} />;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "The desktop service did not respond.";
}

function StartupFailure({ message }: { message: string }) {
  return <main className="fatal-screen"><WarningCircle size={32} /><h1>The workspace could not open</h1><p>{message}</p><button className="button button-primary" onClick={() => location.reload()}>Reload workspace</button></main>;
}

export function App() {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const queryView = (new URLSearchParams(location.search).get("view") || "main") as AppView;
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = "TheWCAG workstation";
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setStartupError("The desktop service did not finish starting. Reload the workspace or restart TheWCAG.");
    }, 15_000);
    void desktop.invoke<PlatformInfo>("app:platform").then((info) => {
      if (!active) return;
      window.clearTimeout(timeout);
      document.documentElement.dataset.platform = info.platform;
      document.documentElement.dataset.motion = info.reduceMotion ? "reduced" : "full";
      setPlatform(info);
    }).catch((error: unknown) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setStartupError(errorMessage(error));
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  if (startupError) return <StartupFailure message={startupError} />;
  if (!platform) return <div className="boot-screen" role="status" aria-live="polite" aria-busy="true"><img className="brand-mark" src="./logo.png" alt="" aria-hidden draggable={false} /><span>Opening workspace</span></div>;
  return <ErrorBoundary>{queryView === "overlay" ? <OverlayView /> : queryView === "lens" ? <LensView /> : queryView === "annotate" ? <AnnotateView /> : <Workspace platform={platform} />}</ErrorBoundary>;
}
