"use client";

import clsx from "clsx";
import { MapPin, Repeat } from "lucide-react";
import { CATEGORY_SINGULAR } from "@/lib/categories";
import { formatTimeRange } from "@/lib/time";
import type { CalendarEntry } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useUI } from "@/store/ui-store";
import { Checkbox } from "../ui/checkbox";
import { CATEGORY_ICONS, catVar } from "../ui/icons";

/** Linha de agenda/tarefa: barra de cor da categoria, checkbox para tarefas, ícone para eventos fixos. */
export function EntryRow({ entry, showDate }: { entry: CalendarEntry; showDate?: string }) {
  const toggle = useApp((s) => s.toggleEntry);
  const select = useUI((s) => s.select);
  const Icon = CATEGORY_ICONS[entry.category];
  const isTask = entry.kind === "tarefa";

  return (
    <li
      className={clsx(
        "tint-soft tint-bar group flex items-center gap-1 rounded-2xl py-1.5 pr-3 pl-1.5 transition-opacity",
        entry.done && "opacity-60",
      )}
      style={catVar(entry.category)}
    >
      {isTask ? (
        <Checkbox
          checked={entry.done}
          onChange={() => toggle(entry)}
          category={entry.category}
          label={`${entry.done ? "Desmarcar" : "Concluir"}: ${entry.title}`}
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center" title={entry.kind === "prova" ? "Prova" : "Evento fixo"}>
          <span className="tint grid size-8 place-items-center rounded-xl">
            <Icon className="size-4" strokeWidth={1.8} />
          </span>
        </span>
      )}
      <button type="button" onClick={() => select(entry)} className="min-w-0 flex-1 py-1.5 text-left">
        <span className={clsx("block truncate font-medium", entry.done && "line-through decoration-1")}>{entry.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8rem] text-muted">
          {showDate && <span>{showDate}</span>}
          <span className="tabular-nums">{formatTimeRange(entry.startTime, entry.endTime)}</span>
          <span aria-hidden>·</span>
          <span>{CATEGORY_SINGULAR[entry.category]}</span>
          {entry.recurring && <Repeat className="size-3" aria-label="Semanal" />}
          {entry.location && (
            <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
              <MapPin className="size-3 shrink-0" />
              {entry.location}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
