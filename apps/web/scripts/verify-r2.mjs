// Real Cloudflare R2 acceptance test. Run:
//   cd apps/web && node --env-file=.env.production.local scripts/verify-r2.mjs
// Ensures the bucket exists, then exercises the production path:
// write (S3) -> authenticated read -> delete. The bucket must remain private;
// report and branding routes enforce subscription lifecycle before streaming.
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
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

  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: png, ContentType: "image/png", CacheControl: "private, no-store" }));
  step("write object (S3 PutObject)", true, key);

  const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
  step("object exists (S3 HeadObject)", head.ContentType === "image/png", `type=${head.ContentType}`);

  const read = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const bytes = await read.Body.transformToByteArray();
  step("authenticated read", bytes.length === png.length && read.ContentType === "image/png", `${bytes.length} bytes`);

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

console.log(ok ? "\nPrivate R2 storage is working." : "\nR2 test failed - see above.");
process.exit(ok ? 0 : 1);
