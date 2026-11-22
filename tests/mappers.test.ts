import { describe, expect, it } from "vitest";
import { buildMockData } from "@/data/mock";
import {
  categoriesFromColors,
  colorsFromCategories,
  examToRow,
  examsFromRows,
  itemFromRow,
  itemToRow,
  occurrenceFromRow,
  occurrenceToRow,
  topicsToRows,
} from "@/lib/supabase/mappers";
import { friendlyError } from "@/store/app-store";

describe("conversão app ↔ banco", () => {
  it("itens fazem ida e volta sem perder informação", () => {
    const { items } = buildMockData("2026-11-22");
    for (const item of items) {
      const back = itemFromRow(itemToRow(item));
      expect(back).toEqual({ ...item, doneAt: item.doneAt ?? null });
    }
  });

  it("normaliza horários do Postgres (HH:MM:SS → HH:MM) e nulos", () => {
    const item = itemFromRow({
      id: "x", kind: "evento", title: "Anatomia", category: "aula", date: null, start_time: "07:30:00", end_time: "09:10:00",
      location: null, notes: null, recurrence: { freq: "weekly", weekdays: [1], startsOn: "2026-11-02" }, done_at: null, source: "manual",
    });
    expect(item).toMatchObject({ startTime: "07:30", endTime: "09:10", location: undefined, date: undefined });
  });

  it("item recorrente não grava data avulsa; evento nunca grava conclusão", () => {
    const row = itemToRow({ id: "x", kind: "evento", title: "t", category: "aula", date: "2026-11-22", doneAt: "2026-01-01", recurrence: { freq: "weekly", weekdays: [1], startsOn: "2026-11-02" }, source: "manual" });
    expect(row.date).toBeNull();
    expect(row.done_at).toBeNull();
  });

  it("ocorrências preservam conclusão e reagendamento", () => {
    const o = { itemId: "i", date: "2026-11-16", done: true, cancelled: false, moveTo: { date: "2026-11-17", startTime: "14:00", endTime: "15:00" } };
    expect(occurrenceFromRow({ ...occurrenceToRow(o), move_start_time: "14:00:00", move_end_time: "15:00:00" })).toEqual(o);
  });

  it("provas e conteúdos voltam ordenados pela posição", () => {
    const { exams } = buildMockData("2026-11-22");
    const exam = exams[0];
    const rows = topicsToRows(exam.id, exam.topics).reverse(); // banco devolve em qualquer ordem
    const [back] = examsFromRows([examToRow(exam)], rows);
    expect(back).toEqual(exam);
  });

  it("cores: só grava o que difere do padrão e ignora valores inválidos", () => {
    const cats = categoriesFromColors({ aula: "#112233", pratica: "vermelho" });
    expect(cats.find((c) => c.key === "aula")!.color).toBe("#112233");
    expect(cats.find((c) => c.key === "pratica")!.color).toBe("#FFC5A5");
    expect(colorsFromCategories(cats)).toEqual({ aula: "#112233" });
  });

  it("dados de exemplo usam UUIDs (aceitos pelo banco)", () => {
    const { items, exams } = buildMockData("2026-11-22");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const id of [...items.map((i) => i.id), ...exams.map((e) => e.id), ...exams.flatMap((e) => e.topics.map((t) => t.id))]) expect(id).toMatch(uuid);
  });

  it("mensagens de erro em português", () => {
    expect(friendlyError("TypeError: Failed to fetch")).toMatch(/Sem conexão/);
    expect(friendlyError("new row violates row-level security policy")).toMatch(/permissão/);
    expect(friendlyError("Could not find the table 'public.items' in the schema cache")).toMatch(/migração/);
  });
});
