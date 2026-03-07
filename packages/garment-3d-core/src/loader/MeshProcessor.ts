import * as THREE from "three";

/**
 * Post-processing for loaded meshes.
 * Ensures normals, tangents, and other attributes are correct for PBR rendering.
 */
export class MeshProcessor {
  /**
   * Process a mesh to ensure it's ready for fabric material rendering.
   * - Computes vertex normals if missing
   * - Computes tangent attributes (required for normal maps)
   * - Centers geometry at origin
   * - Enables shadow casting/receiving
   */
  static process(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry;

    // Compute normals if missing
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    // Compute tangents for normal map support
    if (geometry.attributes.uv && !geometry.attributes.tangent) {
      geometry.computeTangents();
    }

    // Enable shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  /**
   * Process all meshes in a scene graph.
   */
  static processScene(scene: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        MeshProcessor.process(child);
        meshes.push(child);
      }
    });
    return meshes;
  }

  /**
   * Center a scene at the origin based on its bounding box.
   */
  static centerScene(scene: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
    // Keep feet on the ground plane
    const newBox = new THREE.Box3().setFromObject(scene);
    scene.position.y -= newBox.min.y;
  }
}
