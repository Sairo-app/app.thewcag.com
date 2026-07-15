"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { putImage, deleteImage } from "@/lib/r2";
import { BRAND_LOGO_TYPES, hasValidBrandLogoSignature, validateBrandLogoMeta } from "@/lib/brand";

const HEX = /^#[0-9a-fA-F]{6}$/;
export type BrandResult = { ok: true } | { ok: false; error: string };

/** Persist a user's white-label branding. Handles logo upload/removal to R2. */
export async function saveBrand(_prev: BrandResult | null, formData: FormData): Promise<BrandResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in again." };

  const name = ((formData.get("name") as string) ?? "").trim().slice(0, 60) || null;
  const colorRaw = ((formData.get("color") as string) ?? "").trim();
  const color = HEX.test(colorRaw) ? colorRaw : null;
  const removeLogo = formData.get("removeLogo") === "1";
  const logo = formData.get("logo") as File | null;

  const [cur] = await db
    .select({ key: users.brandLogoKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const previousLogoKey = cur?.key ?? null;
  let logoKey = removeLogo ? null : previousLogoKey;
  let uploadedLogoKey: string | null = null;

  try {
    if (logo && logo.size > 0) {
      const validationError = validateBrandLogoMeta(logo.type, logo.size);
      if (validationError) return { ok: false, error: validationError };
      const ext = BRAND_LOGO_TYPES[logo.type];
      const buf = Buffer.from(await logo.arrayBuffer());
      if (!hasValidBrandLogoSignature(logo.type, buf)) {
        return {
          ok: false,
          error:
            logo.type === "image/svg+xml"
              ? "SVG logos cannot contain scripts, event handlers, embedded data, or external resources."
              : "The logo contents do not match the selected image format.",
        };
      }
      // Random suffix busts the immutable CDN cache when the logo is replaced.
      const newKey = `brand/${userId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      await putImage(newKey, buf, logo.type);
      uploadedLogoKey = newKey;
      logoKey = newKey;
    }
  } catch {
    return { ok: false, error: "Could not upload the logo. Try again." };
  }

  try {
    const updated = await db
      .update(users)
      .set({ brandName: name, brandColor: color, brandLogoKey: logoKey })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updated.length !== 1) throw new Error("user record not found");
  } catch {
    // The database still points at the previous logo. Remove only the newly
    // uploaded orphan and leave the currently published logo intact.
    if (uploadedLogoKey) await deleteImage(uploadedLogoKey);
    return { ok: false, error: "Could not save your branding. Your previous branding is still active." };
  }

  // Delete the old immutable object only after the database points at the new
  // value (or null), so a failed save can never break existing report logos.
  if (previousLogoKey && previousLogoKey !== logoKey) await deleteImage(previousLogoKey);

  revalidatePath("/brand");
  return { ok: true };
}
