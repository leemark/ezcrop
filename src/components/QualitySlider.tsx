interface QualitySliderProps {
  quality: number;
  onChange: (quality: number) => void;
}

export function QualitySlider({ quality, onChange }: QualitySliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-syne text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
          Quality
        </h3>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700"
      />
      <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
        Recommended: 80–85%
      </p>
    </div>
  );
}
