import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { copyImage, deleteImage, BUCKETS } from "@/lib/s3";
import { z } from "zod";

const decideSchema = z.object({
  processed_image_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejection_reason: z
    .enum(["wrong_product", "poor_quality", "not_what_i_wanted", "other"])
    .optional(),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const body = await request.json();
    const data = decideSchema.parse(body);

    // Verify the processed image belongs to this job
    const processedImage = await prisma.processedImage.findUnique({
      where: { processedImageId: data.processed_image_id },
    });

    if (!processedImage || processedImage.jobId !== params.jobId) {
      return NextResponse.json(
        { error: "Processed image not found for this job" },
        { status: 404 }
      );
    }

    if (data.decision === "approved") {
      // Copy to approved bucket
      const approvedKey = `approved/${params.jobId}/${processedImage.shotType}.jpg`;
      await copyImage(
        BUCKETS.processed,
        processedImage.s3Key,
        BUCKETS.approved,
        approvedKey
      );

      await prisma.processedImage.update({
        where: { processedImageId: data.processed_image_id },
        data: {
          brandDecision: "approved",
          brandDecisionAt: new Date(),
        },
      });

      // Update job with approved image
      await prisma.imageJob.update({
        where: { jobId: params.jobId },
        data: {
          approvedImageKey: approvedKey,
          status: "approved",
          completedAt: new Date(),
        },
      });
    } else {
      // Rejected — delete processed image
      await deleteImage(BUCKETS.processed, processedImage.s3Key);

      await prisma.processedImage.update({
        where: { processedImageId: data.processed_image_id },
        data: {
          brandDecision: "rejected",
          brandDecisionAt: new Date(),
          brandRejectionReason: data.rejection_reason,
        },
      });

      // Check if all processed images for this job are rejected
      const remaining = await prisma.processedImage.count({
        where: {
          jobId: params.jobId,
          brandDecision: null,
        },
      });

      if (remaining === 0) {
        await prisma.imageJob.update({
          where: { jobId: params.jobId },
          data: {
            status: "pending_resubmission",
            rejectionReason: data.rejection_reason ?? "other",
            brandRejectionNote: data.note,
          },
        });
      }
    }

    return NextResponse.json({ success: true, decision: data.decision });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Decide error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
