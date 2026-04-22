/**
 * Stage 3: Quality Assessment — GPT-4o Vision
 * Determines if the image is a usable product shot and routes to:
 *   - brand_review (already good)
 *   - enhance (PhotoRoom fix-up)
 *   - generate (full AI shot generation)
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QUALITY_PROMPT = `You are a product image quality reviewer for an e-commerce platform.

Analyse this image and return a JSON object with the following fields:
{
  "is_product_shot": boolean,
  "product_visible": boolean,
  "background_type": "white" | "clean_solid" | "lifestyle" | "cluttered" | "none",
  "needs_background_removal": boolean,
  "needs_brightness_fix": boolean,
  "needs_sharpness_fix": boolean,
  "shot_type": "hero" | "flat_lay" | "angle" | "lifestyle" | "unknown",
  "confidence": number,
  "notes": string
}

Return ONLY the JSON object. No commentary.`;

export interface QualityResult {
  route: "brand_review" | "enhance" | "generate";
  isProductShot: boolean;
  productVisible: boolean;
  backgroundType: string;
  needsBackgroundRemoval: boolean;
  needsBrightnessFix: boolean;
  needsSharpnessFix: boolean;
  shotType: string;
  gpt4oConfidence: number;
  notes: string;
  checkedAt: string;
}

export async function assessQuality(imageBuffer: Buffer): Promise<QualityResult> {
  const now = new Date().toISOString();
  const base64 = imageBuffer.toString("base64");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" },
          },
          { type: "text", text: QUALITY_PROMPT },
        ],
      },
    ],
    max_tokens: 300,
    response_format: { type: "json_object" },
  });

  const report = JSON.parse(response.choices[0].message.content ?? "{}");

  let route: QualityResult["route"];
  if (!report.is_product_shot || !report.product_visible) {
    route = "generate";
  } else if (report.needs_background_removal || report.needs_brightness_fix || report.needs_sharpness_fix) {
    route = "enhance";
  } else {
    route = "brand_review";
  }

  return {
    route,
    isProductShot: report.is_product_shot ?? false,
    productVisible: report.product_visible ?? false,
    backgroundType: report.background_type ?? "unknown",
    needsBackgroundRemoval: report.needs_background_removal ?? false,
    needsBrightnessFix: report.needs_brightness_fix ?? false,
    needsSharpnessFix: report.needs_sharpness_fix ?? false,
    shotType: report.shot_type ?? "unknown",
    gpt4oConfidence: report.confidence ?? 0,
    notes: report.notes ?? "",
    checkedAt: now,
  };
}
