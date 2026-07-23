import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({ title: "Terms of Use", description: "Terms governing the TheWCAG desktop app, browser extension, issue connectors, local exports, hosted reports, and AI-assisted authoring.", path: "/terms" });

export default function TermsPage() {
  return (
    <>
      <Header />
      <main id="main" className="prose-page mx-auto max-w-3xl px-6 py-12">
        <p className="type-callout font-semibold uppercase text-primary">Effective 22 July 2026</p>
        <h1 className="mt-3 type-title-1 font-bold ">Terms of use</h1>
        <section><h2>Using TheWCAG</h2><p>You may use TheWCAG to plan and document accessibility evaluations, capture evidence you are authorized to inspect, prepare findings, and publish reports you are authorized to share. Do not use the service to access protected systems, capture information without permission, distribute unlawful material, or interfere with the service.</p></section>
        <section><h2>Professional judgment remains required</h2><p>Automated checks, templates, contrast calculations, simulations, and AI-assisted drafts are supporting tools. They do not by themselves establish legal compliance or conformance with WCAG or another standard. You are responsible for the scope, manual testing, conclusions, remediation advice, and final deliverables.</p></section>
        <section><h2>Your content and public links</h2><p>You retain responsibility for captures, findings, branding, and reports you create. You grant the service permission to store and serve content only as necessary to provide the features you request. Published report links are unlisted, not private; anyone with the link can view them. Remove sensitive information before publication.</p></section>
        <section><h2>Accounts and security</h2><p>Keep access to your email account and connected devices secure. Revoke lost or unused devices promptly. You are responsible for activity performed using your valid sessions and device tokens.</p></section>
        <section><h2>AI features</h2><p>AI output may be incomplete or incorrect and must be reviewed before use. Do not submit material you are not permitted to process. Provider-specific terms may also apply when you configure or use an AI provider.</p></section>
        <section><h2>Free product and Pro subscription</h2><p>The local desktop audit workflow, browser extension, local exports, deterministic drafts, and AI providers used with your own key are free. Pro is an optional recurring subscription for TheWCAG-operated managed AI, hosted report links, report analytics, storage, and hosted white-label branding. The price, billing interval, currency, applicable taxes, and renewal terms shown in checkout control your purchase.</p></section>
        <section><h2>Billing through Dodo Payments</h2><p>Dodo Payments is the Merchant of Record for Pro purchases and handles checkout, payment methods, tax calculation and collection, invoices, and statutory billing records. A subscription renews until cancelled. You can update payment details, obtain invoices, switch an available billing interval, or cancel through the secure billing portal. Cancellation scheduled for renewal preserves paid access through the current period; an immediate cancellation or refund can end hosted access sooner.</p></section>
        <section><h2>Hosted-service grace and retention</h2><p>New managed-AI requests and new hosted reports stop when Pro is inactive. Existing report links may remain available for seven days while a payment is on hold and for thirty days after a paid period ends. After that they are disabled; retained report data is scheduled for deletion after a further ninety days. Refunds, fraud action, accepted or lost disputes, account deletion, and legal or security requirements may cause immediate restriction or deletion. Export records you are required to retain.</p></section>
        <section><h2>Availability and changes</h2><p>The service may change, suspend, or discontinue features to improve reliability, security, or legal compliance. Release notes will describe material product changes where practical. Keep exports of audit records you must retain independently.</p></section>
        <section><h2>Disclaimer and liability</h2><p>The software is provided without a guarantee that every barrier will be detected or that any evaluated product will satisfy a legal requirement. To the extent permitted by applicable law, TheWCAG is not liable for indirect or consequential loss resulting from reliance on automated results, AI output, public links, or unavailable service features.</p></section>
        <section><h2>Termination and deletion</h2><p>You may stop using the software and delete your hosted account at any time. If a billable subscription is active, TheWCAG attempts to cancel it before deleting the account so deletion cannot leave a continuing charge. Access may be restricted for abuse, security threats, payment reversal, or material violation of these terms.</p></section>
      </main>
      <Footer />
    </>
  );
}
