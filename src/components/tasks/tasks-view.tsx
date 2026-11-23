"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Inbox } from "lucide-react";
import { overdueTasks } from "@/lib/recurrence";
import { addDays, capitalize, formatLongDate, type ISODate } from "@/lib/time";
import type { CalendarEntry } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useEntries } from "@/store/ui-store";
import { useNow } from "@/store/use-now";
import { EmptyState, PageHeader } from "../ui/card";
import { Segmented } from "../ui/segmented";
import { EntryRow } from "./entry-row";

type Tab = "pendentes" | "concluidas";

export function TasksView() {
  const now = useNow();
  const today = now?.today ?? null;
  const items = useApp((s) => s.items);
  const [tab, setTab] = useState<Tab>("pendentes");
  const upcoming = useEntries(today, today ? addDays(today, 13) : null);
  const recent = useEntries(today ? addDays(today, -13) : null, today);

  const { pending, done } = useMemo(() => {
    if (!today) return { pending: [], done: [] };
    const tasks = (l: CalendarEntry[]) => l.filter((e) => e.kind === "tarefa");
    const pending = [...overdueTasks(items, today), ...tasks(upcoming).filter((e) => !e.done)];
    const done = tasks(recent)
      .filter((e) => e.done)
      .reverse();
    return { pending, done };
  }, [items, upcoming, recent, today]);

  if (!today) return null;
  const undated: CalendarEntry[] = items
    .filter((i) => i.kind === "tarefa" && !i.recurrence && !i.date && (tab === "pendentes" ? !i.doneAt : Boolean(i.doneAt)))
    .map((i) => ({ key: i.id, kind: "tarefa", title: i.title, category: i.category, date: "", location: i.location, notes: i.notes, done: Boolean(i.doneAt), recurring: false, itemId: i.id, source: i.source }));

  const list = tab === "pendentes" ? pending : done;
  const groups = groupByDay(list, today);

  return (
    <div>
      <PageHeader
        title="Tarefas"
        subtitle="Próximas duas semanas e concluídas recentemente"
        actions={
          <Segmented<Tab>
            label="Filtro de tarefas"
            value={tab}
            onChange={setTab}
            options={[
              { value: "pendentes", label: "Pendentes", count: pending.length + items.filter((i) => i.kind === "tarefa" && !i.recurrence && !i.date && !i.doneAt).length },
              { value: "concluidas", label: "Concluídas", count: done.length },
            ]}
          />
        }
      />
      {list.length === 0 && undated.length === 0 ? (
        <EmptyState
          icon={tab === "pendentes" ? <CheckCheck className="size-6" /> : <Inbox className="size-6" />}
          title={tab === "pendentes" ? "Nenhuma tarefa pendente" : "Nada concluído ainda"}
          text={tab === "pendentes" ? "Use o botão + para adicionar." : "Marque tarefas para vê-las aqui."}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {undated.length > 0 && (
            <section className="min-w-0">
              <h2 className="mb-2 text-sm font-semibold text-muted">
                Sem data <span className="font-normal tabular-nums opacity-70">· {undated.length}</span>
              </h2>
              <ul className="space-y-2">
                {undated.map((e) => (
                  <EntryRow key={e.key} entry={e} />
                ))}
              </ul>
            </section>
          )}
          {groups.map(({ label, entries, alert }) => (
            <section key={label} className="min-w-0">
              <h2 className={`mb-2 text-sm font-semibold ${alert ? "text-accent" : "text-muted"}`}>
                {label} <span className="font-normal tabular-nums opacity-70">· {entries.length}</span>
              </h2>
              <ul className="space-y-2">
                {entries.map((e) => (
                  <EntryRow key={e.key} entry={e} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDay(list: CalendarEntry[], today: ISODate) {
  const groups: { label: string; entries: CalendarEntry[]; alert?: boolean }[] = [];
  for (const e of list) {
    const label =
      e.date < today && !e.done
        ? "Atrasadas"
        : e.date === today
          ? "Hoje"
          : e.date === addDays(today, 1)
            ? "Amanhã"
            : e.date === addDays(today, -1)
              ? "Ontem"
              : capitalize(formatLongDate(e.date));
    const g = groups.find((x) => x.label === label);
    if (g) g.entries.push(e);
    else groups.push({ label, entries: [e], alert: label === "Atrasadas" });
  }
  return groups;
}
