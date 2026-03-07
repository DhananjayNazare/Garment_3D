import * as THREE from "three";

/**
 * Studio lighting setup optimized for fabric rendering.
 * Uses a three-point lighting system with environment-based ambient light.
 */
export class LightingRig {
  readonly group: THREE.Group;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private backLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "lighting-rig";

    // Key light - main directional light with shadows
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.keyLight.position.set(3, 4, 2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 20;
    this.keyLight.shadow.camera.left = -3;
    this.keyLight.shadow.camera.right = 3;
    this.keyLight.shadow.camera.top = 3;
    this.keyLight.shadow.camera.bottom = -3;
    this.keyLight.shadow.bias = -0.002;
    this.group.add(this.keyLight);

    // Fill light - softer, from the opposite side
    this.fillLight = new THREE.DirectionalLight(0xd4e4ff, 0.6);
    this.fillLight.position.set(-2, 2, -1);
    this.group.add(this.fillLight);

    // Back/rim light - highlights edges and fabric texture
    this.backLight = new THREE.DirectionalLight(0xfff4e0, 0.8);
    this.backLight.position.set(0, 3, -3);
    this.group.add(this.backLight);

    // Ambient light - base illumination
    this.ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.group.add(this.ambient);
  }

  /** Adjust key light intensity */
  setKeyIntensity(intensity: number): void {
    this.keyLight.intensity = intensity;
  }

  /** Adjust overall ambient intensity */
  setAmbientIntensity(intensity: number): void {
    this.ambient.intensity = intensity;
  }

  /** Get the group to add to the scene */
  getGroup(): THREE.Group {
    return this.group;
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Light) {
        if ("shadow" in child && child.shadow?.map) {
          child.shadow.map.dispose();
        }
      }
    });
  }
}
