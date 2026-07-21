import { useState } from "react";
import {
  Aperture,
  ArrowSquareOut,
  Eye,
  EyeSlash,
  LockKey,
  Monitor,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { desktop } from "../api";
import { Button, StatusBadge, Toast } from "../components";
import { messageFromError, useTransientMessage } from "../hooks";

const MODES = ["Original", "Protanopia", "Deuteranopia", "Tritanopia"];

export function VisionView() {
  const [open, setOpen] = useState(false);
  const [message, show] = useTransientMessage();

  async function toggle() {
    try {
      const next = await desktop.invoke<boolean>("lens:toggle");
      setOpen(next);
      show(next ? "Vision lens opened" : "Vision lens closed");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  return (
    <div className="vision-view">
      <Toast message={message} />
      <section className="vision-workbench">
        <div className="lens-schematic" aria-hidden="true">
          <div className="schematic-bar">
            <span>
              <Aperture size={17} weight="duotone" /> Vision lens
            </span>
            <span>100%</span>
          </div>
          <div className="schematic-preview">
            <div>
              <span>Original</span>
              <strong>Clear signals.</strong>
            </div>
            <div>
              <span>Simulated</span>
              <strong>Clear signals.</strong>
            </div>
          </div>
          <div className="schematic-controls">
            {MODES.slice(1).map((mode, index) => (
              <span key={mode} data-active={index === 1}>
                {mode.replace("opia", "")}
              </span>
            ))}
          </div>
        </div>
        <div className="vision-copy">
          <StatusBadge tone={open ? "success" : "neutral"}>
            {open ? "Lens active" : "Lens closed"}
          </StatusBadge>
          <h2>See the interface through another visual system.</h2>
          <p>
            Keep a protected, always-on-top lens above browsers, design tools,
            documents, and native apps while you evaluate color and clarity.
          </p>
          <Button
            variant="primary"
            icon={open ? EyeSlash : Eye}
            onClick={() => void toggle()}
          >
            {open ? "Close vision lens" : "Open vision lens"}
          </Button>
        </div>
      </section>

      <section
        className="capability-list"
        aria-label="Vision lens capabilities"
      >
        <div>
          <Monitor size={21} weight="duotone" />
          <span>
            <strong>Across applications</strong>
            <small>
              Inspect any visible interface without importing files.
            </small>
          </span>
          <b>System wide</b>
        </div>
        <div>
          <SlidersHorizontal size={21} weight="duotone" />
          <span>
            <strong>Adjustable simulation</strong>
            <small>
              Choose deficiency type, severity, zoom, split view, blur, and low
              contrast.
            </small>
          </span>
          <b>Live controls</b>
        </div>
        <div>
          <LockKey size={21} weight="duotone" />
          <span>
            <strong>Protected evidence</strong>
            <small>
              The lens stays out of captures when the operating system supports
              exclusion.
            </small>
          </span>
          <b>Capture safe</b>
        </div>
      </section>

      <section className="vision-note">
        <ArrowSquareOut size={20} />
        <div>
          <strong>Move the lens over the interface you are testing</strong>
          <p>
            Use its compact controls while you work. Close it with Escape or
            your global lens shortcut.
          </p>
        </div>
      </section>
    </div>
  );
}
