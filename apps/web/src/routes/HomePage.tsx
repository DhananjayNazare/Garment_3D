import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Garment 3D</h1>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Transform Garment Images into Interactive 3D Models
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Upload a garment photo, generate a 3D model, and replace fabrics
            with any textile sample. See your designs come to life with
            realistic PBR rendering.
          </p>

          <button
            onClick={() => navigate("/editor")}
            className="inline-flex items-center px-8 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            Open Editor
            <svg
              className="ml-2 w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Image to 3D</h3>
              <p className="text-sm text-gray-600">
                Upload any garment photo and our AI converts it into a detailed
                3D mesh with textures.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Fabric Replacement
              </h3>
              <p className="text-sm text-gray-600">
                Swap fabrics instantly with PBR materials including sheen,
                roughness, and normal mapping.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Export</h3>
              <p className="text-sm text-gray-600">
                Download your 3D garment as GLB or capture high-res screenshots
                for presentations.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
