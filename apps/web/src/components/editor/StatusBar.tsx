import { useProjectStore } from "../../stores";

export function StatusBar() {
  const { generationStatus, modelUrl } = useProjectStore();

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
    </div>
  );
}
