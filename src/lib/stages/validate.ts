/**
 * Stage 1: Image Validation
 * Checks format (magic bytes), file size, dimensions, aspect ratio.
 * Strips EXIF metadata and stores a sanitised copy.
 */

import sharp from "sharp";
import { createHash } from "crypto";
import { downloadImage, uploadImage, BUCKETS } from "../s3";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAGIC_BYTES: Record<string, string> = {
  ffd8ff: "image/jpeg",
  "89504e47": "image/png",
  52494646: "image/webp",
};

const LIMITS = {
  MIN_SIZE_BYTES: 200 * 1024,       // 200 KB
  MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  MIN_DIMENSION: 1000,              // px (shorter side)
  MAX_DIMENSION: 8000,              // decompression bomb guard
};

const ALLOWED_RATIOS = [
  { w: 1, h: 1 },
  { w: 4, h: 3 },
  { w: 3, h: 4 },
  { w: 16, h: 9 },
];
const RATIO_TOLERANCE = 0.05;

export interface ValidationResult {
  passed: boolean;
  reason?: string;
  sanitisedS3Key?: string;
  imageHash?: string;
  width?: number;
  height?: number;
  checkedAt: string;
}

export async function validateImage(s3Key: string): Promise<ValidationResult> {
  const buffer = await downloadImage(BUCKETS.staging, s3Key);
  const now = new Date().toISOString();

  // 1. File size
  if (buffer.length < LIMITS.MIN_SIZE_BYTES)
    return { passed: false, reason: "file_too_small", checkedAt: now };
  if (buffer.length > LIMITS.MAX_SIZE_BYTES)
    return { passed: false, reason: "file_too_large", checkedAt: now };

  // 2. Magic bytes (real MIME, not extension)
  const hex = buffer.subarray(0, 4).toString("hex");
  const detectedMime = Object.entries(MAGIC_BYTES).find(([m]) => hex.startsWith(m))?.[1];
  if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime))
    return { passed: false, reason: "invalid_format", checkedAt: now };

  // 3. Decode with sharp (catches corrupted files)
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { passed: false, reason: "corrupt_file", checkedAt: now };
  }

  const { width = 0, height = 0 } = metadata;

  // 4. Max dimension guard
  if (width > LIMITS.MAX_DIMENSION || height > LIMITS.MAX_DIMENSION)
    return { passed: false, reason: "unsafe_dimensions", checkedAt: now };

  // 5. Min resolution
  if (Math.min(width, height) < LIMITS.MIN_DIMENSION)
    return { passed: false, reason: "low_resolution", checkedAt: now };

  // 6. Aspect ratio
  const ratio = width / height;
  const validRatio = ALLOWED_RATIOS.some(({ w, h }) => {
    const target = w / h;
    return Math.abs(ratio - target) / target <= RATIO_TOLERANCE;
  });
  if (!validRatio)
    return { passed: false, reason: "wrong_aspect_ratio", checkedAt: now };

  // 7. SHA-256 hash for dedup
  const imageHash = createHash("sha256").update(buffer).digest("hex");

  // 8. Strip EXIF and store sanitised copy
  const sanitised = await sharp(buffer).withMetadata({}).jpeg({ quality: 95 }).toBuffer();
  const sanitisedKey = `sanitised/${s3Key.split("/").pop()}`;
  await uploadImage(BUCKETS.staging, sanitisedKey, sanitised);

  return { passed: true, sanitisedS3Key: sanitisedKey, imageHash, width, height, checkedAt: now };
}
