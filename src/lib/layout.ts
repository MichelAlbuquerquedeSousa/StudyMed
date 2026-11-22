import type { CalendarEntry } from "./types";
import { timeToMinutes } from "./time";

export interface PositionedEntry {
  entry: CalendarEntry;
  start: number; // minutos
  end: number; // minutos
  column: number;
  columns: number;
}

const DEFAULT_DURATION = 45;

function bounds(e: CalendarEntry) {
  const start = timeToMinutes(e.startTime!);
  const end = e.endTime ? Math.max(timeToMinutes(e.endTime), start + 15) : start + DEFAULT_DURATION;
  return { start, end };
}

/**
 * Distribui entradas com horário de um mesmo dia em colunas, como o Google Agenda:
 * eventos que se sobrepõem ficam lado a lado; grupos sem sobreposição usam largura total.
 */
export function layoutDay(entries: CalendarEntry[]): PositionedEntry[] {
  const timed = entries
    .filter((e) => e.startTime)
    .map((entry) => ({ entry, ...bounds(entry) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedEntry[] = [];
  let cluster: (typeof timed[number] & { column: number })[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = columnEnds.length;
    for (const c of cluster) result.push({ ...c, columns });
    cluster = [];
    columnEnds = [];
  };

  for (const t of timed) {
    if (t.start >= clusterEnd && cluster.length) flush();
    let column = columnEnds.findIndex((end) => end <= t.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(t.end);
    } else {
      columnEnds[column] = t.end;
    }
    cluster.push({ ...t, column });
    clusterEnd = Math.max(clusterEnd, t.end);
  }
  if (cluster.length) flush();
  return result;
}

/** Pares de entradas com horário que se sobrepõem no mesmo dia. */
export function findConflicts(entries: CalendarEntry[]): [CalendarEntry, CalendarEntry][] {
  const out: [CalendarEntry, CalendarEntry][] = [];
  const timed = entries.filter((e) => e.startTime);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.date !== b.date) continue;
      const ba = bounds(a);
      const bb = bounds(b);
      if (ba.start < bb.end && bb.start < ba.end) out.push([a, b]);
    }
  }
  return out;
}
