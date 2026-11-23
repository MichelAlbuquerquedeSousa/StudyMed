import { describe, expect, it } from "vitest";
import { cellToCandidates, dedupeTail, detectGrid, detectLegend, gridCells, inferYear, repairBrokenWords, titleCase, type FilledRect } from "@/lib/import/grid";
import { filledRects } from "@/lib/import/pdf-geometry";
import type { PositionedText } from "@/lib/import/line-assembly";

const TODAY = "2026-11-23";

/**
 * Página sintética no formato do cronograma: colunas de 100pt a partir de x=100,
 * faixas de 100pt de altura começando em y=700 (y cresce para cima, como no PDF).
 */
const t = (str: string, x: number, y: number, size = 8): PositionedText => ({ str, x, y, width: str.length * size * 0.5, size });
const centered = (str: string, cx: number, y: number, size = 8) => t(str, cx - (str.length * size * 0.5) / 2, y, size);
const COL = (i: number) => 100 + i * 100; // borda esquerda da coluna i
const BAND = [
  ["08:00 –", "10:00", 700, 600],
  ["10:00 –", "12:00", 600, 500],
  ["14:00 –", "16:00", 500, 400],
  ["16:00 –", "18:00", 400, 300],
  ["18:30 –", "21:30", 300, 200],
] as const;

function page(days: [string, string][], cells: { col: number; top: number; bottom: number; color: string; lines: string[]; x0?: number; x1?: number }[], extraRects: FilledRect[] = []) {
  const items: PositionedText[] = [];
  const rects: FilledRect[] = [...extraRects];
  days.forEach(([name, date], i) => {
    items.push(centered(name, COL(i) + 50, 730, 10), centered(date, COL(i) + 50, 716, 10));
  });
  for (const [a, b, top, bottom] of BAND) {
    const cy = (top + bottom) / 2;
    items.push(centered(a, 50, cy + 6, 10), centered(b, 50, cy - 6, 10));
    rects.push({ x0: 20, x1: 100, y0: bottom, y1: top, color: "#ffffff" });
  }
  for (const c of cells) {
    const x0 = c.x0 ?? COL(c.col);
    const x1 = c.x1 ?? COL(c.col) + 100;
    rects.push({ x0, x1, y0: c.bottom, y1: c.top, color: c.color });
    const cx = (x0 + x1) / 2;
    const mid = (c.top + c.bottom) / 2;
    c.lines.forEach((l, i) => items.push(centered(l, cx, mid + (c.lines.length / 2 - i) * 10)));
  }
  return { items, rects };
}

const WEEK: [string, string][] = [
  ["SEGUNDA", "23/11"],
  ["TERÇA", "24/11"],
  ["QUARTA", "25/11"],
  ["QUINTA", "26/11"],
  ["SEXTA", "27/11"],
];

