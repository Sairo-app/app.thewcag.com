import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.R2_BUCKET;
try {
  await s3.send(new HeadBucketCommand({ Bucket }));
  console.log(`bucket "${Bucket}" already exists`);
} catch {
  await s3.send(new CreateBucketCommand({ Bucket }));
  console.log(`created bucket "${Bucket}"`);
}

// Anonymous read so the local MinIO mirrors a public R2 bucket (R2_PUBLIC_URL).
// In production you enable public access on the R2 bucket instead.
await s3.send(
  new PutBucketPolicyCommand({
    Bucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${Bucket}/*`],
        },
      ],
    }),
  }),
);
console.log("public-read policy applied");
