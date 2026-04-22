import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batch = await prisma.batchJob.findUnique({
      where: { batchId: params.batchId },
      include: {
        jobs: {
          select: {
            jobId: true,
            status: true,
            currentStage: true,
            originalFilename: true,
            rejectionReason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Check if batch is done
    const allDone = batch.jobs.every((j) =>
      ["approved", "rejected", "pending_resubmission", "awaiting_brand_review"].includes(j.status)
    );
    if (allDone && batch.status === "processing") {
      const hasFailures = batch.failed > 0;
      await prisma.batchJob.update({
        where: { batchId: params.batchId },
        data: {
          status: hasFailures ? "partial_failure" : "completed",
        },
      });
    }

    return NextResponse.json({
      batch_id: batch.batchId,
      brand_id: batch.brandId,
      listing_id: batch.listingId,
      total_images: batch.totalImages,
      completed: batch.completed,
      failed: batch.failed,
      status: batch.status,
      jobs: batch.jobs.map((j) => ({
        job_id: j.jobId,
        status: j.status,
        current_stage: j.currentStage,
        filename: j.originalFilename,
        rejection_reason: j.rejectionReason,
      })),
      created_at: batch.createdAt,
    });
  } catch (error) {
    console.error("Batch status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
