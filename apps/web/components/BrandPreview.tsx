import type { CSSProperties } from "react";

// Same severity colors the real share page uses, so the preview is faithful.
const SEV = { blocker: "#B91C1C", major: "#B45309", minor: "#475569" } as const;
type Sev = keyof typeof SEV;

function Pin({ n, sev, style }: { n: number; sev: Sev; style: CSSProperties }) {
  return (
    <span
      className="absolute flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow ring-2 ring-white"
      style={{ backgroundColor: SEV[sev], ...style }}
    >
      {n}
    </span>
  );
}

const SAMPLE: { n: number; sev: Sev; sc: string; note: string }[] = [
  { n: 1, sev: "major", sc: "1.4.3", note: "Body text is 3.8:1 — needs 4.5:1." },
  { n: 2, sev: "minor", sc: "2.4.7", note: "Focus ring is hard to see." },
];

/** A faithful, live mock of how a shared report looks with this brand applied —
 *  branded header, a sample annotated screenshot, findings, and attribution. */
export function BrandPreview({
  name,
  color,
  logoUrl,
}: {
  name: string;
  color: string;
  logoUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {/* accent strip */}
      <div aria-hidden="true" style={{ background: color }} className="h-1 w-full" />

      {/* branded header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-6 w-auto max-w-[130px] object-contain" />
          ) : (
            <span aria-hidden="true" className="h-6 w-6 rounded" style={{ background: color }} />
          )}
          <span className="truncate text-sm font-semibold">{name || "Your organization"}</span>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">
          Accessibility report
        </span>
      </div>

      {/* body: sample screenshot + findings */}
      <div className="grid gap-3 p-3 sm:grid-cols-[1.7fr_1fr]">
        {/* mock annotated screenshot */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span className="h-2 w-2 rounded-full bg-muted" />
          </div>
          <div className="relative space-y-2 p-3">
            <div className="h-3 w-1/3 rounded bg-muted/60" />
            <div className="h-14 rounded-md" style={{ background: `${color}22` }} />
            <div className="h-2 w-4/5 rounded bg-muted/50" />
            <div className="h-2 w-3/5 rounded bg-muted/50" />
            <div className="h-6 w-24 rounded-md" style={{ background: color }} />
            <Pin n={1} sev="major" style={{ top: "38%", left: "30%" }} />
            <Pin n={2} sev="minor" style={{ bottom: "16%", left: "10%" }} />
          </div>
        </div>

        {/* findings panel */}
        <div className="min-w-0">
          <p className="text-xs font-semibold">Sample audit</p>
          <p className="mt-0.5 text-[10px] text-muted">2 issues · today</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ background: SEV.major }}>
              1 major
            </span>
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ background: SEV.minor }}>
              1 minor
            </span>
          </div>
          <ol className="mt-2 space-y-1.5">
            {SAMPLE.map((f) => (
              <li key={f.n} className="flex gap-1.5">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: SEV[f.sev] }}
                >
                  {f.n}
                </span>
                <span className="min-w-0 text-[10px] leading-tight text-muted">
                  <span className="font-medium text-foreground">{f.sc}</span> — {f.note}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* attribution — as it appears on white-labeled reports */}
      <div className="border-t border-border px-4 py-2 text-center text-[10px] text-muted">
        Prepared with <span className="font-medium">TheWCAG</span>
      </div>
    </div>
  );
}
