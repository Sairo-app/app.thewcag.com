import {
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  HeadBucketCommand,
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

// Hosted images must remain private so report lifecycle checks cannot be
// bypassed with a direct object URL. Remove an older development policy if it
// exists; a missing policy is already the desired state.
try {
  await s3.send(new DeleteBucketPolicyCommand({ Bucket }));
  console.log("removed legacy public-read policy");
} catch {
  console.log("bucket is private");
}
