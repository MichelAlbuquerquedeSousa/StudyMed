/** Revisão dos candidatos: duplicatas, conflitos de horário, validação e conversão para itens/provas. */
import { findConflicts } from "../layout";
import { expandEntries } from "../recurrence";
import { addDays, formatShortDate, formatTimeRange, timeToMinutes, WEEKDAY_NAMES, type ISODate } from "../time";
import type { CalendarEntry, Exam, Item, OccurrenceOverride } from "../types";
import { flag } from "./parser";
import type { ImportCandidate } from "./types";

export const normalizeTitle = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface ImportPeriod {
  /** Início das atividades semanais importadas. */
  startsOn: ISODate;
  /** Fim (opcional) — ex.: último dia do semestre. */
  endsOn?: ISODate;
}

/** Erros que impedem importar o candidato (campos obrigatórios). */
export function blockingErrors(c: ImportCandidate): string[] {
  const out: string[] = [];
  if (!c.title.trim()) out.push(c.kind === "prova" ? "Informe a disciplina." : "Informe o título.");
  if (c.kind === "prova" && !c.date) out.push("Provas precisam de data.");
  if (c.kind === "evento" && !c.date && c.weekdays.length === 0) out.push("Informe a data ou os dias da semana.");
  if (c.endTime && !c.startTime) out.push("Informe o horário de início.");
  if (c.startTime && c.endTime && timeToMinutes(c.endTime) <= timeToMinutes(c.startTime)) out.push("O término deve ser depois do início.");
  return out;
}

/** Converte o candidato em item da agenda (eventos e tarefas). */
export function candidateToItem(c: ImportCandidate, period: ImportPeriod, id: string, importBatchId: string): Item {
  const recurring = c.weekdays.length > 0 && !c.date;
  return {
    id,
    kind: c.kind === "tarefa" ? "tarefa" : "evento",
    title: c.title.trim(),
    category: c.category === "prova" ? "aula" : c.category,
    date: recurring ? undefined : c.date,
    startTime: c.startTime,
    endTime: c.startTime ? c.endTime : undefined,
    location: c.location?.trim() || undefined,
    recurrence: recurring ? { freq: "weekly", weekdays: [...c.weekdays].sort((a, b) => a - b), startsOn: period.startsOn, ...(period.endsOn ? { endsOn: period.endsOn } : {}) } : undefined,
    doneAt: null,
    source: "importado",
    importBatchId,
  };
}

export function candidateToExam(c: ImportCandidate, id: string, importBatchId: string, makeId: () => string): Exam {
  const subject = c.title.trim();
  return {
    id,
    subject,
    title: `Prova — ${subject}`,
    date: c.date!,
    startTime: c.startTime,
    location: c.location?.trim() || undefined,
    topics: c.topics.filter((t) => t.trim()).map((title) => ({ id: makeId(), title: title.trim(), done: false })),
    source: "importado",
    importBatchId,
  };
}

/** Entradas que o candidato geraria na agenda, numa janela de duas semanas (para checar conflitos). */
function candidateEntries(c: ImportCandidate, period: ImportPeriod): CalendarEntry[] {
  if (c.kind === "prova") {
    if (!c.date) return [];
    return [{ key: `cand:${c.id}`, kind: "prova", title: c.title, category: "prova", date: c.date, startTime: c.startTime, endTime: c.startTime ? c.endTime : undefined, done: false, recurring: false, source: "importado" }];
  }
  const item = candidateToItem(c, period, `cand:${c.id}`, "");
  const from = item.recurrence ? period.startsOn : (item.date ?? period.startsOn);
  return expandEntries([item], [], [], from, addDays(from, 13)).map((e) => ({ ...e, key: `cand:${c.id}@${e.date}` }));
}

const describe = (e: CalendarEntry) =>
  `${e.title.replace(/^Prova · /, "Prova de ")} (${e.recurring ? WEEKDAY_NAMES[new Date(e.date + "T00:00:00Z").getUTCDay()] : formatShortDate(e.date)}, ${formatTimeRange(e.startTime, e.endTime)})`;

/**
 * Recalcula os sinais de duplicata e conflito (os demais sinais vêm do leitor e são mantidos).
 * - Duplicata: mesmo título e mesma data/dia da semana e horário de algo que já existe ou de outro candidato.
 * - Conflito: horário sobreposto com a agenda atual ou com outro candidato incluído.
 */
