import { describe, expect, it } from "vitest";
import { findDates, findTime, findWeekdays, parsePlanning } from "@/lib/import/parser";

const TODAY = "2026-11-22";
let n = 0;
const ids = () => `c${++n}`;
const parse = (text: string) => parsePlanning(text, TODAY, ids);
const codes = (c: { flags: { code: string }[] }) => c.flags.map((f) => f.code);

describe("reconhecimento de partes", () => {
  it("dias da semana por extenso, abreviados e 2ª/3ª", () => {
    expect(findWeekdays("Segunda-feira 07:30").days).toEqual([1]);
    expect(findWeekdays("SEG e QUA 08:00 - Bioquímica").days).toEqual([1, 3]);
    expect(findWeekdays("3ª feira: Fisiologia").days).toEqual([2]);
    expect(findWeekdays("Terça e quinta").days).toEqual([2, 4]);
    // "ter" como verbo não é terça
    expect(findWeekdays("Vamos ter aula de reposição").days).toEqual([]);
    expect(findWeekdays("Sábado").days).toEqual([6]);
  });

  it("datas numéricas e por extenso; ano ausente é sinalizado; datas impossíveis são rejeitadas", () => {
    expect(findDates("Prova 12/03", TODAY)[0]).toMatchObject({ date: "2026-03-12", yearPresumed: true });
    expect(findDates("12/03/2027", TODAY)[0]).toMatchObject({ date: "2027-03-12", yearPresumed: false });
    expect(findDates("05-12-26", TODAY)[0]).toMatchObject({ date: "2026-12-05" });
    expect(findDates("dia 7 de dezembro de 2026", TODAY)[0]).toMatchObject({ date: "2026-12-07", yearPresumed: false });
    expect(findDates("31/02", TODAY)[0].date).toBeNull();
    expect(findDates("07:30 às 09:10", TODAY)).toEqual([]);
  });

  it("horários e intervalos em vários formatos", () => {
    expect(findTime("07:30 - 09:10")).toMatchObject({ start: "07:30", end: "09:10" });
    expect(findTime("das 8h às 10h")).toMatchObject({ start: "08:00", end: "10:00" });
    expect(findTime("14h30 até 16h")).toMatchObject({ start: "14:30", end: "16:00" });
    expect(findTime("às 19h")).toMatchObject({ start: "19:00", end: undefined });
    expect(findTime("08h30min–10h")).toMatchObject({ start: "08:30", end: "10:00" });
    expect(findTime("Sala 104")).toBeNull();
    expect(findTime("25:00")).toBeNull();
  });
});

