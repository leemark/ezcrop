import { useState, useEffect } from "react";
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

export function PresetPicker({
  activePreset,
  onSelect,
  customWidth,
  customHeight,
  onCustomChange,
}: PresetPickerProps) {
  const [widthStr, setWidthStr] = useState(String(customWidth));
  const [heightStr, setHeightStr] = useState(String(customHeight));

  useEffect(() => { setWidthStr(String(customWidth)); }, [customWidth]);
  useEffect(() => { setHeightStr(String(customHeight)); }, [customHeight]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWidthStr(e.target.value);
    const v = parseInt(e.target.value, 10);
    if (v > 0 && isFinite(v)) onCustomChange(v, customHeight);
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeightStr(e.target.value);
    const v = parseInt(e.target.value, 10);
    if (v > 0 && isFinite(v)) onCustomChange(customWidth, v);
  };

  const handleWidthBlur = () => {
    const v = parseInt(widthStr, 10);
    if (!(v > 0 && isFinite(v))) setWidthStr(String(customWidth));
  };

  const handleHeightBlur = () => {
    const v = parseInt(heightStr, 10);
    if (!(v > 0 && isFinite(v))) setHeightStr(String(customHeight));
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-syne text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
        Preset
      </h3>

      <div className="flex flex-col gap-1.5">
        {groups.map(({ label, prefix, shortLabels }) => {
          const groupPresets = presets.filter((p) => p.id.startsWith(prefix));
          return (
            <div key={prefix} className="flex items-center">
              <span className="w-10 shrink-0 text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {label}
              </span>
              <div className="flex gap-0.5">
                {groupPresets.map((preset, i) => (
                  <button
                    key={preset.id}
                    onClick={() => onSelect(preset)}
                    title={preset.label}
                    className={`flex flex-col items-center gap-0.5 rounded px-1 py-1 transition-colors ${
                      activePreset.id === preset.id
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-700/50"
                    }`}
                  >
                    <AspectThumbnail
                      width={preset.width}
                      height={preset.height}
                      active={activePreset.id === preset.id}
                    />
                    <span className="font-mono text-[9px] leading-none">
                      {shortLabels[i]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Custom / free-form */}
        <div className="flex items-center">
          <span className="w-10 shrink-0 text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Free
          </span>
          <button
            onClick={() => onSelect(customPreset)}
            className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
              activePreset.id === "custom"
                ? "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/40 dark:text-amber-400"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50"
            }`}
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
        </div>
      </div>

      {activePreset.id === "custom" && (
        <div className="flex items-center gap-1.5 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
          <input
            type="number"
            min={1}
            max={7680}
            value={widthStr}
            onChange={handleWidthChange}
            onBlur={handleWidthBlur}
            className="w-16 rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <span className="text-xs text-zinc-400">×</span>
          <input
            type="number"
            min={1}
            max={7680}
            value={heightStr}
            onChange={handleHeightChange}
            onBlur={handleHeightBlur}
            className="w-16 rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <span className="text-[10px] text-zinc-400">px</span>
        </div>
      )}
    </div>
  );
}
