/**
 * ⚠️ DADOS FICTÍCIOS — exemplo opcional que pode ser carregado e removido em Ajustes.
 * Todas as entradas têm `source: "ficticio"` e as datas são geradas a partir de "hoje",
 * para que a demonstração sempre pareça preenchida.
 */
import type { Exam, Item, OccurrenceOverride } from "@/lib/types";
import { addDays, startOfWeek, type ISODate } from "@/lib/time";

export interface AppData {
  items: Item[];
  overrides: OccurrenceOverride[];
  exams: Exam[];
}

export function buildMockData(today: ISODate, makeId: () => string = () => crypto.randomUUID()): AppData {
  const monday = startOfWeek(today);
  const recurrence = (weekdays: number[]) => ({
    freq: "weekly" as const,
    weekdays,
    startsOn: addDays(monday, -28),
    endsOn: addDays(monday, 140),
  });
  // O prefixo só documenta o tipo; o id real é um UUID (exigido pelo banco).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const id = (_kind: string) => makeId();

  const items: Item[] = [
    // Aulas
    { id: id("aula"), kind: "evento", title: "Anatomia II", category: "aula", startTime: "07:30", endTime: "09:10", location: "Auditório 2", recurrence: recurrence([1]), source: "ficticio" },
    { id: id("aula"), kind: "evento", title: "Fisiologia Humana", category: "aula", startTime: "08:00", endTime: "09:40", location: "Sala 104", recurrence: recurrence([2]), source: "ficticio" },
    { id: id("aula"), kind: "evento", title: "Bioquímica Metabólica", category: "aula", startTime: "07:30", endTime: "09:10", location: "Sala 201", recurrence: recurrence([3]), source: "ficticio" },
    { id: id("aula"), kind: "evento", title: "Histologia", category: "aula", startTime: "08:00", endTime: "09:40", location: "Sala 104", recurrence: recurrence([4]), source: "ficticio" },
    { id: id("aula"), kind: "evento", title: "Imunologia", category: "aula", startTime: "08:00", endTime: "09:40", location: "Auditório 1", recurrence: recurrence([5]), source: "ficticio" },
    // Práticas
    { id: id("pratica"), kind: "evento", title: "Lab. de Anatomia", category: "pratica", startTime: "09:20", endTime: "11:00", location: "Laboratório Morfológico", recurrence: recurrence([1]), source: "ficticio" },
    { id: id("pratica"), kind: "evento", title: "Habilidades Clínicas", category: "pratica", startTime: "10:00", endTime: "12:00", location: "Centro de Simulação", recurrence: recurrence([2]), source: "ficticio" },
    { id: id("pratica"), kind: "evento", title: "Microscopia", category: "pratica", startTime: "13:30", endTime: "15:30", location: "Lab. Multidisciplinar", recurrence: recurrence([4]), source: "ficticio" },
    // Tutorias
    { id: id("tutoria"), kind: "evento", title: "Tutoria — Abertura do caso", category: "tutoria", startTime: "14:00", endTime: "16:00", location: "Sala de tutoria 12", notes: "Tutora: Dra. Exemplo (fictícia)", recurrence: recurrence([1]), source: "ficticio" },
    { id: id("tutoria"), kind: "evento", title: "Tutoria — Fechamento", category: "tutoria", startTime: "14:00", endTime: "16:30", location: "Sala de tutoria 12", recurrence: recurrence([3]), source: "ficticio" },
    // Estudos recorrentes (tarefas concluíveis)
    { id: id("estudo"), kind: "tarefa", title: "Revisão ativa — flashcards", category: "estudo", startTime: "19:00", endTime: "20:00", recurrence: recurrence([1, 3, 5]), source: "ficticio" },
    { id: id("estudo"), kind: "tarefa", title: "Questões de residência (20)", category: "estudo", startTime: "16:30", endTime: "17:30", recurrence: recurrence([2, 4]), source: "ficticio" },
    // Pessoais recorrentes
    { id: id("pessoal"), kind: "tarefa", title: "Academia", category: "pessoal", startTime: "18:00", endTime: "19:00", recurrence: recurrence([2, 4]), source: "ficticio" },
    // Tarefas avulsas
    { id: id("estudo"), kind: "tarefa", title: "Resumo: ciclo cardíaco", category: "estudo", date: today, startTime: "10:30", endTime: "11:30", source: "ficticio" },
    { id: id("estudo"), kind: "tarefa", title: "Ler capítulo 4 — Guyton", category: "estudo", date: today, source: "ficticio" },
    { id: id("pessoal"), kind: "tarefa", title: "Comprar jaleco novo", category: "pessoal", date: today, source: "ficticio" },
    { id: id("pessoal"), kind: "tarefa", title: "Pagar boleto da mensalidade", category: "pessoal", date: addDays(today, -1), source: "ficticio" },
    { id: id("estudo"), kind: "tarefa", title: "Mapa mental de glicólise", category: "estudo", date: addDays(today, -1), doneAt: new Date(0).toISOString(), source: "ficticio" },
    { id: id("tutoria"), kind: "tarefa", title: "Preparar objetivos da tutoria", category: "tutoria", date: addDays(today, 1), startTime: "20:00", endTime: "21:00", source: "ficticio" },
    { id: id("pratica"), kind: "tarefa", title: "Entregar relatório de prática", category: "pratica", date: addDays(today, 2), source: "ficticio" },
    { id: id("pessoal"), kind: "tarefa", title: "Organizar resumos no Drive", category: "pessoal", date: addDays(today, 4), source: "ficticio" },
  ];

  const topics = (list: string[], doneCount: number) =>
    list.map((title, i) => ({ id: id("topico"), title, done: i < doneCount }));

  const exams: Exam[] = [
    {
      id: id("prova"),
      subject: "Anatomia II",
      title: "N1 — Anatomia II",
      date: addDays(today, 5),
      startTime: "08:00",
      location: "Auditório 2",
      notes: "Prova teórica + prática (peças). Levar jaleco.",
      topics: topics(
        ["Plexo braquial", "Músculos do membro superior", "Vascularização do membro superior", "Fossa cubital", "Mão: compartimentos", "Membro inferior: inervação", "Trígono femoral", "Fossa poplítea"],
        3,
      ),
      source: "ficticio",
    },
    {
      id: id("prova"),
      subject: "Fisiologia Humana",
      title: "N1 — Fisiologia",
      date: addDays(today, 12),
      startTime: "10:00",
      location: "Sala 104",
      topics: topics(["Potencial de ação", "Ciclo cardíaco", "Débito cardíaco", "Regulação da pressão arterial", "ECG básico", "Microcirculação"], 1),
      source: "ficticio",
    },
    {
      id: id("prova"),
      subject: "Bioquímica Metabólica",
      title: "N1 — Bioquímica",
      date: addDays(today, 26),
      startTime: "07:30",
      location: "Sala 201",
      topics: topics(["Glicólise", "Ciclo de Krebs", "Cadeia respiratória", "Gliconeogênese", "Metabolismo do glicogênio"], 0),
      source: "ficticio",
    },
    {
      id: id("prova"),
      subject: "Histologia",
      title: "Prova prática — Histologia",
      date: addDays(today, -4),
      startTime: "08:00",
      topics: topics(["Tecido epitelial", "Tecido conjuntivo", "Tecido muscular"], 3),
      source: "ficticio",
    },
  ];

  // Uma revisão de flashcards da semana já concluída, para mostrar o estado "feito".
  const flashcards = items.find((i) => i.title.startsWith("Revisão ativa"))!;
  const overrides: OccurrenceOverride[] = [{ itemId: flashcards.id, date: monday, done: true }];

  return { items, overrides, exams };
}
