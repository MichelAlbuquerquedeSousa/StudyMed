/** Rascunhos de formulário, validação e conversão. Funções puras (testadas em tests/forms.test.ts). */
import type { CalendarEntry, CategoryKey, Exam, Item, ItemKind, OccurrenceOverride } from "./types";
import { minutesToTime, timeToMinutes, weekdayOf, type HHMM, type ISODate } from "./time";
import { occurrenceKey } from "./recurrence";

// ---------------- Atividades (eventos e tarefas) ----------------

export interface ItemDraft {
  kind: ItemKind;
  title: string;
  category: CategoryKey;
  /** "" = tarefa sem data */
  date: ISODate | "";
  startTime: HHMM | "";
  endTime: HHMM | "";
  location: string;
  notes: string;
  repeat: boolean;
  weekdays: number[];
  /** "" = repete sem data de término */
  repeatUntil: ISODate | "";
}

export function emptyItemDraft(date: ISODate, startTime = ""): ItemDraft {
  return {
    kind: "tarefa",
    title: "",
    category: "estudo",
    date,
    startTime,
    endTime: startTime ? minutesToTime(Math.min(timeToMinutes(startTime) + 60, 23 * 60 + 59)) : "",
    location: "",
    notes: "",
    repeat: false,
    weekdays: [weekdayOf(date)],
    repeatUntil: "",
  };
}

export function itemToDraft(item: Item, fallbackDate: ISODate): ItemDraft {
  const r = item.recurrence;
  return {
    kind: item.kind,
    title: item.title,
    category: item.category,
    date: r ? r.startsOn : (item.date ?? ""),
    startTime: item.startTime ?? "",
    endTime: item.endTime ?? "",
    location: item.location ?? "",
    notes: item.notes ?? "",
    repeat: Boolean(r),
    weekdays: r ? r.weekdays : [weekdayOf(item.date ?? fallbackDate)],
    repeatUntil: r?.endsOn ?? "",
  };
}

/** Devolve a mensagem do primeiro problema encontrado, ou null se o rascunho é válido. */
export function validateItemDraft(d: ItemDraft): string | null {
  if (!d.title.trim()) return "Dê um título para a atividade.";
  if (d.title.trim().length > 200) return "O título pode ter no máximo 200 caracteres.";
  if (d.kind === "evento" && !d.date) return "Eventos fixos precisam de uma data.";
  if (d.repeat && !d.date) return "Informe a partir de quando a atividade se repete.";
  if (d.endTime && !d.startTime) return "Informe o horário de início.";
  if (d.startTime && d.endTime && timeToMinutes(d.endTime) <= timeToMinutes(d.startTime)) return "O término deve ser depois do início.";
  if (d.repeat && d.weekdays.length === 0) return "Escolha ao menos um dia da semana.";
  if (d.repeat && d.repeatUntil && d.date && d.repeatUntil < d.date) return "A repetição deve terminar depois de começar.";
  return null;
}

export function draftToItem(d: ItemDraft): Omit<Item, "id" | "source"> {
  const opt = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    kind: d.kind,
    title: d.title.trim(),
    category: d.category,
    date: d.repeat ? undefined : opt(d.date),
    startTime: opt(d.startTime),
    endTime: d.startTime ? opt(d.endTime) : undefined,
    location: opt(d.location),
    notes: opt(d.notes),
    recurrence: d.repeat
      ? { freq: "weekly", weekdays: [...d.weekdays].sort((a, b) => a - b), startsOn: d.date, ...(d.repeatUntil ? { endsOn: d.repeatUntil } : {}) }
      : undefined,
    doneAt: null,
  };
}

// ---------------- Reagendamento ----------------

export interface RescheduleTarget {
  date: ISODate;
  startTime?: HHMM;
  endTime?: HHMM;
}

/** Mantém a duração original ao trocar o horário de início. */
export function shiftEnd(oldStart: HHMM | undefined, oldEnd: HHMM | undefined, newStart: HHMM): HHMM | undefined {
  if (!oldStart || !oldEnd) return undefined;
  const end = timeToMinutes(newStart) + (timeToMinutes(oldEnd) - timeToMinutes(oldStart));
  return end > 23 * 60 + 59 ? undefined : minutesToTime(end);
}

export type RescheduleResult = { kind: "item"; item: Item } | { kind: "occurrence"; override: OccurrenceOverride };

/**
 * Reagenda uma entrada. Itens avulsos mudam a própria data/horário; ocorrências de itens
 * recorrentes ganham um ajuste "moveTo" (ou o perdem, se voltarem ao dia e horário originais).
 */
export function reschedule(entry: CalendarEntry, items: Item[], overrides: OccurrenceOverride[], target: RescheduleTarget): RescheduleResult | null {
  const item = items.find((i) => i.id === entry.itemId);
  if (!item) return null;
  if (!item.recurrence) {
    return { kind: "item", item: { ...item, date: target.date, startTime: target.startTime, endTime: target.startTime ? target.endTime : undefined } };
  }
  const date = entry.originalDate ?? entry.date;
  const existing = overrides.find((o) => occurrenceKey(o.itemId, o.date) === occurrenceKey(item.id, date));
  const backToOriginal = target.date === date && target.startTime === item.startTime && target.endTime === item.endTime;
  return {
    kind: "occurrence",
    override: {
      itemId: item.id,
      date,
      done: existing?.done ?? false,
      cancelled: false,
      moveTo: backToOriginal ? undefined : { date: target.date, startTime: target.startTime, endTime: target.startTime ? target.endTime : undefined },
    },
  };
}

// ---------------- Provas ----------------

export interface ExamDraft {
  subject: string;
  title: string;
  date: ISODate | "";
  startTime: HHMM | "";
  location: string;
  notes: string;
  /** Um conteúdo por linha (só na criação). */
  topicsText: string;
}

export function emptyExamDraft(date: ISODate | "" = ""): ExamDraft {
  return { subject: "", title: "", date, startTime: "", location: "", notes: "", topicsText: "" };
}

export function examToDraft(e: Exam): ExamDraft {
  return { subject: e.subject, title: e.title, date: e.date, startTime: e.startTime ?? "", location: e.location ?? "", notes: e.notes ?? "", topicsText: "" };
}

export function validateExamDraft(d: ExamDraft): string | null {
  if (!d.subject.trim()) return "Informe a disciplina.";
  if (!d.date) return "Informe a data da prova.";
  if (d.subject.trim().length > 120) return "A disciplina pode ter no máximo 120 caracteres.";
  if (d.title.trim().length > 200) return "O título pode ter no máximo 200 caracteres.";
  return null;
}

export function draftToExamFields(d: ExamDraft): Omit<Exam, "id" | "source" | "topics"> {
  const subject = d.subject.trim();
  return {
    subject,
    title: d.title.trim() || `Prova — ${subject}`,
    date: d.date,
    startTime: d.startTime || undefined,
    location: d.location.trim() || undefined,
    notes: d.notes.trim() || undefined,
  };
}

/**
 * Converte texto colado (um conteúdo por linha) em títulos limpos:
 * remove marcadores ("-", "•", "*", "1.", "a)", "[ ]"), linhas vazias e repetidas.
 */
export function parseTopicLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw
      .replace(/^\s*(?:[-•*·–—]|\[\s?[xX]?\s?\]|\d{1,3}[.)]|[a-zA-Z][.)](?=\s))\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}
