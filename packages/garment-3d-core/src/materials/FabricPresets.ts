import type { FabricPresetType } from "@garment-3d/shared";

export interface FabricPresetConfig {
  sheen: number;
  sheenRoughness: number;
  sheenColor: string;
  roughness: number;
  metalness: number;
  anisotropy: number;
  normalScale: number;
  textureRepeat: number;
}

/** Default PBR presets for common fabric types */
export const FabricPresets: Record<FabricPresetType, FabricPresetConfig> = {
  cotton: {
    sheen: 0.2,
    sheenRoughness: 0.8,
    sheenColor: "#ffffff",
    roughness: 0.9,
    metalness: 0,
    anisotropy: 0.1,
    normalScale: 0.6,
    textureRepeat: 4,
  },
  silk: {
    sheen: 1.0,
    sheenRoughness: 0.2,
    sheenColor: "#ffe8d0",
    roughness: 0.3,
    metalness: 0,
    anisotropy: 0.7,
    normalScale: 0.2,
    textureRepeat: 6,
  },
  denim: {
    sheen: 0.15,
    sheenRoughness: 0.9,
    sheenColor: "#c0c8d8",
    roughness: 0.95,
    metalness: 0,
    anisotropy: 0.3,
    normalScale: 1.0,
    textureRepeat: 8,
  },
  linen: {
    sheen: 0.25,
    sheenRoughness: 0.7,
    sheenColor: "#f5f0e8",
    roughness: 0.85,
    metalness: 0,
    anisotropy: 0.2,
    normalScale: 0.8,
    textureRepeat: 5,
  },
  velvet: {
    sheen: 1.0,
    sheenRoughness: 0.5,
    sheenColor: "#ffffff",
    roughness: 0.7,
    metalness: 0,
    anisotropy: 0.0,
    normalScale: 0.4,
    textureRepeat: 3,
  },
  wool: {
    sheen: 0.3,
    sheenRoughness: 0.6,
    sheenColor: "#f0ece4",
    roughness: 0.92,
    metalness: 0,
    anisotropy: 0.15,
    normalScale: 0.9,
    textureRepeat: 4,
  },
  satin: {
    sheen: 0.9,
    sheenRoughness: 0.15,
    sheenColor: "#ffffff",
    roughness: 0.25,
    metalness: 0.05,
    anisotropy: 0.8,
    normalScale: 0.15,
    textureRepeat: 5,
  },
  custom: {
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: "#ffffff",
    roughness: 0.7,
    metalness: 0,
    anisotropy: 0.2,
    normalScale: 0.5,
    textureRepeat: 4,
  },
};