describe("horário semanal da faculdade", () => {
  it("linhas com dia, horário, disciplina e local", () => {
    const { candidates } = parse(
      ["Segunda 07:30-09:10 Anatomia II - Auditório 2", "TER | 10h às 12h | Habilidades Clínicas | Centro de Simulação", "Qua e Sex 14:00 - 16:30 Tutoria APG (Sala 12)"].join("\n"),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({ kind: "evento", title: "Anatomia II", weekdays: [1], startTime: "07:30", endTime: "09:10", location: "Auditório 2" });
    expect(candidates[1]).toMatchObject({ title: "Habilidades Clínicas", weekdays: [2], category: "pratica", location: "Centro de Simulação" });
    expect(candidates[2]).toMatchObject({ title: "Tutoria APG", weekdays: [3, 5], category: "tutoria", location: "Sala 12" });
  });

  it("dia como cabeçalho seguido de horários", () => {
    const { candidates } = parse("Quinta-feira:\n08:00 - 09:40 Histologia\n13h30 às 15h30 Prática de Microscopia - Lab. Multidisciplinar");
    expect(candidates.map((c) => [c.title, c.weekdays, c.category])).toEqual([
      ["Histologia", [4], "aula"],
      ["Prática de Microscopia", [4], "pratica"],
    ]);
    expect(codes(candidates[0])).toContain("categoria-presumida");
    expect(candidates[1].location).toBe("Lab. Multidisciplinar");
  });

  it("sinaliza o que falta em vez de inventar", () => {
    const { candidates } = parse("Sexta 08:00 Imunologia\nSegunda Bioquímica");
    expect(candidates[0]).toMatchObject({ startTime: "08:00", endTime: undefined });
    expect(codes(candidates[0])).toContain("sem-termino");
    // "Segunda Bioquímica" sem horário: fica sem horário e sinalizada
    expect(candidates[1]).toMatchObject({ title: "Bioquímica", startTime: undefined });
    expect(codes(candidates[1])).toContain("sem-horario");
  });
});

describe("roteiro com datas, provas e conteúdos", () => {
  const roteiro = [
    "CRONOGRAMA — MÓDULO CARDIORRESPIRATÓRIO",
    "",
    "02/12 (quarta)",
    "14h às 17h Tutoria — abertura do problema 3",
    "Entrega do relatório de prática: 04/12",
    "Prova N1 de Fisiologia - 10/12/2026 - 08:00 - Auditório 1",
    "Conteúdos:",
    "1. Potencial de ação",
    "- Ciclo cardíaco",
    "• Regulação da pressão arterial",
    "Avaliação prática de Anatomia – 15 de dezembro, 7h30. Conteúdos: plexo braquial; fossa cubital; trígono femoral",
    "Observação: trazer jaleco",
    "18/12 às 10h",
  ].join("\n");
  const { candidates, unrecognized } = parse(roteiro);

  it("usa a data de contexto para as linhas seguintes", () => {
    expect(candidates[0]).toMatchObject({ kind: "evento", title: "Tutoria — abertura do problema 3", date: "2026-12-02", startTime: "14:00", endTime: "17:00", category: "tutoria" });
    // "02/12 (quarta)": o dia da semana confirma 2026, então não há aviso de ano presumido.
    expect(codes(candidates[0])).not.toContain("ano-presumido");
  });

  it("reconhece tarefa com prazo", () => {
    expect(candidates[1]).toMatchObject({ kind: "tarefa", date: "2026-12-04", category: "pratica" });
    expect(candidates[1].title).toMatch(/relatório de prática/i);
  });

  it("reconhece prova, disciplina, local e lista de conteúdos abaixo", () => {
    expect(candidates[2]).toMatchObject({ kind: "prova", title: "Fisiologia", date: "2026-12-10", startTime: "08:00", category: "prova", location: "Auditório 1" });
    expect(candidates[2].topics).toEqual(["Potencial de ação", "Ciclo cardíaco", "Regulação da pressão arterial"]);
    expect(codes(candidates[2])).not.toContain("ano-presumido");
  });

  it("reconhece prova com conteúdos na mesma linha", () => {
    expect(candidates[3]).toMatchObject({ kind: "prova", title: "Anatomia", date: "2026-12-15", startTime: "07:30" });
    expect(candidates[3].topics).toEqual(["plexo braquial", "fossa cubital", "trígono femoral"]);
  });

  it("ignora texto corrido; data e horário sem título viram item com erro para completar", () => {
    expect(candidates).toHaveLength(5);
    expect(candidates[4]).toMatchObject({ title: "", date: "2026-12-18", startTime: "10:00" });
    expect(candidates[4].flags.find((f) => f.code === "titulo-incerto")?.severity).toBe("erro");
    expect(unrecognized).toEqual([]);
  });
});

describe("contexto de data", () => {
  it("vale até a linha em branco e não se aplica a 'data a definir'", () => {
    const { candidates, unrecognized } = parse("02/12\n14h-16h Tutoria\nProva substitutiva de Anatomia, data a definir\n\n15h-17h Monitoria\n\nRevisar 3 capítulos de farmacologia");
    expect(candidates[0]).toMatchObject({ title: "Tutoria", date: "2026-12-02" });
    expect(candidates[1]).toMatchObject({ kind: "prova", date: undefined });
    expect(candidates[1].flags.find((f) => f.code === "sem-data")?.severity).toBe("erro");
    expect(candidates[2]).toMatchObject({ title: "Monitoria", date: undefined });
    expect(candidates[2].flags.find((f) => f.code === "sem-data")?.severity).toBe("erro");
    expect(unrecognized.map((u) => u.text)).toEqual(["Revisar 3 capítulos de farmacologia"]);
  });
});

describe("casos ambíguos", () => {
  it("data impossível vira erro", () => {
    const [c] = parse("Seminário 31/02 14h-15h").candidates;
    expect(c.flags.find((f) => f.code === "data-invalida")?.severity).toBe("erro");
  });

  it("período com duas datas é sinalizado", () => {
    const [c] = parse("Semana de provas 07/12 a 11/12").candidates;
    expect(codes(c)).toContain("varias-datas");
  });

  it("prova sem disciplina pede correção", () => {
    const [c] = parse("Prova 12/12 08:00").candidates;
    expect(c.title).toBe("");
    expect(c.flags.find((f) => f.code === "titulo-incerto")?.severity).toBe("erro");
  });

  it("horário sem dia nem data é erro (não presume o dia)", () => {
    const [c] = parse("08:00 - 10:00 Farmacologia").candidates;
    expect(c).toMatchObject({ title: "Farmacologia", weekdays: [], date: undefined });
    expect(c.flags.find((f) => f.code === "sem-data")?.severity).toBe("erro");
  });

  it("colunas separadas por tabulação (copiadas de planilha)", () => {
    const [c] = parse("Terça\t08:00\t09:40\tFisiologia Humana\tSala 104").candidates;
    expect(c).toMatchObject({ weekdays: [2], startTime: "08:00", endTime: "09:40", title: "Fisiologia Humana", location: "Sala 104" });
  });
});

import { blockingErrors, candidateToExam, candidateToItem, review, summarize } from "@/lib/import/review";
import type { Exam, Item } from "@/lib/types";

describe("revisão antes de importar", () => {
  const period = { startsOn: "2026-11-23", endsOn: "2027-03-31" };
  const existingItems: Item[] = [
    { id: "a", kind: "evento", title: "Anatomia II", category: "aula", startTime: "07:30", endTime: "09:10", recurrence: { freq: "weekly", weekdays: [1], startsOn: "2026-11-01" }, source: "manual" },
    { id: "b", kind: "evento", title: "Plantão", category: "pratica", date: "2026-12-10", startTime: "07:00", endTime: "12:00", source: "manual" },
  ];
  const existingExams: Exam[] = [{ id: "e", subject: "Bioquímica", title: "N1", date: "2026-12-18", topics: [], source: "manual" }];
  const existing = { items: existingItems, overrides: [], exams: existingExams };

  const text = [
    "Segunda 07:30-09:10 Anatomia II", // duplicata da agenda
    "Segunda 08:00-10:00 Embriologia", // conflita com Anatomia II
    "Prova de Fisiologia 10/12/2026 08:00", // conflita com Plantão
    "Prova de Bioquímica 18/12/2026", // duplicata de prova
    "Quarta 14h-16h Tutoria",
    "Quarta 15h-17h Monitoria de Histologia", // conflita com outro candidato
    "Quarta 14h-16h Tutoria", // repetido no material
  ].join("\n");
  const reviewed = review(parse(text).candidates, existing, period);
  const byTitle = (t: string) => reviewed.filter((c) => c.title === t);
  const msg = (c: (typeof reviewed)[number], code: string) => c.flags.find((f) => f.code === code)?.message ?? "";

  it("aponta duplicatas da agenda e do próprio material", () => {
    expect(msg(byTitle("Anatomia II")[0], "duplicata")).toMatch(/já existe/);
    expect(msg(byTitle("Bioquímica")[0], "duplicata")).toMatch(/já existe/);
    const tutorias = byTitle("Tutoria");
    expect(msg(tutorias[0], "duplicata")).toBe("");
    expect(msg(tutorias[1], "duplicata")).toMatch(/repetido/);
  });

  it("aponta conflitos com a agenda e entre itens do material", () => {
    expect(msg(byTitle("Embriologia")[0], "conflito")).toMatch(/Anatomia II \(segunda, 07:30 – 09:10\)/);
    expect(msg(byTitle("Fisiologia")[0], "conflito")).toMatch(/Plantão/);
    expect(msg(byTitle("Monitoria de Histologia")[0], "conflito")).toMatch(/Tutoria .*também neste material/);
  });

  it("revisar de novo não acumula sinais repetidos", () => {
    const again = review(reviewed, existing, period);
    expect(again.map((c) => c.flags.length)).toEqual(reviewed.map((c) => c.flags.length));
  });

  it("itens desmarcados não geram conflito", () => {
    const off = review(reviewed.map((c) => (c.title === "Embriologia" ? { ...c, include: false } : c)), existing, period);
    expect(off.find((c) => c.title === "Anatomia II")?.flags.some((f) => f.code === "conflito")).toBe(false);
  });

  it("converte para itens e provas marcados como importados, com o período escolhido", () => {
    const anatomia = byTitle("Embriologia")[0];
    expect(candidateToItem(anatomia, period, "i1", "lote")).toMatchObject({
      kind: "evento",
      source: "importado",
      importBatchId: "lote",
      date: undefined,
      recurrence: { weekdays: [1], startsOn: "2026-11-23", endsOn: "2027-03-31" },
    });
    let k = 0;
    const exam = candidateToExam({ ...byTitle("Fisiologia")[0], topics: ["Ciclo cardíaco", " "] }, "x1", "lote", () => `t${++k}`);
    expect(exam).toMatchObject({ subject: "Fisiologia", title: "Prova — Fisiologia", date: "2026-12-10", source: "importado", importBatchId: "lote" });
    expect(exam.topics.map((t) => t.title)).toEqual(["Ciclo cardíaco"]);
  });

  it("bloqueia itens incompletos e resume a importação", () => {
    expect(blockingErrors({ ...reviewed[0], title: " " })).toContain("Informe o título.");
    expect(blockingErrors({ ...reviewed[0], weekdays: [], date: undefined })).toContain("Informe a data ou os dias da semana.");
    const s = summarize(reviewed);
    expect(s).toMatchObject({ eventos: 5, provas: 2, recorrentes: 5, bloqueados: 0 });
  });
});

import { itemsToLines } from "@/lib/import/extractors";

describe("montagem de linhas do PDF", () => {
  it("agrupa por altura, ordena por coluna e separa colunas distantes", () => {
    const w = (s: string) => s.length * 5;
    const items = [
      { str: "Anatomia II", x: 200, y: 700, width: w("Anatomia II") },
      { str: "Segunda", x: 50, y: 700.5, width: w("Segunda") },
      { str: "07:30", x: 120, y: 699, width: w("07:30") },
      { str: "- 09:10", x: 148, y: 700, width: w("- 09:10") },
      { str: "Terça", x: 50, y: 680, width: w("Terça") },
      { str: "  ", x: 80, y: 680, width: 5 },
    ];
    expect(itemsToLines(items)).toEqual(["Segunda | 07:30 - 09:10 | Anatomia II", "Terça"]);
  });

  it("usa o tamanho da fonte para distinguir espaço entre palavras de colunas (posições reais de um PDF)", () => {
    const row = [
      { str: "Quinta", x: 40, y: 739, width: 35, size: 12 },
      { str: "13h30 às 15h30", x: 85, y: 739, width: 86, size: 12 },
      { str: "Prática de", x: 180, y: 739, width: 55, size: 12 },
      { str: "Microscopia", x: 238, y: 739, width: 63, size: 12 },
      { str: "Lab. Multidisciplinar", x: 310, y: 739, width: 105, size: 12 },
    ];
    expect(itemsToLines(row)).toEqual(["Quinta | 13h30 às 15h30 | Prática de Microscopia | Lab. Multidisciplinar"]);
  });
});

describe("plano de estudos (formato tutoria)", () => {
  const plano = [
    "TUTORIA — PLANO DA SEMANA",
    "-Revisar = reler resumo + questões antigas;",
    "• | SEGUNDA (23/11)",
    "o | 10-12h – AIM 2 Ped",
    "o | 14-17h – Prática Ped",
    "o | 19-22h",
    "o | Revisar Entrevista Psiquiátrica, Exame Mental e Súmula",
    "o | Revisar Afetividade",
    "• | SEXTA (27/11)",
    "o | 10-12h – AIM HAP",
    "o | 17h – Extensão",
    "o | 18-19h – revisar CBL Nefrologia – ITU",
    "",
    "• | SÁBADO (28/11)",
    "o | 09-12h",
    "o | Estudar Abdome agudo inflamatório",
    "o | LAZER",
  ].join("\n");
  const { candidates, unrecognized } = parse(plano);
  const by = (t: string) => candidates.find((c) => c.title === t);

  it("'10-12h' é horário (não a data 10/12) e o dia vem do cabeçalho, com ano confirmado pelo dia da semana", () => {
    expect(by("Ped")).toMatchObject({ kind: "prova", examTitle: "AIM 2", date: "2026-11-23", startTime: "10:00", endTime: "12:00" });
    expect(codes(by("Ped")!)).not.toContain("ano-presumido");
    expect(by("Prática Ped")).toMatchObject({ kind: "evento", startTime: "14:00", endTime: "17:00", category: "pratica" });
  });

  it("remove marcadores de lista do PDF/Word", () => {
    expect(candidates.every((c) => !/^(o|•)\b/.test(c.title))).toBe(true);
  });

  it("bloco '19-22h' passa o horário para as tarefas de estudo abaixo dele, sem conflito entre elas", () => {
    const rev = candidates.filter((c) => c.date === "2026-11-23" && c.kind === "tarefa");
    expect(rev.map((c) => [c.title, c.startTime, c.endTime, c.category])).toEqual([
      ["Revisar Entrevista Psiquiátrica, Exame Mental e Súmula", "19:00", "22:00", "estudo"],
      ["Revisar Afetividade", "19:00", "22:00", "estudo"],
    ]);
    expect(rev[0].group).toBe(rev[1].group);
  });

  it("'Revisar … Exame Mental' é tarefa de estudo, não prova; 'AIM HAP' é prova", () => {
    expect(candidates.filter((c) => c.kind === "prova").map((c) => `${c.examTitle} ${c.title}`)).toEqual(["AIM 2 Ped", "AIM HAP"]);
    expect(by("revisar CBL Nefrologia – ITU")).toMatchObject({ kind: "tarefa", startTime: "18:00", endTime: "19:00" });
  });

  it("linha sem horário fora de bloco (LAZER) não vira item; nada fica sem data", () => {
    expect(candidates.some((c) => /lazer/i.test(c.title))).toBe(false);
    expect(candidates.every((c) => c.date)).toBe(true);
    expect(by("Estudar Abdome agudo inflamatório")).toMatchObject({ date: "2026-11-28", startTime: "09:00", endTime: "12:00" });
    expect(unrecognized).toEqual([]);
  });

  it("aula/prova no mesmo horário de uma aula/prova da agenda é sinalizada como duplicata", () => {
    const existing = {
      items: [{ id: "p", kind: "evento" as const, title: "Pediatria — Prática 5", category: "pratica" as const, date: "2026-11-23", startTime: "14:00", endTime: "18:00", source: "importado" as const }],
      overrides: [],
      exams: [{ id: "e", subject: "Pediatria / Neonatologia", title: "AIM 2 — Pediatria / Neonatologia", date: "2026-11-23", startTime: "10:00", topics: [], source: "importado" as const }],
    };
    const r = review(candidates, existing, { startsOn: "2026-11-23" });
    const msg = (t: string) => r.find((c) => c.title === t)!.flags.find((f) => f.code === "duplicata")?.message ?? "";
    expect(msg("Ped")).toMatch(/já existe na sua agenda neste horário: Prova de Pediatria/);
    expect(msg("Prática Ped")).toMatch(/Pediatria — Prática 5/);
    // Tarefa de estudo no mesmo horário NÃO é duplicata
    expect(msg("Revisar Afetividade")).toBe("");
  });

  it("o aviso de duplicata continua depois de desmarcar o item (para explicar por que veio desmarcado)", () => {
    const existing = {
      items: [],
      overrides: [],
      exams: [{ id: "e", subject: "Pediatria", title: "AIM 2 — Pediatria", date: "2026-11-23", startTime: "10:00", topics: [], source: "importado" as const }],
    };
    const off = candidates.map((c) => (c.title === "Ped" ? { ...c, include: false } : c));
    const r = review(off, existing, { startsOn: "2026-11-23" });
    expect(r.find((c) => c.title === "Ped")!.flags.some((f) => f.code === "duplicata")).toBe(true);
  });
});
