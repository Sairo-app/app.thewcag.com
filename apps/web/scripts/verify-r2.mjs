// Real Cloudflare R2 acceptance test. Run once creds are set:
//   cd apps/web && node --env-file=.env.production.local scripts/verify-r2.mjs
// Exercises the exact production path: write (S3) -> public read (CDN) -> delete.
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const need = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env: " + missing.join(", "));
  process.exit(1);
}

const Bucket = process.env.R2_BUCKET;
const PUBLIC = process.env.R2_PUBLIC_URL.replace(/\/+$/, "");
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// 1x1 transparent PNG
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
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: png, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }));
  step("write object (S3 PutObject)", true, key);

  const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
  step("object exists (S3 HeadObject)", head.ContentType === "image/png", `type=${head.ContentType}`);

  const url = `${PUBLIC}/${key}`;
  const res = await fetch(url);
  const type = res.headers.get("content-type") || "";
  step("public read (CDN GET)", res.ok && type.includes("image/png"), `${res.status} ${type} ${url}`);

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

console.log(ok ? "\nR2 is fully working — ready to deploy." : "\nR2 test failed — see above.");
process.exit(ok ? 0 : 1);
