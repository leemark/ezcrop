import type { Preset } from "../types";
import { presets } from "../lib/presets";

interface PresetPickerProps {
  activePreset: Preset;
  onSelect: (preset: Preset) => void;
  customWidth: number;
  customHeight: number;
  onCustomChange: (w: number, h: number) => void;
}

export function PresetPicker({
  activePreset,
  onSelect,
  customWidth,
  customHeight,
  onCustomChange,
}: PresetPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Preset
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
              activePreset.id === preset.id
                ? "bg-indigo-500 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {activePreset.id === "custom" && (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={7680}
            value={customWidth}
            onChange={(e) =>
              onCustomChange(Number(e.target.value), customHeight)
            }
            className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs tabular-nums dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
          />
          <span className="text-xs text-zinc-400">&times;</span>
          <input
            type="number"
            min={1}
            max={7680}
            value={customHeight}
            onChange={(e) =>
              onCustomChange(customWidth, Number(e.target.value))
            }
            className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs tabular-nums dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
          />
          <span className="text-xs text-zinc-400">px</span>
        </div>
      )}
    </div>
  );
}
