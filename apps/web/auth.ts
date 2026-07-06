import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/schema";

const hasResend = Boolean(process.env.AUTH_RESEND_KEY);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      // In dev (no Resend key) the magic link is logged to the server
      // console instead of emailed, so local sign-in works with no email set up.
      apiKey: process.env.AUTH_RESEND_KEY ?? "dev",
      from: process.env.AUTH_EMAIL_FROM ?? "dev@thewcag.local",
      ...(hasResend
        ? {}
        : {
            sendVerificationRequest: async ({ identifier, url }) => {
              console.log(`\n\n==== DEV MAGIC LINK (${identifier}) ====\n${url}\n========================================\n\n`);
            },
          }),
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin/check" },
});
