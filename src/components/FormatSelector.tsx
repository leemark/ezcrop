import type { OutputFormat } from "../types";

interface FormatSelectorProps {
  format: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

const formats: { value: OutputFormat; label: string }[] = [
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
  { value: "avif", label: "AVIF" },
];

export function FormatSelector({ format, onChange }: FormatSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Format
      </h3>
      <div className="flex gap-1.5">
        {formats.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              format === f.value
                ? "bg-indigo-500 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
