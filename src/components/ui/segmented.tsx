"use client";

import clsx from "clsx";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-9 rounded-full px-3.5 text-sm sm:px-4 font-medium transition-all",
            value === o.value ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-xs tabular-nums opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
