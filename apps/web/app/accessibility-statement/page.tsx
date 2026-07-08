import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";
const ISSUES = "https://github.com/Sairo-app/app.thewcag.com/issues";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "TheWCAG's accessibility statement: our WCAG 2.2 Level AA conformance target for app.thewcag.com, the measures we take, known limitations, and how to give feedback.",
  alternates: { canonical: "/accessibility-statement" },
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function AccessibilityStatementPage() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Accessibility Statement</h1>
        <p className="mt-3 text-sm text-muted">
          Last reviewed: 7 July 2026. This statement applies to the website at{" "}
          <span className="font-mono">app.thewcag.com</span> and the TheWCAG desktop application.
        </p>

        <Section id="commitment" title="Our commitment">
          <p>
            Accessibility is our product, so it has to be our practice. We build TheWCAG to help
            teams meet the Web Content Accessibility Guidelines (WCAG), and we hold our own website
            and app to the same standard. We are committed to making our services usable by everyone,
            regardless of ability or assistive technology.
          </p>
        </Section>

        <Section id="conformance" title="Conformance status">
          <p>
            The WCAG defines requirements to improve accessibility for people with disabilities at
            three levels: A, AA, and AAA. Our target for both the website and the desktop app is{" "}
            <strong>WCAG 2.2 Level AA</strong>.
          </p>
          <p>
            The website is <strong>substantially conformant</strong> with WCAG 2.2 Level AA:
            it meets the standard except where noted under Known limitations below.
          </p>
        </Section>

        <Section id="measures" title="Measures we take">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Semantic HTML with correct landmark, heading, and list structure.</li>
            <li>Visible keyboard focus indicators and a fully keyboard-operable interface.</li>
            <li>Text and interface colors tested to meet AA contrast (4.5:1 text, 3:1 UI), in both light and dark themes.</li>
            <li>Respect for the operating system&apos;s reduced-motion and color-scheme preferences.</li>
            <li>Alternative text on meaningful images and labels on all form controls.</li>
            <li>Responsive layouts that reflow to 320px without loss of content or horizontal scrolling.</li>
          </ul>
        </Section>

        <Section id="compatibility" title="Compatibility">
          <p>
            The website is designed to work with recent versions of major browsers (Chrome, Edge,
            Firefox, Safari) and common screen readers (VoiceOver, NVDA, JAWS). It is not designed to
            support browsers more than two major versions old.
          </p>
        </Section>

        <Section id="limitations" title="Known limitations">
          <p>Despite our efforts, some limitations may remain. We are actively working on these:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Public share pages render a user-supplied screenshot image; the accessibility of that
              image&apos;s content is determined by its author, not by us. The surrounding page,
              findings list, and controls are accessible.
            </li>
            <li>
              Third-party sign-in emails are delivered by our email provider and may not fully match
              our contrast choices.
            </li>
          </ul>
        </Section>

        <Section id="assessment" title="How we assessed this">
          <p>
            We evaluate accessibility through a combination of self-evaluation, automated checks in
            our build pipeline, manual keyboard and screen-reader testing, and the same contrast and
            color-vision tooling that TheWCAG provides. This statement was created on 7 July 2026 and
            is reviewed when the site materially changes.
          </p>
        </Section>

        <Section id="feedback" title="Feedback">
          <p>
            We welcome your feedback on the accessibility of TheWCAG. If you encounter a barrier, or
            need content in a different format, please tell us:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Open an issue on{" "}
              <a href={ISSUES} className="underline hover:text-foreground">
                our GitHub tracker
              </a>{" "}
              (the fastest way to reach us).
            </li>
            <li>
              Email{" "}
              <a href="mailto:accessibility@thewcag.com" className="underline hover:text-foreground">
                accessibility@thewcag.com
              </a>
              .
            </li>
          </ul>
          <p>We aim to respond to accessibility feedback within five business days.</p>
        </Section>

        <p className="mt-12 text-sm text-muted">
          Want to hold your own product to this standard?{" "}
          <Link href="/download" className="underline hover:text-foreground">
            Download TheWCAG
          </Link>{" "}
          or read the{" "}
          <Link href="/wcag-contrast" className="underline hover:text-foreground">
            WCAG contrast guide
          </Link>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
