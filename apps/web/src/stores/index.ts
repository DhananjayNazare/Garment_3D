import { create } from "zustand";
import type * as THREE from "three";
import type {
  GenerationStatus,
  FabricDescriptor,
  FabricPresetType,
} from "@garment-3d/shared";

interface ProjectState {
  // Image upload
  uploadedImageId: string | null;
  uploadedImageUrl: string | null;

  // Generation
  jobId: string | null;
  generationStatus: GenerationStatus | null;
  generationProgress: number;
  modelUrl: string | null;
  generationError: string | null;

  // Actions
  setUploadedImage: (imageId: string, url: string) => void;
  setGenerationJob: (jobId: string) => void;
  updateGenerationStatus: (
    status: GenerationStatus,
    progress: number,
    modelUrl?: string,
    error?: string,
  ) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  uploadedImageId: null,
  uploadedImageUrl: null,
  jobId: null,
  generationStatus: null,
  generationProgress: 0,
  modelUrl: null,
  generationError: null,

  setUploadedImage: (imageId, url) =>
    set({
      uploadedImageId: imageId,
      uploadedImageUrl: url,
      generationStatus: null,
      generationProgress: 0,
      modelUrl: null,
      generationError: null,
    }),

  setGenerationJob: (jobId) =>
    set({
      jobId,
      generationStatus: "pending",
      generationProgress: 0,
    }),

  updateGenerationStatus: (status, progress, modelUrl, error) =>
    set({
      generationStatus: status,
      generationProgress: progress,
      modelUrl: modelUrl ?? null,
      generationError: error ?? null,
    }),

  reset: () =>
    set({
      uploadedImageId: null,
      uploadedImageUrl: null,
      jobId: null,
      generationStatus: null,
      generationProgress: 0,
      modelUrl: null,
      generationError: null,
    }),
}));

/** Preset default slider values (mirrors FabricPresets in core library) */
const PRESET_DEFAULTS: Record<
  FabricPresetType,
  {
    sheen: number;
    sheenRoughness: number;
    roughness: number;
    normalStrength: number;
    anisotropy: number;
    textureScale: number;
  }
> = {
  cotton: {
    sheen: 0.2,
    sheenRoughness: 0.8,
    roughness: 0.9,
    normalStrength: 0.6,
    anisotropy: 0.1,
    textureScale: 4,
  },
  silk: {
    sheen: 1.0,
    sheenRoughness: 0.2,
    roughness: 0.3,
    normalStrength: 0.2,
    anisotropy: 0.7,
    textureScale: 6,
  },
  denim: {
    sheen: 0.15,
    sheenRoughness: 0.9,
    roughness: 0.95,
    normalStrength: 1.0,
    anisotropy: 0.3,
    textureScale: 8,
  },
  linen: {
    sheen: 0.25,
    sheenRoughness: 0.7,
    roughness: 0.85,
    normalStrength: 0.8,
    anisotropy: 0.2,
    textureScale: 5,
  },
  velvet: {
    sheen: 1.0,
    sheenRoughness: 0.5,
    roughness: 0.7,
    normalStrength: 0.4,
    anisotropy: 0.0,
    textureScale: 3,
  },
  wool: {
    sheen: 0.3,
    sheenRoughness: 0.6,
    roughness: 0.92,
    normalStrength: 0.9,
    anisotropy: 0.15,
    textureScale: 4,
  },
  satin: {
    sheen: 0.9,
    sheenRoughness: 0.15,
    roughness: 0.25,
    normalStrength: 0.15,
    anisotropy: 0.8,
    textureScale: 5,
  },
  custom: {
    sheen: 0.3,
    sheenRoughness: 0.5,
    roughness: 0.7,
    normalStrength: 0.5,
    anisotropy: 0.2,
    textureScale: 4,
  },
};

interface FabricState {
  currentFabric: FabricDescriptor | null;
  presetType: FabricPresetType;
  /** Incremented each time a fabric is applied to trigger viewport updates */
  fabricVersion: number;
  /** URL of uploaded custom fabric image */
  fabricImageUrl: string | null;

  // Real-time adjustments
  sheen: number;
  sheenRoughness: number;
  roughness: number;
  normalStrength: number;
  anisotropy: number;
  textureScale: number;
  textureRotation: number;

  // Actions
  setPresetType: (preset: FabricPresetType) => void;
  setFabricImageUrl: (url: string | null) => void;
  applyFabric: () => void;
  updateParameter: (key: string, value: number) => void;
  reset: () => void;

  // Async apply state (set by GarmentViewport during fabric apply)
  isFabricApplying: boolean;
  fabricApplyError: string | null;
  setFabricApplyState: (applying: boolean, error: string | null) => void;
}

export const useFabricStore = create<FabricState>((set, get) => ({
  currentFabric: null,
  presetType: "cotton",
  fabricVersion: 0,
  fabricImageUrl: null,
  sheen: 0.2,
  sheenRoughness: 0.8,
  roughness: 0.9,
  normalStrength: 0.6,
  anisotropy: 0.1,
  textureScale: 4,
  textureRotation: 0,
  isFabricApplying: false,
  fabricApplyError: null,

  setPresetType: (preset) => {
    const defaults = PRESET_DEFAULTS[preset];
    set({
      presetType: preset,
      ...defaults,
      textureRotation: 0,
    });
  },

  setFabricImageUrl: (url) => set({ fabricImageUrl: url }),

  applyFabric: () => {
    const state = get();
    const fabric: FabricDescriptor = {
      diffuse: state.fabricImageUrl ?? "",
      preset: state.presetType,
      scale: state.textureScale,
      rotation: state.textureRotation,
      sheen: state.sheen,
      sheenRoughness: state.sheenRoughness,
      roughness: state.roughness,
      normalStrength: state.normalStrength,
      anisotropy: state.anisotropy,
    };
    set({
      currentFabric: fabric,
      fabricVersion: state.fabricVersion + 1,
    });
  },

  updateParameter: (key, value) => set({ [key]: value }),

  setFabricApplyState: (applying, error) =>
    set({ isFabricApplying: applying, fabricApplyError: error }),

  reset: () =>
    set({
      currentFabric: null,
      presetType: "cotton",
      fabricVersion: 0,
      fabricImageUrl: null,
      sheen: 0.2,
      sheenRoughness: 0.8,
      roughness: 0.9,
      normalStrength: 0.6,
      anisotropy: 0.1,
      textureScale: 4,
      textureRotation: 0,
      isFabricApplying: false,
      fabricApplyError: null,
    }),
}));

/** Exposes Three.js objects from the R3F Canvas so components outside can use them */
export interface ViewportState {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  setViewportRefs: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  renderer: null,
  scene: null,
  camera: null,
  setViewportRefs: (renderer, scene, camera) =>
    set({ renderer, scene, camera }),
}));
