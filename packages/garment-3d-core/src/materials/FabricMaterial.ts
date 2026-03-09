import * as THREE from "three";
import type { FabricDescriptor } from "@garment-3d/shared";
import { FabricPresets, type FabricPresetConfig } from "./FabricPresets";
import { TextureProcessor } from "./TextureProcessor";

/**
 * Creates and manages MeshPhysicalMaterial instances configured for fabric rendering.
 * Wraps Three.js's PBR material system with fabric-specific defaults for:
 * - Sheen (silk, satin, velvet glow)
 * - Anisotropy (directional weave highlights)
 * - Normal maps (surface texture detail)
 * - Roughness (matte vs glossy appearance)
 */
export class FabricMaterial {
  private material: THREE.MeshPhysicalMaterial;
  private textureProcessor: TextureProcessor;
  private currentTextures: THREE.Texture[] = [];

  constructor() {
    this.textureProcessor = new TextureProcessor();
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xcccccc,
      roughness: 0.7,
      metalness: 0,
    });
  }

  /**
   * Create a fabric material from a descriptor.
   * Auto-generates normal and roughness maps if not provided.
   */
  async createFromDescriptor(
    descriptor: FabricDescriptor,
  ): Promise<THREE.MeshPhysicalMaterial> {
    // Dispose previous textures
    this.disposeTextures();

    const preset: FabricPresetConfig = descriptor.preset
      ? FabricPresets[descriptor.preset]
      : FabricPresets.custom;

    const repeat = descriptor.scale ?? preset.textureRepeat;

    this.material.dispose();

    // Preset-only mode: no diffuse image uploaded — apply PBR parameters directly
    if (!descriptor.diffuse) {
      this.material = new THREE.MeshPhysicalMaterial({
        color: 0xdddddd,
        roughness: descriptor.roughness ?? preset.roughness,
        metalness: preset.metalness,
        sheen: descriptor.sheen ?? preset.sheen,
        sheenRoughness: descriptor.sheenRoughness ?? preset.sheenRoughness,
        sheenColor: new THREE.Color(preset.sheenColor),
        anisotropy: descriptor.anisotropy ?? preset.anisotropy,
        side: THREE.DoubleSide,
      });
      return this.material;
    }

    // Full texture pipeline when a diffuse image is provided.
    // Load the image once, build the seamless canvas, then derive all maps from it.
    const img = await this.textureProcessor.loadImage(descriptor.diffuse);
    const seamlessCanvas = this.textureProcessor.makeSeamless(img);
    const diffuseTexture = this.textureProcessor.canvasToTexture(
      seamlessCanvas,
      repeat,
      THREE.SRGBColorSpace,
    );
    this.currentTextures.push(diffuseTexture);

    // Load or generate normal map
    let normalMap: THREE.Texture;
    if (descriptor.normalMap) {
      normalMap = await this.textureProcessor.loadSeamlessTexture(
        descriptor.normalMap,
        repeat,
      );
    } else {
      normalMap = this.textureProcessor.generateNormalMap(
        seamlessCanvas,
        descriptor.normalStrength ?? preset.normalScale,
      );
      normalMap.repeat.set(repeat, repeat);
    }
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;
    this.currentTextures.push(normalMap);

    // Load or generate roughness map
    let roughnessMap: THREE.Texture;
    if (descriptor.roughnessMap) {
      roughnessMap = await this.textureProcessor.loadSeamlessTexture(
        descriptor.roughnessMap,
        repeat,
      );
    } else {
      roughnessMap = this.textureProcessor.generateRoughnessMap(seamlessCanvas);
      roughnessMap.repeat.set(repeat, repeat);
    }
    roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
    this.currentTextures.push(roughnessMap);

    // Apply rotation to all textures
    if (descriptor.rotation) {
      const rotation = descriptor.rotation;
      [diffuseTexture, normalMap, roughnessMap].forEach((tex) => {
        tex.rotation = rotation;
        tex.center.set(0.5, 0.5);
      });
    }

    // Create the PBR material
    this.material = new THREE.MeshPhysicalMaterial({
      map: diffuseTexture,
      normalMap,
      normalScale: new THREE.Vector2(
        descriptor.normalStrength ?? preset.normalScale,
        descriptor.normalStrength ?? preset.normalScale,
      ),
      roughnessMap,
      roughness: descriptor.roughness ?? preset.roughness,
      metalness: preset.metalness,
      sheen: descriptor.sheen ?? preset.sheen,
      sheenRoughness: descriptor.sheenRoughness ?? preset.sheenRoughness,
      sheenColor: new THREE.Color(preset.sheenColor),
      anisotropy: descriptor.anisotropy ?? preset.anisotropy,
      side: THREE.DoubleSide,
    });

    return this.material;
  }

  /** Get the current material instance */
  getMaterial(): THREE.MeshPhysicalMaterial {
    return this.material;
  }

  /** Update a single material property in real-time */
  updateProperty(property: string, value: number | string): void {
    switch (property) {
      case "sheen":
        this.material.sheen = value as number;
        break;
      case "sheenRoughness":
        this.material.sheenRoughness = value as number;
        break;
      case "roughness":
        this.material.roughness = value as number;
        break;
      case "anisotropy":
        this.material.anisotropy = value as number;
        break;
      case "normalStrength":
        this.material.normalScale.set(value as number, value as number);
        break;
      default:
        break;
    }
    this.material.needsUpdate = true;
  }

  private disposeTextures(): void {
    this.currentTextures.forEach((tex) => tex.dispose());
    this.currentTextures = [];
  }

  dispose(): void {
    this.disposeTextures();
    this.material.dispose();
  }
}
