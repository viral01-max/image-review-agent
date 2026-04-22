/**
 * Image Processing Worker
 *
 * Run separately from the web server:
 *   npm run worker       (production)
 *   npm run worker:dev   (development with hot-reload)
 *
 * Deployment: Railway worker process
 */

import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processImageJob } from "../lib/stages/pipeline";

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

const worker = new Worker(
  "image-processing",
  async (job) => {
    const { jobId } = job.data;
    console.log(`[Worker] Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

    await processImageJob(jobId);

    console.log(`[Worker] Completed job ${jobId}`);
  },
  {
    connection,
    concurrency: 10,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} finished successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Queue error:", err);
});

console.log("[Worker] Image processing worker started. Waiting for jobs...");

// Graceful shutdown
async function shutdown() {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