export function review(
  candidates: ImportCandidate[],
  existing: { items: Item[]; overrides: OccurrenceOverride[]; exams: Exam[] },
  period: ImportPeriod,
): ImportCandidate[] {
  const base = candidates.map((c) => ({ ...c, flags: c.flags.filter((f) => f.code !== "duplicata" && f.code !== "conflito") }));

  const itemKey = (title: string, when: string, start?: string) => `${normalizeTitle(title)}|${when}|${start ?? ""}`;
  const existingKeys = new Set<string>();
  for (const i of existing.items) {
    if (i.recurrence) for (const d of i.recurrence.weekdays) existingKeys.add(itemKey(i.title, `w${d}`, i.startTime));
    else if (i.date) existingKeys.add(itemKey(i.title, i.date, i.startTime));
  }
  for (const e of existing.exams) existingKeys.add(itemKey(e.subject, e.date, "prova"));

  const seen = new Set<string>();
  for (const c of base) {
    if (!c.title.trim()) continue;
    const keys = c.kind === "prova" ? [itemKey(c.title, c.date ?? "", "prova")] : c.date ? [itemKey(c.title, c.date, c.startTime)] : c.weekdays.map((d) => itemKey(c.title, `w${d}`, c.startTime));
    if (keys.some((k) => existingKeys.has(k))) c.flags.push(flag("duplicata", "aviso", "já existe na sua agenda"));
    else if (keys.some((k) => seen.has(k))) c.flags.push(flag("duplicata", "aviso", "repetido neste material"));
    keys.forEach((k) => seen.add(k));
  }

  // Conflitos: agenda atual + candidatos incluídos
  const included = base.filter((c) => c.include && blockingErrors(c).length === 0);
  const candEntries = included.flatMap((c) => candidateEntries(c, period).map((e) => ({ e, c })));
  if (candEntries.length) {
    const dates = candEntries.map(({ e }) => e.date).sort();
    const current = expandEntries(existing.items, existing.overrides, existing.exams, dates[0], dates[dates.length - 1]).filter((e) => e.startTime);
    const all = [...current, ...candEntries.map(({ e }) => e)];
    const byKey = new Map(candEntries.map(({ e, c }) => [e.key, c]));
    const reported = new Map<string, Set<string>>();
    for (const [a, b] of findConflicts(all)) {
      for (const [mine, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const c = byKey.get(mine.key);
        if (!c) continue;
        const otherCand = byKey.get(other.key);
        if (otherCand === c) continue;
        // A própria cópia já existente é duplicata (sinalizada acima), não conflito.
        if (!otherCand && normalizeTitle(other.title.replace(/^Prova · /, "")) === normalizeTitle(c.title) && other.startTime === mine.startTime) continue;
        const label = otherCand ? `${describe(other)} — também neste material` : describe(other);
        const set = reported.get(c.id) ?? new Set<string>();
        if (set.has(label)) continue;
        set.add(label);
        reported.set(c.id, set);
      }
    }
    for (const c of base) {
      const set = reported.get(c.id);
      if (set) c.flags.push(flag("conflito", "aviso", [...set].slice(0, 2).join("; ") + (set.size > 2 ? ` e mais ${set.size - 2}` : "")));
    }
  }
  return base;
}

export interface ImportSummary {
  eventos: number;
  tarefas: number;
  provas: number;
  conteudos: number;
  recorrentes: number;
  avisos: number;
  bloqueados: number;
}

export function summarize(candidates: ImportCandidate[]): ImportSummary {
  const inc = candidates.filter((c) => c.include);
  return {
    eventos: inc.filter((c) => c.kind === "evento").length,
    tarefas: inc.filter((c) => c.kind === "tarefa").length,
    provas: inc.filter((c) => c.kind === "prova").length,
    conteudos: inc.filter((c) => c.kind === "prova").reduce((n, c) => n + c.topics.length, 0),
    recorrentes: inc.filter((c) => c.kind !== "prova" && c.weekdays.length > 0 && !c.date).length,
    avisos: inc.filter((c) => c.flags.some((f) => f.severity === "aviso")).length,
    bloqueados: inc.filter((c) => blockingErrors(c).length > 0).length,
  };
}
