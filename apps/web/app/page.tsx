import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer, JsonLd } from "@/components/Footer";
import {
  AppleIcon,
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  ContrastIcon,
  CropIcon,
  EyeIcon,
  FlagIcon,
  ImageIcon,
  PaletteIcon,
  WindowsIcon,
} from "@/components/icons";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

export const metadata: Metadata = {
  title: "Desktop accessibility auditing toolkit for macOS & Windows",
  description:
    "Audit accessibility anywhere on screen with WCAG contrast checks, color-blindness simulation, annotated findings, a WCAG 2.2 checklist, and shareable reports.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "TheWCAG - Accessibility auditing, anywhere on screen",
    description:
      "A local-first desktop toolkit for accessibility auditors, designers, developers, and QA teams on macOS and Windows.",
    url: SITE,
  },
};

const TOOLS: { icon: ReactNode; title: string; body: string; href: string; link: string }[] = [
  {
    icon: <ContrastIcon size={19} />,
    title: "On-screen contrast",
    body: "Pick foreground and background pixels from any browser, native app, design file, or video. Get WCAG 2.2, AAA, UI-component, and APCA results immediately.",
    href: "/color-contrast-checker",
    link: "Explore contrast",
  },
  {
    icon: <CropIcon size={19} />,
    title: "Capture and annotate",
    body: "Capture a region, mark exact locations, classify severity, attach WCAG criteria, measure target sizes, redact details, and preserve the evidence.",
    href: "/screenshot-tool",
    link: "See the workflow",
  },
  {
    icon: <EyeIcon size={19} />,
    title: "Live vision simulation",
    body: "Move a resizable lens over any interface to review protanopia, deuteranopia, tritanopia, monochromacy, low acuity, and low-contrast vision.",
    href: "/color-blindness-simulator",
    link: "Explore simulations",
  },
  {
    icon: <FlagIcon size={19} />,
    title: "Findings register",
    body: "Triage manual and screenshot findings in one register. Search and filter by severity or status, then export client-ready CSV, Markdown, or HTML.",
    href: "/screenshot-tool",
    link: "Review findings",
  },
  {
    icon: <BookIcon size={19} />,
    title: "WCAG 2.2 checklist",
    body: "Track every Level A and AA success criterion with pass, fail, not-applicable, notes, completion progress, and scoped audit exports.",
    href: "/wcag-checklist",
    link: "Open the checklist",
  },
  {
    icon: <PaletteIcon size={19} />,
    title: "Palette validation",
    body: "Compare a complete color palette as a pairwise matrix and catch combinations that will fail before they become components or design tokens.",
    href: "/color-contrast-checker",
    link: "Check a palette",
  },
];

const WORKFLOW = [
  ["01", "Set the audit context", "Record the project, target, scope, conformance level, evaluator, and start date so every export remains traceable."],
  ["02", "Inspect the real experience", "Use global shortcuts over websites, desktop apps, prototypes, documents, and transient states that DOM-only tools cannot see."],
  ["03", "Verify and document", "Check measurable criteria, capture evidence, add severity and remediation context, and work through the WCAG checklist."],
  ["04", "Triage and share", "Move findings from open to fixed, export structured deliverables, or publish a branded screenshot report to one reviewable link."],
];

