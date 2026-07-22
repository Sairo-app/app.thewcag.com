import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Standalone Accessibility Screenshot Tool",
  description:
    "Capture, annotate, copy, export, and share accessibility screenshots without creating an audit, or attach multiple captures directly to a finding when you choose.",
  path: "/screenshot-tool",
  keywords: ["accessibility screenshot tool", "WCAG annotation tool", "accessibility evidence capture", "annotated accessibility report"],
});

const STEPS: { title: string; body: string }[] = [
  {
    title: "Open Screenshot tool",
    body: "Choose Screenshot tool, use the tray action, or press the Capture shortcut (default ⌥⌘S on macOS, Ctrl+Alt+S on Windows). You do not need an audit, a finding, or an account.",
  },
  {
    title: "Capture the necessary context",
    body: "Drag around the affected region or choose a full-screen capture when the surrounding application state matters. The most recent 100 local captures remain available in the library.",
  },
  {
    title: "Annotate the evidence",
    body: "Add issue markers, arrows, boxes, text, measurements, focus-order labels, contrast probes, crops, and irreversible solid redactions. Marker notes can reference a WCAG criterion without making an automatic conformance decision.",
  },
  {
    title: "Copy or export locally",
    body: "Copy or export the annotated image as PNG, or copy Markdown that describes the capture and its annotations. This remains a screenshot-only workflow unless you choose to connect the capture to an audit.",
  },
  {
    title: "Attach evidence while writing a finding",
    body: "Inside finding authoring, choose Add evidence to run the same capture and annotation flow and return the result directly to that finding. Attach multiple images or select existing captures from the local library.",
  },
  {
    title: "Share only when you decide",
    body: "Local export never requires an account. If you publish reviewed evidence, TheWCAG creates an unlisted app.thewcag.com link and keeps every audit and other local capture private.",
  },
];

const SHORTCUTS: [string, string, string][] = [
  ["Pick color pair", "⌥⌘P", "Ctrl+Alt+P"],
  ["Capture region", "⌥⌘S", "Ctrl+Alt+S"],
  ["Toggle color-blindness lens", "⌥⌘L", "Ctrl+Alt+L"],
];

const FAQ = [
  {
    q: "Do I need to create an audit or finding?",
    a: "No. Standalone captures are a complete screenshot-only workflow. Capture, annotate, copy, and export without entering the audit workspace.",
  },
  {
    q: "Do reviewers need to install anything to see a report?",
    a: "No. Published reports are web pages at app.thewcag.com/s/… that open in any browser. Only the person creating reports needs the app and an account.",
  },
  {
    q: "Where are captures stored?",
    a: "Captures stay on your machine until you choose to publish one. Published images are stored in our object storage, with a per-account 1 GB limit; you can delete any shared screenshot at any time.",
  },
  {
    q: "Can I change the keyboard shortcuts?",
    a: "Yes. Every global shortcut is remappable from the app's main window.",
  },
];

export default function ScreenshotToolPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to capture and share accessibility screenshots with TheWCAG",
          description:
            "Capture, annotate, copy, export, or share a screenshot without creating an audit, or attach it directly to a structured finding.",
          step: STEPS.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.title,
            text: s.body,
          })),
        }}
      />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">The accessibility screenshot tool</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Keep your audit process. TheWCAG gives you a separate screenshot workspace for capturing
          any app, adding clear annotations, copying or exporting the result, and sharing an
          unlisted review link when you choose. The same capture flow can also attach evidence to a
          finding when your workflow needs it.
        </p>
        <div className="mt-6">
          <Link
            href="/download"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download the free app
          </Link>
        </div>

        <figure className="guide-figure">
          <div className="guide-figure__image">
            <Image
              src="/guides/getting-started/standalone-capture-library.png"
              alt="TheWCAG standalone capture library with region and full-screen capture actions and a recent local capture, separate from the audit stages."
              width={1191}
              height={768}
              priority
            />
          </div>
          <figcaption>
            <p><strong>Screenshot-only by design.</strong> The capture library remains a standalone utility even when an audit is open.</p>
          </figcaption>
        </figure>

        <section className="mt-14" aria-labelledby="steps">
          <h2 id="steps" className="text-xl font-bold tracking-tight">
            Step by step
          </h2>
          <ol className="mt-5 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16" aria-labelledby="shortcuts">
          <h2 id="shortcuts" className="text-xl font-bold tracking-tight">
            Keyboard shortcuts
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Action</th>
                  <th scope="col" className="py-2 pr-4 font-medium">macOS</th>
                  <th scope="col" className="py-2 font-medium">Windows</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(([action, mac, win]) => (
                  <tr key={action} className="border-b border-border">
                    <td className="py-2 pr-4">{action}</td>
                    <td className="py-2 pr-4 font-mono">{mac}</td>
                    <td className="py-2 font-mono">{win}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">All global shortcuts can be remapped in the app.</p>
        </section>

        <section className="mt-16" aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-4 space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-12 text-sm text-muted">
          Next, learn the{" "}
          <Link href="/wcag-contrast" className="underline hover:text-foreground">
            WCAG contrast requirements
          </Link>{" "}
          or read our{" "}
          <Link href="/accessibility-statement" className="underline hover:text-foreground">
            accessibility statement
          </Link>
          .
        </p>
        <ProductLinks heading="Use Screenshot tool alone or connect the full audit workflow" />
      </main>
      <Footer />
    </>
  );
}
