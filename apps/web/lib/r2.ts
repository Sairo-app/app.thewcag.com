import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 (S3-compatible). One bucket holds all screenshot images,
// keyed by an opaque object key stored alongside the screenshot metadata.
const BUCKET = process.env.R2_BUCKET ?? "thewcag-reports";

// Public bucket URL (custom domain like https://cdn.thewcag.com, or the
// managed *.r2.dev URL). When set, images are served straight from
// Cloudflare's CDN; otherwise the app streams them (dev / private bucket).
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "") || null;

export function publicImageUrl(key: string): string | null {
  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : null;
}

function assertConfigured(): void {
  const missing = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    throw new Error(`Cloudflare R2 is not configured: missing ${missing.join(", ")}`);
  }
}

let cached: S3Client | null = null;
function client(): S3Client {
  assertConfigured();
  cached ??= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    // Path-style addressing works for both Cloudflare R2 and a local MinIO
    // dev bucket, and avoids TLS-SNI issues on the R2 S3 endpoint.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cached;
}

export async function putImage(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function getImage(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body!.transformToByteArray();
    return { body, contentType: res.ContentType ?? "image/png" };
  } catch {
    return null;
  }
}

export async function deleteImage(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    /* best-effort */
  }
}
