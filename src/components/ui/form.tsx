import clsx from "clsx";

/** 16px evita o zoom automático do Safari no iPhone ao focar o campo. */
export const fieldClass =
  "w-full min-w-0 min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-[16px] text-fg outline-none transition-colors focus:border-accent";

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block min-w-0 text-sm font-medium text-muted", className)}>
      {label}
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs font-normal">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-[color-mix(in_oklab,var(--cat-prova)_30%,var(--surface))] px-3 py-2 text-sm font-medium">
      {message}
    </p>
  );
}

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx(
        "min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx("inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50", className)}
    >
      {children}
    </button>
  );
}

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayPicker({ value, onChange, style }: { value: number[]; onChange: (v: number[]) => void; style?: React.CSSProperties }) {
  return (
    <div className="flex justify-between gap-1" role="group" aria-label="Dias da semana">
      {WEEKDAY_ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_NAMES[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
            style={style}
            className={clsx("grid size-10 place-items-center rounded-full text-sm font-semibold transition-colors", on ? "tint" : "bg-surface-2 text-muted")}
          >
            {WEEKDAY_LETTERS[d]}
          </button>
        );
      })}
    </div>
  );
}

/** Data + início + fim: no celular a data ocupa a linha inteira; a partir de 640px, tudo em uma linha. */
export const dateTimeGrid = "grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr] [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1";
