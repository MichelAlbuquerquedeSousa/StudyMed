import type { HHMM, ISODate } from "../time";
import type { CategoryKey } from "../types";

export type CandidateKind = "evento" | "tarefa" | "prova";

export type FlagCode =
  | "sem-horario"
  | "sem-termino"
  | "sem-data"
  | "ano-presumido"
  | "categoria-presumida"
  | "titulo-incerto"
  | "data-invalida"
  | "varias-datas"
  | "duplicata"
  | "conflito"
  | "alternativa"
  | "sem-aula"
  | "passado"
  | "segunda-chamada";

export interface Flag {
  code: FlagCode;
  message: string;
  /** "erro" impede a importação até ser corrigido; "aviso" só chama atenção. */
  severity: "aviso" | "erro";
}

/** Um item identificado no material, ainda não salvo. Todos os campos são editáveis na prévia. */
export interface ImportCandidate {
  id: string;
  include: boolean;
  kind: CandidateKind;
  title: string;
  category: CategoryKey;
  /** Não vazio = evento/tarefa semanal (horário fixo da faculdade). */
  weekdays: number[];
  date?: ISODate;
  startTime?: HHMM;
  endTime?: HHMM;
  location?: string;
  /** Observações (tema completo, professores…). */
  notes?: string;
  /** Provas: nome da avaliação ("AIM 2", "OSCE"); o título vira "AIM 2 — Disciplina". */
  examTitle?: string;
  /** Opções alternativas da mesma célula ("A ou B") compartilham o grupo. */
  group?: string;
  /** Só para provas. */
  topics: string[];
  /** Linhas do material de onde o item veio (1 = primeira linha). */
  sourceLines: number[];
  sourceText: string;
  flags: Flag[];
}

export interface UnrecognizedLine {
  line: number;
  text: string;
}

export interface ParseResult {
  candidates: ImportCandidate[];
  unrecognized: UnrecognizedLine[];
}

/** Texto extraído de um material (colado, PDF; no futuro, imagem via OCR/IA). */
export interface ExtractedDocument {
  text: string;
  /** Itens já estruturados (ex.: grade semanal lida pela geometria do PDF). Usados se o texto não for editado. */
  structured?: ImportCandidate[];
  source: "texto" | "pdf" | "imagem";
  fileName?: string;
  pages?: number;
  warnings: string[];
  /** Mensagem informativa (ex.: grade semanal reconhecida). */
  info?: string;
}
