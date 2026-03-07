import { FastifyPluginAsync } from "fastify";
import { resolve } from "path";
import { readFile } from "fs/promises";
import { createConnection } from "net";
import { getGenerationQueue, getRedisConnection } from "../services/queue.js";
import { HunyuanService } from "../services/hunyuan.js";
import { Worker, Job, Queue } from "bullmq";

const UPLOADS_DIR = resolve(process.cwd(), "uploads");
const MODELS_DIR = resolve(process.cwd(), "models");

// Track job statuses in-memory (Redis pubsub for production)
const jobStatuses = new Map<
  string,
  {
    status: string;
    progress: number;
    modelUrl?: string;
    error?: string;
  }
>();

/** Check if a TCP port is reachable (2s timeout) */
function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 2000 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export const generateRoutes: FastifyPluginAsync = async (fastify) => {
  let queue: Queue | null = null;
  let worker: Worker | null = null;
  let redisAvailable = false;

  // Check Redis availability before creating BullMQ objects
  const redisConfig = getRedisConnection();
  const isReachable = await checkPort(
    redisConfig.host ?? "localhost",
    redisConfig.port ?? 6379,
  );

  if (isReachable) {
    const hunyuan = new HunyuanService();
    queue = getGenerationQueue();

    worker = new Worker(
      "3d-generation",
      async (job: Job) => {
        const { imageId, imagePath } = job.data;
        const jobId = job.id!;

        try {
          jobStatuses.set(jobId, { status: "processing", progress: 10 });

          const imageBuffer = await readFile(imagePath);
          jobStatuses.set(jobId, { status: "processing", progress: 20 });

          const taskId = await hunyuan.submit(imageBuffer, `${imageId}.png`);
          jobStatuses.set(jobId, { status: "processing", progress: 30 });

          let status = await hunyuan.getStatus(taskId);
          while (
            status.status === "pending" ||
            status.status === "processing"
          ) {
            await new Promise((r) => setTimeout(r, 3000));
            status = await hunyuan.getStatus(taskId);
            const progress = Math.min(30 + status.progress * 0.6, 90);
            jobStatuses.set(jobId, { status: "processing", progress });
          }

          if (status.status === "failed") {
            throw new Error(status.error ?? "Generation failed");
          }

          const outputDir = resolve(MODELS_DIR, jobId);
          await hunyuan.downloadResult(taskId, outputDir);

          jobStatuses.set(jobId, {
            status: "completed",
            progress: 100,
            modelUrl: `/models/${jobId}/model.glb`,
          });

          return { modelUrl: `/models/${jobId}/model.glb` };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          jobStatuses.set(jobId, {
            status: "failed",
            progress: 0,
            error: message,
          });
          throw error;
        }
      },
      { connection: getRedisConnection(), concurrency: 1 },
    );

    worker.on("failed", (job, err) => {
      fastify.log.error({ jobId: job?.id, err }, "Generation job failed");
    });

    redisAvailable = true;
    fastify.log.info("Redis connected — generation pipeline ready");
  } else {
    fastify.log.warn(
      "Redis not reachable at %s:%d — generation routes will return 503. Start Redis to enable 3D generation.",
      redisConfig.host ?? "localhost",
      redisConfig.port ?? 6379,
    );
  }

  // Cleanup on server close
  fastify.addHook("onClose", async () => {
    await worker?.close();
    await queue?.close();
  });

  // POST /api/generate - Start a new generation job
  fastify.post("/generate", async (request, reply) => {
    if (!redisAvailable || !queue) {
      return reply.status(503).send({
        error:
          "Generation service unavailable. Redis is not running. Start Redis with: docker compose up -d redis",
      });
    }

    const body = request.body as { imageId: string };

    if (!body.imageId) {
      return reply.status(400).send({ error: "imageId is required" });
    }

    // Find the image file
    const imageId = body.imageId;
    const uploadsDir = UPLOADS_DIR;
    const { existsSync } = await import("fs");
    const extensions = ["jpg", "png", "webp"];
    let imagePath = "";

    for (const ext of extensions) {
      const candidate = resolve(uploadsDir, `${imageId}.${ext}`);
      if (existsSync(candidate)) {
        imagePath = candidate;
        break;
      }
    }

    if (!imagePath) {
      return reply.status(404).send({ error: "Image not found" });
    }

    // Enqueue the job
    const job = await queue.add("generate-3d", {
      imageId,
      imagePath,
    });

    jobStatuses.set(job.id!, { status: "pending", progress: 0 });

    return {
      jobId: job.id,
      status: "pending",
    };
  });

  // GET /api/generate/:jobId - Get job status
  fastify.get<{ Params: { jobId: string } }>(
    "/generate/:jobId",
    async (request, reply) => {
      const { jobId } = request.params;
      const status = jobStatuses.get(jobId);

      if (!status) {
        return reply.status(404).send({ error: "Job not found" });
      }

      return {
        jobId,
        ...status,
      };
    },
  );

  // GET /api/generate/:jobId/sse - Server-Sent Events for real-time status
  fastify.get<{ Params: { jobId: string } }>(
    "/generate/:jobId/sse",
    async (request, reply) => {
      const { jobId } = request.params;

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const send = (data: Record<string, unknown>) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const interval = setInterval(() => {
        const status = jobStatuses.get(jobId);
        if (!status) {
          send({ status: "not_found" });
          clearInterval(interval);
          reply.raw.end();
          return;
        }

        send({ jobId, ...status });

        if (status.status === "completed" || status.status === "failed") {
          clearInterval(interval);
          reply.raw.end();
        }
      }, 1000);

      request.raw.on("close", () => {
        clearInterval(interval);
      });
    },
  );
};
