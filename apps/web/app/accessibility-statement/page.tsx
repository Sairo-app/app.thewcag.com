import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductLinks } from "@/components/ProductLinks";
import { createPageMetadata } from "@/lib/seo";

const ISSUES = "https://github.com/Sairo-app/app.thewcag.com/issues";

export const metadata: Metadata = createPageMetadata({
  title: "Accessibility Statement",
  description:
    "Read TheWCAG's accessibility statement for the website, macOS and Windows audit workstation, Chrome extension, known limitations, and feedback channels.",
  path: "/accessibility-statement",
  keywords: ["TheWCAG accessibility statement", "WCAG 2.2 conformance target", "accessibility feedback"],
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="type-title-2 font-bold ">
        {title}
      </h2>
      <div className="mt-3 space-y-3 type-body text-muted">{children}</div>
    </section>
  );
}

export default function AccessibilityStatementPage() {
  return (
    <>
      <Header />
      <main id="main" className="editorial-page mx-auto max-w-3xl px-6 py-12">
        <h1 className="type-title-1 font-bold ">Accessibility Statement</h1>
        <p className="mt-3 type-body text-muted">
          Last reviewed: 21 July 2026. This statement applies to the website at{" "}
          <span className="font-mono">app.thewcag.com</span>, the TheWCAG desktop application, and the Chrome evidence extension.
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
            We have not commissioned an independent conformance assessment and do not currently claim full WCAG conformance. We continuously test against our Level AA target and document known limitations below.
          </p>
        </Section>

        <Section id="measures" title="Measures we take">
          <ul className="list-disc space-y-2 pl-5">
            <li>Semantic HTML with correct landmark, heading, and list structure.</li>
            <li>Visible keyboard focus indicators and a fully keyboard-operable interface.</li>
            <li>Text and interface colors tested against AA contrast thresholds for text and user-interface components.</li>
            <li>Respect for reduced-motion, forced-colors, zoom, text resizing, and platform accessibility settings.</li>
            <li>Alternative text on meaningful images and labels on all form controls.</li>
            <li>Responsive layouts that reflow to 320px without loss of content or horizontal scrolling.</li>
            <li>Keyboard and screen-reader operation for the extension popup, evidence workspace, and desktop audit workflow.</li>
          </ul>
        </Section>

        <Section id="compatibility" title="Compatibility">
          <p>
            The website is designed for recent versions of Chrome, Edge, Firefox, and Safari with common screen readers including VoiceOver, NVDA, and JAWS. The desktop app supports macOS 12 or later and Windows 10 or 11. The extension requires Chrome 116 or later.
          </p>
        </Section>

        <Section id="limitations" title="Known limitations">
          <p>Despite our efforts, some limitations may remain. We are actively working on these:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Public share pages render a user-supplied screenshot image; the accessibility of that
              image&apos;s content is determined by its author, not by us. The surrounding page,
              findings list, and controls are accessible.
            </li>
            <li>
              Third-party sign-in emails are delivered by our email provider and may not fully match
              our contrast choices.
            </li>
            <li>
              Chrome prevents extensions from inspecting browser-owned pages such as <span className="font-mono">chrome://</span> settings. Evidence capture works on regular HTTP and HTTPS webpages.
            </li>
          </ul>
        </Section>

        <Section id="assessment" title="How we assessed this">
          <p>
            We evaluate accessibility through a combination of self-evaluation, automated checks in
            our build pipeline, responsive browser checks, manual keyboard and screen-reader testing, and the same contrast and color-vision tooling that TheWCAG provides. This statement was updated on 21 July 2026 and is reviewed whenever a public surface materially changes.
          </p>
        </Section>

        <Section id="feedback" title="Feedback">
          <p>
            We welcome your feedback on the accessibility of TheWCAG. If you encounter a barrier, or
            need content in a different format, please tell us:
          </p>
          <ul className="list-disc space-y-2 pl-5">
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

        <p className="mt-12 type-body text-muted">
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
        <ProductLinks heading="Explore the product covered by this statement" />
      </main>
      <Footer />
    </>
  );
}
