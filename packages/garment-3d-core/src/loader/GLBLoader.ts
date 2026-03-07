import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export interface LoadResult {
  scene: THREE.Group;
  meshes: THREE.Mesh[];
  animations: THREE.AnimationClip[];
}

/**
 * Loads GLB/GLTF models with Draco decompression support.
 */
export class GLBModelLoader {
  private loader: GLTFLoader;
  private dracoLoader: DRACOLoader;

  constructor(dracoPath = "/draco/") {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(dracoPath);
    this.dracoLoader.setDecoderConfig({ type: "js" });

    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  /** Load a GLB model from URL or ArrayBuffer */
  async load(source: string | ArrayBuffer): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const onLoad = (gltf: {
        scene: THREE.Group;
        animations: THREE.AnimationClip[];
      }) => {
        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshes.push(child);
          }
        });

        resolve({
          scene: gltf.scene,
          meshes,
          animations: gltf.animations,
        });
      };

      if (typeof source === "string") {
        this.loader.load(source, onLoad, undefined, reject);
      } else {
        this.loader.parse(source, "", onLoad, reject);
      }
    });
  }

  dispose(): void {
    this.dracoLoader.dispose();
  }
}
