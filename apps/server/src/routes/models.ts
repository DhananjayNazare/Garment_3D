import { FastifyPluginAsync } from "fastify";
import { resolve } from "path";
import { readdir, stat } from "fs/promises";

const MODELS_DIR = resolve(process.cwd(), "models");

export const modelRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/models - List all generated models
  fastify.get("/models", async (_request, _reply) => {
    try {
      const entries = await readdir(MODELS_DIR, { withFileTypes: true });
      const models = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modelPath = resolve(MODELS_DIR, entry.name, "model.glb");
          try {
            const stats = await stat(modelPath);
            models.push({
              id: entry.name,
              url: `/models/${entry.name}/model.glb`,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
            });
          } catch {
            // Skip directories without model.glb
          }
        }
      }

      return { models };
    } catch {
      return { models: [] };
    }
  });

  // DELETE /api/models/:id - Delete a generated model
  fastify.delete<{ Params: { id: string } }>(
    "/models/:id",
    async (request, reply) => {
      const { id } = request.params;
      const modelDir = resolve(MODELS_DIR, id);

      try {
        const { rm } = await import("fs/promises");
        await rm(modelDir, { recursive: true, force: true });
        return { success: true };
      } catch {
        return reply.status(500).send({ error: "Failed to delete model" });
      }
    },
  );
};
