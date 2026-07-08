"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { putImage, deleteImage } from "@/lib/r2";

const HEX = /^#[0-9a-fA-F]{6}$/;
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

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
  let logoKey = cur?.key ?? null;

  try {
    if (removeLogo && logoKey) {
      await deleteImage(logoKey);
      logoKey = null;
    }
    if (logo && logo.size > 0) {
      const ext = LOGO_TYPES[logo.type];
      if (!ext) return { ok: false, error: "Logo must be a PNG, JPG, WEBP, or SVG." };
      if (logo.size > 1_000_000) return { ok: false, error: "Logo must be under 1 MB." };
      const buf = Buffer.from(await logo.arrayBuffer());
      // Random suffix busts the immutable CDN cache when the logo is replaced.
      const newKey = `brand/${userId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      await putImage(newKey, buf, logo.type);
      if (logoKey) await deleteImage(logoKey);
      logoKey = newKey;
    }
  } catch {
    return { ok: false, error: "Could not upload the logo. Try again." };
  }

  await db
    .update(users)
    .set({ brandName: name, brandColor: color, brandLogoKey: logoKey })
    .where(eq(users.id, userId));

  revalidatePath("/brand");
  return { ok: true };
}
