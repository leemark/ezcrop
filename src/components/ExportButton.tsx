interface ExportButtonProps {
  onClick: () => void;
  exporting: boolean;
  disabled: boolean;
}

export function ExportButton({
  onClick,
  exporting,
  disabled,
}: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || exporting}
      className="w-full rounded-xl bg-amber-500 px-4 py-3 font-syne text-sm font-bold tracking-wide text-white shadow-sm transition-all hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-amber-400"
    >
      {exporting ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-75"
            />
          </svg>
          Exporting…
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export Image
        </span>
      )}
    </button>
  );
}
