import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingSessionAttempts } from "@/lib/schema";
import type { PlanChoice } from "./plans";

export type BillingSessionKind = "checkout" | "portal";

export class BillingSessionRateLimitError extends Error {
  readonly retryAfterSeconds = 60 * 60;
  constructor() {
    super("billing_session_rate_limited");
  }
}

export class BillingSessionPendingError extends Error {
  readonly retryAfterSeconds = 5 * 60;
  constructor() {
    super("billing_confirmation_pending");
  }
}

export async function reserveBillingSession(input: {
  userId: string;
  kind: BillingSessionKind;
  planChoice?: PlanChoice;
}): Promise<string> {
  const since = new Date(Date.now() - 60 * 60 * 1_000);
  const limit = input.kind === "checkout" ? 5 : 10;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`billing-session:${input.kind}:${input.userId}`}))`);
    if (input.kind === "checkout") {
      const [recent] = await tx
        .select({ id: billingSessionAttempts.id })
        .from(billingSessionAttempts)
        .where(and(
          eq(billingSessionAttempts.userId, input.userId),
          eq(billingSessionAttempts.kind, "checkout"),
          inArray(billingSessionAttempts.status, ["started", "succeeded"]),
          gte(billingSessionAttempts.createdAt, new Date(Date.now() - 5 * 60 * 1_000)),
        ))
        .orderBy(desc(billingSessionAttempts.createdAt))
        .limit(1);
      if (recent) throw new BillingSessionPendingError();
    }
    const [usage] = await tx
      .select({ value: count() })
      .from(billingSessionAttempts)
      .where(and(
        eq(billingSessionAttempts.userId, input.userId),
        eq(billingSessionAttempts.kind, input.kind),
        gte(billingSessionAttempts.createdAt, since),
      ));
    if (Number(usage?.value ?? 0) >= limit) throw new BillingSessionRateLimitError();
    const [attempt] = await tx
      .insert(billingSessionAttempts)
      .values({ userId: input.userId, kind: input.kind, planChoice: input.planChoice, status: "started" })
      .returning({ id: billingSessionAttempts.id });
    if (!attempt) throw new Error("billing_session_reservation_failed");
    return attempt.id;
  });
}

export async function completeBillingSession(
  id: string,
  status: "succeeded" | "failed",
  remoteSessionId?: string,
): Promise<void> {
  await db
    .update(billingSessionAttempts)
    .set({ status, remoteSessionId: remoteSessionId?.slice(0, 200), updatedAt: new Date() })
    .where(eq(billingSessionAttempts.id, id));
}
