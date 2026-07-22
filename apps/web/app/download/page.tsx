import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { AppleIcon, ArrowRightIcon, CheckIcon, WindowsIcon } from "@/components/icons";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Download Free Accessibility Audit Software",
  description:
    "Download TheWCAG free for macOS or Windows. No account is required for local WCAG audits, evidence capture, findings, retesting, and exports.",
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
    cta: "Download free for macOS",
  },
  {
    os: "windows" as const,
    name: "Windows",
    icon: WindowsIcon,
    note: "Windows 10 and 11, 64-bit",
    security: "Unsigned x64 installer; Windows may show an Unknown Publisher warning",
    cta: "Download free for Windows",
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
      <main id="main" className="download-page">
        <header className="download-hero">
          <p className="download-hero__eyebrow">Free desktop app</p>
          <h1>Start your next audit with the evidence intact.</h1>
          <p>
            Choose macOS or Windows and start locally. Plan scope, inspect rendered interfaces, capture evidence, manage WCAG 2.2 findings, retest fixes, and deliver a reviewable record from one workspace.
          </p>
          <div className="download-hero__assurances" aria-label="Download assurances">
            <span><CheckIcon size={15} /> No account to start</span>
            <span><CheckIcon size={15} /> No payment details</span>
            <span><CheckIcon size={15} /> Captures stay local</span>
          </div>
        </header>

        <div className="download-platforms">
          {PLATFORMS.map((p) => (
            <article key={p.os} className={`download-platform download-platform--${p.os}`}>
              <div className="download-platform__topline">
                <span className="download-platform__icon"><p.icon className="h-8 w-8" /></span>
                <span className="download-platform__badge">Free</span>
              </div>
              <h2>{p.name}</h2>
              <p className="download-platform__requirements">{p.note}</p>
              <p className="download-platform__security">{p.security}</p>
              <a
                href={`/api/desktop/download?os=${p.os}`}
                className="button button--primary"
              >
                {p.cta} <ArrowRightIcon size={16} />
              </a>
            </article>
          ))}
        </div>

        <p className="download-release-note">
          These buttons download the latest release. You can also inspect every version on{" "}
          <a
            href="https://github.com/Sairo-app/app.thewcag.com/releases/latest"
          >
            GitHub Releases
          </a>
          .
        </p>

        <section className="download-steps" aria-labelledby="download-steps-heading">
          <div>
            <h2 id="download-steps-heading">From install to first finding.</h2>
            <p>The local workflow is ready before you create an account or connect a service.</p>
          </div>
          <ol>
            <li><span>01</span><div><h3>Install the workstation</h3><p>Choose the build for your desktop and open TheWCAG.</p></div></li>
            <li><span>02</span><div><h3>Create the audit locally</h3><p>Plan scope, capture evidence, document findings, and export without an account.</p></div></li>
            <li><span>03</span><div><h3>Connect only when useful</h3><p>Sign in when you want AI-assisted drafts or controlled report publishing.</p></div></li>
          </ol>
        </section>

        <section className="download-included" aria-labelledby="download-included-heading">
          <h2 id="download-included-heading">Everything the evidence trail needs.</h2>
          <dl>
            {[
              ["Audit planning", "Define evaluation goals, scope, exclusions, representative samples, environments, assistive technologies, and reusable audit templates."],
              ["Guided manual testing", "Run repeatable scripts for authentication, checkout, forms, media, documents, components, and regression work."],
              ["Screen-wide inspection", "Check contrast, target size, palettes, color-vision deficiencies, low acuity, and temporary interface states across any application."],
              ["Editable evidence", "Capture high-DPI regions or screens and add issue markers, arrows, measurements, focus order, contrast probes, text, crop, and redaction."],
              ["Findings and WCAG decisions", "Track stable references, affected users, severity rationale, owners, dates, repeated occurrences, accepted risk, failed criteria, and retests."],
              ["Portable delivery", "Export Markdown or printable HTML, move integrity-checked audit packages between computers, or publish a selected unlisted report."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="download-resources">
          New to contrast requirements? Read the{" "}
          <Link href="/wcag-contrast">
            WCAG contrast guide
          </Link>{" "}
          or try the{" "}
          <Link href="/color-contrast-checker">
            color contrast checker
          </Link>
          .
        </p>
        <ProductLinks heading="Want to inspect the workflow first?" description="Explore the full audit workstation and its paired Chrome evidence capture before you install." />
      </main>
      <Footer />
    </>
  );
}
