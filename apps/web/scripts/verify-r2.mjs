// Real Cloudflare R2 acceptance test. Run:
//   cd apps/web && node --env-file=.env.production.local scripts/verify-r2.mjs
// Ensures the bucket exists, then exercises the production path:
// write (S3) -> [public read via CDN if R2_PUBLIC_URL set] -> delete.
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const need = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env: " + missing.join(", "));
  process.exit(1);
}

const Bucket = process.env.R2_BUCKET;
const PUBLIC = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "") || null;
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const key = `verify/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
let ok = true;
const step = (name, pass, extra = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!pass) ok = false;
};

try {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
    step("bucket exists", true, Bucket);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
    step("bucket created", true, Bucket);
  }

  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: png, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }));
  step("write object (S3 PutObject)", true, key);

  const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
  step("object exists (S3 HeadObject)", head.ContentType === "image/png", `type=${head.ContentType}`);

  if (PUBLIC) {
    const url = `${PUBLIC}/${key}`;
    const res = await fetch(url);
    const type = res.headers.get("content-type") || "";
    step("public read (CDN GET)", res.ok && type.includes("image/png"), `${res.status} ${type}`);
  } else {
    console.log("SKIP  public read - set R2_PUBLIC_URL after enabling public access on the bucket");
  }

  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  let deleted = false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
  } catch {
    deleted = true;
  }
  step("delete object", deleted);
} catch (e) {
  step("R2 request", false, String(e?.message || e));
}

console.log(ok ? "\nR2 storage is working." + (PUBLIC ? " Fully ready." : " Enable public access + set R2_PUBLIC_URL to finish.") : "\nR2 test failed - see above.");
process.exit(ok ? 0 : 1);
