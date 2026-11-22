"use client";

import { useState } from "react";
import clsx from "clsx";
import type { CategoryKey } from "@/lib/types";
import { catVar } from "./icons";

interface Props {
  checked: boolean;
  onChange: () => void;
  label: string;
  category?: CategoryKey;
  size?: "md" | "lg";
}

/** Checkbox grande (alvo de toque ≥ 44px) com animação discreta ao concluir. */
export function Checkbox({ checked, onChange, label, category = "prova", size = "lg" }: Props) {
  const [burst, setBurst] = useState(0);
  const box = size === "lg" ? "size-7" : "size-6";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (!checked) setBurst((b) => b + 1);
        onChange();
      }}
      className="relative grid size-11 shrink-0 place-items-center rounded-full"
      style={catVar(category)}
    >
      {burst > 0 && checked && (
        <span key={burst} aria-hidden className="dot anim-sparkle pointer-events-none absolute inset-1.5 rounded-full" />
      )}
      <span
        key={checked ? `on-${burst}` : "off"}
        className={clsx(
          box,
          "relative grid place-items-center rounded-[9px] border-2 transition-colors duration-200",
          checked
            ? "anim-pop border-transparent bg-[color-mix(in_oklab,var(--c)_70%,var(--ink))] dark:bg-[var(--c)]"
            : "border-[color-mix(in_oklab,var(--c)_75%,var(--text)_25%)] bg-surface hover:bg-[color-mix(in_oklab,var(--c)_25%,var(--surface))]",
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="size-[70%] text-white dark:text-ink" fill="none" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="anim-draw" />
          </svg>
        )}
      </span>
    </button>
  );
}
