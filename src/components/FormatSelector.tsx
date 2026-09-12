import type { OutputFormat } from "../types";

interface FormatSelectorProps {
  format: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

const formats: { value: OutputFormat; label: string; hint: string }[] = [
  { value: "webp", label: "WebP", hint: "Best balance" },
  { value: "jpeg", label: "JPEG", hint: "Compatible" },
  { value: "avif", label: "AVIF", hint: "Compact; slower to encode" },
];

export function FormatSelector({ format, onChange }: FormatSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-syne text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
        Format
      </h3>
      <div className="flex gap-1">
        {formats.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            title={f.hint}
            aria-pressed={format === f.value}
            className={`flex flex-1 flex-col items-center rounded-lg py-2 transition-colors ${
              format === f.value
                ? "bg-amber-500 text-zinc-900 shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400`}
          >
            <span className="font-mono text-xs font-medium">{f.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        JPEG turns transparent areas black. Choose WebP or AVIF to keep transparency.
      </p>
    </div>
  );
}
