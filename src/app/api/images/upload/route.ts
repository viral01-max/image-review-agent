import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUploadUrl, BUCKETS } from "@/lib/s3";
import { enqueueImageJob } from "@/lib/queue";
import { z } from "zod";

const uploadSchema = z.object({
  listing_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  filename: z.string().min(1),
  size_bytes: z.number().int().positive(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = uploadSchema.parse(body);

    // Create job record
    const job = await prisma.imageJob.create({
      data: {
        brandId: data.brand_id,
        listingId: data.listing_id,
        originalFilename: data.filename,
        originalSizeBytes: data.size_bytes,
        originalMimeType: data.mime_type,
        originalS3Key: "", // Will be set after upload
        status: "pending",
        currentStage: 0,
      },
    });

    // Generate the S3 key and pre-signed upload URL
    const s3Key = `uploads/${job.jobId}/${data.filename}`;
    const uploadUrl = await getUploadUrl(job.jobId, data.filename, data.mime_type);

    // Update job with the S3 key
    await prisma.imageJob.update({
      where: { jobId: job.jobId },
      data: { originalS3Key: s3Key },
    });

    // Enqueue for processing (worker picks it up after upload completes)
    // In production, you'd use an S3 event notification to trigger this
    // For now, the client calls a "confirm upload" endpoint
    await enqueueImageJob(job.jobId);

    return NextResponse.json({
      job_id: job.jobId,
      upload_url: uploadUrl,
      s3_key: s3Key,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
