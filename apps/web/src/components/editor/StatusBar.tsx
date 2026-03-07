import { useEffect, useState } from "react";
import { useProjectStore } from "../../stores";

type ModelMode = "gpu" | "mock-server" | "offline" | null;

interface ModelStatus {
  reachable: boolean;
  mock: boolean;
  mode: "gpu" | "mock-server" | "offline";
}

export function StatusBar() {
  const { generationStatus, modelUrl } = useProjectStore();
  const [modelMode, setModelMode] = useState<ModelMode>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/model-status")
      .then((r) => r.json() as Promise<ModelStatus>)
      .then((data) => {
        if (!cancelled) setModelMode(data.mode);
      })
      .catch(() => {
        if (!cancelled) setModelMode("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modeBadge: Record<
    Exclude<ModelMode, null>,
    { dot: string; label: string; title: string }
  > = {
    gpu: {
      dot: "bg-emerald-400",
      label: "GPU",
      title: "Hunyuan3D-2.1 — real inference active",
    },
    "mock-server": {
      dot: "bg-amber-400",
      label: "Mock",
      title: "Model server running in mock mode (hy3dgen not installed)",
    },
    offline: {
      dot: "bg-red-400",
      label: "Offline",
      title: "Model server not reachable — generation unavailable",
    },
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-900/80 backdrop-blur-sm flex items-center px-4 text-xs text-gray-300">
      <span className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            modelUrl
              ? "bg-green-400"
              : generationStatus === "processing"
                ? "bg-yellow-400 animate-pulse"
                : generationStatus === "failed"
                  ? "bg-red-400"
                  : "bg-gray-500"
          }`}
        />
        {modelUrl
          ? "Model loaded"
          : generationStatus === "processing"
            ? "Generating..."
            : generationStatus === "failed"
              ? "Generation failed"
              : "No model loaded"}
      </span>

      {modelMode && (
        <span
          className="ml-auto flex items-center gap-1.5 cursor-default"
          title={modeBadge[modelMode].title}
        >
          <span
            className={`w-2 h-2 rounded-full ${modeBadge[modelMode].dot}`}
          />
          <span className="text-gray-400">
            Model server:{" "}
            <span
              className={
                modelMode === "gpu"
                  ? "text-emerald-400"
                  : modelMode === "offline"
                    ? "text-red-400"
                    : "text-amber-400"
              }
            >
              {modeBadge[modelMode].label}
            </span>
          </span>
        </span>
      )}
    </div>
  );
}
