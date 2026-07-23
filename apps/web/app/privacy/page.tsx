import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({ title: "Privacy Policy", description: "How TheWCAG handles local audit data, browser evidence, account data, AI requests, optional telemetry, and published reports.", path: "/privacy" });

const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@thewcag.com";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="main" className="prose-page mx-auto max-w-3xl px-6 py-12">
        <p className="type-callout font-semibold uppercase text-primary">Effective 22 July 2026</p>
        <h1 className="mt-3 type-title-1 font-bold ">Privacy policy</h1>
        <p className="mt-4 text-muted">TheWCAG is designed around local audit storage and deliberate sharing. This policy explains what remains on your device, what reaches the service, and what becomes public only after you choose to publish it.</p>

        <section><h2>Information stored locally</h2><p>Desktop audit plans, findings, checklists, annotations, captures, personal templates, settings, and locally configured provider credentials are stored on your computer. Provider and account credentials use the operating system credential protection available to the installed application.</p></section>
        <section><h2>Chrome extension evidence</h2><p>The extension captures only the selected page region and bounded semantic context needed for review. It does not request all-sites access and does not read cookies, network traffic, browser history, hidden form values, or unrelated browser storage. The current capture and draft remain in local extension storage and automatically expire after 24 hours unless replaced or removed sooner.</p></section>
        <section><h2>Account and device information</h2><p>Magic-link sign-in stores your email address, verification and session records, and connected desktop-device records. Device bearer tokens are stored as one-way hashes by the service, expire after 90 days, and can be revoked from the account page. The desktop stores its token using operating-system encryption.</p></section>
        <section><h2>Optional funnel telemetry</h2><p>Anonymous funnel telemetry is off by default. If you opt in, TheWCAG can increment aggregate counters for exactly three transitions: getting-started guide to download, download to first completed Plan, and first completed Plan to first Deliver. Each request contains only the allowlisted event name. It does not include an identifier, audit content, URLs under test, screenshots, findings, account data, or personal information, and request headers are not retained for telemetry.</p></section>
        <section><h2>AI-assisted authoring</h2><p>AI authoring is optional. Before a request, you choose whether to include the selected screenshot, element text, and page context. Approved evidence is sent through the connected desktop application to the configured provider. The service stores bounded usage metadata for rate limiting and abuse prevention, not the full evidence payload or model response. A locally configured provider is governed by that provider&apos;s terms and privacy policy.</p></section>
        <section><h2>Published reports</h2><p>A report is uploaded only after you sign in, select a capture, review it for sensitive content, and publish it. Published reports use an unlisted public link: anyone who receives the link can view it without an account. Report metadata is stored in PostgreSQL and report images are stored in Cloudflare R2. Delete the report from My reports to revoke its public page.</p></section>
        <section><h2>Subscription and billing information</h2><p>When you start Pro, Dodo Payments receives the checkout and billing information needed to act as Merchant of Record, process payment, calculate and collect taxes, issue invoices, and manage the subscription. TheWCAG stores only Dodo customer, subscription, product, lifecycle, and billing-period references needed to authorize service and recover webhook delivery. TheWCAG does not store card or bank details, invoice PDFs, or tax identifiers.</p></section>
        <section><h2>Service providers</h2><p>The hosted service may use PostgreSQL hosting for account, entitlement, and report metadata; Cloudflare R2 in private-bucket mode for report images; Resend for sign-in email; OpenAI for explicitly approved managed-AI requests; Dodo Payments for billing; and GitHub for source and release distribution. Each provider processes only the information needed for its role.</p></section>
        <section><h2>Retention and deletion</h2><p>Local desktop records remain until you delete them from your device. Extension evidence expires after 24 hours. Active hosted reports remain until you delete them or Pro access changes. Existing links may receive a seven-day on-hold grace or a thirty-day post-subscription grace, followed by up to ninety additional days of disabled retention before scheduled deletion. Revoked access and account deletion can remove them immediately. Connected-device and billing idempotency records are retained only for security, recovery, and legal needs. Account deletion cancels a known nonterminal subscription before removing hosted product data; it does not delete local desktop audits or billing records Dodo must retain by law.</p></section>
        <section><h2>Security and your choices</h2><p>You control whether evidence is sent for AI processing or published. Redact personal or confidential information before publishing and revoke devices you no longer use. No online service can promise absolute security, but TheWCAG uses bounded inputs, hashed tokens, encrypted local credentials, restricted extension permissions, and explicit publication controls.</p></section>
        <section><h2>Contact</h2><p>For privacy questions, access requests, or deletion assistance, email <a href={`mailto:${privacyEmail}`} className="text-primary underline">{privacyEmail}</a>.</p></section>
      </main>
      <Footer />
    </>
  );
}
