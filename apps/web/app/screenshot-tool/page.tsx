import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Screenshot Tool - Full How-To Guide",
  description:
    "A complete guide to TheWCAG's screenshot and annotation tool: capture any region, flag issues against WCAG success criteria, measure target sizes, probe contrast, and publish a shareable report.",
  path: "/screenshot-tool",
  keywords: ["accessibility screenshot tool", "WCAG annotation tool", "accessibility evidence capture", "annotated accessibility report"],
});

const STEPS: { title: string; body: string }[] = [
  {
    title: "Capture a region",
    body: "Press the Capture shortcut (default ⌥⌘S on macOS, Ctrl+Alt+S on Windows) and drag a box around the required evidence. Use the app menu or tray action when you need a full-screen capture. The result opens in the annotation window.",
  },
  {
    title: "Flag an issue",
    body: "Choose the issue-marker tool and click where the problem appears. Add the WCAG criterion, severity, and note for each marker, then use Add findings to create structured finding rows in the selected audit.",
  },
  {
    title: "Describe it against WCAG",
    body: "For each marker, pick the WCAG success criterion it violates (e.g. 1.4.3 Contrast, 2.5.8 Target Size), set a severity (blocker, major, minor), and write a note. This turns a screenshot into a structured, standards-referenced report.",
  },
  {
    title: "Measure & probe",
    body: "Use the ruler to record an element's dimensions and review the result against WCAG 2.5.8 and its exceptions. Use the contrast probe to click two points in the capture and record their exact ratio.",
  },
  {
    title: "Redact anything sensitive",
    body: "Draw a solid block over private data before sharing. Prefer solid redaction over pixelation - pixelation can sometimes be reversed on text.",
  },
  {
    title: "Save or publish",
    body: "Export or copy the annotated image as PNG. Add markers to the audit to include their structured findings in Markdown or printable HTML audit exports, or publish the reviewed capture to an unlisted app.thewcag.com link.",
  },
];

const SHORTCUTS: [string, string, string][] = [
  ["Pick color pair", "⌥⌘P", "Ctrl+Alt+P"],
  ["Capture region", "⌥⌘S", "Ctrl+Alt+S"],
  ["Toggle color-blindness lens", "⌥⌘L", "Ctrl+Alt+L"],
];

const FAQ = [
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
          name: "How to audit accessibility with TheWCAG's screenshot tool",
          description:
            "Capture a screenshot, flag issues against WCAG success criteria, measure target sizes, probe contrast, and publish a shareable report.",
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
          TheWCAG turns a screenshot into a structured accessibility report. Capture any part of any
          app, flag issues against specific WCAG success criteria, measure target sizes, probe
          contrast, and share the result as a link your team can open. Here is the full workflow.
        </p>
        <div className="mt-6">
          <Link
            href="/download"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download the free app
          </Link>
        </div>

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
        <ProductLinks heading="Keep screenshot evidence connected to the audit" />
      </main>
      <Footer />
    </>
  );
}
