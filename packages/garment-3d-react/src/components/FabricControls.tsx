import { useRef } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import type { FabricPresetType, FabricDescriptor } from "@garment-3d/shared";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FabricControlsValue {
  presetType: FabricPresetType;
  /** Object URL or remote URL of the fabric sample image; null if none selected. */
  fabricImageUrl: string | null;
  sheen: number;
  sheenRoughness: number;
  roughness: number;
  normalStrength: number;
  anisotropy: number;
  textureScale: number;
  textureRotation: number;
}

export interface FabricControlsProps {
  /** Current controlled value. */
  value: FabricControlsValue;
  /** Called on any field change with the full updated value. */
  onChange: (next: FabricControlsValue) => void;
  /** Called with a FabricDescriptor when the user clicks Apply. */
  onApply: (descriptor: FabricDescriptor) => void;
  /** Disable all controls. */
  disabled?: boolean;
  /** Show spinner on Apply button and disable it during async apply. */
  isApplying?: boolean;
  /** Error message shown below the Apply button. */
  applyError?: string | null;
  className?: string;
  style?: CSSProperties;
  /** Override the Apply button label. */
  applyLabel?: string;
  /** Custom content inside the Apply button while isApplying is true. */
  applyingContent?: ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS: { type: FabricPresetType; label: string; color: string }[] = [
  { type: "cotton", label: "Cotton", color: "#f5f0e8" },
  { type: "silk", label: "Silk", color: "#ffe8d0" },
  { type: "denim", label: "Denim", color: "#4a6fa5" },
  { type: "linen", label: "Linen", color: "#e8dcc8" },
  { type: "velvet", label: "Velvet", color: "#6b2d5b" },
  { type: "wool", label: "Wool", color: "#a0998a" },
  { type: "satin", label: "Satin", color: "#c8b8d8" },
];

interface SliderDef {
  key: keyof FabricControlsValue;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: "sheen", label: "Sheen", min: 0, max: 1, step: 0.01 },
  {
    key: "sheenRoughness",
    label: "Sheen Roughness",
    min: 0,
    max: 1,
    step: 0.01,
  },
  { key: "roughness", label: "Roughness", min: 0, max: 1, step: 0.01 },
  {
    key: "normalStrength",
    label: "Normal Strength",
    min: 0,
    max: 2,
    step: 0.01,
  },
  { key: "anisotropy", label: "Anisotropy", min: 0, max: 1, step: 0.01 },
  { key: "textureScale", label: "Texture Scale", min: 0.5, max: 15, step: 0.5 },
  { key: "textureRotation", label: "Rotation", min: 0, max: 6.28, step: 0.01 },
];

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------

const labelTextStyle: CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A fully controlled fabric controls component.
 *
 * Renders preset swatches, a custom fabric image upload zone,
 * seven PBR sliders, and an Apply button. Uses inline styles only —
 * no Tailwind or CSS dependency.
 *
 * @example
 * ```tsx
 * const [fabric, setFabric] = useState<FabricControlsValue>({
 *   presetType: 'cotton', fabricImageUrl: null,
 *   sheen: 0.2, sheenRoughness: 0.8, roughness: 0.9,
 *   normalStrength: 0.6, anisotropy: 0.1, textureScale: 4, textureRotation: 0,
 * });
 *
 * <FabricControls
 *   value={fabric}
 *   onChange={setFabric}
 *   onApply={(descriptor) => canvasRef.current?.setFabric(descriptor)}
 * />
 * ```
 */
export function FabricControls({
  value,
  onChange,
  onApply,
  disabled = false,
  isApplying = false,
  applyError,
  className,
  style,
  applyLabel = "Apply Fabric",
  applyingContent,
}: FabricControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (partial: Partial<FabricControlsValue>) =>
    onChange({ ...value, ...partial });

  const handleFabricUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous object URL to avoid memory leak
    if (value.fabricImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(value.fabricImageUrl);
    }
    const url = URL.createObjectURL(file);
    set({ fabricImageUrl: url, presetType: "custom" });
  };

  const handleApply = () => {
    if (!value.fabricImageUrl) return;
    onApply({
      diffuse: value.fabricImageUrl,
      preset: value.presetType,
      scale: value.textureScale,
      rotation: value.textureRotation,
      sheen: value.sheen,
      sheenRoughness: value.sheenRoughness,
      roughness: value.roughness,
      normalStrength: value.normalStrength,
      anisotropy: value.anisotropy,
    });
  };

  const rootStyle: CSSProperties = {
    fontFamily: "inherit",
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
    ...style,
  };

  return (
    <div className={className} style={rootStyle}>
      {/* Preset swatches */}
      <section style={{ marginBottom: 20 }}>
        <span style={labelTextStyle}>Presets</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {PRESETS.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => set({ presetType: type })}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "6px 4px",
                border:
                  value.presetType === type
                    ? "2px solid #6366f1"
                    : "1px solid #e5e7eb",
                borderRadius: 8,
                background: value.presetType === type ? "#eef2ff" : "#fff",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: color,
                  border: "1px solid rgba(0,0,0,0.1)",
                  marginBottom: 4,
                }}
              />
              <span style={{ fontSize: 10, color: "#4b5563" }}>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Custom fabric upload */}
      <section style={{ marginBottom: 20 }}>
        <span style={labelTextStyle}>Custom Fabric</span>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          style={{
            border: "1.5px dashed #d1d5db",
            borderRadius: 8,
            padding: 12,
            textAlign: "center",
            cursor: "pointer",
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {value.fabricImageUrl ? (
            <img
              src={value.fabricImageUrl}
              alt="Fabric sample"
              style={{
                maxHeight: 96,
                maxWidth: "100%",
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ) : (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              Upload fabric sample image
            </span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFabricUpload}
        />
      </section>

      {/* Material sliders */}
      <section style={{ marginBottom: 20 }}>
        <span style={labelTextStyle}>Material Properties</span>
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {(value[key] as number).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[key] as number}
              onChange={(e) => set({ [key]: parseFloat(e.target.value) })}
              style={{ width: "100%", cursor: "pointer" }}
            />
          </div>
        ))}
      </section>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={isApplying || !value.fabricImageUrl}
        style={{
          width: "100%",
          padding: "10px 0",
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor:
            isApplying || !value.fabricImageUrl ? "not-allowed" : "pointer",
          opacity: isApplying || !value.fabricImageUrl ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {isApplying ? (applyingContent ?? "Applying...") : applyLabel}
      </button>

      {applyError && (
        <p style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>
          {applyError}
        </p>
      )}
    </div>
  );
}
