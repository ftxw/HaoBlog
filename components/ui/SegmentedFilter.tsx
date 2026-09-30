"use client";

interface SegmentedOption {
  value: string;
  label: string;
  count?: number;
}

export default function SegmentedFilter({
  options,
  active,
  onChange,
  variant = "pill",
  className = "",
  ariaLabel = "筛选",
}: {
  options: SegmentedOption[];
  active: string;
  onChange: (value: string) => void;
  variant?: "pill" | "bar";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`glass flex flex-wrap gap-2 rounded-card p-3 ${
        variant === "bar" ? "w-full" : "mx-auto w-fit"
      } ${className}`}
    >
      <div
        role="group"
        aria-label={ariaLabel}
        className={`flex w-full flex-wrap gap-2 ${
          variant === "bar" ? "justify-center md:justify-start" : "justify-center"
        }`}
      >
        {options.map((opt) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-300 ${
                isActive
                  ? "bg-accent text-accent-ink shadow-md"
                  : "text-ink-3 hover:text-accent"
              }`}
            >
              {opt.label}
              {typeof opt.count === "number" && (
                <span className="text-xs opacity-70">{opt.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
