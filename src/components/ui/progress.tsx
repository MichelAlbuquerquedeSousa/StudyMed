import clsx from "clsx";
import type { CategoryKey } from "@/lib/types";
import { catVar } from "./icons";

export function ProgressBar({
  percent,
  category = "prova",
  className,
  label,
}: {
  percent: number;
  category?: CategoryKey;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={clsx("h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c)_28%,var(--surface-2))]", className)}
      style={catVar(category)}
    >
      <div
        className="h-full rounded-full bg-[color-mix(in_oklab,var(--c)_80%,var(--ink)_20%)] transition-[width] duration-500 ease-out dark:bg-[var(--c)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Anel de progresso para destaques (cards de prova, dashboard). */
export function ProgressRing({
  percent,
  size = 64,
  stroke = 7,
  category = "prova",
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  category?: CategoryKey;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size, ...catVar(category) }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[color-mix(in_oklab,var(--c)_30%,var(--surface-2))]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="stroke-[color-mix(in_oklab,var(--c)_80%,var(--ink)_20%)] transition-[stroke-dashoffset] duration-700 ease-out dark:stroke-[var(--c)]"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
