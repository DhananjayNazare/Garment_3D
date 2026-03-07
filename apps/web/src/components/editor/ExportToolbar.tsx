import { useCallback, useState } from "react";
import { ScreenshotExporter, GLBExporter } from "@garment-3d/core";
import { useViewportStore, type ViewportState } from "../../stores";

export function ExportToolbar() {
  const renderer = useViewportStore((s: ViewportState) => s.renderer);
  const scene = useViewportStore((s: ViewportState) => s.scene);
  const camera = useViewportStore((s: ViewportState) => s.camera);
  const [exporting, setExporting] = useState<"screenshot" | "glb" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const canExport = renderer && scene && camera;

  const showError = (msg: string) => {
    setExportError(msg);
    setTimeout(() => setExportError(null), 4000);
  };

  const handleScreenshot = useCallback(async () => {
    if (!renderer || !scene || !camera) return;
    setExporting("screenshot");
    try {
      const blob = await ScreenshotExporter.capture(renderer, scene, camera, {
        width: 1920,
        height: 1080,
        format: "png",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "garment-screenshot.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Screenshot export failed:", err);
      showError(err instanceof Error ? err.message : "Screenshot failed");
    } finally {
      setExporting(null);
    }
  }, [renderer, scene, camera]);

  const handleGLBExport = useCallback(async () => {
    if (!scene) return;
    setExporting("glb");
    try {
      await GLBExporter.download(scene, "garment.glb");
    } catch (err) {
      console.error("GLB export failed:", err);
      showError(err instanceof Error ? err.message : "GLB export failed");
    } finally {
      setExporting(null);
    }
  }, [scene]);

  if (!canExport) return null;

  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
      <div className="flex gap-2">
        <button
          onClick={handleScreenshot}
          disabled={!!exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-white hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save as PNG screenshot"
        >
          {exporting === "screenshot" ? (
            <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <circle cx="12" cy="13" r="3" />
            </svg>
          )}
          Screenshot
        </button>
        <button
          onClick={handleGLBExport}
          disabled={!!exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-white hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download as GLB 3D file"
        >
          {exporting === "glb" ? (
            <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          )}
          Export GLB
        </button>
      </div>
      {exportError && (
        <div className="text-xs text-red-600 bg-white/95 border border-red-200 rounded-lg px-3 py-1.5 shadow-sm max-w-xs text-right">
          {exportError}
        </div>
      )}
    </div>
  );
}
