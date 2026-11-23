"use client";

import { useState } from "react";
import clsx from "clsx";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import {
  addDays,
  addMonths,
  capitalize,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  monthGrid,
  parseISODate,
  weekDays,
  type ISODate,
} from "@/lib/time";
import { useEntries, useUI } from "@/store/ui-store";
import { useNow } from "@/store/use-now";
import { EntryRow } from "../tasks/entry-row";
import { EmptyState } from "../ui/card";
import { CATEGORY_ICONS, catVar } from "../ui/icons";
import { Segmented } from "../ui/segmented";
import { MonthView } from "./month-view";
import { TimeGrid } from "./time-grid";

type View = "dia" | "semana" | "mes";
const VIEW_KEY = "studymed-calendar-view";

function initialView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    if (v) return v;
  } catch {}
  return typeof window !== "undefined" && window.innerWidth < 640 ? "dia" : "semana";
}

export function CalendarView() {
  const now = useNow();
  if (!now) return null;
  return <Calendar today={now.today} nowMinutes={now.minutes} />;
}

function Calendar({ today, nowMinutes }: { today: ISODate; nowMinutes: number }) {
  const [view, setViewState] = useState<View>(initialView);
  const [cursor, setCursor] = useState<ISODate>(today);
  const hidden = useUI((s) => s.hidden);
  const toggleHidden = useUI((s) => s.toggleHidden);
  const openQuickAdd = useUI((s) => s.openQuickAdd);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const days = view === "dia" ? [cursor] : weekDays(cursor);
  const grid = monthGrid(cursor);
  const [from, to] = view === "mes" ? [grid[0], grid[41]] : [days[0], days[days.length - 1]];
  const entries = useEntries(from, to, { respectFilters: true });

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "dia" ? addDays(c, dir) : view === "semana" ? addDays(c, 7 * dir) : addMonths(c, dir)));

  const title =
    view === "dia"
      ? capitalize(formatLongDate(cursor))
      : view === "semana"
        ? weekTitle(days[0], days[6])
        : capitalize(formatMonthYear(cursor));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display mr-1 text-[1.6rem] leading-tight font-medium tracking-tight md:text-3xl">{title}</h1>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Segmented<View>
            label="Visualização"
            value={view}
            onChange={setView}
            options={[
              { value: "dia", label: "Dia" },
              { value: "semana", label: "Semana" },
              { value: "mes", label: "Mês" },
            ]}
          />
          <div className="flex items-center">
            <IconBtn label="Anterior" onClick={() => step(-1)}>
              <ChevronLeft className="size-5" />
            </IconBtn>
            <button
              type="button"
              onClick={() => setCursor(today)}
              className="min-h-10 rounded-full border border-line px-3 text-sm font-medium hover:bg-surface-2 sm:px-4"
            >
              Hoje
            </button>
            <IconBtn label="Próximo" onClick={() => step(1)}>
              <ChevronRight className="size-5" />
            </IconBtn>
          </div>
        </div>
      </div>

      {/* Legenda / filtro por categoria */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar categorias">
        {DEFAULT_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c.key];
          const off = hidden.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={!off}
              onClick={() => toggleHidden(c.key)}
              style={catVar(c.key)}
              className={clsx(
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-medium transition-all",
                off ? "border border-dashed border-line text-muted line-through" : "tint-soft",
              )}
            >
              <span className={clsx("grid size-5 place-items-center rounded-full", off ? "bg-surface-2" : "dot text-ink")}>
                <Icon className="size-3" strokeWidth={2} />
              </span>
              {c.name}
            </button>
          );
        })}
      </div>

      {view === "dia" && <DayStrip cursor={cursor} today={today} onPick={setCursor} />}

      {view === "mes" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <MonthView cursor={cursor} today={today} entries={entries} selected={cursor} onSelectDay={setCursor} />
          <section className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{capitalize(formatLongDate(cursor))}</h2>
              <IconBtn label="Adicionar neste dia" onClick={() => openQuickAdd(cursor)}>
                <CalendarPlus className="size-5" />
              </IconBtn>
            </div>
            <DayList entries={entries.filter((e) => e.date === cursor)} />
            <button type="button" onClick={() => setView("dia")} className="mt-3 text-sm font-medium text-accent">
              Ver em grade de horários →
            </button>
          </section>
        </div>
      ) : (
        <TimeGrid
          days={days}
          entries={entries}
          today={today}
          nowMinutes={nowMinutes}
          onPickDay={
            view === "semana"
              ? (d) => {
                  setCursor(d);
                  setView("dia");
                }
              : undefined
          }
        />
      )}
      <p className="text-center text-xs text-muted">Toque em um horário vazio para adicionar · horários de Fortaleza (UTC−3)</p>
    </div>
  );
}

function DayList({ entries }: { entries: ReturnType<typeof useEntries> }) {
  if (!entries.length) return <EmptyState icon={<CalendarPlus className="size-6" />} title="Nada agendado" />;
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <EntryRow key={e.key} entry={e} />
      ))}
    </ul>
  );
}

function DayStrip({ cursor, today, onPick }: { cursor: ISODate; today: ISODate; onPick: (d: ISODate) => void }) {
  const days = weekDays(cursor);
  return (
    <div className="grid grid-cols-7 gap-1 rounded-2xl border border-line bg-surface p-1 md:hidden">
      {days.map((d) => {
        const active = d === cursor;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onPick(d)}
            aria-pressed={active}
            className={clsx(
              "flex flex-col items-center rounded-xl py-1.5 transition-colors",
              active ? "bg-accent text-accent-fg" : d === today ? "text-accent" : "text-muted",
            )}
          >
            <span className="text-[0.65rem] font-semibold uppercase">{["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][parseISODate(d).getUTCDay()]}</span>
            <span className="text-base font-semibold tabular-nums">{parseISODate(d).getUTCDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-9 place-items-center rounded-full text-muted sm:size-10 hover:bg-surface-2 hover:text-fg">
      {children}
    </button>
  );
}

function weekTitle(a: ISODate, b: ISODate) {
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  if (sameMonth) return `${parseISODate(a).getUTCDate()} – ${formatShortDate(b).replace(".", "")}`;
  return `${formatShortDate(a).replace(".", "")} – ${formatShortDate(b).replace(".", "")}`;
}
