import { Queue } from "bullmq";
import IORedis from "ioredis";

let _connection: IORedis | null = null;
let _queue: Queue | null = null;

function getConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return _connection;
}

function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue("image-processing", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _queue;
}

export async function enqueueImageJob(jobId: string) {
  await getQueue().add("process-image", { jobId }, { jobId });
}

export async function enqueueBatchJobs(jobIds: string[]) {
  const jobs = jobIds.map((id) => ({
    name: "process-image",
    data: { jobId: id },
    opts: { jobId: id },
  }));
  await getQueue().addBulk(jobs);
}

export { getConnection as redisConnection };
