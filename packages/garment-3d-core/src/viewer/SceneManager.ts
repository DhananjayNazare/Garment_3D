import * as THREE from "three";

export interface SceneManagerOptions {
  antialias?: boolean;
  backgroundColor?: string;
  shadows?: boolean;
  maxPixelRatio?: number;
  toneMapping?: boolean;
}

/**
 * Manages the Three.js scene, renderer, and render loop.
 * Handles setup and teardown of the WebGL context.
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private animationFrameId: number | null = null;
  private renderCallbacks: Set<() => void> = new Set();
  private needsRender = true;

  constructor(container: HTMLElement, options: SceneManagerOptions = {}) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(
      options.backgroundColor ?? "#f5f5f5",
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: true,
      powerPreference: "high-performance",
    });

    const pixelRatio = Math.min(
      window.devicePixelRatio,
      options.maxPixelRatio ?? 2,
    );
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    if (options.toneMapping !== false) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    }

    if (options.shadows !== false) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.renderer.setSize(width, height);
          this.requestRender();
        }
      }
    });
    observer.observe(this.container);
  }

  /** Request a render on the next animation frame */
  requestRender(): void {
    this.needsRender = true;
  }

  /** Register a callback to run each render frame */
  onRender(callback: () => void): () => void {
    this.renderCallbacks.add(callback);
    return () => this.renderCallbacks.delete(callback);
  }

  /** Start the render-on-demand loop */
  startRenderLoop(camera: THREE.Camera): void {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);
      if (this.needsRender) {
        this.renderCallbacks.forEach((cb) => cb());
        this.renderer.render(this.scene, camera);
        this.needsRender = false;
      }
    };
    loop();
  }

  /** Stop rendering */
  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Clean up all resources */
  dispose(): void {
    this.stopRenderLoop();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