function ProductPreview() {
  return (
    <div aria-label="Preview of TheWCAG desktop audit workspace" role="img" className="relative mx-auto w-full max-w-[620px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef6a5b]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e9b949]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4ab06c]" />
          <span className="ml-2 text-[11px] font-semibold text-muted">TheWCAG · Checkout accessibility audit</span>
        </div>
        <div className="grid gap-3 bg-background/70 p-3 sm:grid-cols-[1.55fr_1fr] sm:p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {["Pick pair", "Capture", "Lens"].map((label, index) => (
                <div key={label} className="rounded-lg border border-border bg-card px-2.5 py-2.5">
                  <span className="block text-[10px] font-semibold">{label}</span>
                  <span className="mt-1 block text-[8px] text-muted">{index === 0 ? "⌥⌘P" : index === 1 ? "⌥⌘S" : "⌥⌘L"}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 flex-1 rounded-md border border-border bg-[#172033]" />
                <span className="text-xs text-muted">on</span>
                <div className="h-7 flex-1 rounded-md border border-border bg-[#fffaf5]" />
              </div>
              <div className="mt-3 rounded-lg border border-border bg-[#fffaf5] px-3 py-3 text-center text-sm font-semibold text-[#172033]">
                Accessible checkout
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <span className="font-mono text-3xl font-extrabold tracking-tight">16.01</span>
                  <span className="ml-1 text-xs text-muted">: 1</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">AA PASS</span>
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">AAA PASS</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full w-[88%] rounded-full bg-primary" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Current audit</span>
              <strong className="mt-1.5 block text-[11px]">Checkout · Q3 release</strong>
              <span className="mt-1 block text-[9px] text-muted">WCAG 2.2 AA · Web + desktop</span>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"><div className="h-full w-[68%] bg-primary" /></div>
                <span className="font-mono text-[9px] text-muted">68%</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Findings</span>
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold text-red-800">3 open</span>
              </div>
              {["Focus indicator obscured", "Target below 24 × 24", "Error not announced"].map((label, index) => (
                <div key={label} className="mt-2 flex items-center gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${index === 0 ? "bg-red-600" : index === 1 ? "bg-amber-500" : "bg-slate-400"}`} />
                  <span className="truncate text-[9px]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:block">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted">Evidence ready</span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold"><CheckIcon size={13} /> HTML · CSV · Markdown</span>
      </div>
    </div>
  );
}

export default function Home() {
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
          url: SITE,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "A desktop accessibility auditing toolkit with WCAG contrast checking, vision simulation, annotated findings, checklists, and shareable reports.",
        }}
      />
      <main id="main">
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
            <div className="text-center lg:text-left">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                The auditor&apos;s desktop companion
              </span>
              <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.55rem]">
                Audit what users actually see.
                <span className="block text-primary">Anywhere on screen.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted lg:mx-0">
                TheWCAG brings contrast analysis, vision simulation, evidence capture, WCAG 2.2 tracking, and structured findings into one fast desktop workflow—for websites, native apps, prototypes, and everything between.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link href="/download" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Download free <ArrowRightIcon size={16} />
                </Link>
                <Link href="/screenshot-tool" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:bg-background">
                  See the audit workflow
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted lg:justify-start">
                {["No account to start", "Captures stay local", "Free on macOS + Windows"].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5"><CheckIcon size={13} />{item}</li>
                ))}
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section aria-label="Product capabilities" className="border-b border-border bg-card">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border px-6 sm:grid-cols-4 sm:divide-y-0">
            {[
              ["WCAG 2.2", "A + AA checklist"],
              ["APCA", "Side-by-side scoring"],
              ["macOS + Windows", "One audit workflow"],
              ["Local first", "Share only by choice"],
            ].map(([value, label]) => (
              <div key={value} className="px-4 py-6 text-center">
                <strong className="block text-sm">{value}</strong>
                <span className="mt-1 block text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24" aria-labelledby="toolkit-heading">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">A complete manual-testing toolkit</span>
            <h2 id="toolkit-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From first observation to defensible finding</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">Purpose-built utilities stay connected, so auditors spend less time moving evidence between color pickers, spreadsheets, screenshot editors, and report documents.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <article key={tool.title} className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{tool.icon}</span>
                <h3 className="mt-5 text-base font-semibold">{tool.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{tool.body}</p>
                <Link href={tool.href} className="mt-5 inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  {tool.link} <ArrowRightIcon size={14} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card" aria-labelledby="workflow-heading">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-24 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Structured by design</span>
              <h2 id="workflow-heading" className="mt-3 text-3xl font-bold tracking-tight">A clearer audit trail, without heavyweight project software</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">Set enough context to keep the work trustworthy, then move quickly through inspection, documentation, triage, and delivery.</p>
              <Link href="/wcag-checklist" className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-background">
                View the WCAG checklist <ArrowRightIcon size={14} />
              </Link>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {WORKFLOW.map(([n, title, body]) => (
                <li key={n} className="rounded-xl border border-border bg-background p-5">
                  <span className="font-mono text-xs font-bold text-primary">{n}</span>
                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24" aria-labelledby="platform-heading">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Native where it matters</span>
              <h2 id="platform-heading" className="mt-3 text-3xl font-bold tracking-tight">Consistent on MacBook and Windows. Familiar on both.</h2>
              <p className="mt-4 text-base leading-relaxed text-muted">A shared audit model keeps results consistent while each desktop build respects platform window controls, global shortcuts, system capture permissions, scaling, and resizable layouts.</p>
              <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                {["Global, remappable shortcuts", "Responsive narrow-window mode", "Automatic light and dark themes", "Keyboard-visible focus states", "Reduced-motion support", "Automatic update support"].map((item) => (
                  <li key={item} className="flex items-start gap-2"><span className="mt-0.5 text-primary"><CheckIcon size={15} /></span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <AppleIcon className="h-9 w-9" />
                <h3 className="mt-5 text-lg font-semibold">macOS</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">Menu-bar access, Mac shortcuts, native Screen Recording recovery, vibrancy, resizable workspaces, and Apple Silicon + Intel support.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <WindowsIcon className="h-9 w-9" />
                <h3 className="mt-5 text-lg font-semibold">Windows</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">A compact default window, Windows shortcut labels, native title bar, responsive reflow, high-DPI webview rendering, and Windows 10 + 11 support.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-foreground px-6 py-12 text-center text-background sm:px-10 sm:py-14">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-background/10"><ImageIcon size={20} /></span>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-tight">Build a better accessibility audit, one observable issue at a time.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-background/70">Start free. No account is required until you choose to publish a shareable report.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/download" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">Download TheWCAG <ArrowRightIcon size={16} /></Link>
              <Link href="/screenshot-tool" className="inline-flex min-h-12 items-center rounded-lg border border-background/25 px-5 text-sm font-semibold hover:bg-background/10">Read the full workflow</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
