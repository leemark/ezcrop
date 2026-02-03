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
      className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
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
          Exporting...
        </span>
      ) : (
        "Export"
      )}
    </button>
  );
}
