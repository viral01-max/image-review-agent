import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

export const BUCKETS = {
  staging: process.env.S3_BUCKET_STAGING ?? "brand-images-staging",
  processed: process.env.S3_BUCKET_PROCESSED ?? "brand-images-processed",
  approved: process.env.S3_BUCKET_APPROVED ?? "brand-images-approved",
} as const;

/** Generate a pre-signed URL for brand to upload directly to S3 staging */
export async function getUploadUrl(
  jobId: string,
  filename: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKETS.staging,
    Key: `uploads/${jobId}/${filename}`,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

/** Download an image from a bucket */
export async function downloadImage(
  bucket: string,
  key: string
): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
}

/** Upload a processed image buffer to a bucket */
export async function uploadImage(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType = "image/jpeg"
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key;
}

/** Copy an image between buckets (used on approval) */
export async function copyImage(
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
): Promise<void> {
  await s3.send(
    new CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      CopySource: `${sourceBucket}/${sourceKey}`,
    })
  );
}

/** Delete an image from a bucket (used on rejection of processed images) */
export async function deleteImage(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Get a temporary pre-signed URL for viewing an image */
export async function getViewUrl(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}
