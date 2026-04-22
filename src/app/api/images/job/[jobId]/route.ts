import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getViewUrl, BUCKETS } from "@/lib/s3";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const job = await prisma.imageJob.findUnique({
      where: { jobId: params.jobId },
      include: { processedImages: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Generate fresh signed URLs for all images
    const originalPreviewUrl = job.originalS3Key
      ? await getViewUrl(BUCKETS.staging, job.originalS3Key).catch(() => null)
      : null;

    const processedImagesWithUrls = await Promise.all(
      job.processedImages.map(async (img) => ({
        processed_image_id: img.processedImageId,
        shot_type: img.shotType,
        source: img.source,
        public_url: await getViewUrl(BUCKETS.processed, img.s3Key).catch(() => img.publicUrl),
        prompt_used: img.promptUsed,
        enhancement_skipped: img.enhancementSkipped,
        brand_decision: img.brandDecision,
        brand_decision_at: img.brandDecisionAt,
        brand_rejection_reason: img.brandRejectionReason,
        created_at: img.createdAt,
      }))
    );

    return NextResponse.json({
      job_id: job.jobId,
      batch_id: job.batchId,
      brand_id: job.brandId,
      listing_id: job.listingId,
      status: job.status,
      current_stage: job.currentStage,
      paused_reason: job.pausedReason,
      original: {
        filename: job.originalFilename,
        size_bytes: job.originalSizeBytes,
        mime_type: job.originalMimeType,
        width: job.originalWidth,
        height: job.originalHeight,
        preview_url: originalPreviewUrl,
      },
      validation: job.validation,
      moderation: job.moderation,
      quality: job.quality,
      processed_images: processedImagesWithUrls,
      rejection_reason: job.rejectionReason,
      approved_image_key: job.approvedImageKey,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      completed_at: job.completedAt,
    });
  } catch (error) {
    console.error("Get job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
