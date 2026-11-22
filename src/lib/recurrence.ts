import type { CalendarEntry, Exam, Item, OccurrenceOverride } from "./types";
import { addDays, timeToMinutes, weekdayOf, type ISODate } from "./time";

export function occurrenceKey(itemId: string, date: ISODate) {
  return `${itemId}@${date}`;
}

function overrideMap(overrides: OccurrenceOverride[]) {
  return new Map(overrides.map((o) => [occurrenceKey(o.itemId, o.date), o]));
}

/** Datas originais em que um item recorrente acontece dentro de [from, to]. */
export function recurringDates(item: Item, from: ISODate, to: ISODate): ISODate[] {
  const r = item.recurrence;
  if (!r) return [];
  const start = r.startsOn > from ? r.startsOn : from;
  const end = r.endsOn && r.endsOn < to ? r.endsOn : to;
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (r.weekdays.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

function entryFromItem(item: Item, date: ISODate, override?: OccurrenceOverride): CalendarEntry {
  const moved = override?.moveTo;
  const recurring = Boolean(item.recurrence);
  return {
    key: occurrenceKey(item.id, date),
    kind: item.kind,
    title: item.title,
    category: item.category,
    date: moved?.date ?? date,
    startTime: moved ? moved.startTime : item.startTime,
    endTime: moved ? moved.endTime : item.endTime,
    location: item.location,
    notes: item.notes,
    done: recurring ? Boolean(override?.done) : Boolean(item.doneAt),
    recurring,
    itemId: item.id,
    originalDate: date,
    source: item.source,
  };
}

export function sortEntries(a: CalendarEntry, b: CalendarEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.startTime ? timeToMinutes(a.startTime) : -1;
  const tb = b.startTime ? timeToMinutes(b.startTime) : -1;
  if (ta !== tb) return ta - tb;
  return a.title.localeCompare(b.title, "pt-BR");
}

/**
 * Expande itens (avulsos e recorrentes) e provas em entradas de calendário
 * no intervalo [from, to], aplicando cancelamentos, reagendamentos e conclusões.
 */
export function expandEntries(
  items: Item[],
  overrides: OccurrenceOverride[],
  exams: Exam[],
  from: ISODate,
  to: ISODate,
): CalendarEntry[] {
  const ovr = overrideMap(overrides);
  const out: CalendarEntry[] = [];
  const inRange = (d: ISODate) => d >= from && d <= to;

  for (const item of items) {
    if (item.recurrence) {
      // Ocorrências podem ter sido movidas para dentro do intervalo a partir de fora dele;
      // ampliamos a busca e filtramos pela data final.
      const margin = 62;
      for (const date of recurringDates(item, addDays(from, -margin), addDays(to, margin))) {
        const o = ovr.get(occurrenceKey(item.id, date));
        if (o?.cancelled) continue;
        const entry = entryFromItem(item, date, o);
        if (inRange(entry.date)) out.push(entry);
      }
    } else if (item.date && inRange(item.date)) {
      out.push(entryFromItem(item, item.date));
    }
  }

  for (const exam of exams) {
    if (!inRange(exam.date)) continue;
    out.push({
      key: `exam:${exam.id}`,
      kind: "prova",
      title: `Prova · ${exam.subject}`,
      category: "prova",
      date: exam.date,
      startTime: exam.startTime,
      endTime: exam.startTime ? addMinutes(exam.startTime, 120) : undefined,
      location: exam.location,
      notes: exam.notes,
      done: false,
      recurring: false,
      examId: exam.id,
      source: exam.source,
    });
  }

  return out.sort(sortEntries);
}

function addMinutes(t: string, n: number): string {
  const m = Math.min(timeToMinutes(t) + n, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Tarefas avulsas não concluídas com data anterior a hoje. */
export function overdueTasks(items: Item[], today: ISODate): CalendarEntry[] {
  return items
    .filter((i) => i.kind === "tarefa" && !i.recurrence && !i.doneAt && i.date && i.date < today)
    .map((i) => entryFromItem(i, i.date!))
    .sort(sortEntries);
}

/** Tarefas sem data (caixa de entrada). */
export function undatedTasks(items: Item[]): Item[] {
  return items.filter((i) => i.kind === "tarefa" && !i.recurrence && !i.date);
}

