import { useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { Preset } from "../types";
import { presets } from "../lib/presets";

interface PresetPickerProps {
  activePreset: Preset;
  onSelect: (preset: Preset) => void;
  customWidth: number;
  customHeight: number;
  onCustomChange: (w: number, h: number) => void;
  onValidityChange?: (valid: boolean) => void;
  aspectLocked?: boolean;
  onAspectLockChange?: (locked: boolean) => void;
  customDimensionsRevision?: number;
}

const BOX = 30;
const MAX_DIMENSION = 7680;

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
    label: "Landscape",
    prefix: "rect",
    shortLabels: ["Tall", "Mid", "Short"],
  },
  {
    label: "Portrait",
    prefix: "vert",
    shortLabels: ["Wide", "Mid", "Narrow"],
  },
];

const customPreset = presets.find((p) => p.id === "custom")!;
const freeformPreset = presets.find((p) => p.id === "freeform")!;

function parseDimension(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_DIMENSION
    ? parsed
    : null;
}

function draftIsValid(width: string, height: string): boolean {
  return parseDimension(width) !== null && parseDimension(height) !== null;
}

function CustomDimensionFields({
  customWidth,
  customHeight,
  onCustomChange,
  onValidityChange,
  aspectLocked,
  onAspectLockChange,
}: Pick<
  PresetPickerProps,
  | "customWidth"
  | "customHeight"
  | "onCustomChange"
  | "onValidityChange"
  | "aspectLocked"
  | "onAspectLockChange"
>) {
  const [widthStr, setWidthStr] = useState(String(customWidth));
  const [heightStr, setHeightStr] = useState(String(customHeight));
  const widthDraft = widthStr;
  const heightDraft = heightStr;

  const reportValidity = (width: string, height: string) => {
    onValidityChange?.(draftIsValid(width, height));
  };

  const handleWidthChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextWidth = e.target.value;
    let nextHeight = heightDraft;
    setWidthStr(nextWidth);

    if (aspectLocked) {
      const value = parseDimension(nextWidth);
      if (value !== null) {
        const derivedHeight = Math.round(value * customHeight / customWidth);
        nextHeight = String(derivedHeight);
        setHeightStr(nextHeight);
      }
    }
    reportValidity(nextWidth, nextHeight);
  };

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextHeight = e.target.value;
    let nextWidth = widthDraft;
    setHeightStr(nextHeight);

    if (aspectLocked) {
      const value = parseDimension(nextHeight);
      if (value !== null) {
        const derivedWidth = Math.round(value * customWidth / customHeight);
        nextWidth = String(derivedWidth);
        setWidthStr(nextWidth);
      }
    }
    reportValidity(nextWidth, nextHeight);
  };

  const handleWidthBlur = () => {
    const value = parseDimension(widthDraft);
    if (value === null) {
      reportValidity(widthDraft, heightDraft);
      return;
    }
    const heightValue = parseDimension(heightDraft);
    if (aspectLocked && heightValue === null) {
      reportValidity(widthDraft, heightDraft);
      return;
    }

    setWidthStr(String(value));
    if (aspectLocked && heightValue !== null) {
      setHeightStr(String(heightValue));
      if (value !== customWidth || heightValue !== customHeight) {
        onCustomChange(value, heightValue);
      }
      reportValidity(String(value), String(heightValue));
    } else {
      if (value !== customWidth) onCustomChange(value, customHeight);
      reportValidity(String(value), heightDraft);
    }
  };

  const handleHeightBlur = () => {
    const value = parseDimension(heightDraft);
    if (value === null) {
      reportValidity(widthDraft, heightDraft);
      return;
    }
    const widthValue = parseDimension(widthDraft);
    if (aspectLocked && widthValue === null) {
      reportValidity(widthDraft, heightDraft);
      return;
    }

    setHeightStr(String(value));
    if (aspectLocked && widthValue !== null) {
      setWidthStr(String(widthValue));
      if (widthValue !== customWidth || value !== customHeight) {
        onCustomChange(widthValue, value);
      }
      reportValidity(String(widthValue), String(value));
    } else {
      if (value !== customHeight) onCustomChange(customWidth, value);
      reportValidity(widthDraft, String(value));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  const widthInvalid = parseDimension(widthDraft) === null;
  const heightInvalid = parseDimension(heightDraft) === null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={MAX_DIMENSION}
          value={widthDraft}
          aria-label="Width in pixels"
          aria-invalid={widthInvalid}
          aria-describedby={widthInvalid ? "custom-width-error" : undefined}
          onChange={handleWidthChange}
          onBlur={handleWidthBlur}
          onKeyDown={handleKeyDown}
          className="min-h-11 w-24 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus-visible:outline-amber-300"
        />
        <span className="text-xs text-zinc-400">×</span>
        <input
          type="number"
          min={1}
          max={MAX_DIMENSION}
          value={heightDraft}
          aria-label="Height in pixels"
          aria-invalid={heightInvalid}
          aria-describedby={heightInvalid ? "custom-height-error" : undefined}
          onChange={handleHeightChange}
          onBlur={handleHeightBlur}
          onKeyDown={handleKeyDown}
          className="min-h-11 w-24 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus-visible:outline-amber-300"
        />
        <span className="text-xs text-zinc-500">px</span>
      </div>
      <label className="flex min-h-11 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={Boolean(aspectLocked)}
          aria-label="Keep proportions"
          onChange={(e) => onAspectLockChange?.(e.target.checked)}
          className="h-3.5 w-3.5 accent-amber-600"
        />
        Keep proportions
      </label>
      {(widthInvalid || heightInvalid) && (
        <p className="text-xs text-red-700 dark:text-red-300" aria-live="polite">
          {widthInvalid && (
            <span id="custom-width-error">
              Width: use a whole number from 1 to 7,680.{heightInvalid && " "}
            </span>
          )}
          {heightInvalid && (
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
  onValidityChange,
  aspectLocked = false,
  onAspectLockChange,
  customDimensionsRevision = 0,
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
            <div key={prefix} className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
              </span>
              <div className="grid min-w-0 grid-cols-3 gap-1">
                {groupPresets.map((preset, i) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelect(preset)}
                    title={preset.label}
                    aria-label={preset.label}
                    aria-pressed={activePreset.id === preset.id}
                    className={`flex min-w-0 flex-col items-center gap-0.5 rounded px-0.5 py-1 transition-colors ${
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
                    <span className="font-mono text-[10px] leading-none">{shortLabels[i]}</span>
                    <span className="whitespace-nowrap font-mono text-[11px] leading-relaxed tabular-nums">
                      {preset.width} × {preset.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Output sizing modes */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Size
          </span>
          <div className="flex min-w-0 flex-1 gap-1">
            <button
              type="button"
              onClick={() => onSelect(customPreset)}
              aria-label="Custom size"
              aria-pressed={activePreset.id === "custom"}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded px-1 py-1.5 text-xs transition-colors ${
                activePreset.id === "custom"
                  ? "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-300`}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
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
              <span className="min-w-0 truncate">Custom size</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                {customWidth} × {customHeight}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSelect(freeformPreset)}
              aria-label="Freeform"
              aria-pressed={activePreset.id === "freeform"}
              className={`min-h-11 rounded px-2 py-1.5 text-xs transition-colors ${
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
          key={customDimensionsRevision}
          customWidth={customWidth}
          customHeight={customHeight}
          onCustomChange={onCustomChange}
          onValidityChange={onValidityChange}
          aspectLocked={aspectLocked}
          onAspectLockChange={onAspectLockChange}
        />
      )}
    </div>
  );
}
