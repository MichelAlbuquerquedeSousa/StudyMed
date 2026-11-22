/** Conversão entre as linhas do Postgres (snake_case) e os tipos do app. Funções puras e testadas. */
import { DEFAULT_CATEGORIES } from "../categories";
import type { Category, CategoryKey, DataSource, Exam, ExamTopic, Item, ItemKind, OccurrenceOverride, WeeklyRecurrence } from "../types";

export interface ItemRow {
  id: string;
  kind: ItemKind;
  title: string;
  category: CategoryKey;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  recurrence: WeeklyRecurrence | null;
  done_at: string | null;
  source: DataSource;
}

export interface OccurrenceRow {
  item_id: string;
  occurrence_date: string;
  done: boolean;
  cancelled: boolean;
  move_date: string | null;
  move_start_time: string | null;
  move_end_time: string | null;
}

export interface ExamRow {
  id: string;
  subject: string;
  title: string;
  date: string;
  start_time: string | null;
  location: string | null;
  notes: string | null;
  source: DataSource;
}

export interface TopicRow {
  id: string;
  exam_id: string;
  title: string;
  done: boolean;
  done_at?: string | null;
  position: number;
}

/** "07:30:00" → "07:30" */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : undefined);
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);
const nul = <T,>(v: T | undefined) => (v === undefined || v === "" ? null : v);

export function itemFromRow(r: ItemRow): Item {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    category: r.category,
    date: opt(r.date),
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    location: opt(r.location),
    notes: opt(r.notes),
    recurrence: opt(r.recurrence),
    doneAt: r.done_at,
    source: r.source,
  };
}

export function itemToRow(i: Item): ItemRow {
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    category: i.category,
    date: i.recurrence ? null : nul(i.date),
    start_time: nul(i.startTime),
    end_time: nul(i.endTime),
    location: nul(i.location),
    notes: nul(i.notes),
    recurrence: i.recurrence ?? null,
    done_at: i.kind === "tarefa" ? (i.doneAt ?? null) : null,
    source: i.source,
  };
}

export function occurrenceFromRow(r: OccurrenceRow): OccurrenceOverride {
  return {
    itemId: r.item_id,
    date: r.occurrence_date,
    done: r.done,
    cancelled: r.cancelled,
    moveTo: r.move_date ? { date: r.move_date, startTime: hhmm(r.move_start_time), endTime: hhmm(r.move_end_time) } : undefined,
  };
}

export function occurrenceToRow(o: OccurrenceOverride): OccurrenceRow {
  return {
    item_id: o.itemId,
    occurrence_date: o.date,
    done: Boolean(o.done),
    cancelled: Boolean(o.cancelled),
    move_date: o.moveTo?.date ?? null,
    move_start_time: nul(o.moveTo?.startTime),
    move_end_time: nul(o.moveTo?.endTime),
  };
}

export function examsFromRows(exams: ExamRow[], topics: TopicRow[]): Exam[] {
  const byExam = new Map<string, TopicRow[]>();
  for (const t of topics) byExam.set(t.exam_id, [...(byExam.get(t.exam_id) ?? []), t]);
  return exams.map((e) => ({
    id: e.id,
    subject: e.subject,
    title: e.title,
    date: e.date,
    startTime: hhmm(e.start_time),
    location: opt(e.location),
    notes: opt(e.notes),
    source: e.source,
    topics: (byExam.get(e.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((t): ExamTopic => ({ id: t.id, title: t.title, done: t.done })),
  }));
}

export function examToRow(e: Exam): ExamRow {
  return {
    id: e.id,
    subject: e.subject,
    title: e.title,
    date: e.date,
    start_time: nul(e.startTime),
    location: nul(e.location),
    notes: nul(e.notes),
    source: e.source,
  };
}

export function topicsToRows(examId: string, topics: ExamTopic[]): TopicRow[] {
  return topics.map((t, position) => ({ id: t.id, exam_id: examId, title: t.title, done: t.done, position }));
}

/** Aplica as cores salvas sobre as categorias padrão (ignora valores inválidos). */
export function categoriesFromColors(colors: Record<string, string> | null | undefined): Category[] {
  return DEFAULT_CATEGORIES.map((c) => {
    const v = colors?.[c.key];
    return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? { ...c, color: v } : c;
  });
}

/** Só grava as cores que diferem do padrão. */
export function colorsFromCategories(categories: Category[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of categories) {
    const def = DEFAULT_CATEGORIES.find((d) => d.key === c.key);
    if (def && def.color.toLowerCase() !== c.color.toLowerCase()) out[c.key] = c.color;
  }
  return out;
}
