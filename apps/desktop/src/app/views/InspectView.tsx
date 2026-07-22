import { useEffect, useMemo, useState } from "react";
import {
  apcaLc,
  apcaRating,
  hexToRgb,
  rgbToHex,
  suggestAccessible,
  wcagVerdict,
} from "@accessibility-build/a11y-core";
import {
  ArrowRight,
  ArrowsLeftRight,
  Camera,
  Check,
  Copy,
  Crosshair,
  FloppyDisk,
  Lightbulb,
  Plus,
  Warning,
} from "@phosphor-icons/react";
import type { OverlayResult, WorkspaceStage } from "../../shared/desktop";
import { desktop } from "../api";
import type { AuditSessionSelection } from "../audit-coverage";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, Segmented, StatusBadge, Toast } from "../components";
import { GuidedAuditSession } from "../GuidedAuditSession";
import {
  messageFromError,
  useStoredState,
  useTransientMessage,
} from "../hooks";

type TextMode = "normal" | "large" | "ui";
interface Pair {
  fg: string;
  bg: string;
  ratio: number;
  createdAt: number;
}
const MODES: Record<TextMode, { label: string; target: number; sc: string }> = {
  normal: { label: "Normal text", target: 4.5, sc: "1.4.3" },
  large: { label: "Large text", target: 3, sc: "1.4.3" },
  ui: { label: "UI component", target: 3, sc: "1.4.11" },
};

function cleanHex(input: string, fallback: string) {
  const value = input.trim();
  return hexToRgb(value) ? rgbToHex(hexToRgb(value)!) : fallback;
}

