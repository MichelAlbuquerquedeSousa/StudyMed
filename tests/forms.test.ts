import { describe, expect, it } from "vitest";
import {
  draftToExamFields,
  draftToItem,
  emptyItemDraft,
  itemToDraft,
  parseTopicLines,
  reschedule,
  shiftEnd,
  validateExamDraft,
  validateItemDraft,
  emptyExamDraft,
} from "@/lib/forms";
import { expandEntries } from "@/lib/recurrence";
import type { Item } from "@/lib/types";

describe("formulário de atividade", () => {
  it("sugere término 1h depois quando o início vem de um toque na agenda", () => {
    expect(emptyItemDraft("2026-11-23", "14:00")).toMatchObject({ startTime: "14:00", endTime: "15:00", weekdays: [1] });
  });

  it("valida os casos comuns", () => {
    const ok = { ...emptyItemDraft("2026-11-23"), title: "Revisar" };
    expect(validateItemDraft(ok)).toBeNull();
    expect(validateItemDraft({ ...ok, title: "  " })).toMatch(/título/);
    expect(validateItemDraft({ ...ok, startTime: "10:00", endTime: "09:00" })).toMatch(/término/);
    expect(validateItemDraft({ ...ok, endTime: "09:00" })).toMatch(/início/);
    expect(validateItemDraft({ ...ok, kind: "evento", date: "" })).toMatch(/data/);
    expect(validateItemDraft({ ...ok, repeat: true, weekdays: [] })).toMatch(/dia da semana/);
    expect(validateItemDraft({ ...ok, repeat: true, repeatUntil: "2026-11-01" })).toMatch(/terminar/);
    expect(validateItemDraft({ ...ok, date: "" })).toBeNull(); // tarefa sem data é permitida
  });

  it("converte rascunho recorrente e volta sem perder dados", () => {
    const draft = { ...emptyItemDraft("2026-11-23", "07:30"), kind: "evento" as const, title: " Anatomia ", category: "aula" as const, endTime: "09:10", repeat: true, weekdays: [3, 1], repeatUntil: "2026-12-18" };
    const item = draftToItem(draft);
    expect(item).toMatchObject({ title: "Anatomia", date: undefined, recurrence: { weekdays: [1, 3], startsOn: "2026-11-23", endsOn: "2026-12-18" } });
    expect(itemToDraft({ ...item, id: "x", source: "manual" }, "2026-11-23")).toMatchObject({ title: "Anatomia", repeat: true, weekdays: [1, 3], date: "2026-11-23", repeatUntil: "2026-12-18" });
  });

  it("tarefa sem data não grava data", () => {
    expect(draftToItem({ ...emptyItemDraft("2026-11-23"), title: "Ler artigo", date: "" }).date).toBeUndefined();
  });
});

describe("reagendamento", () => {
  const series: Item = { id: "s", kind: "tarefa", title: "Flashcards", category: "estudo", startTime: "19:00", endTime: "20:00", recurrence: { freq: "weekly", weekdays: [1], startsOn: "2026-11-02" }, source: "manual" };
  const single: Item = { id: "u", kind: "tarefa", title: "Resumo", category: "estudo", date: "2026-11-23", startTime: "10:00", endTime: "11:00", source: "manual" };
  const entryOf = (items: Item[], overrides = [] as Parameters<typeof expandEntries>[1]) => expandEntries(items, overrides, [], "2026-11-23", "2026-11-29")[0];

  it("mantém a duração ao trocar o início", () => {
    expect(shiftEnd("10:00", "11:30", "14:00")).toBe("15:30");
    expect(shiftEnd("10:00", undefined, "14:00")).toBeUndefined();
    expect(shiftEnd("10:00", "11:00", "23:30")).toBeUndefined();
  });

  it("item avulso muda a própria data", () => {
    const r = reschedule(entryOf([single]), [single], [], { date: "2026-11-24", startTime: "08:00", endTime: "09:00" });
    expect(r).toEqual({ kind: "item", item: { ...single, date: "2026-11-24", startTime: "08:00", endTime: "09:00" } });
  });

  it("ocorrência recorrente ganha ajuste só para aquele dia, preservando a conclusão", () => {
    const r = reschedule(entryOf([series], [{ itemId: "s", date: "2026-11-23", done: true }]), [series], [{ itemId: "s", date: "2026-11-23", done: true }], { date: "2026-11-25", startTime: "18:00", endTime: "19:00" });
    expect(r).toEqual({ kind: "occurrence", override: { itemId: "s", date: "2026-11-23", done: true, cancelled: false, moveTo: { date: "2026-11-25", startTime: "18:00", endTime: "19:00" } } });
    const moved = expandEntries([series], [r!.kind === "occurrence" ? r!.override : (null as never)], [], "2026-11-23", "2026-11-29");
    expect(moved.map((e) => e.date)).toEqual(["2026-11-25"]);
  });

  it("voltar ao dia e horário originais remove o ajuste", () => {
    const ov = [{ itemId: "s", date: "2026-11-23", moveTo: { date: "2026-11-25", startTime: "18:00" } }];
    const entry = expandEntries([series], ov, [], "2026-11-23", "2026-11-29")[0];
    const r = reschedule(entry, [series], ov, { date: "2026-11-23", startTime: "19:00", endTime: "20:00" });
    expect(r?.kind === "occurrence" && r.override.moveTo).toBeUndefined();
  });
});

describe("formulário de prova", () => {
  it("exige disciplina e data; gera título padrão", () => {
    expect(validateExamDraft(emptyExamDraft())).toMatch(/disciplina/);
    expect(validateExamDraft({ ...emptyExamDraft(), subject: "Fisiologia" })).toMatch(/data/);
    expect(draftToExamFields({ ...emptyExamDraft("2026-12-04"), subject: "Fisiologia" })).toMatchObject({ title: "Prova — Fisiologia", date: "2026-12-04" });
  });

  it("limpa a lista de conteúdos colada", () => {
    const text = "1. Potencial de ação\n- Ciclo cardíaco\n\n• ECG básico\n[ ] Débito cardíaco\na) Microcirculação\nciclo cardíaco\n   Regulação  da PA  ";
    expect(parseTopicLines(text)).toEqual(["Potencial de ação", "Ciclo cardíaco", "ECG básico", "Débito cardíaco", "Microcirculação", "Regulação da PA"]);
  });

  it("não corta palavras que começam com letra seguida de ponto sem espaço", () => {
    expect(parseTopicLines("A.C.T.H. e cortisol")).toEqual(["A.C.T.H. e cortisol"]);
  });
});
