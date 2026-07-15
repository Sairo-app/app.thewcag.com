import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { AppleIcon, WindowsIcon } from "@/components/icons";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "Download TheWCAG for macOS & Windows",
  description:
    "Download TheWCAG - the free desktop accessibility toolkit for macOS and Windows. Check WCAG color contrast anywhere on screen, simulate color blindness, and share annotated reports.",
  alternates: { canonical: "/download" },
  openGraph: {
    title: "Download TheWCAG for macOS & Windows",
    description:
      "Free desktop accessibility toolkit. WCAG contrast checking, color-blindness simulation, and shareable annotated screenshots.",
    url: `${SITE}/download`,
  },
};

const PLATFORMS = [
  {
    os: "mac" as const,
    name: "macOS",
    icon: AppleIcon,
    note: "macOS 12 Monterey or later, Apple Silicon & Intel",
    cta: "Download for macOS",
  },
  {
    os: "windows" as const,
    name: "Windows",
    icon: WindowsIcon,
    note: "Windows 10 & 11, 64-bit",
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
            "Desktop accessibility toolkit for checking WCAG color contrast anywhere on screen, simulating color blindness, and sharing annotated reports.",
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Download TheWCAG</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The free desktop accessibility toolkit. Pick a color pair from anywhere on screen, get the
          exact WCAG contrast ratio, simulate color blindness, and turn annotated screenshots into
          shareable reports - natively on your Mac or PC.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <div key={p.os} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <p.icon className="h-8 w-8" />
              <h2 className="mt-4 text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 flex-1 text-sm text-muted">{p.note}</p>
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
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["On-screen contrast picker", "Sample any two pixels and read the WCAG 2.1/2.2 ratio, AA/AAA verdict, and APCA Lc instantly."],
              ["Color-blindness lens", "See any app through protanopia, deuteranopia, tritanopia, and low-acuity filters, live."],
              ["Annotate & measure", "Capture a region, flag issues against WCAG success criteria, and check 24px target sizes."],
              ["Shareable reports", "Publish an annotated screenshot to a link your team can open - no account needed to view."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ul>
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
      </main>
      <Footer />
    </>
  );
}
