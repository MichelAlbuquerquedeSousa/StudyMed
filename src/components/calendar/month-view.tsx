"use client";

import clsx from "clsx";
import { isSameMonth, monthGrid, parseISODate, type ISODate } from "@/lib/time";
import type { CalendarEntry } from "@/lib/types";
import { useUI } from "@/store/ui-store";
import { catVar } from "../ui/icons";

const HEAD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function MonthView({
  cursor,
  today,
  entries,
  selected,
  onSelectDay,
}: {
  cursor: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  selected: ISODate;
  onSelectDay: (d: ISODate) => void;
}) {
  const select = useUI((s) => s.select);
  const days = monthGrid(cursor);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-soft">
      <div className="grid grid-cols-7 border-b border-line">
        {HEAD.map((h) => (
          <div key={h} className="py-2 text-center text-[0.7rem] font-semibold tracking-wide text-muted uppercase">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = entries.filter((e) => e.date === d);
          const inMonth = isSameMonth(d, cursor);
          const isToday = d === today;
          const isSelected = d === selected;
          const visible = list.slice(0, 3);
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${parseISODate(d).getUTCDate()}, ${list.length} itens`}
              onClick={() => onSelectDay(d)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectDay(d))}
              className={clsx(
                "flex min-h-[4.25rem] cursor-pointer flex-col gap-1 border-line p-1 text-left transition-colors outline-none sm:min-h-[6.5rem] sm:p-1.5",
                i % 7 !== 0 && "border-l",
                i >= 7 && "border-t",
                !inMonth && "bg-surface-2/50",
                isSelected ? "bg-[color-mix(in_oklab,var(--accent-soft)_28%,var(--surface))]" : "hover:bg-surface-2/60",
              )}
            >
              <span
                className={clsx(
                  "grid size-7 place-items-center self-center rounded-full text-sm font-semibold tabular-nums sm:self-start",
                  isToday && "bg-accent text-accent-fg",
                  !inMonth && !isToday && "text-muted/60",
                )}
              >
                {parseISODate(d).getUTCDate()}
              </span>

              {/* Celular: pontinhos coloridos */}
              <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {list.slice(0, 5).map((e) => (
                  <span key={e.key} className={clsx("dot size-1.5 rounded-full", e.done && "opacity-40")} style={catVar(e.category)} />
                ))}
              </span>

              {/* Tablet/desktop: chips */}
              <span className="hidden flex-col gap-0.5 sm:flex">
                {visible.map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      select(e);
                    }}
                    style={catVar(e.category)}
                    className={clsx("tint truncate rounded-md px-1.5 py-0.5 text-left text-[0.7rem] font-medium", e.done && "line-through opacity-55")}
                  >
                    {e.startTime && <span className="mr-1 opacity-70 tabular-nums">{e.startTime}</span>}
                    {e.title}
                  </button>
                ))}
                {list.length > visible.length && (
                  <span className="px-1.5 text-[0.7rem] font-medium text-muted">+{list.length - visible.length} mais</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
