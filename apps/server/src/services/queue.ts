import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

export function getRedisConnection() {
  return {
    ...parseRedisUrl(REDIS_URL),
    maxRetriesPerRequest: null,
  };
}

let queue: Queue | null = null;

export function getGenerationQueue(): Queue {
  if (!queue) {
    queue = new Queue("3d-generation", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}
