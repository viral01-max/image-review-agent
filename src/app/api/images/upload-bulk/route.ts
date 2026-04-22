import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUploadUrl } from "@/lib/s3";
import { enqueueBatchJobs } from "@/lib/queue";
import { z } from "zod";

const bulkSchema = z.object({
  listing_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  files: z
    .array(
      z.object({
        filename: z.string().min(1),
        size_bytes: z.number().int().positive(),
        mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = bulkSchema.parse(body);

    const batch = await prisma.batchJob.create({
      data: {
        brandId: data.brand_id,
        listingId: data.listing_id,
        totalImages: data.files.length,
        status: "processing",
      },
    });

    const uploads = await Promise.all(
      data.files.map(async (file) => {
        const job = await prisma.imageJob.create({
          data: {
            batchId: batch.batchId,
            brandId: data.brand_id,
            listingId: data.listing_id,
            originalFilename: file.filename,
            originalSizeBytes: file.size_bytes,
            originalMimeType: file.mime_type,
            originalS3Key: "",
            status: "pending",
            currentStage: 0,
          },
        });

        const s3Key = `uploads/${job.jobId}/${file.filename}`;
        const uploadUrl = await getUploadUrl(job.jobId, file.filename, file.mime_type);

        await prisma.imageJob.update({
          where: { jobId: job.jobId },
          data: { originalS3Key: s3Key },
        });

        return { job_id: job.jobId, filename: file.filename, upload_url: uploadUrl, s3_key: s3Key };
      })
    );

    await enqueueBatchJobs(uploads.map((u) => u.job_id));

    return NextResponse.json({
      batch_id: batch.batchId,
      total_images: data.files.length,
      uploads,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("Bulk upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
