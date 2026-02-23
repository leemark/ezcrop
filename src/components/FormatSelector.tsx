import type { OutputFormat } from "../types";

interface FormatSelectorProps {
  format: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

const formats: { value: OutputFormat; label: string; hint: string }[] = [
  { value: "webp", label: "WebP", hint: "Best balance" },
  { value: "jpeg", label: "JPEG", hint: "Compatible" },
  { value: "avif", label: "AVIF", hint: "Smallest" },
];

export function FormatSelector({ format, onChange }: FormatSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-syne text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
        Format
      </h3>
      <div className="flex gap-1">
        {formats.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            title={f.hint}
            className={`flex flex-1 flex-col items-center rounded-lg py-2 transition-colors ${
              format === f.value
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            <span className="font-mono text-xs font-medium">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
