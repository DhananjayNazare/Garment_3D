import { useCallback, useRef, useState } from "react";
import { useProjectStore } from "../../stores";

export function UploadPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Holds a cancel function for any in-flight SSE connection or poll loop
  const cancelActiveRef = useRef<(() => void) | null>(null);
  const {
    uploadedImageUrl,
    generationStatus,
    generationProgress,
    generationError,
    setUploadedImage,
    setGenerationJob,
    updateGenerationStatus,
  } = useProjectStore();

  const pollStatus = useCallback(
    (jobId: string): (() => void) => {
      let cancelled = false;
      const cancel = () => {
        cancelled = true;
      };

      const poll = async () => {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/generate/${jobId}`);
          const data = await res.json();
          if (!cancelled) {
            updateGenerationStatus(
              data.status,
              data.progress ?? 0,
              data.modelUrl,
              data.error,
            );
          }

          if (
            !cancelled &&
            data.status !== "completed" &&
            data.status !== "failed"
          ) {
            setTimeout(poll, 2000);
          }
        } catch {
          if (!cancelled) setTimeout(poll, 5000);
        }
      };
      poll();
      return cancel;
    },
    [updateGenerationStatus],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        alert("Please upload a JPEG, PNG, or WebP image.");
        return;
      }

      // Cancel any previous SSE connection or poll loop before starting a new upload
      cancelActiveRef.current?.();
      cancelActiveRef.current = null;

      setIsUploading(true);

      try {
        // Upload the image
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Upload failed");
        }

        const { imageId, url } = await uploadRes.json();
        setUploadedImage(imageId, url);

        // Start generation
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId }),
        });

        if (!genRes.ok) {
          const errBody = await genRes.json().catch(() => null);
          const message =
            errBody?.error ?? `Generation failed (HTTP ${genRes.status})`;
          throw new Error(message);
        }

        const { jobId } = await genRes.json();
        setGenerationJob(jobId);

        // Poll for status via SSE
        const eventSource = new EventSource(`/api/generate/${jobId}/sse`);

        // Store cancel so a subsequent upload can close this stream
        cancelActiveRef.current = () => eventSource.close();

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          updateGenerationStatus(
            data.status,
            data.progress ?? 0,
            data.modelUrl,
            data.error,
          );

          if (data.status === "completed" || data.status === "failed") {
            eventSource.close();
            cancelActiveRef.current = null;
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          // Fallback to polling; store its cancel fn
          cancelActiveRef.current = pollStatus(jobId);
        };
      } catch (err) {
        console.error("Upload/generation error:", err);
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        updateGenerationStatus("failed", 0, undefined, message);
      } finally {
        setIsUploading(false);
      }
    },
    [pollStatus, setUploadedImage, setGenerationJob, updateGenerationStatus],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Garment Image
      </h2>

      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-gray-400"}
          ${isUploading || generationStatus === "pending" || generationStatus === "processing" ? "opacity-50 pointer-events-none" : ""}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("garment-upload")?.click()}
      >
        {uploadedImageUrl ? (
          <img
            src={uploadedImageUrl}
            alt="Uploaded garment"
            className="max-h-48 mx-auto rounded-md object-contain"
          />
        ) : (
          <>
            <svg
              className="w-10 h-10 mx-auto text-gray-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
              />
            </svg>
            <p className="text-sm text-gray-600 mb-1">
              Drop garment image here or click to browse
            </p>
            <p className="text-xs text-gray-400">
              JPEG, PNG, or WebP (max 10MB)
            </p>
          </>
        )}

        <input
          id="garment-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Generation status */}
      {generationStatus && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">
              {generationStatus === "pending" && "Queued..."}
              {generationStatus === "processing" && "Generating 3D model..."}
              {generationStatus === "completed" && "Model ready"}
              {generationStatus === "failed" && "Generation failed"}
            </span>
            <span className="text-gray-500">{generationProgress}%</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                generationStatus === "failed"
                  ? "bg-red-500"
                  : generationStatus === "completed"
                    ? "bg-green-500"
                    : "bg-primary-500"
              }`}
              style={{ width: `${generationProgress}%` }}
            />
          </div>

          {generationError && (
            <p className="text-sm text-red-600 mt-2">{generationError}</p>
          )}
        </div>
      )}

      {/* Upload another */}
      {uploadedImageUrl && (
        <button
          onClick={() => document.getElementById("garment-upload")?.click()}
          className="mt-4 w-full py-2 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Upload Different Image
        </button>
      )}
    </div>
  );
}
