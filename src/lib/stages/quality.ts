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

Return ONLY the JSON object. No commentary. No markdown. No backticks.`;

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
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" } },
        { type: "text", text: QUALITY_PROMPT },
      ],
    }],
    max_tokens: 300,
    response_format: { type: "json_object" },
  });

  let report: Record<string, unknown> = {};
  try {
    const raw = response.choices[0].message.content ?? "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    report = JSON.parse(cleaned);
  } catch {
    report = {};
  }

  const route: QualityResult["route"] =
    !report.is_product_shot || !report.product_visible
      ? "generate"
      : report.needs_background_removal || report.needs_brightness_fix || report.needs_sharpness_fix
      ? "enhance"
      : "brand_review";

  return {
    route,
    isProductShot: Boolean(report.is_product_shot),
    productVisible: Boolean(report.product_visible),
    backgroundType: String(report.background_type ?? "unknown"),
    needsBackgroundRemoval: Boolean(report.needs_background_removal),
    needsBrightnessFix: Boolean(report.needs_brightness_fix),
    needsSharpnessFix: Boolean(report.needs_sharpness_fix),
    shotType: String(report.shot_type ?? "unknown"),
    gpt4oConfidence: Number(report.confidence ?? 0),
    notes: String(report.notes ?? ""),
    checkedAt: now,
  };
}
