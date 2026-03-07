/** Status of a 3D model generation job */
export type GenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** Supported 3D generation providers */
export type GenerationProvider = "hunyuan";

/** Request to generate a 3D model from an image */
export interface GenerationRequest {
  imageId: string;
  provider?: GenerationProvider;
}

/** Response from creating a generation job */
export interface GenerationJobResponse {
  jobId: string;
  status: GenerationStatus;
}

/** Full generation job details */
export interface GenerationJob {
  jobId: string;
  imageId: string;
  provider: GenerationProvider;
  status: GenerationStatus;
  progress: number;
  modelUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** Upload response */
export interface UploadResponse {
  imageId: string;
  url: string;
  width: number;
  height: number;
}

/** Fabric preset types */
export type FabricPresetType =
  | "cotton"
  | "silk"
  | "denim"
  | "linen"
  | "velvet"
  | "wool"
  | "satin"
  | "custom";

/** Fabric material descriptor for the core library */
export interface FabricDescriptor {
  /** URL or data URI for the diffuse/color texture */
  diffuse: string;
  /** Optional URL for a normal map (auto-generated if not provided) */
  normalMap?: string;
  /** Optional URL for a roughness map (auto-generated if not provided) */
  roughnessMap?: string;
  /** Fabric preset to apply default material properties */
  preset?: FabricPresetType;
  /** Texture repeat scale (default: 1) */
  scale?: number;
  /** Texture rotation in radians (default: 0) */
  rotation?: number;
  /** Override sheen intensity (0-1) */
  sheen?: number;
  /** Override sheen roughness (0-1) */
  sheenRoughness?: number;
  /** Override base roughness (0-1) */
  roughness?: number;
  /** Override normal map strength (0-2) */
  normalStrength?: number;
  /** Override anisotropy (0-1) */
  anisotropy?: number;
}

/** Viewer configuration options */
export interface ViewerOptions {
  /** Enable anti-aliasing (default: true) */
  antialias?: boolean;
  /** Background color hex string (default: '#f5f5f5') */
  backgroundColor?: string;
  /** Enable shadow mapping (default: true) */
  shadows?: boolean;
  /** Pixel ratio limit (default: 2) */
  maxPixelRatio?: number;
  /** Enable tone mapping (default: true) */
  toneMapping?: boolean;
}

/** Screenshot export options */
export interface ScreenshotOptions {
  width?: number;
  height?: number;
  transparent?: boolean;
  format?: "png" | "jpeg" | "webp";
  quality?: number;
}

/** Camera preset positions */
export type CameraPreset =
  | "front"
  | "back"
  | "left"
  | "right"
  | "three-quarter"
  | "top";
