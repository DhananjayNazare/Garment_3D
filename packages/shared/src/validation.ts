import { z } from "zod";

/** Validate image upload request */
export const uploadSchema = z.object({
  filename: z.string().min(1),
  mimetype: z
    .string()
    .refine((val) => ["image/jpeg", "image/png", "image/webp"].includes(val), {
      message: "Only JPEG, PNG, and WebP images are accepted",
    }),
  size: z.number().max(10 * 1024 * 1024, "Image must be under 10MB"),
});

/** Validate generation request */
export const generateRequestSchema = z.object({
  imageId: z.string().uuid(),
  provider: z.enum(["hunyuan"]).default("hunyuan"),
});

/** Validate fabric descriptor */
export const fabricDescriptorSchema = z.object({
  diffuse: z.string().min(1),
  normalMap: z.string().optional(),
  roughnessMap: z.string().optional(),
  preset: z
    .enum([
      "cotton",
      "silk",
      "denim",
      "linen",
      "velvet",
      "wool",
      "satin",
      "custom",
    ])
    .optional(),
  scale: z.number().min(0.1).max(20).optional(),
  rotation: z
    .number()
    .min(0)
    .max(Math.PI * 2)
    .optional(),
  sheen: z.number().min(0).max(1).optional(),
  sheenRoughness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  normalStrength: z.number().min(0).max(2).optional(),
  anisotropy: z.number().min(0).max(1).optional(),
});

export type UploadInput = z.infer<typeof uploadSchema>;
export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;
export type FabricDescriptorInput = z.infer<typeof fabricDescriptorSchema>;
