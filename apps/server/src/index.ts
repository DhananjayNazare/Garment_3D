import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { uploadRoutes } from "./routes/upload.js";
import { generateRoutes } from "./routes/generate.js";
import { modelRoutes } from "./routes/models.js";

const server = Fastify({
  logger: true,
  bodyLimit: 15 * 1024 * 1024, // 15MB
});

async function start() {
  // Register plugins
  await server.register(cors, {
    origin: ["http://localhost:5173"], // Vite dev server
    methods: ["GET", "POST", "DELETE"],
  });

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  });

  // Ensure directories exist
  const uploadsDir = resolve(process.cwd(), "uploads");
  const modelsDir = resolve(process.cwd(), "models");
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });

  // Serve uploaded files and generated models
  await server.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  await server.register(fastifyStatic, {
    root: modelsDir,
    prefix: "/models/",
    decorateReply: false,
  });

  // Register routes
  await server.register(uploadRoutes, { prefix: "/api" });
  await server.register(generateRoutes, { prefix: "/api" });
  await server.register(modelRoutes, { prefix: "/api" });

  // Health check
  server.get("/api/health", async () => ({ status: "ok" }));

  // Start server
  const port = parseInt(process.env.PORT ?? "3001", 10);
  await server.listen({ port, host: "0.0.0.0" });
  console.log(`Server running at http://localhost:${port}`);
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
