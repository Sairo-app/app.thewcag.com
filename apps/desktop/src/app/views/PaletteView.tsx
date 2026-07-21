import { useMemo, useState } from "react";
import {
  contrastRatio,
  hexToRgb,
  rgbToHex,
} from "@accessibility-build/a11y-core";
import { ClipboardText, Palette, Plus, Trash, X } from "@phosphor-icons/react";
import { desktop } from "../api";
import { auditStoreKey } from "../audits";
import { Button, EmptyState, Toast } from "../components";
import { useStoredState, useTransientMessage } from "../hooks";

const HEX_RE = /#?[0-9a-fA-F]{6}\b|#?[0-9a-fA-F]{3}\b/g;

export function PaletteView({ auditId }: { auditId: string }) {
  const [colors, setColors] = useStoredState<string[]>(
    auditStoreKey(auditId, "palette"),
    ["#1F2933", "#FFF9ED", "#D9480F", "#28745D"],
  );
  const [draft, setDraft] = useState("");
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [clearedColors, setClearedColors] = useState<string[] | null>(null);
  const [message, show] = useTransientMessage();
  const matrix = useMemo(
    () =>
      colors.map((fg) =>
        colors.map((bg) => contrastRatio(hexToRgb(fg)!, hexToRgb(bg)!)),
      ),
    [colors],
  );
  function add() {
    const next = (draft.match(HEX_RE) || [])
      .map((value) => hexToRgb(value.startsWith("#") ? value : `#${value}`))
      .filter(Boolean)
      .map((rgb) => rgbToHex(rgb!));
    if (!next.length) {
      show("Enter one or more valid hex colors", true);
      return;
    }
    setColors((current) => [...new Set([...current, ...next])].slice(0, 16));
    setClearedColors(null);
    setDraft("");
  }
  async function copyCsv() {
    const csv = [
      ["", ...colors].join(","),
      ...colors.map((color, index) =>
        [color, ...matrix[index].map((value) => value.toFixed(2))].join(","),
      ),
    ].join("\n");
    await desktop.invoke("clipboard:write-text", { text: csv });
    show("Contrast matrix copied as CSV");
  }
  return (
    <div className="palette-view">
      <Toast message={message} />
      <section className="palette-input">
        <div>
          <span className="section-label">Up to 16 colors</span>
          <h2>Test a design system palette</h2>
          <p>
            Every color is evaluated as text against every other color as a
            background.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <label>
            <span>Hex colors</span>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="#1F2933  #FFF9ED  #D9480F"
              spellCheck={false}
            />
          </label>
          <Button type="submit" variant="primary" icon={Plus}>
            Add colors
          </Button>
        </form>
      </section>
      <div className="palette-toolbar">
        <div className="color-chips">
          {colors.map((color) => (
            <span key={color}>
              <i style={{ backgroundColor: color }} />
              {color}
              <button
                onClick={() =>
                  setColors((items) => items.filter((item) => item !== color))
                }
                aria-label={`Remove ${color}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <label className="compact-check">
          <input
            type="checkbox"
            checked={failuresOnly}
            onChange={(event) => setFailuresOnly(event.target.checked)}
          />
          Highlight failures
        </label>
        <Button
          icon={ClipboardText}
          disabled={colors.length < 2}
          onClick={() => void copyCsv()}
        >
          Copy CSV
        </Button>
        <Button
          variant="quiet"
          icon={Trash}
          disabled={!colors.length}
          onClick={() => {
            setClearedColors(colors);
            setColors([]);
          }}
        >
          Clear
        </Button>
      </div>
      {clearedColors ? (
        <div className="undo-strip" role="status">
          <span>Palette cleared.</span>
          <button
            type="button"
            onClick={() => {
              setColors(clearedColors);
              setClearedColors(null);
            }}
          >
            Undo
          </button>
        </div>
      ) : null}
      {colors.length < 2 ? (
        <EmptyState
          icon={Palette}
          title="Add at least two colors"
          body="Use any three or six digit hex values. Duplicate colors are removed automatically."
        />
      ) : (
        <div className="matrix-wrap">
          <table className="contrast-matrix">
            <thead>
              <tr>
                <th>Text / background</th>
                {colors.map((bg) => (
                  <th key={bg}>
                    <span style={{ backgroundColor: bg }} />
                    <code>{bg}</code>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((fg, row) => (
                <tr key={fg}>
                  <th>
                    <span style={{ backgroundColor: fg }} />
                    <code>{fg}</code>
                  </th>
                  {colors.map((bg, column) => {
                    const ratio = matrix[row][column];
                    const tone =
                      row === column
                        ? "same"
                        : ratio >= 4.5
                          ? "pass"
                          : ratio >= 3
                            ? "partial"
                            : "fail";
                    return (
                      <td
                        key={bg}
                        className={`matrix-${tone}${failuresOnly && tone !== "fail" ? " matrix-muted" : ""}`}
                        style={{ color: fg, backgroundColor: bg }}
                      >
                        <strong>
                          {row === column ? "Same" : ratio.toFixed(1)}
                        </strong>
                        {row !== column ? (
                          <small>
                            {ratio >= 4.5
                              ? "AA"
                              : ratio >= 3
                                ? "Large"
                                : "Fail"}
                          </small>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="matrix-legend">
        <span>
          <i className="legend-pass" />
          4.5:1 or more, AA text
        </span>
        <span>
          <i className="legend-partial" />
          3:1 or more, large text and UI
        </span>
        <span>
          <i className="legend-fail" />
          Below 3:1
        </span>
      </footer>
    </div>
  );
}