export function InspectView({
  auditId,
  initialSession,
  onNavigate,
  recordActivity,
}: {
  auditId: string;
  initialSession: AuditSessionSelection | null;
  onNavigate: (stage: WorkspaceStage) => void;
  recordActivity: RecordAuditActivity;
}) {
  const [fg, setFg] = useState("#1F2933");
  const [bg, setBg] = useState("#FFF9ED");
  const [mode, setMode] = useState<TextMode>("normal");
  const [history, setHistory] = useStoredState<Pair[]>(
    auditStoreKey(auditId, "history"),
    [],
  );
  const [pending, setPending] = useState(false);
  const [message, show] = useTransientMessage();
  const fgRgb = hexToRgb(fg) ?? { r: 31, g: 41, b: 51 };
  const bgRgb = hexToRgb(bg) ?? { r: 255, g: 249, b: 237 };
  const verdict = wcagVerdict(fgRgb, bgRgb);
  const target = MODES[mode].target;
  const passes = verdict.ratio >= target;
  const lc = apcaLc(fgRgb, bgRgb);
  const suggestions = suggestAccessible(fgRgb, bgRgb, target).slice(0, 2);

  useEffect(
    () =>
      desktop.on<OverlayResult>("capture:result", (result) => {
        setPending(false);
        if (result.mode === "pair") {
          setFg(result.colors[0].hex);
          setBg(result.colors[1].hex);
          show("Color pair sampled");
        }
        if (result.mode === "foreground") setFg(result.colors[0].hex);
        if (result.mode === "background") setBg(result.colors[0].hex);
      }),
    [],
  );

  async function begin(modeName: "pair" | "foreground" | "background") {
    setPending(true);
    try {
      await desktop.invoke("capture:begin", { mode: modeName, auditId });
    } catch (error) {
      setPending(false);
      show(messageFromError(error), true);
    }
  }

  function addToRecent() {
    setHistory((items) =>
      [
        { fg, bg, ratio: verdict.ratio, createdAt: Date.now() },
        ...items.filter((item) => item.fg !== fg || item.bg !== bg),
      ].slice(0, 12),
    );
    show("Pair added to recent checks");
  }

  async function saveFinding() {
    if (passes) {
      show("This pair passes the selected requirement, so no open finding was created.");
      return;
    }
    try {
      await desktop.invoke("store:add-findings", {
        auditId,
        items: [
          {
            key: crypto.randomUUID(),
            title: `Contrast ${verdict.ratio.toFixed(2)}:1`,
            wcag: MODES[mode].sc,
            severity: verdict.ratio < 3 ? "major" : "minor",
            status: "open",
            note: `${fg} on ${bg} fails ${MODES[mode].label.toLowerCase()} at ${target}:1.`,
            createdAt: Date.now(),
          },
        ],
      });
      await recordActivity({
        kind: "finding",
        title: "Contrast finding saved",
        detail: `${verdict.ratio.toFixed(2)}:1, ${MODES[mode].sc}`,
      });
      show("Finding saved to evidence");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  const checks = useMemo(
    () => [
      {
        label: "Normal text",
        sc: "1.4.3",
        pass: verdict.normalAA,
        target: "4.5:1",
      },
      {
        label: "Large text",
        sc: "1.4.3",
        pass: verdict.largeAA,
        target: "3:1",
      },
      {
        label: "UI components",
        sc: "1.4.11",
        pass: verdict.uiAA,
        target: "3:1",
      },
    ],
    [verdict],
  );

  return (
    <div className="inspect-layout">
      <Toast message={message} />
      <GuidedAuditSession
        auditId={auditId}
        initialSession={initialSession}
        onNavigate={onNavigate}
        recordActivity={recordActivity}
      />
      <section
        className="contrast-stage"
        style={{ backgroundColor: bg, color: fg }}
        aria-label="Contrast preview"
      >
        <div className="contrast-stage-meta">
          <span>Live specimen</span>
          <span>
            {fg} on {bg}
          </span>
        </div>
        <div className="specimen-copy">
          <span>A considered interface is</span>
          <strong>clear at a glance.</strong>
          <p>
            People should be able to perceive, understand, and operate every
            essential action.
          </p>
          <button style={{ backgroundColor: fg, color: bg }}>
            Primary action <ArrowRight size={16} />
          </button>
        </div>
        <div className="ratio-badge">
          <span>WCAG contrast</span>
          <strong>
            {verdict.ratio.toFixed(2)}
            <small>:1</small>
          </strong>
        </div>
      </section>

      <section className="inspection-controls">
        <div className="color-editor">
          <div className="color-row">
            <button
              className="swatch"
              style={{ backgroundColor: fg }}
              onClick={() => void begin("foreground")}
              aria-label="Sample foreground"
            >
              <Crosshair size={17} />
            </button>
            <label>
              <span>Foreground</span>
              <input
                value={fg}
                onChange={(event) => setFg(event.target.value.toUpperCase())}
                onBlur={() => setFg(cleanHex(fg, "#1F2933"))}
                spellCheck={false}
              />
            </label>
            <button
              className="mini-icon"
              onClick={() =>
                void desktop.invoke("clipboard:write-text", { text: fg })
              }
              aria-label="Copy foreground"
            >
              <Copy size={16} />
            </button>
          </div>
          <button
            className="swap-button"
            onClick={() => {
              setFg(bg);
              setBg(fg);
            }}
            aria-label="Swap colors"
          >
            <ArrowsLeftRight size={17} />
          </button>
          <div className="color-row">
            <button
              className="swatch"
              style={{ backgroundColor: bg, color: fg }}
              onClick={() => void begin("background")}
              aria-label="Sample background"
            >
              <Crosshair size={17} />
            </button>
            <label>
              <span>Background</span>
              <input
                value={bg}
                onChange={(event) => setBg(event.target.value.toUpperCase())}
                onBlur={() => setBg(cleanHex(bg, "#FFF9ED"))}
                spellCheck={false}
              />
            </label>
            <button
              className="mini-icon"
              onClick={() =>
                void desktop.invoke("clipboard:write-text", { text: bg })
              }
              aria-label="Copy background"
            >
              <Copy size={16} />
            </button>
          </div>
          <Button
            variant="primary"
            icon={Crosshair}
            disabled={pending}
            onClick={() => void begin("pair")}
          >
            {pending ? "Select two colors" : "Pick from screen"}
          </Button>
        </div>

        <div className="result-panel">
          <div className="result-heading">
            <div>
              <span>Result</span>
              <strong>{passes ? "Passes" : "Needs attention"}</strong>
            </div>
            <StatusBadge tone={passes ? "success" : "danger"}>
              {passes ? (
                <Check size={14} weight="bold" />
              ) : (
                <Warning size={14} weight="fill" />
              )}
              {MODES[mode].sc}
            </StatusBadge>
          </div>
          <Segmented
            value={mode}
            onChange={setMode}
            label="Content type"
            options={Object.entries(MODES).map(([value, item]) => ({
              value: value as TextMode,
              label: item.label,
            }))}
          />
          <div className="criteria-list">
            {checks.map((check) => (
              <div key={check.label}>
                <span className={check.pass ? "check-pass" : "check-fail"}>
                  {check.pass ? (
                    <Check size={15} weight="bold" />
                  ) : (
                    <Warning size={15} weight="fill" />
                  )}
                </span>
                <span>
                  <strong>{check.label}</strong>
                  <small>
                    SC {check.sc}, minimum {check.target}
                  </small>
                </span>
                <b>{check.pass ? "Pass" : "Fail"}</b>
              </div>
            ))}
          </div>
          <div className="apca-line">
            <span>APCA</span>
            <strong>Lc {Math.abs(lc).toFixed(1)}</strong>
            <small>{apcaRating(lc).replaceAll("-", " ")}</small>
          </div>
        </div>
      </section>

      {!passes && suggestions.length ? (
        <section className="suggestion-strip">
          <Lightbulb size={20} weight="duotone" />
          <div>
            <strong>Closest passing foregrounds</strong>
            <p>Keep the background and adjust only the text color.</p>
          </div>
          {suggestions.map((suggestion) => {
            const color = rgbToHex(suggestion.color);
            return (
              <button key={color} onClick={() => setFg(color)}>
                <span style={{ backgroundColor: color }} />
                {color}
                <small>{suggestion.ratio}:1</small>
              </button>
            );
          })}
        </section>
      ) : null}

      <div className="task-actions">
        <Button
          variant="primary"
          icon={FloppyDisk}
          onClick={() => void saveFinding()}
        >
          Save finding
        </Button>
        <Button icon={Plus} onClick={addToRecent}>
          Add to recent
        </Button>
        <Button
          icon={Camera}
          variant="quiet"
          onClick={() => onNavigate("evidence")}
        >
          Capture evidence
        </Button>
      </div>
      {history.length ? (
        <section className="recent-pairs">
          <div className="section-heading">
            <h2>Recent checks</h2>
            <button onClick={() => setHistory([])}>Clear</button>
          </div>
          <div className="pair-list">
            {history.slice(0, 5).map((item) => (
              <button
                key={`${item.createdAt}-${item.fg}`}
                onClick={() => {
                  setFg(item.fg);
                  setBg(item.bg);
                }}
              >
                <span className="pair-preview">
                  <i style={{ backgroundColor: item.fg }} />
                  <i style={{ backgroundColor: item.bg }} />
                </span>
                <span>
                  <strong>{item.ratio.toFixed(2)}:1</strong>
                  <small>
                    {item.fg} · {item.bg}
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
