interface QualitySliderProps {
  quality: number;
  onChange: (quality: number) => void;
}

export function QualitySlider({ quality, onChange }: QualitySliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Quality
        </h3>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {quality}%
        </span>
      </div>
      <input
        type="range"
        min={60}
        max={100}
        step={1}
        value={quality}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-indigo-500 dark:bg-zinc-700"
      />
    </div>
  );
}
