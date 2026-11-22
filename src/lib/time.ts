/**
 * Datas e horas do StudyMed.
 *
 * Convenção: datas são strings "YYYY-MM-DD" e horas "HH:mm", sempre interpretadas
 * como hora local de Fortaleza (America/Fortaleza, UTC−3, sem horário de verão).
 * A aritmética é feita sobre datas em UTC à meia-noite, o que torna os cálculos
 * independentes do fuso configurado no aparelho.
 */

export const TIME_ZONE = "America/Fortaleza";
export const LOCALE = "pt-BR";

export type ISODate = string; // "2026-11-22"
export type HHMM = string; // "07:30"

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data de hoje em Fortaleza, independente do fuso do aparelho. */
export function todayInTZ(now: Date = new Date()): ISODate {
  return isoFmt.format(now);
}

/** Minutos desde a meia-noite em Fortaleza. */
export function minutesNowInTZ(now: Date = new Date()): number {
  const [h, m] = hmFmt.format(now).split(":").map(Number);
  return h * 60 + m;
}

export function parseISODate(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = parseISODate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return toISODate(date);
}

export function addMonths(d: ISODate, n: number): ISODate {
  const date = parseISODate(d);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(d: ISODate): number {
  return parseISODate(d).getUTCDay();
}

/** Diferença em dias inteiros (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function startOfWeek(d: ISODate, weekStartsOn = 1): ISODate {
  const diff = (weekdayOf(d) - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

export function weekDays(d: ISODate, weekStartsOn = 1): ISODate[] {
  const start = startOfWeek(d, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(d: ISODate): ISODate {
  return d.slice(0, 8) + "01";
}

/** Grade de 6 semanas (42 dias) cobrindo o mês de `d`. */
export function monthGrid(d: ISODate, weekStartsOn = 1): ISODate[] {
  const start = startOfWeek(startOfMonth(d), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function timeToMinutes(t: HHMM): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): HHMM {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------- Formatação em português (datas tratadas em UTC para não deslocar o dia) ----------

function fmt(d: ISODate, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...opts }).format(parseISODate(d));
}

/** "domingo, 22 de novembro" */
export const formatLongDate = (d: ISODate) => fmt(d, { weekday: "long", day: "numeric", month: "long" });
/** "22 de nov." */
export const formatShortDate = (d: ISODate) => fmt(d, { day: "numeric", month: "short" });
/** "22/11" */
export const formatNumericDate = (d: ISODate) => fmt(d, { day: "2-digit", month: "2-digit" });
/** "seg." */
export const formatWeekdayShort = (d: ISODate) => fmt(d, { weekday: "short" });
/** "segunda-feira" */
export const formatWeekdayLong = (d: ISODate) => fmt(d, { weekday: "long" });
/** "novembro de 2026" */
export const formatMonthYear = (d: ISODate) => fmt(d, { month: "long", year: "numeric" });

export const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function formatTimeRange(start?: HHMM, end?: HHMM): string {
  if (!start) return "Sem horário";
  return end ? `${start} – ${end}` : start;
}

/** Saudação conforme o horário de Fortaleza. */
export function greeting(minutes: number): string {
  if (minutes < 12 * 60) return "Bom dia";
  if (minutes < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
