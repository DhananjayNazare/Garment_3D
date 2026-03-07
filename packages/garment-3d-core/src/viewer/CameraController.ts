import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CameraPreset } from "@garment-3d/shared";

const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: THREE.Vector3Tuple; target?: THREE.Vector3Tuple }
> = {
  front: { position: [0, 0.5, 2.5] },
  back: { position: [0, 0.5, -2.5] },
  left: { position: [-2.5, 0.5, 0] },
  right: { position: [2.5, 0.5, 0] },
  "three-quarter": { position: [1.8, 0.8, 1.8] },
  top: { position: [0, 3, 0] },
};

/**
 * Manages the perspective camera and orbit controls.
 * Supports preset camera positions for standard garment views.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private onChangeCallback?: () => void;

  constructor(
    domElement: HTMLElement,
    options?: { fov?: number; near?: number; far?: number },
  ) {
    const aspect = domElement.clientWidth / domElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      options?.fov ?? 45,
      aspect,
      options?.near ?? 0.1,
      options?.far ?? 100,
    );
    this.camera.position.set(1.8, 0.8, 1.8);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.5, 0);
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI * 0.95;
    this.controls.update();
  }

  /** Set a callback to be called when the camera changes (for render-on-demand) */
  onChange(callback: () => void): void {
    this.onChangeCallback = callback;
    this.controls.addEventListener("change", callback);
  }

  /** Smoothly transition to a preset camera position */
  setPreset(preset: CameraPreset): void {
    const config = CAMERA_PRESETS[preset];
    if (!config) return;

    const [x, y, z] = config.position;
    this.camera.position.set(x, y, z);

    if (config.target) {
      const [tx, ty, tz] = config.target;
      this.controls.target.set(tx, ty, tz);
    }

    this.controls.update();
    this.onChangeCallback?.();
  }

  /** Frame object to fit it in the viewport */
  frameObject(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim / (2 * Math.tan((this.camera.fov * Math.PI) / 360));

    this.controls.target.copy(center);
    this.camera.position.set(
      center.x + distance * 0.7,
      center.y + distance * 0.3,
      center.z + distance * 0.7,
    );
    this.controls.update();
    this.onChangeCallback?.();
  }

  /** Update aspect ratio on resize */
  updateAspect(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Update controls (call each frame for damping) */
  update(): void {
    if (this.controls.enableDamping) {
      this.controls.update();
    }
  }

  dispose(): void {
    this.controls.dispose();
  }
}
