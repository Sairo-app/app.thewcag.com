import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { AppleIcon, WindowsIcon } from "@/components/icons";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Download TheWCAG for macOS & Windows",
  description:
    "Download TheWCAG for macOS or Windows. Plan WCAG 2.2 audits, inspect interfaces, capture evidence, manage findings, retest fixes, and deliver reports.",
  path: "/download",
  keywords: ["download accessibility audit software", "macOS WCAG tool", "Windows accessibility testing app", "TheWCAG download"],
});

const PLATFORMS = [
  {
    os: "mac" as const,
    name: "macOS",
    icon: AppleIcon,
    note: "macOS 12 Monterey or later, Apple Silicon and Intel",
    security: "Developer ID signed and Apple notarized universal build",
    cta: "Download for macOS",
  },
  {
    os: "windows" as const,
    name: "Windows",
    icon: WindowsIcon,
    note: "Windows 10 and 11, 64-bit",
    security: "Unsigned x64 installer; Windows may show an Unknown Publisher warning",
    cta: "Download for Windows",
  },
];

export default function DownloadPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "TheWCAG",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "macOS, Windows",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "Local-first accessibility audit workstation with planning, guided testing, browser and desktop evidence, WCAG 2.2 findings, retesting, and report delivery.",
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Download TheWCAG</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Install the local-first accessibility audit workstation. Plan scope, inspect any rendered interface, capture browser and desktop evidence, manage WCAG 2.2 findings, retest remediation, and deliver a reviewable record from your Mac or PC.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <div key={p.os} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <p.icon className="h-8 w-8" />
              <h2 className="mt-4 text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 flex-1 text-sm text-muted">{p.note}</p>
              <p className="mt-3 text-xs text-muted">{p.security}</p>
              <a
                href={`/api/desktop/download?os=${p.os}`}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">
          Downloads always resolve to the latest release. You can also browse every version on{" "}
          <a
            href="https://github.com/Sairo-app/app.thewcag.com/releases/latest"
            className="underline hover:text-foreground"
          >
            GitHub Releases
          </a>
          .
        </p>

        <section className="mt-16">
          <h2 className="text-xl font-bold tracking-tight">What you get</h2>
          <dl className="mt-5">
            {[
              ["Audit planning", "Define evaluation goals, scope, exclusions, representative samples, environments, assistive technologies, and reusable audit templates."],
              ["Guided manual testing", "Run repeatable scripts for authentication, checkout, forms, media, documents, components, and regression work."],
              ["Screen-wide inspection", "Check contrast, target size, palettes, color-vision deficiencies, low acuity, and temporary interface states across any application."],
              ["Editable evidence", "Capture high-DPI regions or screens and add issue markers, arrows, measurements, focus order, contrast probes, text, crop, and redaction."],
              ["Findings and WCAG decisions", "Track stable references, affected users, severity rationale, owners, dates, repeated occurrences, accepted risk, failed criteria, and retests."],
              ["Portable delivery", "Export Markdown or printable HTML, move integrity-checked audit packages between computers, or publish a selected unlisted report."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-sm font-semibold">{t}</dt>
                <dd className="mt-1 text-sm text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-12 text-sm text-muted">
          New to contrast requirements? Read the{" "}
          <Link href="/wcag-contrast" className="underline hover:text-foreground">
            WCAG contrast guide
          </Link>{" "}
          or try the{" "}
          <Link href="/color-contrast-checker" className="underline hover:text-foreground">
            color contrast checker
          </Link>
          .
        </p>
        <ProductLinks heading="Know what you are installing" description="Explore the full desktop audit workflow and its paired Chrome evidence capture before downloading." />
      </main>
      <Footer />
    </>
  );
}
