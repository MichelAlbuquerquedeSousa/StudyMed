import type { HHMM, ISODate } from "./time";

export type CategoryKey = "aula" | "pratica" | "tutoria" | "estudo" | "pessoal" | "prova";

export interface Category {
  key: CategoryKey;
  name: string;
  color: string; // #hex pastel
  icon: string; // nome do ícone lucide
}

/** evento = compromisso fixo (aula, prática); tarefa = algo que se conclui com checkbox */
export type ItemKind = "evento" | "tarefa";
export type DataSource = "manual" | "importado" | "ficticio";

export interface WeeklyRecurrence {
  freq: "weekly";
  weekdays: number[]; // 0 = domingo
  startsOn: ISODate;
  endsOn?: ISODate;
}

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  category: CategoryKey;
  /** Data de itens avulsos (ignorada quando há recorrência). */
  date?: ISODate;
  startTime?: HHMM;
  endTime?: HHMM;
  location?: string;
  notes?: string;
  recurrence?: WeeklyRecurrence;
  /** Conclusão de tarefa avulsa (ISO timestamp). */
  doneAt?: string | null;
  source: DataSource;
  /** Lote de importação de origem (permite desfazer a importação). */
  importBatchId?: string;
}

/** Ajuste de uma ocorrência específica de um item recorrente. */
export interface OccurrenceOverride {
  itemId: string;
  date: ISODate; // data original da ocorrência
  done?: boolean;
  cancelled?: boolean;
  moveTo?: { date: ISODate; startTime?: HHMM; endTime?: HHMM };
}

export interface ExamTopic {
  id: string;
  title: string;
  done: boolean;
}

export interface Exam {
  id: string;
  subject: string;
  title: string;
  date: ISODate;
  startTime?: HHMM;
  location?: string;
  notes?: string;
  topics: ExamTopic[];
  source: DataSource;
  importBatchId?: string;
}

/** Entrada já resolvida para exibição no calendário / listas. */
export interface CalendarEntry {
  key: string; // único por ocorrência
  kind: ItemKind | "prova";
  title: string;
  category: CategoryKey;
  date: ISODate;
  startTime?: HHMM;
  endTime?: HHMM;
  location?: string;
  notes?: string;
  done: boolean;
  recurring: boolean;
  itemId?: string;
  examId?: string;
  /** Data original da ocorrência (para recorrentes). */
  originalDate?: ISODate;
  source: DataSource;
}
