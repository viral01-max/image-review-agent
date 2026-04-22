/**
 * Stage 2: Content Moderation — AWS Rekognition
 * DetectModerationLabels with 70% confidence threshold.
 * Hard-rejects prohibited content, soft-flags tobacco/alcohol/gambling.
 */

import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";
import { withRetry } from "../retry";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const HARD_REJECT = [
  "Explicit Nudity", "Suggestive", "Violence",
  "Visually Disturbing", "Drugs", "Hate Symbols",
];
const SOFT_FLAG = ["Tobacco", "Alcohol", "Gambling"];

export interface ModerationResult {
  status: "passed" | "rejected" | "flagged_for_review";
  labels?: Array<{ name: string; parentName: string; confidence: number }>;
  rejectionReason?: string;
  checkedAt: string;
}

export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  const now = new Date().toISOString();

  const command = new DetectModerationLabelsCommand({
    Image: { Bytes: imageBuffer },
    MinConfidence: 70,
  });

  let response;
  try {
    response = await withRetry(() => rekognition.send(command));
  } catch (error) {
    throw new Error(`Rekognition unavailable: ${(error as Error).message}`);
  }

  const labels = (response.ModerationLabels ?? []).map((l) => ({
    name: l.Name ?? "",
    parentName: l.ParentName ?? "",
    confidence: l.Confidence ?? 0,
  }));

  const hardFails = labels.filter(
    (l) => HARD_REJECT.includes(l.parentName) || HARD_REJECT.includes(l.name)
  );
  const softFlags = labels.filter(
    (l) => SOFT_FLAG.includes(l.parentName) || SOFT_FLAG.includes(l.name)
  );

  if (hardFails.length > 0) {
    return {
      status: "rejected",
      labels: hardFails,
      rejectionReason: "This image contains content that violates our listing policies.",
      checkedAt: now,
    };
  }
  if (softFlags.length > 0) {
    return { status: "flagged_for_review", labels: softFlags, checkedAt: now };
  }
  return { status: "passed", labels: [], checkedAt: now };
}
