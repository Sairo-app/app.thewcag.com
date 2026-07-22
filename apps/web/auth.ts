import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/schema";

const hasResend = Boolean(process.env.AUTH_RESEND_KEY);
const FROM = process.env.AUTH_EMAIL_FROM ?? "TheWCAG <noreply@updates.onchange.app>";
const isProduction = process.env.NODE_ENV === "production";
const trustsForwardedHost = process.env.AUTH_TRUST_HOST === "true";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

/** Clean, professional magic-link email. `url` is used verbatim so the link
 * always works; a plain-text copy is included for accessibility + fallback. */
function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Invalid sign-in URL");
  const safeUrl = escapeHtml(parsed.toString());
  const subject = "Sign in to TheWCAG";
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f4;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your sign-in link for TheWCAG (expires in 24 hours).</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:440px;background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;">
        <tr><td style="padding:28px 32px 0;">
          <div style="font:700 18px ${font};color:#1c1917;letter-spacing:-0.01em;">The<span style="color:#c2410c;">WCAG</span></div>
        </td></tr>
        <tr><td style="padding:18px 32px 0;">
          <h1 style="margin:0;font:700 20px ${font};color:#1c1917;letter-spacing:-0.01em;">Sign in to TheWCAG</h1>
          <p style="margin:10px 0 0;font:400 14px/1.6 ${font};color:#57534e;">Click the button below to finish signing in. This link expires in 24 hours and can be used once.</p>
        </td></tr>
        <tr><td style="padding:22px 32px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font:600 14px ${font};padding:12px 24px;border-radius:10px;">Sign in</a>
        </td></tr>
        <tr><td style="padding:20px 32px 0;">
          <p style="margin:0;font:400 13px/1.5 ${font};color:#78716c;">Or paste this link into your browser:</p>
          <p style="margin:6px 0 0;font:400 12px/1.5 ${font};word-break:break-all;"><a href="${safeUrl}" style="color:#c2410c;text-decoration:underline;">${safeUrl}</a></p>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <div style="border-top:1px solid #e7e5e4;margin:0 0 16px;"></div>
          <p style="margin:0;font:400 12px/1.5 ${font};color:#a8a29e;">If you didn't request this, you can safely ignore this email. No changes will be made to any account.</p>
        </td></tr>
      </table>
      <p style="max-width:440px;margin:16px auto 0;font:400 12px ${font};color:#78716c;text-align:center;">TheWCAG, accessibility checks anywhere on screen</p>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `Sign in to TheWCAG

Use this link to finish signing in (expires in 24 hours, one-time use):
${url}

If you didn't request this, you can safely ignore this email.`;
  return { subject, html, text };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: !isProduction || Boolean(process.env.AUTH_URL) || trustsForwardedHost,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "dev",
      from: FROM,
      // Custom branded email. In dev (no Resend key) the link is logged to the
      // server console instead of emailed, so local sign-in needs no email setup.
      sendVerificationRequest: async ({ identifier, url }) => {
        if (!hasResend) {
          if (isProduction) {
            throw new Error("Email sign-in is unavailable because AUTH_RESEND_KEY is not configured.");
          }
          console.log(`\n\n==== DEV MAGIC LINK (${identifier}) ====\n${url}\n========================================\n\n`);
          return;
        }
        const [rate] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(verificationTokens)
          .where(and(
            sql`lower(${verificationTokens.identifier}) = ${identifier.toLowerCase()}`,
            gt(verificationTokens.expires, new Date()),
          ));
        if (Number(rate?.count ?? 0) > 5) {
          throw new Error("Too many active sign-in links. Use the newest email or wait for the existing links to expire.");
        }
        const { subject, html, text } = magicLinkEmail(url);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: FROM, to: identifier, subject, html, text }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`Resend send failed (${res.status}): ${body}`);
        }
      },
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin/check" },
  callbacks: {
    redirect({ url, baseUrl }) {
      const canonical = new URL(process.env.AUTH_URL || baseUrl);
      try {
        const destination = new URL(url, canonical);
        return destination.origin === canonical.origin ? destination.toString() : canonical.toString();
      } catch {
        return canonical.toString();
      }
    },
  },
});
