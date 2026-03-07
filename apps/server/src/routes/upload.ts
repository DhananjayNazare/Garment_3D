import { FastifyPluginAsync } from "fastify";
import { resolve } from "path";
import { mkdir, writeFile } from "fs/promises";
import { v4 as uuid } from "uuid";

const UPLOADS_DIR = resolve(process.cwd(), "uploads");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure uploads directory exists
  await mkdir(UPLOADS_DIR, { recursive: true });

  fastify.post("/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({
        error: "Invalid file type. Only JPEG, PNG, and WebP are accepted.",
      });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.status(400).send({ error: "File too large. Maximum 10MB." });
    }

    const ext =
      data.mimetype.split("/")[1] === "jpeg"
        ? "jpg"
        : data.mimetype.split("/")[1];
    const imageId = uuid();
    const filename = `${imageId}.${ext}`;
    const filepath = resolve(UPLOADS_DIR, filename);

    await writeFile(filepath, buffer);

    return {
      imageId,
      url: `/uploads/${filename}`,
      filename: data.filename,
      size: buffer.length,
    };
  });
};
