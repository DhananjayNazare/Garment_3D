import * as THREE from "three";

/**
 * Utilities for managing UV coordinates on garment meshes.
 * Handles texture scale calibration, UV quality analysis, and
 * triplanar projection fallback for meshes with missing or poor UVs.
 */
export class UVMapper {
  /**
   * Check if a mesh has valid UV coordinates.
   */
  static hasValidUVs(mesh: THREE.Mesh): boolean {
    return !!mesh.geometry.attributes.uv;
  }

  /**
   * Analyze UV quality by checking for degenerate (zero-area) triangles,
   * extreme distortion, and out-of-range coordinates.
   * Returns a score from 0 (unusable) to 1 (perfect).
   */
  static analyzeUVQuality(mesh: THREE.Mesh): {
    score: number;
    hasUVs: boolean;
    degeneratePercent: number;
    outOfRangePercent: number;
  } {
    const geometry = mesh.geometry;
    const uvAttr = geometry.attributes.uv;

    if (!uvAttr) {
      return { score: 0, hasUVs: false, degeneratePercent: 100, outOfRangePercent: 100 };
    }

    const index = geometry.index;
    const count = index ? index.count : uvAttr.count;
    const triangleCount = Math.floor(count / 3);

    let degenerateTriangles = 0;
    let outOfRangeVertices = 0;
    const totalVertices = uvAttr.count;

    // Check for out-of-range UVs (values far outside 0-1 can indicate bad unwrap)
    for (let i = 0; i < totalVertices; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (u < -10 || u > 10 || v < -10 || v > 10 || isNaN(u) || isNaN(v)) {
        outOfRangeVertices++;
      }
    }

    // Check for degenerate UV triangles (zero area in UV space)
    const uv0 = new THREE.Vector2();
    const uv1 = new THREE.Vector2();
    const uv2 = new THREE.Vector2();

    for (let i = 0; i < triangleCount; i++) {
      const i0 = index ? index.getX(i * 3) : i * 3;
      const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

      uv0.set(uvAttr.getX(i0), uvAttr.getY(i0));
      uv1.set(uvAttr.getX(i1), uvAttr.getY(i1));
      uv2.set(uvAttr.getX(i2), uvAttr.getY(i2));

      // Triangle area in UV space via cross product
      const area = Math.abs(
        (uv1.x - uv0.x) * (uv2.y - uv0.y) - (uv2.x - uv0.x) * (uv1.y - uv0.y),
      );

      if (area < 1e-8) {
        degenerateTriangles++;
      }
    }

    const degeneratePercent = triangleCount > 0
      ? (degenerateTriangles / triangleCount) * 100
      : 100;
    const outOfRangePercent = totalVertices > 0
      ? (outOfRangeVertices / totalVertices) * 100
      : 100;

    // Score: penalize degenerate triangles and out-of-range UVs
    const degPenalty = Math.min(1, degeneratePercent / 50); // 50%+ degenerate = max penalty
    const oorPenalty = Math.min(1, outOfRangePercent / 20); // 20%+ out-of-range = max penalty
    const score = Math.max(0, 1 - degPenalty * 0.6 - oorPenalty * 0.4);

    return { score, hasUVs: true, degeneratePercent, outOfRangePercent };
  }

  /**
   * Auto-fix UVs for a mesh: check quality and apply triplanar fallback if needed.
   * @param mesh The mesh to fix
   * @param qualityThreshold Below this score (0-1), triplanar UVs are applied (default 0.3)
   * @param scale Scale factor for triplanar projection
   * @returns true if triplanar fallback was applied
   */
  static ensureUsableUVs(
    mesh: THREE.Mesh,
    qualityThreshold = 0.3,
    scale = 1,
  ): boolean {
    const quality = UVMapper.analyzeUVQuality(mesh);

    if (!quality.hasUVs || quality.score < qualityThreshold) {
      UVMapper.applyTriplanarUVs(mesh, scale);
      return true;
    }

    return false;
  }

  /**
   * Apply triplanar projection UVs as a fallback for meshes without UVs.
   * Projects texture from 3 axes and blends based on surface normal direction.
   * Note: This modifies the UV attribute in-place.
   */
  static applyTriplanarUVs(mesh: THREE.Mesh, scale = 1): void {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    if (!positions || !normals) return;

    const count = positions.count;
    const uvs = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const nx = Math.abs(normals.getX(i));
      const ny = Math.abs(normals.getY(i));
      const nz = Math.abs(normals.getZ(i));

      const px = positions.getX(i) * scale;
      const py = positions.getY(i) * scale;
      const pz = positions.getZ(i) * scale;

      // Choose projection axis based on dominant normal direction
      if (nx >= ny && nx >= nz) {
        // Project from X axis
        uvs[i * 2] = pz;
        uvs[i * 2 + 1] = py;
      } else if (ny >= nx && ny >= nz) {
        // Project from Y axis
        uvs[i * 2] = px;
        uvs[i * 2 + 1] = pz;
      } else {
        // Project from Z axis
        uvs[i * 2] = px;
        uvs[i * 2 + 1] = py;
      }
    }

    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }

  /**
   * Scale UV coordinates to match a desired fabric tile size.
   * @param mesh The mesh to modify
   * @param tilesPerMeter How many times the fabric texture repeats per meter
   */
  static calibrateUVScale(mesh: THREE.Mesh, tilesPerMeter: number): void {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Adjust texture repeat based on model size
    if (
      mesh.material instanceof THREE.MeshPhysicalMaterial &&
      mesh.material.map
    ) {
      const repeat = maxDim * tilesPerMeter;
      mesh.material.map.repeat.set(repeat, repeat);
      if (mesh.material.normalMap) {
        mesh.material.normalMap.repeat.set(repeat, repeat);
      }
      if (mesh.material.roughnessMap) {
        mesh.material.roughnessMap.repeat.set(repeat, repeat);
      }
    }
  }
}
