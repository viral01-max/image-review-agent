import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getViewUrl, BUCKETS } from "@/lib/s3";

export async function GET(
  _request: NextRequest,
  { params }: { params: { listingId: string } }
) {
  try {
    const jobs = await prisma.imageJob.findMany({
      where: {
        listingId: params.listingId,
        status: "approved",
      },
      include: {
        processedImages: {
          where: { brandDecision: "approved" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const images = await Promise.all(
      jobs.flatMap((job) =>
        job.processedImages.map(async (img) => ({
          job_id: job.jobId,
          processed_image_id: img.processedImageId,
          shot_type: img.shotType,
          source: img.source,
          s3_key: img.s3Key,
          public_url: job.approvedImageKey
            ? await getViewUrl(BUCKETS.approved, job.approvedImageKey).catch(() => null)
            : null,
          approved_at: img.brandDecisionAt,
        }))
      )
    );

    return NextResponse.json({
      listing_id: params.listingId,
      total: images.length,
      images,
    });
  } catch (error) {
    console.error("Listing images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