describe("leitura de grade semanal", () => {
  it("deduz o ano pelo dia da semana (inclusive na virada do ano)", () => {
    expect(inferYear(3, 8, 1, TODAY)).toEqual({ date: "2026-08-03", inferred: true }); // segunda
    expect(inferYear(1, 1, 5, TODAY)).toEqual({ date: "2027-01-01", inferred: true }); // sexta
    expect(inferYear(1, 1, 1, TODAY).inferred).toBe(false); // não bate com nenhum ano próximo
  });

  const { items, rects } = page(
    WEEK,
    [
      { col: 0, top: 700, bottom: 600, color: "#b4c6e7", lines: ["OBSTETRÍCIA", "Aula 1", "Conferência", "Diagnóstico de Gravidez", "Profa. Eveline", "Linhares", "Local: Sala de Aula - FAMED", "sala de aula"] },
      // mesclada: 14h às 18h
      { col: 0, top: 500, bottom: 300, color: "#f7cbac", lines: ["GINECOLOGIA", "Prática 1", "Prof. Tadeu Pinheiro", "Local: Laboratório de", "Habilidades"] },
      // destaque amarelo pequeno dentro da célula (não é célula)
      { col: 1, top: 700, bottom: 600, color: "#ce8dff", lines: ["NEFROLOGIA", "AIM 2", "Prof André Reis", "Local: Sala de aula"] },
      // alternativas "ou"
      { col: 2, top: 500, bottom: 400, color: "#d9d9d9", lines: ["MEDICAL ENGLISH II", "Class 1", "Writing an article", "Classroom", "ou", "COMMUNICATIVE ENGLISH VI", "Class 1", "Introducing Procedures", "Classroom"] },
      // duas células lado a lado na mesma faixa, com palavras quebradas
      { col: 2, top: 300, bottom: 200, color: "#ffff00", x0: COL(2), x1: COL(2) + 50, lines: ["ELETIVA II", "RADIOL", "OGIA", "Aula 1", "Prof", "Kenard Brito"] },
      { col: 2, top: 300, bottom: 200, color: "#ffff00", x0: COL(2) + 50, x1: COL(2) + 100, lines: ["ELETIVA II", "Clinical", "Skills", "Class 1"] },
      // segunda chamada quebrada
      { col: 3, top: 300, bottom: 200, color: "#ce8dff", lines: ["NEFROLOGIA", "SEGUND", "A CHAMAD", "A AIM 1"] },
      // célula sem disciplina (vem da legenda pela cor)
      { col: 3, top: 700, bottom: 600, color: "#f7cbac", lines: ["Aula 4", "Conferência", "Puberdade"] },
      // recesso o dia todo
      { col: 4, top: 700, bottom: 200, color: "#bfbfbf", lines: ["RECESSO", "ACADÊMICO"] },
    ],
    [{ x0: COL(1) + 40, x1: COL(1) + 60, y0: 650, y1: 659, color: "#ffff00" }],
  );
  const grid = detectGrid(items, rects, TODAY)!;
  const legend = new Map([["#f7cbac", "GINECOLOGIA"]]);
  let n = 0;
  const cells = gridCells(items, rects, grid);
  const cands = cells.flatMap((c) => cellToCandidates(c, TODAY, () => `c${++n}`, legend));
  const find = (re: RegExp) => cands.filter((c) => re.test(c.title) || re.test(c.examTitle ?? ""));

  it("detecta colunas com datas e faixas de horário", () => {
    expect(grid.columns.map((c) => c.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
    expect(grid.bands.map((b) => `${b.start}-${b.end}`)).toEqual(["08:00-10:00", "10:00-12:00", "14:00-16:00", "16:00-18:00", "18:30-21:30"]);
  });

  it("monta título, local sem repetição e professores nas observações", () => {
    const [obs] = find(/^Obstetrícia/);
    expect(obs).toMatchObject({
      title: "Obstetrícia — Aula 1 · Conferência: Diagnóstico de Gravidez",
      date: "2026-11-23",
      startTime: "08:00",
      endTime: "10:00",
      location: "Sala de Aula - FAMED",
      category: "aula",
      kind: "evento",
    });
    expect(obs.notes).toBe("Profa. Eveline Linhares");
  });

  it("célula mesclada ocupa todas as faixas cobertas", () => {
    const [gin] = find(/^Ginecologia — Prática 1/);
    expect(gin).toMatchObject({ startTime: "14:00", endTime: "18:00", category: "pratica", location: "Laboratório de Habilidades" });
  });

  it("reconhece avaliação (AIM) como prova e ignora o destaque amarelo", () => {
    const [aim] = cands.filter((c) => c.kind === "prova" && c.title === "Nefrologia" && c.examTitle === "AIM 2");
    expect(aim).toMatchObject({ date: "2026-11-24", startTime: "08:00", category: "prova", include: true });
    expect(cells.filter((c) => c.column.date === "2026-11-24")).toHaveLength(1);
  });

  it("“ou” vira duas opções alternativas, sem conflito entre si", () => {
    const alts = cands.filter((c) => c.flags.some((f) => f.code === "alternativa"));
    expect(alts.map((c) => c.title)).toEqual(["Medical English II — Class 1: Writing an article", "Communicative English VI — Class 1: Introducing Procedures"]);
    expect(alts[0].group).toBe(alts[1].group);
    expect(alts.every((c) => c.location === "Classroom")).toBe(true);
  });

  it("células lado a lado viram eventos separados; conserta palavras quebradas", () => {
    const eletivas = find(/^Eletiva II/);
    expect(eletivas.map((c) => c.title)).toEqual(["Eletiva II Radiologia — Aula 1", "Eletiva II — Class 1: Clinical Skills"]);
    expect(eletivas.every((c) => c.startTime === "18:30" && c.endTime === "21:30")).toBe(true);
    expect(eletivas[0].notes).toBe("Prof Kenard Brito");
  });

  it("segunda chamada vem desmarcada, mesmo com a expressão quebrada no PDF", () => {
    const [sc] = cands.filter((c) => c.examTitle?.startsWith("Segunda Chamada"));
    expect(sc).toMatchObject({ kind: "prova", title: "Nefrologia", examTitle: "Segunda Chamada · AIM 1", include: false });
    expect(sc.flags.map((f) => f.code)).toContain("segunda-chamada");
  });

  it("usa a legenda de cores quando a célula não traz a disciplina, e avisa", () => {
    const [c] = cands.filter((x) => /Puberdade/.test(x.title));
    expect(c.title).toBe("Ginecologia — Aula 4 · Conferência: Puberdade");
    expect(c.flags.some((f) => /legenda/.test(f.message))).toBe(true);
  });

  it("recesso vem desmarcado e sem horário", () => {
    const [r] = find(/^Recesso/);
    expect(r).toMatchObject({ title: "Recesso Acadêmico", include: false, startTime: undefined, category: "pessoal" });
  });

  it("aulas que já passaram vêm desmarcadas", () => {
    const old = page([["SEGUNDA", "03/08"], ["TERÇA", "04/08"], ["QUARTA", "05/08"]], [{ col: 1, top: 700, bottom: 600, color: "#b4c6e7", lines: ["OBSTETRÍCIA", "Aula 1"] }]);
    const g = detectGrid(old.items, old.rects, TODAY)!;
    const [c] = gridCells(old.items, old.rects, g).flatMap((cell) => cellToCandidates(cell, TODAY, () => "x"));
    expect(c).toMatchObject({ date: "2026-08-04", include: false });
    expect(c.flags.map((f) => f.code)).toContain("passado");
  });

  it("página sem grade não é confundida com grade", () => {
    expect(detectGrid([t("Prova de Fisiologia 10/12 08:00", 50, 700)], [], TODAY)).toBeNull();
  });
});

describe("utilitários da grade", () => {
  it("títulos com siglas e numerais romanos", () => {
    expect(titleCase("AÇÕES INTEGRAIS EM SAÚDE VI")).toBe("Ações Integrais em Saúde VI");
    expect(titleCase("HAP VI")).toBe("HAP VI");
    expect(titleCase("CLÍNICA CIRÚRGICA I")).toBe("Clínica Cirúrgica I");
  });

  it("remove repetição no fim do local", () => {
    expect(dedupeTail("Sala de Aula - FAMED sala de aula")).toBe("Sala de Aula - FAMED");
    expect(dedupeTail("Sala de Aula Sala de Aula")).toBe("Sala de Aula");
    expect(dedupeTail("Laboratório de Habilidades")).toBe("Laboratório de Habilidades");
  });

  it("conserta palavras quebradas conhecidas sem juntar palavras normais", () => {
    expect(repairBrokenWords("Imagem em Pneumol\nogia 1 e 2")).toBe("Imagem em Pneumologia 1 e 2");
    expect(repairBrokenWords("SEGUND\nA CHAMAD\nA")).toBe("SEGUNDA CHAMADA");
    expect(repairBrokenWords("Imagem em abdome")).toBe("Imagem em abdome");
  });

  it("lê a legenda de cores da capa", () => {
    const items = [centered("PEDIATRIA", 300, 500, 10), centered("NEFROLOGIA", 300, 480, 10), centered("UROLOGIA", 300, 460, 10)];
    const rects: FilledRect[] = [
      { x0: 150, x1: 450, y0: 495, y1: 512, color: "#f4b083" },
      { x0: 150, x1: 450, y0: 475, y1: 492, color: "#ce8dff" },
      { x0: 150, x1: 450, y0: 455, y1: 472, color: "#fff2cc" },
    ];
    expect([...detectLegend(items, rects)]).toEqual([
      ["#f4b083", "PEDIATRIA"],
      ["#ce8dff", "NEFROLOGIA"],
      ["#fff2cc", "UROLOGIA"],
    ]);
  });

  it("extrai retângulos preenchidos aplicando a matriz de transformação", () => {
    const OPS = { save: 10, restore: 11, transform: 12, setFillRGBColor: 59, constructPath: 91, fill: 22, eoFill: 23, fillStroke: 24, eoFillStroke: 25, closeFillStroke: 26 };
    const rects = filledRects(
      [10, 12, 59, 91, 11, 91],
      [[], [0.75, 0, 0, 0.75, 0, 0], ["#B4C6E7"], [22, [], [100, 200, 300, 400]], [], [28, [], [0, 0, 10, 10]]],
      OPS,
    );
    expect(rects).toEqual([{ x0: 75, x1: 225, y0: 150, y1: 300, color: "#b4c6e7" }]);
  });
});
