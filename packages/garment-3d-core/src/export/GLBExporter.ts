import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

export interface GLBExportConfig {
  /** Include textures in the exported file (default: true) */
  embedTextures?: boolean;
  /** Clamp max texture resolution to save file size (default: 2048) */
  maxTextureSize?: number;
}

/**
 * Exports a Three.js scene (with applied fabric materials) as a binary .glb file.
 */
export class GLBExporter {
  /**
   * Export the scene as a GLB Blob.
   */
  static async export(
    scene: THREE.Object3D,
    options: GLBExportConfig = {},
  ): Promise<Blob> {
    const { maxTextureSize = 2048 } = options;

    // Clone the scene so modifications don't affect the live viewport
    const clone = scene.clone(true);

    // Downscale textures if needed
    if (maxTextureSize < 4096) {
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshPhysicalMaterial;
          const textures = [mat.map, mat.normalMap, mat.roughnessMap];
          for (const tex of textures) {
            if (tex && tex.image) {
              GLBExporter.clampTextureSize(tex, maxTextureSize);
            }
          }
        }
      });
    }

    const exporter = new GLTFExporter();

    return new Promise<Blob>((resolve, reject) => {
      exporter.parse(
        clone,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(new Blob([result], { type: "model/gltf-binary" }));
          } else {
            // JSON result (shouldn't happen with binary: true)
            const json = JSON.stringify(result);
            resolve(new Blob([json], { type: "model/gltf+json" }));
          }
        },
        (error) => {
          reject(error);
        },
        { binary: true },
      );
    });
  }

  /**
   * Export and trigger a browser download.
   */
  static async download(
    scene: THREE.Object3D,
    filename = "garment.glb",
    options: GLBExportConfig = {},
  ): Promise<void> {
    const blob = await GLBExporter.export(scene, options);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private static clampTextureSize(
    texture: THREE.Texture,
    maxSize: number,
  ): void {
    const image = texture.image;
    if (
      !image ||
      !(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)
    )
      return;

    const w = image.width || (image as HTMLCanvasElement).width;
    const h = image.height || (image as HTMLCanvasElement).height;

    if (w <= maxSize && h <= maxSize) return;

    const scale = maxSize / Math.max(w, h);
    const nw = Math.round(w * scale);
    const nh = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, nw, nh);

    texture.image = canvas;
    texture.needsUpdate = true;
  }
}
