import { useMemo, useState } from "react";
import { contrastRatio, hexToRgb, rgbToHex } from "@accessibility-build/a11y-core";
import { ipc } from "../lib/ipc";

const HEX_RE = /#?[0-9a-fA-F]{6}\b|#?[0-9a-fA-F]{3}\b/g;

export default function PaletteWindow() {
  const [colors, setColors] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function addColors(input: string) {
    const found = input.match(HEX_RE) ?? [];
    const normalized = found
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .map((h) => hexToRgb(h))
      .filter((rgb): rgb is NonNullable<typeof rgb> => rgb !== null)
      .map(rgbToHex);
    if (normalized.length === 0) return;
    setColors((prev) => Array.from(new Set([...prev, ...normalized])).slice(0, 16));
    setDraft("");
  }

  function remove(hex: string) {
    setColors((prev) => prev.filter((c) => c !== hex));
  }

  function flash(m: string) {
    setStatus(m);
    setTimeout(() => setStatus(null), 2000);
  }

  const matrix = useMemo(
    () =>
      colors.map((fg) =>
        colors.map((bg) => {
          const a = hexToRgb(fg)!;
          const b = hexToRgb(bg)!;
          return Math.round(contrastRatio(a, b) * 100) / 100;
        }),
      ),
    [colors],
  );

  async function copyCsv() {
    const header = ["", ...colors].join(",");
    const rows = colors.map((fg, i) => [fg, ...matrix[i].map((r) => r.toFixed(2))].join(","));
    await ipc.copyText([header, ...rows].join("\n"));
    flash("Matrix copied as CSV");
  }

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <h1 className="text-sm font-bold">Palette Contrast</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addColors(draft);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste hex colors…"
            spellCheck={false}
            className="w-52 rounded-md border border-border bg-card-2/70 px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
            Add
          </button>
        </form>
        <div className="ml-auto flex items-center gap-1.5">
          {status && <span className="rise mr-1 text-[11px] text-ok">{status}</span>}
          {colors.length > 0 && (
            <>
              <button onClick={() => void copyCsv()} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                Copy CSV
              </button>
              <button onClick={() => setColors([])} className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                Clear
              </button>
            </>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        {colors.length < 2 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            Add two or more colors (paste a design system&apos;s hex codes) to see the full
            pairwise WCAG contrast matrix — text color down the side, background across the top.
          </div>
        ) : (
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background" />
                {colors.map((bg) => (
                  <th key={bg} className="p-1">
                    <div className="flex flex-col items-center gap-1">
                      <span className="h-5 w-8 rounded border border-border" style={{ backgroundColor: bg }} />
                      <span className="font-mono text-[9px] text-muted-foreground">{bg}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((fg, i) => (
                <tr key={fg}>
                  <th className="sticky left-0 z-10 bg-background pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-5 w-8 shrink-0 rounded border border-border" style={{ backgroundColor: fg }} />
                      <span className="font-mono text-[9px] text-muted-foreground">{fg}</span>
                      <button onClick={() => remove(fg)} className="text-[10px] text-muted-foreground hover:text-coral" title="Remove">
                        ✕
                      </button>
                    </div>
                  </th>
                  {colors.map((bg, j) => {
                    if (i === j) return <td key={bg} className="text-center text-muted-foreground">—</td>;
                    const ratio = matrix[i][j];
                    const tone =
                      ratio >= 4.5 ? "#16A34A" : ratio >= 3 ? "#F59E0B" : "#DC2626";
                    return (
                      <td key={bg} className="p-0.5">
                        <div
                          className="flex h-12 w-16 flex-col items-center justify-center rounded-md border border-border"
                          style={{ backgroundColor: bg, color: fg }}
                          title={`${fg} on ${bg}: ${ratio.toFixed(2)}:1`}
                        >
                          <span className="text-sm font-semibold leading-none">Aa</span>
                          <span
                            className="mt-1 rounded px-1 text-[9px] font-bold"
                            style={{ backgroundColor: tone, color: "#fff" }}
                          >
                            {ratio.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {colors.length >= 2 && (
        <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="mr-3"><span className="font-bold text-ok">●</span> ≥ 4.5 : 1 (AA normal)</span>
          <span className="mr-3"><span className="font-bold text-yellow">●</span> ≥ 3 : 1 (AA large / UI)</span>
          <span><span className="font-bold text-coral">●</span> fails</span>
        </footer>
      )}
    </div>
  );
}
