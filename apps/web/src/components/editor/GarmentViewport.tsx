import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { FabricMaterial, UVMapper } from "@garment-3d/core";
import {
  useProjectStore,
  useFabricStore,
  useViewportStore,
} from "../../stores";

/** Syncs R3F's Three.js objects into the Zustand store so components outside Canvas can use them */
function ViewportBridge() {
  const { gl, scene, camera } = useThree();
  const setViewportRefs = useViewportStore((s) => s.setViewportRefs);

  useEffect(() => {
    setViewportRefs(gl, scene, camera);
  }, [gl, scene, camera, setViewportRefs]);

  return null;
}

function GarmentModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  // Bug 1 fix: useGLTF returns a shared cached scene. Clone before mutating
  // geometry/materials so we don't corrupt the cache for future loads.
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const fabricMatRef = useRef<FabricMaterial | null>(null);
  const { invalidate } = useThree();

  const currentFabric = useFabricStore((s) => s.currentFabric);
  const fabricVersion = useFabricStore((s) => s.fabricVersion);
  const setFabricApplyState = useFabricStore((s) => s.setFabricApplyState);

  // Real-time slider values
  const sheen = useFabricStore((s) => s.sheen);
  const sheenRoughness = useFabricStore((s) => s.sheenRoughness);
  const roughness = useFabricStore((s) => s.roughness);
  const normalStrength = useFabricStore((s) => s.normalStrength);
  const anisotropy = useFabricStore((s) => s.anisotropy);
  const textureScale = useFabricStore((s) => s.textureScale);
  const textureRotation = useFabricStore((s) => s.textureRotation);

  useEffect(() => {
    // Process meshes: compute tangents, enable shadows, fix UVs, ensure visibility
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Ensure default material is visible from both sides
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.side = THREE.DoubleSide;
            });
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }

        const geo = child.geometry;
        if (!geo.attributes.normal) {
          geo.computeVertexNormals();
        }

        // Auto-fix UVs: apply triplanar fallback if UVs are missing or poor
        const usedFallback = UVMapper.ensureUsableUVs(child);
        if (usedFallback) {
          console.log(
            "[GarmentViewport] Applied triplanar UV fallback to mesh:",
            child.name || "(unnamed)",
          );
        }

        if (geo.attributes.uv && !geo.attributes.tangent) {
          try {
            geo.computeTangents();
          } catch {
            // Some geometries can't compute tangents
          }
        }
      }
    });
    // Bug 2 fix: trigger a render now that mesh processing is done.
    // Required because frameloop="demand" only renders on explicit invalidate().
    invalidate();
  }, [clonedScene, invalidate]);

  // Apply fabric material when user clicks "Apply Fabric"
  useEffect(() => {
    if (!currentFabric || fabricVersion === 0) return;
    if (!currentFabric.diffuse) return;

    let cancelled = false;

    async function applyMaterial() {
      // Create or reuse FabricMaterial instance
      if (!fabricMatRef.current) {
        fabricMatRef.current = new FabricMaterial();
      }

      setFabricApplyState(true, null);

      try {
        const material = await fabricMatRef.current.createFromDescriptor(
          currentFabric!,
        );

        if (cancelled) return;

        // Apply to all meshes in the scene
        clonedScene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = material;
          }
        });

        invalidate();
        setFabricApplyState(false, null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to apply fabric";
        console.error("Failed to apply fabric material:", err);
        setFabricApplyState(false, message);
      }
    }

    applyMaterial();

    return () => {
      cancelled = true;
    };
  }, [
    currentFabric,
    fabricVersion,
    clonedScene,
    invalidate,
    setFabricApplyState,
  ]);

  // Real-time slider updates (no texture rebuild, just material property changes)
  useEffect(() => {
    if (!fabricMatRef.current || fabricVersion === 0) return;

    const mat = fabricMatRef.current;
    mat.updateProperty("sheen", sheen);
    mat.updateProperty("sheenRoughness", sheenRoughness);
    mat.updateProperty("roughness", roughness);
    mat.updateProperty("normalStrength", normalStrength);
    mat.updateProperty("anisotropy", anisotropy);

    // Update texture scale and rotation on all current textures
    const material = mat.getMaterial();
    const textures = [material.map, material.normalMap, material.roughnessMap];
    for (const tex of textures) {
      if (tex) {
        tex.repeat.set(textureScale, textureScale);
        tex.rotation = textureRotation;
        tex.center.set(0.5, 0.5);
        tex.needsUpdate = true;
      }
    }

    invalidate();
  }, [
    sheen,
    sheenRoughness,
    roughness,
    normalStrength,
    anisotropy,
    textureScale,
    textureRotation,
    fabricVersion,
    invalidate,
  ]);

  // Cleanup FabricMaterial on unmount
  useEffect(() => {
    return () => {
      fabricMatRef.current?.dispose();
      fabricMatRef.current = null;
    };
  }, []);

  return (
    <Center>
      <primitive ref={groupRef} object={clonedScene} />
    </Center>
  );
}

function LoadingPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.8, 0.3]} />
      <meshStandardMaterial color="#e2e8f0" wireframe />
    </mesh>
  );
}

function EmptyState() {
  return (
    <mesh>
      <ringGeometry args={[0.4, 0.5, 64]} />
      <meshBasicMaterial color="#cbd5e1" side={THREE.DoubleSide} />
    </mesh>
  );
}

export function GarmentViewport() {
  const { modelUrl, generationStatus } = useProjectStore();

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [2, 1.5, 2], fov: 45 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        frameloop="demand"
      >
        <color attach="background" args={["#f1f5f9"]} />
        <ViewportBridge />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[3, 4, 2]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight
          position={[-2, 2, -1]}
          intensity={0.6}
          color="#d4e4ff"
        />
        <directionalLight
          position={[0, 3, -3]}
          intensity={0.8}
          color="#fff4e0"
        />

        {/* Environment for reflections */}
        <Environment preset="studio" />

        {/* Ground plane */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial opacity={0.15} />
        </mesh>

        {/* Model or placeholder */}
        <Suspense fallback={<LoadingPlaceholder />}>
          {modelUrl ? <GarmentModel url={modelUrl} /> : <EmptyState />}
        </Suspense>

        {/* Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[0, 0.5, 0]}
          minDistance={0.5}
          maxDistance={10}
          maxPolarAngle={Math.PI * 0.95}
        />
      </Canvas>

      {/* Overlay when no model */}
      {!modelUrl && !generationStatus && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-sm bg-white/80 px-4 py-2 rounded-lg">
            Upload a garment image to generate a 3D model
          </p>
        </div>
      )}

      {/* Loading overlay */}
      {generationStatus === "processing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg px-6 py-4 text-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">Generating 3D model...</p>
          </div>
        </div>
      )}
    </div>
  );
}
