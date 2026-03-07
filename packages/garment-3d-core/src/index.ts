// Core viewer
export { GarmentViewer } from "./viewer/GarmentViewer";
export { SceneManager } from "./viewer/SceneManager";
export { CameraController } from "./viewer/CameraController";
export { LightingRig } from "./viewer/LightingRig";

// Materials
export { FabricMaterial } from "./materials/FabricMaterial";
export { FabricPresets } from "./materials/FabricPresets";
export { TextureProcessor } from "./materials/TextureProcessor";
export { UVMapper } from "./materials/UVMapper";

// Loader
export { GLBModelLoader } from "./loader/GLBLoader";
export { MeshProcessor } from "./loader/MeshProcessor";

// Export
export { ScreenshotExporter } from "./export/ScreenshotExporter";
export { GLBExporter } from "./export/GLBExporter";

// Re-export types
export type {
  FabricDescriptor,
  ViewerOptions,
  ScreenshotOptions,
  CameraPreset,
  FabricPresetType,
} from "@garment-3d/shared";
