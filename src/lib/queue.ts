import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const imageQueue = new Queue("image-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/** Add a single image job to the queue */
export async function enqueueImageJob(jobId: string) {
  await imageQueue.add("process-image", { jobId }, { jobId });
}

/** Add multiple image jobs for a batch upload */
export async function enqueueBatchJobs(jobIds: string[]) {
  const jobs = jobIds.map((id) => ({
    name: "process-image",
    data: { jobId: id },
    opts: { jobId: id },
  }));
  await imageQueue.addBulk(jobs);
}

export { connection as redisConnection };
