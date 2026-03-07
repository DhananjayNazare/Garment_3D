import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import { GarmentViewer } from "@garment-3d/core";
import type {
  FabricDescriptor,
  ViewerOptions,
  ScreenshotOptions,
} from "@garment-3d/shared";

export interface UseGarmentViewerResult {
  /** Load a model from a URL or ArrayBuffer. Sets isLoading while in progress. */
  loadModel: (src: string | ArrayBuffer) => Promise<void>;
  /** Apply a fabric descriptor to the loaded model. */
  setFabric: (descriptor: FabricDescriptor) => Promise<void>;
  /** Update a single fabric property in real-time (for slider controls). */
  updateFabricProperty: (property: string, value: number) => void;
  /** Export the current view as a PNG/JPEG/WebP blob. */
  exportScreenshot: (options?: ScreenshotOptions) => Promise<Blob>;
  /** True while loadModel or setFabric is in progress. */
  isLoading: boolean;
  /** Last error message, or null if no error. */
  error: string | null;
}

/**
 * Manages a GarmentViewer instance tied to a DOM container element.
 *
 * Creates the viewer when the container mounts and disposes it on unmount.
 * Exposes stable callbacks for all viewer operations plus reactive
 * `isLoading` and `error` state.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { loadModel, setFabric, isLoading } = useGarmentViewer(containerRef);
 *
 * useEffect(() => {
 *   if (modelUrl) loadModel(modelUrl);
 * }, [modelUrl, loadModel]);
 *
 * return <div ref={containerRef} style={{ width: 800, height: 600 }} />;
 * ```
 */
export function useGarmentViewer(
  containerRef: RefObject<HTMLElement | null>,
  options?: ViewerOptions,
): UseGarmentViewerResult {
  const viewerRef = useRef<GarmentViewer | null>(null);
  // Keep latest options in a ref so changing options doesn't recreate the viewer.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const viewer = new GarmentViewer(container, optionsRef.current);
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [containerRef]);

  const loadModel = useCallback(async (src: string | ArrayBuffer) => {
    const viewer = viewerRef.current;
    if (!viewer) throw new Error("GarmentViewer is not initialized");
    setIsLoading(true);
    setError(null);
    try {
      await viewer.loadModel(src);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load model";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setFabric = useCallback(async (descriptor: FabricDescriptor) => {
    const viewer = viewerRef.current;
    if (!viewer) throw new Error("GarmentViewer is not initialized");
    setIsLoading(true);
    setError(null);
    try {
      await viewer.setFabric(descriptor);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to apply fabric";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateFabricProperty = useCallback(
    (property: string, value: number) => {
      viewerRef.current?.updateFabricProperty(property, value);
    },
    [],
  );

  const exportScreenshot = useCallback(
    async (opts?: ScreenshotOptions): Promise<Blob> => {
      const viewer = viewerRef.current;
      if (!viewer) throw new Error("GarmentViewer is not initialized");
      return viewer.exportScreenshot(opts);
    },
    [],
  );

  return {
    loadModel,
    setFabric,
    updateFabricProperty,
    exportScreenshot,
    isLoading,
    error,
  };
}
