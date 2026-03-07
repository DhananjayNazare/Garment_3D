import * as THREE from "three";
import type {
  FabricDescriptor,
  ViewerOptions,
  ScreenshotOptions,
  CameraPreset,
} from "@garment-3d/shared";
import { SceneManager } from "./SceneManager";
import { CameraController } from "./CameraController";
import { LightingRig } from "./LightingRig";
import { GLBModelLoader } from "../loader/GLBLoader";
import { MeshProcessor } from "../loader/MeshProcessor";
import { FabricMaterial } from "../materials/FabricMaterial";
import { UVMapper } from "../materials/UVMapper";
import { ScreenshotExporter } from "../export/ScreenshotExporter";

/**
 * Main entry point for the Garment 3D library.
 * Provides a high-level API for loading garment models, replacing fabrics,
 * and exporting results.
 *
 * @example
 * ```typescript
 * const viewer = new GarmentViewer(document.getElementById('canvas'));
 * await viewer.loadModel('/path/to/garment.glb');
 * await viewer.setFabric({ diffuse: '/path/to/silk.jpg', preset: 'silk' });
 * ```
 */
export class GarmentViewer {
  private sceneManager: SceneManager;
  private cameraController: CameraController;
  private lightingRig: LightingRig;
  private modelLoader: GLBModelLoader;
  private fabricMaterial: FabricMaterial;

  private currentModel: THREE.Group | null = null;
  private garmentMeshes: THREE.Mesh[] = [];

  constructor(container: HTMLElement, options?: ViewerOptions) {
    this.sceneManager = new SceneManager(container, {
      antialias: options?.antialias,
      backgroundColor: options?.backgroundColor,
      shadows: options?.shadows,
      maxPixelRatio: options?.maxPixelRatio,
      toneMapping: options?.toneMapping,
    });

    this.cameraController = new CameraController(
      this.sceneManager.renderer.domElement,
    );
    this.cameraController.onChange(() => this.sceneManager.requestRender());

    this.lightingRig = new LightingRig();
    this.sceneManager.scene.add(this.lightingRig.getGroup());

    this.modelLoader = new GLBModelLoader();
    this.fabricMaterial = new FabricMaterial();

    // Register damping update
    this.sceneManager.onRender(() => this.cameraController.update());

    // Start render loop
    this.sceneManager.startRenderLoop(this.cameraController.camera);
  }

  /**
   * Load a garment 3D model from a URL or ArrayBuffer.
   * Processes the mesh for PBR rendering and centers it in the viewport.
   */
  async loadModel(source: string | ArrayBuffer): Promise<void> {
    // Remove existing model
    if (this.currentModel) {
      this.sceneManager.scene.remove(this.currentModel);
      this.currentModel = null;
      this.garmentMeshes = [];
    }

    const result = await this.modelLoader.load(source);

    // Process meshes (compute normals, tangents, enable shadows)
    this.garmentMeshes = MeshProcessor.processScene(result.scene);

    // Ensure all meshes have UVs
    this.garmentMeshes.forEach((mesh) => {
      if (!UVMapper.hasValidUVs(mesh)) {
        UVMapper.applyTriplanarUVs(mesh);
      }
    });

    // Center the model
    MeshProcessor.centerScene(result.scene);

    this.currentModel = result.scene;
    this.sceneManager.scene.add(this.currentModel);

    // Frame camera to fit the model
    this.cameraController.frameObject(this.currentModel);
    this.sceneManager.requestRender();
  }

  /**
   * Replace the fabric/texture on the loaded garment model.
   * Accepts a fabric descriptor with diffuse texture and optional PBR maps.
   * Auto-generates normal and roughness maps if not provided.
   */
  async setFabric(descriptor: FabricDescriptor): Promise<void> {
    if (this.garmentMeshes.length === 0) {
      throw new Error("No model loaded. Call loadModel() first.");
    }

    const material = await this.fabricMaterial.createFromDescriptor(descriptor);

    // Apply material to all garment meshes
    this.garmentMeshes.forEach((mesh) => {
      mesh.material = material;
    });

    this.sceneManager.requestRender();
  }

  /**
   * Update a single fabric material property in real-time (for slider controls).
   */
  updateFabricProperty(property: string, value: number): void {
    this.fabricMaterial.updateProperty(property, value);
    this.sceneManager.requestRender();
  }

  /**
   * Set the camera to a preset position.
   */
  setCameraPreset(preset: CameraPreset): void {
    this.cameraController.setPreset(preset);
  }

  /**
   * Export the current view as a screenshot.
   */
  async exportScreenshot(options?: ScreenshotOptions): Promise<Blob> {
    return ScreenshotExporter.capture(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.cameraController.camera,
      options,
    );
  }

  /**
   * Get the Three.js scene for advanced usage.
   */
  getScene(): THREE.Scene {
    return this.sceneManager.scene;
  }

  /**
   * Get loaded garment meshes for direct manipulation.
   */
  getMeshes(): THREE.Mesh[] {
    return [...this.garmentMeshes];
  }

  /**
   * Trigger a manual render (useful after external modifications).
   */
  requestRender(): void {
    this.sceneManager.requestRender();
  }

  /**
   * Clean up all resources. Call when removing the viewer.
   */
  dispose(): void {
    this.fabricMaterial.dispose();
    this.modelLoader.dispose();
    this.lightingRig.dispose();
    this.cameraController.dispose();
    this.sceneManager.dispose();
  }
}
