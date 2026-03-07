import { resolve } from "path";
import { mkdir, writeFile } from "fs/promises";
import { createConnection } from "net";

const HUNYUAN_URL = process.env.HUNYUAN_URL ?? "http://localhost:8000";

export interface GenerationResult {
  modelPath: string;
  textures: string[];
}

/** Check if a TCP port is reachable (1s timeout) */
function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((res) => {
    const socket = createConnection({ host, port, timeout: 1000 });
    socket.on("connect", () => {
      socket.destroy();
      res(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      res(false);
    });
    socket.on("error", () => {
      socket.destroy();
      res(false);
    });
  });
}

/**
 * Client for the self-hosted Hunyuan3D-2.1 model server.
 * Falls back to generating a mock GLB when the Python server is unreachable.
 */
export class HunyuanService {
  private baseUrl: string;
  private mockMode: boolean | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? HUNYUAN_URL;
  }

  /** Detect if the model server is reachable; cache the result */
  private async isMockMode(): Promise<boolean> {
    if (this.mockMode !== null) return this.mockMode;
    const url = new URL(this.baseUrl);
    this.mockMode = !(await checkPort(
      url.hostname,
      parseInt(url.port || "8000", 10),
    ));
    if (this.mockMode) {
      console.log(
        `[HunyuanService] Model server not reachable at ${this.baseUrl} — using mock mode`,
      );
    }
    return this.mockMode;
  }

  async submit(imageBuffer: Buffer, imageFilename: string): Promise<string> {
    if (await this.isMockMode()) {
      return `mock-${Date.now()}`;
    }

    const ext = imageFilename.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      "image/jpeg";

    const formData = new FormData();
    formData.append(
      "image",
      new Blob([new Uint8Array(imageBuffer)], { type: mimeType }),
      imageFilename,
    );

    const response = await fetch(`${this.baseUrl}/generate`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Hunyuan3D generation failed: ${error}`);
    }

    const result = (await response.json()) as { task_id: string };
    return result.task_id;
  }

  async getStatus(taskId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    error?: string;
  }> {
    if (taskId.startsWith("mock-")) {
      return { status: "completed", progress: 100 };
    }

    const response = await fetch(`${this.baseUrl}/status/${taskId}`);
    if (!response.ok) {
      throw new Error(`Failed to get status for task ${taskId}`);
    }
    return response.json() as Promise<{
      status: "pending" | "processing" | "completed" | "failed";
      progress: number;
      error?: string;
    }>;
  }

  async downloadResult(
    taskId: string,
    outputDir: string,
  ): Promise<GenerationResult> {
    await mkdir(outputDir, { recursive: true });

    if (taskId.startsWith("mock-")) {
      const modelPath = resolve(outputDir, "model.glb");
      await writeFile(modelPath, createMockGLB());
      return { modelPath, textures: [] };
    }

    const glbResponse = await fetch(
      `${this.baseUrl}/result/${taskId}/model.glb`,
    );
    if (!glbResponse.ok) {
      throw new Error(`Failed to download model for task ${taskId}`);
    }

    const glbBuffer = Buffer.from(await glbResponse.arrayBuffer());
    const modelPath = resolve(outputDir, "model.glb");
    await writeFile(modelPath, glbBuffer);

    return {
      modelPath,
      textures: [],
    };
  }
}

/**
 * Generate a minimal valid GLB file — a box-like garment shape with UVs and normals
 * so fabric materials can be applied during development.
 */
function createMockGLB(): Buffer {
  // 24 vertices (4 per face x 6 faces) for a box with correct per-face normals
  // Box dimensions: width=0.6, height=0.8, depth=0.2 (garment-like proportions)
  const hw = 0.3, hh = 0.4, hd = 0.1; // half extents

  // prettier-ignore
  const positions = new Float32Array([
    // Front face (z+)
    -hw, -hh,  hd,   hw, -hh,  hd,   hw,  hh,  hd,  -hw,  hh,  hd,
    // Back face (z-)
     hw, -hh, -hd,  -hw, -hh, -hd,  -hw,  hh, -hd,   hw,  hh, -hd,
    // Top face (y+)
    -hw,  hh,  hd,   hw,  hh,  hd,   hw,  hh, -hd,  -hw,  hh, -hd,
    // Bottom face (y-)
    -hw, -hh, -hd,   hw, -hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
    // Right face (x+)
     hw, -hh,  hd,   hw, -hh, -hd,   hw,  hh, -hd,   hw,  hh,  hd,
    // Left face (x-)
    -hw, -hh, -hd,  -hw, -hh,  hd,  -hw,  hh,  hd,  -hw,  hh, -hd,
  ]);

  // prettier-ignore
  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,  // front
    0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,  // back
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,  // top
    0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,  // bottom
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,  // right
   -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,  // left
  ]);

  // prettier-ignore
  const uvs = new Float32Array([
    0,0, 1,0, 1,1, 0,1,  // front
    0,0, 1,0, 1,1, 0,1,  // back
    0,0, 1,0, 1,1, 0,1,  // top
    0,0, 1,0, 1,1, 0,1,  // bottom
    0,0, 1,0, 1,1, 0,1,  // right
    0,0, 1,0, 1,1, 0,1,  // left
  ]);

  // 6 faces x 2 triangles x 3 indices = 36 indices
  // prettier-ignore
  const indices = new Uint16Array([
     0, 1, 2,  0, 2, 3,  // front
     4, 5, 6,  4, 6, 7,  // back
     8, 9,10,  8,10,11,  // top
    12,13,14, 12,14,15,  // bottom
    16,17,18, 16,18,19,  // right
    20,21,22, 20,22,23,  // left
  ]);

  const posBytes = 24 * 3 * 4; // 288
  const normBytes = 24 * 3 * 4; // 288
  const uvBytes = 24 * 2 * 4; // 192
  const idxBytes = 36 * 2; // 72
  const totalBinBytes = posBytes + normBytes + uvBytes + idxBytes; // 840

  const gltfJson = JSON.stringify({
    asset: { version: "2.0", generator: "garment-3d-mock" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "GarmentMock" }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: "VEC3",
        max: [hw, hh, hd],
        min: [-hw, -hh, -hd],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 24,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 24,
        type: "VEC2",
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: 36,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes },
      { buffer: 0, byteOffset: posBytes, byteLength: normBytes },
      { buffer: 0, byteOffset: posBytes + normBytes, byteLength: uvBytes },
      { buffer: 0, byteOffset: posBytes + normBytes + uvBytes, byteLength: idxBytes },
    ],
    buffers: [{ byteLength: totalBinBytes }],
  });

  // Pad JSON to 4-byte alignment
  let jsonBytes = Buffer.from(gltfJson, "utf-8");
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPadding > 0) {
    jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  }

  let binData = Buffer.concat([
    Buffer.from(positions.buffer),
    Buffer.from(normals.buffer),
    Buffer.from(uvs.buffer),
    Buffer.from(indices.buffer),
  ]);
  const binPadding = (4 - (binData.length % 4)) % 4;
  if (binPadding > 0) {
    binData = Buffer.concat([binData, Buffer.alloc(binPadding, 0x00)]);
  }

  // GLB: 12-byte header + JSON chunk + BIN chunk
  const totalLength = 12 + 8 + jsonBytes.length + 8 + binData.length;

  const header = Buffer.alloc(12);
  header.write("glTF", 0, 4, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonChunkHeader.write("JSON", 4, 4, "ascii");

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binData.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // "BIN\0"

  return Buffer.concat([
    header,
    jsonChunkHeader,
    jsonBytes,
    binChunkHeader,
    binData,
  ]);
}
