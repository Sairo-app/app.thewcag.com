"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveBrand, type BrandResult } from "@/app/brand/actions";
import { BrandPreview } from "@/components/BrandPreview";
import { CheckIcon } from "@/components/icons";
import { BRAND_LOGO_MAX_BYTES, BRAND_LOGO_TYPES } from "@/lib/brand";

const DEFAULT_COLOR = "#b83b12";
const HEX = /^#[0-9a-fA-F]{6}$/;

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
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  // Clean up any object URL we created for the file preview.
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!BRAND_LOGO_TYPES[f.type]) {
      setFileError("Choose a PNG, JPG, WEBP, or SVG logo.");
      e.target.value = "";
      return;
    }
    if (f.size > BRAND_LOGO_MAX_BYTES) {
      setFileError("Choose a logo under 1 MB.");
      e.target.value = "";
      return;
    }
    setFileError(null);
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
    setFileError(null);
  }

  const showLogo = logoPreview && !removeLogo;
  const safeColor = HEX.test(color) ? color : DEFAULT_COLOR;

  return (
    <form action={formAction} className="mt-8 space-y-8">
      {/* Live, faithful preview of an actual shared report with this brand. */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="label">Live preview</p>
          <p className="text-[11px] text-muted">How anyone opening your link sees it</p>
        </div>
        <BrandPreview name={name} color={safeColor} logoUrl={showLogo ? logoPreview : null} />
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
          {fileError && <span role="alert" className="text-xs text-red-700">{fileError}</span>}
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
        <label htmlFor="brand-logo" className="label">
          Logo
        </label>
        <p id="brand-logo-hint" className="mt-0.5 text-xs text-muted">
          PNG, JPG, WEBP, or SVG. Up to 1 MB. Transparent backgrounds work best.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            id="brand-logo"
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            aria-describedby="brand-logo-hint"
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
          disabled={pending || Boolean(fileError)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save branding"}
        </button>
        {state?.ok && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted">
            <CheckIcon size={15} /> Saved. It’s live on your shared reports.
          </span>
        )}
        {state && !state.ok && (
          <span role="alert" className="text-sm text-red-700">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
