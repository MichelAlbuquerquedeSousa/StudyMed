import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  formatLongDate,
  minutesNowInTZ,
  monthGrid,
  startOfWeek,
  todayInTZ,
  weekdayOf,
} from "@/lib/time";
import { expandEntries, overdueTasks, recurringDates } from "@/lib/recurrence";
import { countdownLabel, reorder, topicProgress, upcomingExams } from "@/lib/exams";
import { findConflicts, layoutDay } from "@/lib/layout";
import { contrastRatio, DEFAULT_CATEGORIES, INK } from "@/lib/categories";
import { buildMockData } from "@/data/mock";
import type { CalendarEntry, Exam, Item } from "@/lib/types";

describe("fuso America/Fortaleza", () => {
  it("usa a data de Fortaleza mesmo quando em UTC já é o dia seguinte", () => {
    // 01:30 UTC de 23/11 = 22:30 de 22/11 em Fortaleza (UTC−3)
    const instant = new Date("2026-11-23T01:30:00Z");
    expect(todayInTZ(instant)).toBe("2026-11-22");
    expect(minutesNowInTZ(instant)).toBe(22 * 60 + 30);
  });

  it("faz aritmética de datas sem deslocamento de fuso", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-22", "2026-12-01")).toBe(9);
    expect(weekdayOf("2026-11-22")).toBe(0); // domingo
    expect(startOfWeek("2026-11-22")).toBe("2026-11-16"); // semana começa na segunda
  });

  it("monta a grade mensal com 42 dias começando na segunda", () => {
    const grid = monthGrid("2026-11-15");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(weekdayOf(grid[0])).toBe(1);
  });

  it("formata datas em português", () => {
    expect(formatLongDate("2026-11-22")).toBe("domingo, 22 de novembro");
  });
});

const baseItem: Item = {
  id: "a",
  kind: "evento",
  title: "Anatomia",
  category: "aula",
  startTime: "08:00",
  endTime: "10:00",
  recurrence: { freq: "weekly", weekdays: [1, 3], startsOn: "2026-11-01", endsOn: "2026-12-31" },
  source: "manual",
};

describe("recorrência semanal", () => {
  it("gera ocorrências apenas nos dias da semana configurados", () => {
    expect(recurringDates(baseItem, "2026-11-16", "2026-11-22")).toEqual(["2026-11-16", "2026-11-18"]);
  });

  it("respeita início e fim da recorrência", () => {
    expect(recurringDates(baseItem, "2026-12-28", "2027-01-10")).toEqual(["2026-12-28", "2026-12-30"]);
  });

  it("aplica cancelamento, reagendamento e conclusão por ocorrência", () => {
    const task: Item = { ...baseItem, id: "t", kind: "tarefa", title: "Revisão" };
    const entries = expandEntries(
      [baseItem, task],
      [
        { itemId: "a", date: "2026-11-16", cancelled: true },
        { itemId: "a", date: "2026-11-18", moveTo: { date: "2026-11-19", startTime: "14:00", endTime: "16:00" } },
        { itemId: "t", date: "2026-11-16", done: true },
      ],
      [],
      "2026-11-16",
      "2026-11-22",
    );
    const anatomy = entries.filter((e) => e.itemId === "a");
    expect(anatomy).toHaveLength(1);
    expect(anatomy[0]).toMatchObject({ date: "2026-11-19", startTime: "14:00", originalDate: "2026-11-18" });
    const reviews = entries.filter((e) => e.itemId === "t");
    expect(reviews.map((r) => r.done)).toEqual([true, false]);
  });

  it("inclui ocorrência movida de fora para dentro do intervalo", () => {
    const entries = expandEntries(
      [baseItem],
      [{ itemId: "a", date: "2026-11-09", moveTo: { date: "2026-11-21", startTime: "09:00" } }],
      [],
      "2026-11-21",
      "2026-11-21",
    );
    expect(entries.map((e) => e.key)).toEqual(["a@2026-11-09"]);
  });

  it("lista tarefas avulsas atrasadas", () => {
    const items: Item[] = [
      { id: "1", kind: "tarefa", title: "Atrasada", category: "pessoal", date: "2026-11-20", source: "manual" },
      { id: "2", kind: "tarefa", title: "Feita", category: "pessoal", date: "2026-11-20", doneAt: "x", source: "manual" },
      { id: "3", kind: "tarefa", title: "Futura", category: "pessoal", date: "2026-11-25", source: "manual" },
    ];
    expect(overdueTasks(items, "2026-11-22").map((e) => e.title)).toEqual(["Atrasada"]);
  });
});

describe("provas", () => {
  it("calcula a porcentagem de conteúdos concluídos", () => {
    expect(topicProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(
      topicProgress([
        { id: "1", title: "a", done: true },
        { id: "2", title: "b", done: false },
        { id: "3", title: "c", done: false },
      ]),
    ).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it("descreve a contagem regressiva", () => {
    expect(countdownLabel(0)).toBe("É hoje");
    expect(countdownLabel(1)).toBe("Amanhã");
    expect(countdownLabel(12)).toBe("Faltam 12 dias");
    expect(countdownLabel(-3)).toBe("Há 3 dias");
  });

  it("ordena próximas provas cronologicamente e ignora as passadas", () => {
    const mk = (id: string, date: string): Exam => ({ id, subject: id, title: id, date, topics: [], source: "manual" });
    const list = upcomingExams([mk("c", "2026-12-10"), mk("past", "2026-11-01"), mk("a", "2026-11-22")], "2026-11-22");
    expect(list.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("reordena conteúdos", () => {
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("layout e conflitos", () => {
  const e = (key: string, start: string, end: string, date = "2026-11-22"): CalendarEntry => ({
    key,
    kind: "evento",
    title: key,
    category: "aula",
    date,
    startTime: start,
    endTime: end,
    done: false,
    recurring: false,
    source: "manual",
  });

  it("coloca eventos sobrepostos lado a lado", () => {
    const pos = layoutDay([e("a", "08:00", "10:00"), e("b", "09:00", "11:00"), e("c", "12:00", "13:00")]);
    const by = Object.fromEntries(pos.map((p) => [p.entry.key, p]));
    expect([by.a.column, by.a.columns]).toEqual([0, 2]);
    expect([by.b.column, by.b.columns]).toEqual([1, 2]);
    expect([by.c.column, by.c.columns]).toEqual([0, 1]);
  });

  it("detecta conflitos de horário no mesmo dia", () => {
    const conflicts = findConflicts([
      e("a", "08:00", "10:00"),
      e("b", "09:30", "11:00"),
      e("c", "10:00", "11:00", "2026-11-23"),
    ]);
    expect(conflicts.map(([x, y]) => `${x.key}-${y.key}`)).toEqual(["a-b"]);
  });
});

describe("cores e dados fictícios", () => {
  it("todas as cores padrão têm contraste AA com a tinta escura", () => {
    for (const c of DEFAULT_CATEGORIES) expect(contrastRatio(c.color, INK)).toBeGreaterThanOrEqual(4.5);
  });

  it("os dados fictícios são marcados como tal e relativos a hoje", () => {
    const data = buildMockData("2026-11-22");
    expect(data.items.every((i) => i.source === "ficticio")).toBe(true);
    expect(data.exams.every((x) => x.source === "ficticio")).toBe(true);
    expect(upcomingExams(data.exams, "2026-11-22").length).toBeGreaterThanOrEqual(3);
  });
});
