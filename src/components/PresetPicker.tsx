import { useState } from "react";
import type { Preset } from "../types";
import { presets } from "../lib/presets";

interface PresetPickerProps {
  activePreset: Preset;
  onSelect: (preset: Preset) => void;
  customWidth: number;
  customHeight: number;
  onCustomChange: (w: number, h: number) => void;
}

const BOX = 30;

function AspectThumbnail({
  width,
  height,
  active,
}: {
  width: number;
  height: number;
  active: boolean;
}) {
  const ratio = width / height;
  let tw: number, th: number;
  if (ratio >= 1) {
    tw = BOX;
    th = Math.max(Math.round(BOX / ratio), 4);
  } else {
    th = BOX;
    tw = Math.max(Math.round(BOX * ratio), 4);
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: BOX, height: BOX }}
    >
      <div
        className={`border transition-colors ${
          active
            ? "border-amber-500 bg-amber-500/15"
            : "border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700/40"
        }`}
        style={{ width: tw, height: th }}
      />
    </div>
  );
}

const groups = [
  {
    label: "Square",
    prefix: "square",
    shortLabels: ["L", "M", "S"],
  },
  {
    label: "Rect",
    prefix: "rect",
    shortLabels: ["Tall", "Mid", "Short"],
  },
  {
    label: "Vert",
    prefix: "vert",
    shortLabels: ["Wide", "Mid", "Narrow"],
  },
];

const customPreset = presets.find((p) => p.id === "custom")!;
const freeformPreset = presets.find((p) => p.id === "freeform")!;

function parseDimension(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1 && parsed <= 7680
    ? parsed
    : null;
}

function CustomDimensionFields({
  customWidth,
  customHeight,
  onCustomChange,
}: Pick<PresetPickerProps, "customWidth" | "customHeight" | "onCustomChange">) {
  const [widthStr, setWidthStr] = useState(String(customWidth));
  const [heightStr, setHeightStr] = useState(String(customHeight));
  const [widthError, setWidthError] = useState(false);
  const [heightError, setHeightError] = useState(false);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWidthStr(e.target.value);
    setWidthError(false);
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeightStr(e.target.value);
    setHeightError(false);
  };

  const handleWidthBlur = () => {
    const value = parseDimension(widthStr);
    if (value === null) {
      setWidthError(true);
      return;
    }
    setWidthError(false);
    setWidthStr(String(value));
    if (value !== customWidth) onCustomChange(value, customHeight);
  };

  const handleHeightBlur = () => {
    const value = parseDimension(heightStr);
    if (value === null) {
      setHeightError(true);
      return;
    }
    setHeightError(false);
    setHeightStr(String(value));
    if (value !== customHeight) onCustomChange(customWidth, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={7680}
          value={widthStr}
          aria-label="Width in pixels"
          aria-invalid={widthError}
          aria-describedby={widthError ? "custom-width-error" : undefined}
          onChange={handleWidthChange}
          onBlur={handleWidthBlur}
          onKeyDown={handleKeyDown}
          className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus-visible:outline-amber-300"
        />
        <span className="text-xs text-zinc-400">×</span>
        <input
          type="number"
          min={1}
          max={7680}
          value={heightStr}
          aria-label="Height in pixels"
          aria-invalid={heightError}
          aria-describedby={heightError ? "custom-height-error" : undefined}
          onChange={handleHeightChange}
          onBlur={handleHeightBlur}
          onKeyDown={handleKeyDown}
          className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus-visible:outline-amber-300"
        />
        <span className="text-xs text-zinc-500">px</span>
      </div>
      {(widthError || heightError) && (
        <p className="text-xs text-red-700 dark:text-red-300" aria-live="polite">
          {widthError && (
            <span id="custom-width-error">
              Width: use a whole number from 1 to 7,680.{heightError && " "}
            </span>
          )}
          {heightError && (
            <span id="custom-height-error">Height: use a whole number from 1 to 7,680.</span>
          )}
        </p>
      )}
    </div>
  );
}

export function PresetPicker({
  activePreset,
  onSelect,
  customWidth,
  customHeight,
  onCustomChange,
}: PresetPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-syne text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
        Preset
      </h3>

      <div className="flex flex-col gap-1.5">
        {groups.map(({ label, prefix, shortLabels }) => {
          const groupPresets = presets.filter((p) => p.id.startsWith(prefix));
          return (
            <div key={prefix} className="flex items-center">
              <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
              </span>
              <div className="flex gap-0.5">
                {groupPresets.map((preset, i) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelect(preset)}
                    title={preset.label}
                    aria-label={preset.label}
                    aria-pressed={activePreset.id === preset.id}
                    className={`flex flex-col items-center gap-0.5 rounded px-1 py-1 transition-colors ${
                      activePreset.id === preset.id
                        ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50"
                    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-300`}
                  >
                    <AspectThumbnail
                      width={preset.width}
                      height={preset.height}
                      active={activePreset.id === preset.id}
                    />
                    <span className="font-mono text-[10px] leading-none">
                      {shortLabels[i]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Output sizing modes */}
        <div className="flex items-center">
          <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Size
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onSelect(customPreset)}
              aria-pressed={activePreset.id === "custom"}
              className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                activePreset.id === "custom"
                  ? "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-300`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <rect
                  x="1.5"
                  y="1.5"
                  width="11"
                  height="11"
                  rx="1"
                  strokeDasharray="2.5 1.5"
                />
              </svg>
              Custom size
            </button>
            <button
              type="button"
              onClick={() => onSelect(freeformPreset)}
              aria-label="Freeform"
              aria-pressed={activePreset.id === "freeform"}
              className={`rounded px-2 py-1.5 text-xs transition-colors ${
                activePreset.id === "freeform"
                  ? "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-300`}
            >
              Freeform
            </button>
          </div>
        </div>
      </div>

      {activePreset.id === "custom" && (
        <CustomDimensionFields
          customWidth={customWidth}
          customHeight={customHeight}
          onCustomChange={onCustomChange}
        />
      )}
    </div>
  );
}
