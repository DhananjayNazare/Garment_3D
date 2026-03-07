import { useCallback } from "react";
import { useFabricStore } from "../../stores";
import type { FabricPresetType } from "@garment-3d/shared";

const PRESETS: { type: FabricPresetType; label: string; color: string }[] = [
  { type: "cotton", label: "Cotton", color: "#f5f0e8" },
  { type: "silk", label: "Silk", color: "#ffe8d0" },
  { type: "denim", label: "Denim", color: "#4a6fa5" },
  { type: "linen", label: "Linen", color: "#e8dcc8" },
  { type: "velvet", label: "Velvet", color: "#6b2d5b" },
  { type: "wool", label: "Wool", color: "#a0998a" },
  { type: "satin", label: "Satin", color: "#c8b8d8" },
];

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
      />
    </div>
  );
}

interface FabricPanelProps {
  disabled?: boolean;
}

export function FabricPanel({ disabled }: FabricPanelProps) {
  const {
    presetType,
    fabricImageUrl,
    sheen,
    sheenRoughness,
    roughness,
    normalStrength,
    anisotropy,
    textureScale,
    textureRotation,
    setPresetType,
    setFabricImageUrl,
    applyFabric,
    updateParameter,
  } = useFabricStore();

  const handleFabricUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      setFabricImageUrl(url);
      setPresetType("custom");
    },
    [setPresetType, setFabricImageUrl],
  );

  return (
    <div className={`p-4 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Fabric
      </h2>

      {/* Fabric presets */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 mb-2">Presets</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => setPresetType(type)}
              className={`
                flex flex-col items-center p-2 rounded-lg border transition-all
                ${
                  presetType === type
                    ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <div
                className="w-8 h-8 rounded-md border border-gray-200 mb-1"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-gray-600">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom fabric upload */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 mb-2">Custom Fabric</p>
        <div
          className="border border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={() => document.getElementById("fabric-upload")?.click()}
        >
          {fabricImageUrl ? (
            <img
              src={fabricImageUrl}
              alt="Fabric sample"
              className="w-full h-24 object-cover rounded"
            />
          ) : (
            <p className="text-xs text-gray-400">Upload fabric sample image</p>
          )}
          <input
            id="fabric-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFabricUpload}
          />
        </div>
      </div>

      {/* Material parameters */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 mb-3">Material Properties</p>

        <Slider
          label="Sheen"
          value={sheen}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateParameter("sheen", v)}
        />
        <Slider
          label="Sheen Roughness"
          value={sheenRoughness}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateParameter("sheenRoughness", v)}
        />
        <Slider
          label="Roughness"
          value={roughness}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateParameter("roughness", v)}
        />
        <Slider
          label="Normal Strength"
          value={normalStrength}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => updateParameter("normalStrength", v)}
        />
        <Slider
          label="Anisotropy"
          value={anisotropy}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateParameter("anisotropy", v)}
        />
        <Slider
          label="Texture Scale"
          value={textureScale}
          min={0.5}
          max={15}
          step={0.5}
          onChange={(v) => updateParameter("textureScale", v)}
        />
        <Slider
          label="Rotation"
          value={textureRotation}
          min={0}
          max={6.28}
          step={0.01}
          onChange={(v) => updateParameter("textureRotation", v)}
        />
      </div>

      {/* Apply button */}
      <button
        className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        onClick={applyFabric}
      >
        Apply Fabric
      </button>
    </div>
  );
}
