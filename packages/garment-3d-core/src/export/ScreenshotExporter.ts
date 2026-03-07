import * as THREE from "three";

export interface ScreenshotConfig {
  width?: number;
  height?: number;
  transparent?: boolean;
  format?: "png" | "jpeg" | "webp";
  quality?: number;
}

/**
 * Exports the current 3D viewport as an image.
 */
export class ScreenshotExporter {
  /**
   * Capture the current render as a Blob.
   */
  static async capture(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: ScreenshotConfig = {},
  ): Promise<Blob> {
    const {
      width = renderer.domElement.width,
      height = renderer.domElement.height,
      transparent = false,
      format = "png",
      quality = 0.92,
    } = options;

    // Create offscreen renderer for custom resolution
    const offscreenRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparent,
      preserveDrawingBuffer: true,
    });
    offscreenRenderer.setSize(width, height);
    offscreenRenderer.toneMapping = renderer.toneMapping;
    offscreenRenderer.toneMappingExposure = renderer.toneMappingExposure;
    offscreenRenderer.outputColorSpace = renderer.outputColorSpace;

    if (!transparent) {
      offscreenRenderer.setClearColor(
        (scene.background as THREE.Color) ?? new THREE.Color(0xf5f5f5),
        1,
      );
    }

    offscreenRenderer.render(scene, camera);

    const mimeType = `image/${format}`;

    return new Promise<Blob>((resolve, reject) => {
      offscreenRenderer.domElement.toBlob(
        (blob: Blob | null) => {
          offscreenRenderer.dispose();
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create screenshot blob"));
          }
        },
        mimeType,
        quality,
      );
    });
  }
}
