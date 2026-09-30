"use client";

export default function InlineSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
}) {
  return (
    <label className="group relative w-full md:w-80">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-ink-4 transition-colors group-focus-within:text-accent"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-strong h-12 w-full rounded-pill pl-12 pr-4 text-sm text-ink shadow-sm transition-all duration-700 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </label>
  );
}
