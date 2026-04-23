/**
 * Image Review Agent — Pipeline Orchestrator
 * Processes a single image job through all stages:
 * 1. Validate → 2. Moderate → 3. Quality → 4a/4b. Enhance/Generate → 5. Brand Review
 */

import { prisma } from "../db";
import { downloadImage, uploadImage, BUCKETS, getViewUrl } from "../s3";
import { validateImage } from "./validate";
import { moderateImage } from "./moderate";
import { assessQuality } from "./quality";
import { enhanceImage } from "./enhance";
import { generateProductShots, downloadGeneratedImage } from "./generate";

export async function processImageJob(jobId: string): Promise<void> {
  const job = await prisma.imageJob.findUnique({ where: { jobId } });
  if (!job) throw new Error(`Job not found: ${jobId}`);

  try {
    // ── Stage 1: Validation ───────────────────────────────────────
    await prisma.imageJob.update({
      where: { jobId },
      data: { status: "validating", currentStage: 1 },
    });

    const validation = await validateImage(job.originalS3Key);

    if (!validation.passed) {
      await prisma.imageJob.update({
        where: { jobId },
        data: {
          status: "rejected",
          validation: validation as any,
          rejectionReason: validation.reason,
          completedAt: new Date(),
        },
      });
      return;
    }

    // Duplicate check by hash
    if (validation.imageHash) {
      const dupe = await prisma.imageJob.findFirst({
        where: {
          imageHash: validation.imageHash,
          jobId: { not: jobId },
          status: "awaiting_brand_review",
        },
      });
      if (dupe) {
        await prisma.imageJob.update({
          where: { jobId },
          data: {
            status: "rejected",
            rejectionReason: "duplicate_image",
            validation: validation as any,
            completedAt: new Date(),
          },
        });
        return;
      }
    }

    await prisma.imageJob.update({
      where: { jobId },
      data: {
        validation: validation as any,
        imageHash: validation.imageHash,
        originalWidth: validation.width,
        originalHeight: validation.height,
      },
    });

    // ── Stage 2: Content Moderation ───────────────────────────────
    await prisma.imageJob.update({
      where: { jobId },
      data: { status: "moderating", currentStage: 2 },
    });

    const imageBuffer = await downloadImage(BUCKETS.staging, validation.sanitisedS3Key ?? job.originalS3Key);
    const moderation = await moderateImage(imageBuffer);

    if (moderation.status === "rejected") {
      await prisma.imageJob.update({
        where: { jobId },
        data: {
          status: "rejected",
          moderation: moderation as any,
          rejectionReason: "prohibited_content",
          completedAt: new Date(),
        },
      });
      return;
    }

    if (moderation.status === "flagged_for_review") {
      await prisma.imageJob.update({
        where: { jobId },
        data: { status: "flagged", moderation: moderation as any },
      });
      return; // Paused for admin review
    }

    await prisma.imageJob.update({
      where: { jobId },
      data: { moderation: moderation as any },
    });

    // ── Stage 3: Quality Assessment ───────────────────────────────
    await prisma.imageJob.update({
      where: { jobId },
      data: { status: "quality_checking", currentStage: 3 },
    });

    const quality = await assessQuality(imageBuffer);
    await prisma.imageJob.update({
      where: { jobId },
      data: { quality: quality as any },
    });

    // ── Stage 4: Enhance or Generate ──────────────────────────────
    const processedImages: Array<{
      shotType: string;
      source: string;
      s3Key: string;
      promptUsed?: string;
      enhancementSkipped?: boolean;
    }> = [];

    if (quality.route === "brand_review") {
      // Already good — pass original through
      const key = `processed/${jobId}/original.jpg`;
      await uploadImage(BUCKETS.processed, key, imageBuffer);
      processedImages.push({ shotType: "original", source: "original", s3Key: key });

    } else if (quality.route === "enhance") {
      await prisma.imageJob.update({
        where: { jobId },
        data: { status: "enhancing", currentStage: 4 },
      });

      const enhanced = await enhanceImage(imageBuffer, quality);

      if (enhanced.status === "enhanced" && enhanced.buffer) {
        const key = `processed/${jobId}/enhanced.jpg`;
        await uploadImage(BUCKETS.processed, key, enhanced.buffer);
        processedImages.push({
          shotType: "hero", source: "photoroom", s3Key: key, enhancementSkipped: false,
        });
      } else {
        // Enhancement failed — pass original with flag
        const key = `processed/${jobId}/original.jpg`;
        await uploadImage(BUCKETS.processed, key, imageBuffer);
        processedImages.push({
          shotType: "original", source: "original", s3Key: key, enhancementSkipped: true,
        });
      }

    } else if (quality.route === "generate") {
      await prisma.imageJob.update({
        where: { jobId },
        data: { status: "generating", currentStage: 4 },
      });

      const shots = await generateProductShots(imageBuffer);

      for (const [shotKey, shot] of Object.entries(shots)) {
        if (shot) {
          const buffer = await downloadGeneratedImage(shot.url);
          const key = `processed/${jobId}/${shotKey}.jpg`;
          await uploadImage(BUCKETS.processed, key, buffer);
          processedImages.push({
            shotType: shot.shotType, source: "openai", s3Key: key, promptUsed: shot.promptUsed,
          });
        }
      }
    }

    // ── Stage 5: Store processed images & await brand review ──────
    for (const img of processedImages) {
      const publicUrl = await getViewUrl(BUCKETS.processed, img.s3Key);
      await prisma.processedImage.create({
        data: {
          jobId,
          shotType: img.shotType,
          source: img.source,
          s3Key: img.s3Key,
          publicUrl,
          promptUsed: img.promptUsed,
          enhancementSkipped: img.enhancementSkipped ?? false,
        },
      });
    }

    await prisma.imageJob.update({
      where: { jobId },
      data: { status: "awaiting_brand_review", currentStage: 5 },
    });

    // Update batch progress if part of a batch
    if (job.batchId) {
      await prisma.batchJob.update({
        where: { batchId: job.batchId },
        data: { completed: { increment: 1 } },
      });
    }

  } catch (error) {
    const message = (error as Error).message;
    await prisma.imageJob.update({
      where: { jobId },
      data: { status: "paused", pausedReason: message },
    });

    if (job.batchId) {
      await prisma.batchJob.update({
        where: { batchId: job.batchId },
        data: { failed: { increment: 1 } },
      });
    }

    throw error;
  }
}
