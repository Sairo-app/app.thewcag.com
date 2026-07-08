"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveBrand, type BrandResult } from "@/app/brand/actions";
import { CheckIcon } from "@/components/icons";

const DEFAULT_COLOR = "#c2410c";

export function BrandForm({
  initial,
}: {
  initial: { name: string; color: string; logoUrl: string | null };
}) {
  const [state, formAction, pending] = useActionState<BrandResult | null, FormData>(saveBrand, null);
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color || DEFAULT_COLOR);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  // Clean up any object URL we created for the file preview.
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(f);
    setLogoPreview(objectUrl.current);
    setRemoveLogo(false);
  }

  function clearLogo() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (fileRef.current) fileRef.current.value = "";
    setLogoPreview(null);
    setRemoveLogo(true);
  }

  const showLogo = logoPreview && !removeLogo;

  return (
    <form action={formAction} className="mt-8 space-y-8">
      {/* Live preview of the share-page header */}
      <div>
        <p className="label mb-2">Preview</p>
        <div className="overflow-hidden rounded-xl border border-border">
          <div aria-hidden="true" style={{ background: color }} className="h-1 w-full" />
          <div className="flex items-center justify-between gap-3 bg-background px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {showLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview!} alt="" className="h-7 w-auto max-w-[160px] object-contain" />
              ) : null}
              {name ? (
                <span className="truncate text-sm font-semibold">{name}</span>
              ) : !showLogo ? (
                <span className="text-sm text-muted">Your brand appears here</span>
              ) : null}
            </div>
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
              Accessibility report
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="label">Organization name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Acme Design"
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="block">
          <span className="label">Accent color</span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              name="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Accent color"
              className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-card"
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Accent color hex"
              className="w-28 rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </label>
      </div>

      <div>
        <span className="label">Logo</span>
        <p className="mt-0.5 text-xs text-muted">PNG, JPG, WEBP, or SVG · up to 1 MB · transparent background looks best.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={onFile}
            className="block text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
          />
          {showLogo && (
            <button
              type="button"
              onClick={clearLogo}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>

      <input type="hidden" name="removeLogo" value={removeLogo ? "1" : "0"} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save branding"}
        </button>
        {state?.ok && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted">
            <CheckIcon size={15} /> Saved — it’s live on your shared reports.
          </span>
        )}
        {state && !state.ok && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
