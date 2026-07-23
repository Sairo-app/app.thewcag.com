import { and, count, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { authSigninAttempts, verificationTokens } from "@/lib/schema";
import { hashedClientIdentity } from "@/lib/request-identity";

const MAX_ACTIVE_EMAIL_TOKENS = 5;
const MAX_SIGNIN_ATTEMPTS_PER_IP_HOUR = 10;

export interface VerificationTokenInput {
  identifier: string;
  token: string;
  expires: Date;
}

export class SignInRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: "too_many_email_links" | "too_many_signin_attempts", retryAfterSeconds: number) {
    super(message);
    this.name = "SignInRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Auth.js calls createVerificationToken before it sends the email. Enforce the
 * recipient limit inside that adapter operation so a rejected sixth request
 * never creates a usable token and never reaches the email provider.
 */
export async function createRateLimitedVerificationToken(
  value: VerificationTokenInput,
): Promise<VerificationTokenInput> {
  const normalizedIdentifier = value.identifier.trim().toLowerCase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`auth-email:${normalizedIdentifier}`}))`);
    const [usage] = await tx
      .select({ value: count() })
      .from(verificationTokens)
      .where(and(
        sql`lower(${verificationTokens.identifier}) = ${normalizedIdentifier}`,
        gt(verificationTokens.expires, new Date()),
      ));
    if (Number(usage?.value ?? 0) >= MAX_ACTIVE_EMAIL_TOKENS) {
      throw new SignInRateLimitError("too_many_email_links", 24 * 60 * 60);
    }

    const [created] = await tx
      .insert(verificationTokens)
      .values(value)
      .returning({
        identifier: verificationTokens.identifier,
        token: verificationTokens.token,
        expires: verificationTokens.expires,
      });
    if (!created) throw new Error("verification_token_not_created");
    return created;
  });
}

/** Reserve one public sign-in action for this keyed client identity. */
export async function reserveSignInAttempt(
  headers: Headers,
  now = new Date(),
): Promise<void> {
  const ipHash = hashedClientIdentity(headers, "auth-signin");
  const since = new Date(now.getTime() - 60 * 60 * 1_000);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`auth-signin:${ipHash}`}))`);
    const [usage] = await tx
      .select({ value: count() })
      .from(authSigninAttempts)
      .where(and(
        eq(authSigninAttempts.ipHash, ipHash),
        gte(authSigninAttempts.createdAt, since),
      ));
    if (Number(usage?.value ?? 0) >= MAX_SIGNIN_ATTEMPTS_PER_IP_HOUR) {
      throw new SignInRateLimitError("too_many_signin_attempts", 60 * 60);
    }
    await tx.insert(authSigninAttempts).values({
      id: crypto.randomUUID(),
      ipHash,
      createdAt: now,
    });
  });
}
