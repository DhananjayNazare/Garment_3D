import { useProjectStore } from "../stores";
import { UploadPanel } from "../components/upload/UploadPanel";
import { FabricPanel } from "../components/fabric/FabricPanel";
import { GarmentViewport } from "../components/editor/GarmentViewport";
import { ExportToolbar } from "../components/editor/ExportToolbar";
import { StatusBar } from "../components/editor/StatusBar";

export function EditorPage() {
  const { modelUrl } = useProjectStore();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top bar */}
      <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 shrink-0">
        <a
          href="/"
          className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors"
        >
          Garment 3D
        </a>
        <span className="mx-3 text-gray-300">|</span>
        <span className="text-sm text-gray-500">Editor</span>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Upload */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto shrink-0">
          <UploadPanel />
        </div>

        {/* Center - 3D Viewport */}
        <div className="flex-1 relative">
          <GarmentViewport />
          {modelUrl && <ExportToolbar />}
          <StatusBar />
        </div>

        {/* Right panel - Fabric controls */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto shrink-0">
          <FabricPanel disabled={!modelUrl} />
        </div>
      </div>
    </div>
  );
}
