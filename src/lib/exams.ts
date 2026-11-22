import type { Exam, ExamTopic } from "./types";
import { daysBetween, type ISODate } from "./time";

export interface Progress {
  done: number;
  total: number;
  /** 0–100, inteiro */
  percent: number;
}

export function topicProgress(topics: ExamTopic[]): Progress {
  const total = topics.length;
  const done = topics.filter((t) => t.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Progresso somado de várias provas (conteúdos de todas). */
export function overallProgress(exams: Exam[]): Progress {
  return topicProgress(exams.flatMap((e) => e.topics));
}

export function daysUntil(today: ISODate, date: ISODate): number {
  return daysBetween(today, date);
}

export function countdownLabel(days: number): string {
  if (days === 0) return "É hoje";
  if (days === 1) return "Amanhã";
  if (days > 1) return `Faltam ${days} dias`;
  if (days === -1) return "Foi ontem";
  return `Há ${-days} dias`;
}

export function upcomingExams(exams: Exam[], today: ISODate): Exam[] {
  return exams
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.startTime ?? "").localeCompare(b.startTime ?? "") : a.date < b.date ? -1 : 1));
}

export function pastExams(exams: Exam[], today: ISODate): Exam[] {
  return exams.filter((e) => e.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Move um elemento de `from` para `to`, devolvendo um novo array. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = list.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** Urgência visual da contagem regressiva. */
export function urgency(days: number): "alta" | "media" | "baixa" {
  if (days <= 3) return "alta";
  if (days <= 10) return "media";
  return "baixa";
}
