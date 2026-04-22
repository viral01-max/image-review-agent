/**
 * Stage 4b: AI Product Shot Generation — OpenAI
 * 1. GPT-4o Vision extracts a product description
 * 2. DALL-E 3 generates hero, flat lay, and angle shots in parallel
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ShotResult {
  shotType: string;
  url: string;
  promptUsed: string;
}

export interface GeneratedShots {
  hero: ShotResult | null;
  flatLay: ShotResult | null;
  angle: ShotResult | null;
}

const SHOT_PROMPTS = {
  hero: (d: string) =>
    `Professional e-commerce hero shot of ${d}, centred on pure white background, studio lighting, sharp focus, photorealistic, high resolution`,
  flat_lay: (d: string) =>
    `Flat lay product photography of ${d}, top-down view, white background, clean minimalist styling, professional product photography`,
  angle: (d: string) =>
    `45-degree angle product shot of ${d}, white background, soft studio lighting, professional e-commerce photography, high detail`,
};

async function extractProductDescription(base64: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" } },
          {
            type: "text",
            text: "Describe this product in 1-2 sentences for a product photography prompt. Focus on: type, colour, material, shape, notable features. Return only the description.",
          },
        ],
      },
    ],
    max_tokens: 150,
  });
  return response.choices[0].message.content ?? "a product";
}

export async function generateProductShots(imageBuffer: Buffer): Promise<GeneratedShots> {
  const base64 = imageBuffer.toString("base64");
  const productDescription = await extractProductDescription(base64);

  const shotTypes = ["hero", "flat_lay", "angle"] as const;
  const results = await Promise.allSettled(
    shotTypes.map(async (shotType) => {
      const prompt = SHOT_PROMPTS[shotType](productDescription);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "hd",
        style: "natural",
        n: 1,
      });
      return { shotType, url: response.data[0].url!, promptUsed: prompt };
    })
  );

  return {
    hero: results[0].status === "fulfilled" ? results[0].value : null,
    flatLay: results[1].status === "fulfilled" ? results[1].value : null,
    angle: results[2].status === "fulfilled" ? results[2].value : null,
  };
}

/** Download a generated image from OpenAI's temporary URL */
export async function downloadGeneratedImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}
