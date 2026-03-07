import { forwardRef, useImperativeHandle, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useGarmentViewer } from "../hooks/useGarmentViewer";
import type {
  FabricDescriptor,
  ViewerOptions,
  ScreenshotOptions,
} from "@garment-3d/shared";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GarmentCanvasHandle {
  /** Load a model from a URL or ArrayBuffer. */
  loadModel: (src: string | ArrayBuffer) => Promise<void>;
  /** Apply a fabric descriptor to the loaded model. */
  setFabric: (descriptor: FabricDescriptor) => Promise<void>;
  /** Update a single fabric property in real-time. */
  updateFabricProperty: (property: string, value: number) => void;
  /** Export the current view as a blob. */
  exportScreenshot: (options?: ScreenshotOptions) => Promise<Blob>;
}

export interface GarmentCanvasProps {
  /** Options forwarded to the GarmentViewer constructor. */
  options?: ViewerOptions;
  className?: string;
  style?: CSSProperties;
  /** Content shown in the loading overlay. Defaults to "Loading...". */
  loadingContent?: ReactNode;
  /**
   * Content shown in the error overlay.
   * Can be a static node or a function receiving the error message.
   */
  errorContent?: ReactNode | ((error: string) => ReactNode);
  /** Called after loadModel resolves successfully. */
  onLoad?: () => void;
  /** Called when loadModel or setFabric throw. */
  onError?: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Overlay base style (inline, no Tailwind dependency)
// ---------------------------------------------------------------------------

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
  pointerEvents: "none",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A self-contained 3D garment viewer component.
 *
 * Renders a `div` that owns a `GarmentViewer` instance. The viewer attaches
 * its own canvas to the div. Loading and error states are rendered as overlays.
 *
 * Use `ref` to call `loadModel`, `setFabric`, `updateFabricProperty`, and
 * `exportScreenshot` imperatively.
 *
 * @example
 * ```tsx
 * const canvasRef = useRef<GarmentCanvasHandle>(null);
 *
 * const handleLoad = async () => {
 *   await canvasRef.current?.loadModel('/garment.glb');
 *   await canvasRef.current?.setFabric({ diffuse: '/silk.jpg', preset: 'silk' });
 * };
 *
 * return (
 *   <GarmentCanvas
 *     ref={canvasRef}
 *     style={{ width: 800, height: 600 }}
 *     onLoad={() => console.log('model loaded')}
 *   />
 * );
 * ```
 */
export const GarmentCanvas = forwardRef<
  GarmentCanvasHandle,
  GarmentCanvasProps
>(function GarmentCanvas(
  { options, className, style, loadingContent, errorContent, onLoad, onError },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    loadModel,
    setFabric,
    updateFabricProperty,
    exportScreenshot,
    isLoading,
    error,
  } = useGarmentViewer(containerRef, options);

  useImperativeHandle(
    ref,
    () => ({
      async loadModel(src) {
        try {
          await loadModel(src);
          onLoad?.();
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Failed to load model";
          onError?.(msg);
          throw err;
        }
      },
      setFabric: async (descriptor) => {
        try {
          await setFabric(descriptor);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Failed to apply fabric";
          onError?.(msg);
          throw err;
        }
      },
      updateFabricProperty,
      exportScreenshot,
    }),
    [
      loadModel,
      setFabric,
      updateFabricProperty,
      exportScreenshot,
      onLoad,
      onError,
    ],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      {isLoading && (
        <div
          style={{
            ...overlayStyle,
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(2px)",
          }}
        >
          {loadingContent ?? (
            <span style={{ color: "#6b7280", fontSize: 14 }}>Loading...</span>
          )}
        </div>
      )}
      {error && !isLoading && (
        <div
          style={{
            ...overlayStyle,
            background: "rgba(255, 255, 255, 0.9)",
            color: "#dc2626",
            padding: 16,
            textAlign: "center",
          }}
        >
          {typeof errorContent === "function"
            ? errorContent(error)
            : (errorContent ?? <span style={{ fontSize: 14 }}>{error}</span>)}
        </div>
      )}
    </div>
  );
});
