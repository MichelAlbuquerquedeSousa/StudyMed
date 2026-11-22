"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { Check, Repeat } from "lucide-react";
import { layoutDay } from "@/lib/layout";
import { formatWeekdayShort, minutesToTime, parseISODate, type ISODate } from "@/lib/time";
import type { CalendarEntry } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useUI } from "@/store/ui-store";
import { catVar } from "../ui/icons";

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_PX = 56;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

interface Props {
  days: ISODate[];
  entries: CalendarEntry[];
  today: ISODate;
  nowMinutes: number;
  onPickDay?: (d: ISODate) => void;
}

/** Grade de horários estilo Google Agenda (visões Dia e Semana). */
export function TimeGrid({ days, entries, today, nowMinutes, onPickDay }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const select = useUI((s) => s.select);
  const toggle = useApp((s) => s.toggleEntry);
  const isWeek = days.length > 1;

  // Começa a rolagem perto das 7h.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = (7 - START_HOUR) * HOUR_PX - 8;
  }, []);

  const byDay = new Map(days.map((d) => [d, entries.filter((e) => e.date === d)]));
  const hasUntimed = entries.some((e) => !e.startTime);
  const colMin = isWeek ? "max-sm:min-w-[7.25rem]" : "";
  const gridCols = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-soft">
      <div ref={scroller} className="max-h-[calc(100dvh-15rem)] min-h-[26rem] overflow-auto overscroll-contain md:max-h-[calc(100dvh-13rem)]">
        <div className={clsx(isWeek && "max-sm:min-w-[54rem]")}>
          {/* Cabeçalho fixo: dias + tarefas sem horário */}
          <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur">
          <div className={clsx("grid border-b border-line", !isWeek && "max-md:hidden")} style={gridCols}>
            <div className="sticky left-0 z-10 bg-surface/95" />
            {days.map((d) => {
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onPickDay?.(d)}
                  disabled={!onPickDay}
                  className={clsx("flex flex-col items-center gap-0.5 py-2.5", colMin)}
                >
                  <span className={clsx("text-[0.7rem] font-semibold tracking-wide uppercase", isToday ? "text-accent" : "text-muted")}>
                    {formatWeekdayShort(d).replace(".", "")}
                  </span>
                  <span
                    className={clsx(
                      "grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums",
                      isToday && "bg-accent text-accent-fg",
                    )}
                  >
                    {parseISODate(d).getUTCDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tarefas sem horário */}
          {hasUntimed && (
            <div className="grid border-b border-line bg-surface-2/60" style={gridCols}>
              <div className="sticky left-0 z-10 flex items-start justify-end pt-2 pr-2 text-[0.65rem] leading-tight text-muted">
                sem
                <br />
                horário
              </div>
              {days.map((d) => (
                <div key={d} className={clsx("space-y-1 border-l border-line p-1", colMin)}>
                  {byDay
                    .get(d)!
                    .filter((e) => !e.startTime)
                    .map((e) => (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => select(e)}
                        style={catVar(e.category)}
                        className={clsx("tint flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-xs font-medium", e.done && "opacity-55")}
                      >
                        {e.kind === "tarefa" && (
                          <span
                            role="checkbox"
                            aria-checked={e.done}
                            aria-label={`Concluir ${e.title}`}
                            tabIndex={0}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggle(e);
                            }}
                            onKeyDown={(ev) => {
                              if (ev.key === " " || ev.key === "Enter") {
                                ev.preventDefault();
                                ev.stopPropagation();
                                toggle(e);
                              }
                            }}
                            className="grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-current/60 bg-white/50 dark:bg-transparent"
                          >
                            {e.done && <Check className="size-3" strokeWidth={3} />}
                          </span>
                        )}
                        <span className={clsx("truncate", e.done && "line-through")}>{e.title}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Corpo com horas */}
          <div className="grid" style={gridCols}>
            <div className="sticky left-0 z-10 bg-surface">
              {HOURS.map((h) => (
                <div key={h} className="relative text-right text-[0.7rem] text-muted tabular-nums" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2 right-2">{h > START_HOUR ? `${h}h` : ""}</span>
                </div>
              ))}
            </div>
            {days.map((d) => (
              <DayColumn
                key={d}
                date={d}
                entries={byDay.get(d)!}
                isToday={d === today}
                nowMinutes={nowMinutes}
                compact={isWeek}
                className={colMin}
                onEmptyClick={(min) => openQuickAdd(d, minutesToTime(min))}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  date,
  entries,
  isToday,
  nowMinutes,
  compact,
  className,
  onEmptyClick,
}: {
  date: ISODate;
  entries: CalendarEntry[];
  isToday: boolean;
  nowMinutes: number;
  compact: boolean;
  className?: string;
  onEmptyClick: (minutes: number) => void;
}) {
  const select = useUI((s) => s.select);
  const positioned = layoutDay(entries);
  const top = (min: number) => ((min - START_HOUR * 60) / 60) * HOUR_PX;

  return (
    <div
      className={clsx("relative border-l border-line", isToday && "bg-[color-mix(in_oklab,var(--accent-soft)_10%,transparent)]", className)}
      style={{
        height: HOURS.length * HOUR_PX,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const y = e.nativeEvent.offsetY;
        const min = START_HOUR * 60 + Math.floor((y / HOUR_PX) * 2) * 30; // arredonda para meia hora
        onEmptyClick(min);
      }}
      aria-label={`Horários de ${date}`}
    >
      {positioned.map(({ entry, start, end, column, columns }) => {
        const height = Math.max(top(end) - top(start) - 2, 22);
        const small = height < 44;
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => select(entry)}
            style={{
              ...catVar(entry.category),
              top: top(start) + 1,
              height,
              left: `calc(${(column / columns) * 100}% + 2px)`,
              width: `calc(${100 / columns}% - 4px)`,
            }}
            className={clsx(
              "tint tint-bar absolute overflow-hidden rounded-lg px-2 text-left shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-[filter] hover:brightness-[0.97]",
              small ? "py-0.5" : "py-1.5",
              entry.done && "opacity-55",
            )}
          >
            <span className={clsx("flex items-start gap-1 font-semibold", compact ? "text-[0.72rem] leading-tight" : "text-sm", entry.done && "line-through")}>
              {entry.kind === "tarefa" && (
                <span className="mt-px grid size-3.5 shrink-0 place-items-center rounded-[4px] border-[1.5px] border-current/60">
                  {entry.done && <Check className="size-2.5" strokeWidth={3.5} />}
                </span>
              )}
              <span className={clsx(small ? "truncate" : "line-clamp-2")}>{entry.title}</span>
            </span>
            {!small && (
              <span className={clsx("mt-0.5 flex items-center gap-1 opacity-75 tabular-nums", compact ? "text-[0.65rem]" : "text-xs")}>
                {entry.startTime}
                {entry.endTime && `–${entry.endTime}`}
                {entry.recurring && <Repeat className="size-2.5" aria-label="semanal" />}
              </span>
            )}
            {!small && !compact && entry.location && <span className="block truncate text-xs opacity-75">{entry.location}</span>}
          </button>
        );
      })}

      {isToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowMinutes) - 5 }} aria-label="Agora">
          <span className="-ml-[5px] size-2.5 rounded-full bg-accent" />
          <span className="h-0.5 flex-1 bg-accent" />
        </div>
      )}
    </div>
  );
}
