/**
 * Stage 4a: Enhancement — PhotoRoom API
 * Background removal, white bg, padding, soft shadow.
 * Retries once on failure, then passes original through.
 */

import { withRetry } from "../retry";
import type { QualityResult } from "./quality";

export interface EnhancementResult {
  status: "enhanced" | "failed";
  buffer?: Buffer;
  operationsApplied: string[];
}

export async function enhanceImage(
  imageBuffer: Buffer,
  quality: QualityResult
): Promise<EnhancementResult> {
  const operations: string[] = [];
  const formData = new FormData();

  formData.append("imageFile", new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }), "product.jpg");
  formData.append("outputSize", "1000x1000");
  formData.append("padding", "0.08");

  if (quality.needsBackgroundRemoval || quality.backgroundType !== "white") {
    formData.append("background.color", "FFFFFF");
    operations.push("background_removal", "white_background");
    formData.append("shadow.mode", "ai.soft");
    operations.push("soft_shadow");
  }

  try {
    const response = await withRetry(
      () =>
        fetch("https://image-api.photoroom.com/v2/edit", {
          method: "POST",
          headers: { "x-api-key": process.env.PHOTOROOM_API_KEY! },
          body: formData,
        }),
      1, // single retry
      5000
    );

    if (!response.ok) throw new Error(`PhotoRoom error: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    return { status: "enhanced", buffer, operationsApplied: operations };
  } catch (error) {
    console.error("PhotoRoom enhancement failed:", error);
    return { status: "failed", operationsApplied: [] };
  }
}
