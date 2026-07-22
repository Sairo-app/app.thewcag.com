import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingSubscriptions, reports } from "@/lib/schema";
import { verifyDeviceToken } from "@/lib/device-auth";
import { decodePngBase64, generateSlug, isUniqueViolation, sanitizeReportIssues, SITE_URL } from "@/lib/reports";
import { deleteImageBestEffort, putImage } from "@/lib/r2";
import { formatBytes } from "@/lib/quota";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/bounded-json";
import { resolveEntitlements } from "@/lib/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 5_600_000;

class StorageQuotaError extends Error {
  constructor(public readonly usedBytes: number) {
    super("storage quota exceeded");
  }
}

class HostedReportSubscriptionError extends Error {}

function quotaResponse(usedBytes: number, quotaBytes: number) {
  return NextResponse.json(
    {
      error: "storage_quota_exceeded",
      message: `Image storage limit reached (${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used). Delete some shared screenshots to free space.`,
      usedBytes,
      quotaBytes,
    },
    { status: 413 },
  );
}

/** Publish an annotated screenshot: image to R2, metadata to Postgres. */
export async function POST(req: NextRequest) {
  const ctx = await verifyDeviceToken(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entitlements = await resolveEntitlements(ctx.userId);
  if (!entitlements.features.hostedReports.enabled) {
    const hasSubscription = entitlements.subscription.status !== "none";
    return NextResponse.json({
      error: hasSubscription ? "subscription_inactive" : "subscription_required",
      message: hasSubscription
        ? "Hosted publishing is unavailable while the Pro subscription is inactive. Local reports and exports remain free."
        : "Hosted share links are a Pro service. Local reports and exports remain free.",
      ...(entitlements.actions.billingUrl ? { billingUrl: entitlements.actions.billingUrl } : { upgradeUrl: entitlements.actions.upgradeUrl }),
    }, { status: 402, headers: { "Cache-Control": "no-store" } });
  }
  if (entitlements.features.hostedReports.active >= entitlements.features.hostedReports.limit) {
    return NextResponse.json({
      error: "hosted_report_limit_reached",
      message: `Hosted report limit reached (${entitlements.features.hostedReports.limit}). Delete an existing report before publishing another.`,
    }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(req, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "request too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const b = body as { title?: string; description?: string; issues?: unknown; imageBase64?: string };

  const decoded = decodePngBase64(String(b.imageBase64 ?? ""));
  if (!decoded.ok) {
    return NextResponse.json({ error: decoded.error }, { status: decoded.error === "image too large" ? 413 : 400 });
  }

  const title = (typeof b.title === "string" ? b.title.trim() : "").slice(0, 140) || "Accessibility screenshot";
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 500) : null;
  const issues = sanitizeReportIssues(b.issues);

  // Per-user 1 GiB image cap: reject before writing anything to R2.
  const used = entitlements.storage.usedBytes;
  const storageQuota = entitlements.storage.quotaBytes;
  if (used + decoded.buffer.length > storageQuota) {
    return quotaResponse(used, storageQuota);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const imageKey = `screenshots/${slug}.png`;
    try {
      await putImage(imageKey, decoded.buffer, "image/png");
      await db.transaction(async (tx) => {
        // Serialize quota checks for this account. The early check above is a
        // fast rejection; this locked check closes the concurrent-upload race.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.userId}))`);
        const [subscription] = await tx
          .select({ status: billingSubscriptions.status, end: billingSubscriptions.currentPeriodEnd })
          .from(billingSubscriptions)
          .where(and(
            eq(billingSubscriptions.userId, ctx.userId),
            eq(billingSubscriptions.status, "active"),
            gt(billingSubscriptions.currentPeriodEnd, new Date()),
          ))
          .orderBy(desc(billingSubscriptions.currentPeriodEnd))
          .limit(1);
        if (subscription?.status !== "active" || !subscription.end || subscription.end.getTime() <= Date.now()) {
          throw new HostedReportSubscriptionError("subscription_inactive");
        }
        const [row] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${reports.sizeBytes}), 0)` })
          .from(reports)
          .where(eq(reports.userId, ctx.userId));
        const currentUsed = Number(row?.total ?? 0);
        if (currentUsed + decoded.buffer.length > storageQuota) {
          throw new StorageQuotaError(currentUsed);
        }
        const [activeRow] = await tx
          .select({ value: count() })
          .from(reports)
          .where(sql`${reports.userId} = ${ctx.userId} AND ${reports.availabilityStatus} IN ('active', 'grace')`);
        if (Number(activeRow?.value ?? 0) >= entitlements.features.hostedReports.limit) {
          throw new Error("report_limit_reached");
        }
        await tx.insert(reports).values({
          slug,
          userId: ctx.userId,
          title,
          description,
          issues,
          imageKey,
          imageContentType: "image/png",
          sizeBytes: decoded.buffer.length,
          availabilityStatus: "active",
          graceEndsAt: null,
          retentionDeleteAt: null,
          disabledAt: null,
        });
      });
      return NextResponse.json({ url: `${SITE_URL}/s/${slug}`, slug });
    } catch (err) {
      await deleteImageBestEffort(imageKey);
      if (err instanceof StorageQuotaError) return quotaResponse(err.usedBytes, storageQuota);
      if (err instanceof HostedReportSubscriptionError) {
        return NextResponse.json({
          error: "subscription_inactive",
          message: "The Pro subscription changed before publishing completed. The image was not retained.",
          ...(entitlements.actions.billingUrl ? { billingUrl: entitlements.actions.billingUrl } : { upgradeUrl: entitlements.actions.upgradeUrl }),
        }, { status: 402 });
      }
      if (err instanceof Error && err.message === "report_limit_reached") {
        return NextResponse.json({ error: "hosted_report_limit_reached", message: "Hosted report limit reached. Delete an existing report before publishing another." }, { status: 409 });
      }
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "could not allocate an id" }, { status: 500 });
}
