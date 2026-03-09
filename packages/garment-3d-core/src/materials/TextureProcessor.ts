import * as THREE from "three";

/**
 * Processes raw fabric/textile images into PBR texture sets.
 * Generates normal maps (Sobel), roughness maps (luminance inversion),
 * and seamless tiles from flat fabric photos.
 */
export class TextureProcessor {
  private textureLoader: THREE.TextureLoader;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  /** Load a texture from URL and configure for tiling */
  async loadTexture(url: string, repeat = 4): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(repeat, repeat);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          resolve(texture);
        },
        undefined,
        reject,
      );
    });
  }

  /**
   * Generate a normal map from a diffuse texture using Sobel filter.
   * Uses a canvas-based approach (runs on CPU for portability).
   */
  generateNormalMap(
    diffuseImage: HTMLImageElement | HTMLCanvasElement,
    strength = 1.0,
  ): THREE.Texture {
    const canvas = document.createElement("canvas");
    const width =
      diffuseImage.width || (diffuseImage as HTMLCanvasElement).width;
    const height =
      diffuseImage.height || (diffuseImage as HTMLCanvasElement).height;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(diffuseImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Convert to grayscale luminance
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = pixels[i * 4] / 255;
      const g = pixels[i * 4 + 1] / 255;
      const b = pixels[i * 4 + 2] / 255;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Sobel filter for gradient
    const outputData = ctx.createImageData(width, height);
    const out = outputData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tl =
          gray[((y - 1 + height) % height) * width + ((x - 1 + width) % width)];
        const t = gray[((y - 1 + height) % height) * width + x];
        const tr =
          gray[((y - 1 + height) % height) * width + ((x + 1) % width)];
        const l = gray[y * width + ((x - 1 + width) % width)];
        const r = gray[y * width + ((x + 1) % width)];
        const bl = gray[((y + 1) % height) * width + ((x - 1 + width) % width)];
        const b = gray[((y + 1) % height) * width + x];
        const br = gray[((y + 1) % height) * width + ((x + 1) % width)];

        // Sobel X and Y
        const dx = tr + 2 * r + br - (tl + 2 * l + bl);
        const dy = bl + 2 * b + br - (tl + 2 * t + tr);

        // Normal vector
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

        const idx = (y * width + x) * 4;
        out[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255); // R
        out[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255); // G
        out[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255); // B
        out[idx + 3] = 255; // A
      }
    }

    ctx.putImageData(outputData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
  }

  /**
   * Generate a roughness map from a diffuse texture.
   * Heuristic: desaturate and invert luminance.
   * Dark/shiny areas → low roughness, light/matte areas → high roughness.
   */
  generateRoughnessMap(
    diffuseImage: HTMLImageElement | HTMLCanvasElement,
    bias = 0.5,
  ): THREE.Texture {
    const canvas = document.createElement("canvas");
    const width =
      diffuseImage.width || (diffuseImage as HTMLCanvasElement).width;
    const height =
      diffuseImage.height || (diffuseImage as HTMLCanvasElement).height;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(diffuseImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const luminance =
        (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) /
        255;
      // Invert and apply bias: higher luminance = lower roughness (shinier)
      const roughness = Math.max(
        0,
        Math.min(1, (1 - luminance) * bias + bias * 0.5),
      );
      const value = Math.round(roughness * 255);
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
  }

  /**
   * Make a texture seamlessly tileable by cross-blending edges.
   * Blends a border region so the left/right and top/bottom edges match.
   * @param source The source image
   * @param blendWidth Width of the blend region as a fraction of image size (0-0.5, default 0.15)
   * @returns A canvas containing the seamless texture
   */
  makeSeamless(
    source: HTMLImageElement | HTMLCanvasElement,
    blendWidth = 0.15,
  ): HTMLCanvasElement {
    const width =
      source.width || (source as HTMLCanvasElement).width;
    const height =
      source.height || (source as HTMLCanvasElement).height;

    // Clamp blend width to valid range
    const bw = Math.max(0.01, Math.min(0.5, blendWidth));
    const blendX = Math.floor(width * bw);
    const blendY = Math.floor(height * bw);

    // Draw source into a canvas to get pixel data
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext("2d")!;
    srcCtx.drawImage(source, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, width, height);
    const src = srcData.data;

    // Output canvas
    const outCanvas = document.createElement("canvas");
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext("2d")!;
    outCtx.drawImage(source, 0, 0);
    const outData = outCtx.getImageData(0, 0, width, height);
    const out = outData.data;

    // Smoothstep for smoother blending
    function smoothstep(t: number): number {
      return t * t * (3 - 2 * t);
    }

    // Horizontal blend: merge left and right edges
    for (let y = 0; y < height; y++) {
      for (let dx = 0; dx < blendX; dx++) {
        const alpha = smoothstep(dx / blendX); // 0 at edge, 1 at blend boundary

        // Left side pixel and its wrap-around partner from the right
        const leftIdx = (y * width + dx) * 4;
        const rightIdx = (y * width + (width - blendX + dx)) * 4;

        // Blend: at edge (dx=0) use 50/50, transition to original
        for (let c = 0; c < 4; c++) {
          const blended = src[leftIdx + c] * (1 - alpha) * 0.5 +
            src[rightIdx + c] * (1 - alpha) * 0.5 +
            src[leftIdx + c] * alpha;
          out[leftIdx + c] = Math.round(blended);

          const blendedR = src[rightIdx + c] * (1 - alpha) * 0.5 +
            src[leftIdx + c] * (1 - alpha) * 0.5 +
            src[rightIdx + c] * alpha;
          out[rightIdx + c] = Math.round(blendedR);
        }
      }
    }

    // Vertical blend: merge top and bottom edges
    // Read from the horizontally-blended output
    const hBlended = new Uint8ClampedArray(out);

    for (let x = 0; x < width; x++) {
      for (let dy = 0; dy < blendY; dy++) {
        const alpha = smoothstep(dy / blendY);

        const topIdx = (dy * width + x) * 4;
        const bottomIdx = ((height - blendY + dy) * width + x) * 4;

        for (let c = 0; c < 4; c++) {
          const blended = hBlended[topIdx + c] * (1 - alpha) * 0.5 +
            hBlended[bottomIdx + c] * (1 - alpha) * 0.5 +
            hBlended[topIdx + c] * alpha;
          out[topIdx + c] = Math.round(blended);

          const blendedB = hBlended[bottomIdx + c] * (1 - alpha) * 0.5 +
            hBlended[topIdx + c] * (1 - alpha) * 0.5 +
            hBlended[bottomIdx + c] * alpha;
          out[bottomIdx + c] = Math.round(blendedB);
        }
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }

  /**
   * Load a texture from an image, make it seamless, and return as a Three.js texture.
   * Combines loadImage + makeSeamless + CanvasTexture creation.
   */
  async loadSeamlessTexture(url: string, repeat = 4, blendWidth = 0.15): Promise<THREE.Texture> {
    const img = await this.loadImage(url);
    const seamlessCanvas = this.makeSeamless(img, blendWidth);
    return this.canvasToTexture(seamlessCanvas, repeat, THREE.SRGBColorSpace);
  }

  /** Wrap an existing canvas as a tiling Three.js texture. */
  canvasToTexture(
    canvas: HTMLCanvasElement,
    repeat = 4,
    colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  ): THREE.Texture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = colorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  /** Create a solid-color canvas, used as a neutral placeholder diffuse texture. */
  neutralCanvas(color = "#cccccc", size = 64): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  /**
   * Load an image element from URL (helper for normal/roughness generation).
   */
  async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
}
