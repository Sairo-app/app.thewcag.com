import { readFileSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

await sql`insert into "user" (id, email) values (${crypto.randomUUID()}, 'dev@thewcag.local') on conflict (email) do nothing`;
const [user] = await sql`select id from "user" where email = 'dev@thewcag.local'`;

const img = readFileSync(new URL("../../../scripts/brand-icon-512.png", import.meta.url));
const slug = "demo" + Math.random().toString(36).slice(2, 8);
const key = `screenshots/${slug}.png`;
await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: img, ContentType: "image/png" }));

const issues = [
  { n: 1, sc: "2.4.7", label: "Focus indicator", severity: "blocker", note: "No visible focus ring on the primary button." },
  { n: 2, sc: "1.4.3", label: "Contrast", severity: "major", note: "Body text is 3.1:1 against its background (needs 4.5:1)." },
  { n: 3, sc: "2.5.8", label: "Target size", severity: "minor", note: "Close icon is 20×20px (needs 24×24)." },
];
await sql`insert into report (id, slug, user_id, title, description, issues, image_key, image_content_type)
  values (${crypto.randomUUID()}, ${slug}, ${user.id}, 'Sample accessibility screenshot',
  '3 issues: 1 blocker, 1 major, 1 minor.', ${JSON.stringify(issues)}::jsonb, ${key}, 'image/png')`;

console.log(`SEEDED  http://localhost:3100/s/${slug}`);
await sql.end();
