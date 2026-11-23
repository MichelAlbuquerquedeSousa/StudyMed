/**
 * Leitor de planejamento acadêmico (texto → candidatos).
 *
 * Regras:
 * - Só extrai o que está explícito: dia da semana, data, horário, título, local, conteúdos.
 * - O que faltar fica vazio e sinalizado; nada é inventado. Quando algo é presumido
 *   (ex.: ano não escrito, categoria deduzida por palavra-chave), o item recebe um aviso.
 * - Linhas com data/horário que não puderam ser interpretadas vão para "não reconhecidas".
 */
import { inferYear, minutesToTime, parseISODate, type HHMM, type ISODate } from "../time";
import type { CategoryKey } from "../types";
import type { CandidateKind, Flag, FlagCode, ImportCandidate, ParseResult, UnrecognizedLine } from "./types";

// ---------------- Utilitários de texto ----------------

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const FLAG_TEXT: Record<FlagCode, string> = {
  "sem-horario": "Horário não informado",
  "sem-termino": "Horário de término não informado",
  "sem-data": "Sem data nem dia da semana",
  "ano-presumido": "Ano não informado",
  "categoria-presumida": "Categoria deduzida — confira",
  "titulo-incerto": "Título/disciplina não identificado com clareza",
  "data-invalida": "Data inválida",
  "varias-datas": "Mais de uma data na mesma linha",
  duplicata: "Possível duplicata",
  conflito: "Conflito de horário",
  alternativa: "Opção alternativa (“ou” no cronograma) — mantenha só a sua",
  "sem-aula": "Sem aula (recesso/feriado) — desmarcado",
  passado: "Já passou — desmarcado",
  "segunda-chamada": "Segunda chamada — desmarcada; marque se você for fazer",
};

export function flag(code: FlagCode, severity: Flag["severity"] = "aviso", detail?: string): Flag {
  return { code, severity, message: detail ? `${FLAG_TEXT[code]}: ${detail}` : FLAG_TEXT[code] };
}

// ---------------- Dias da semana ----------------

const WEEKDAY_FULL: [RegExp, number][] = [
  [/\bdomingo\b/, 0],
  [/\bsegunda(?:[\s-]*feira)?\b/, 1],
  [/\bterca(?:[\s-]*feira)?\b/, 2],
  [/\bquarta(?:[\s-]*feira)?\b/, 3],
  [/\bquinta(?:[\s-]*feira)?\b/, 4],
  [/\bsexta(?:[\s-]*feira)?\b/, 5],
  [/\bsabado\b/, 6],
];
const WEEKDAY_ABBR: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

/**
 * Dias da semana explícitos na linha. Abreviações ("seg", "ter"…) só contam no início da linha,
 * seguidas de pontuação ou de outra abreviação — evita confundir o verbo "ter" com terça.
 */
export function findWeekdays(line: string): { days: number[]; spans: [number, number][] } {
  const s = strip(line);
  const days = new Set<number>();
  const spans: [number, number][] = [];
  for (const [re, d] of WEEKDAY_FULL) {
    const g = new RegExp(re.source, "g");
    for (const m of s.matchAll(g)) {
      days.add(d);
      spans.push([m.index!, m.index! + m[0].length]);
    }
  }
  // 2ª, 3ª … 6ª feira
  for (const m of s.matchAll(/\b([2-6])\s*[ªa]\s*(?:-?\s*feira)?(?=$|[\s,.;:|/-])/g)) {
    days.add(Number(m[1]) - 1);
    spans.push([m.index!, m.index! + m[0].length]);
  }
  const abbr = /\b(dom|seg|ter|qua|qui|sex|sab)\b\.?/g;
  for (const m of s.matchAll(abbr)) {
    const start = m.index!;
    const before = s.slice(0, start);
    const after = s.slice(start + m[0].length);
    const okBefore = /^\s*$/.test(before) || /[|,;/]\s*$/.test(before) || (/\be\s*$/.test(before) && days.size > 0);
    const okAfter = m[0].endsWith(".") || /^\s*(?:[.:|,;/–-]|e\s+(?:dom|seg|ter|qua|qui|sex|sab)\b|\d|$)/.test(after);
    if (okBefore && okAfter) {
      days.add(WEEKDAY_ABBR[m[1]]);
      spans.push([start, start + m[0].length]);
    }
  }
  return { days: [...days].sort((a, b) => a - b), spans };
}

// ---------------- Datas ----------------

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

export interface FoundDate {
  date: ISODate | null; // null = inválida
  yearPresumed: boolean;
  span: [number, number];
}

function makeDate(y: number, m: number, d: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return parseISODate(iso).getUTCDate() === d ? iso : null; // rejeita 31/02 etc.
}

export function findDates(line: string, today: ISODate): FoundDate[] {
  const s = strip(line);
  const year = Number(today.slice(0, 4));
  const out: FoundDate[] = [];
  // 12/03, 12/03/2026, 12-03-26, 12.03
  for (const m of s.matchAll(/(?<![\d:h])(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?(?![\d:]|\s*h)/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (mo > 12 || d > 31 || mo === 0 || d === 0) continue; // não é data (ex.: 1.5)
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : year;
    out.push({ date: makeDate(y, mo, d), yearPresumed: !m[3], span: [m.index!, m.index! + m[0].length] });
  }
  // 12 de março (de 2026) / 12 mar
  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${monthNames})\\b\\.?(?:\\s*(?:de\\s+)?(\\d{4}))?`, "g"))) {
    const y = m[3] ? Number(m[3]) : year;
    out.push({ date: makeDate(y, MONTHS[m[2]], Number(m[1])), yearPresumed: !m[3], span: [m.index!, m.index! + m[0].length] });
  }
  return out.sort((a, b) => a.span[0] - b.span[0]);
}

// ---------------- Horários ----------------

const TIME = String.raw`(\d{1,2})\s*(?::\s*(\d{2})|h\s*(\d{2})?\s*(?:min)?)`;

function toTime(h: string, m1?: string, m2?: string): HHMM | null {
  const hh = Number(h);
  const mm = Number(m1 ?? m2 ?? 0);
  if (hh > 23 || mm > 59) return null;
  return minutesToTime(hh * 60 + mm);
}

export interface FoundTime {
  start: HHMM;
  end?: HHMM;
  span: [number, number];
}

/** Primeiro horário (ou intervalo) explícito: "07:30-09:10", "8h às 10h", "das 14h30 até 16h", "19h". */
export function findTime(line: string): FoundTime | null {
  const s = strip(line);
  const range = new RegExp(`(?:das\\s+|de\\s+)?${TIME}\\s*(?:-|–|—|a|as|ate|/|\\|)\\s*${TIME}`, "g");
  for (const m of s.matchAll(range)) {
    const start = toTime(m[1], m[2], m[3]);
    const end = toTime(m[4], m[5], m[6]);
    if (start && end) return { start, end, span: [m.index!, m.index! + m[0].length] };
  }
  // "10-12h", "8 às 10h": início só com a hora, fim com "h" ou ":"
  const hourRange = new RegExp(`(?<![\\d/:])(?:das\\s+|de\\s+)?(\\d{1,2})\\s*(?:-|–|—|a|as|ate)\\s*${TIME}`, "g");
  for (const m of s.matchAll(hourRange)) {
    const start = toTime(m[1]);
    const end = toTime(m[2], m[3], m[4]);
    if (start && end && start < end) return { start, end, span: [m.index!, m.index! + m[0].length] };
  }
  const single = new RegExp(`(?:as\\s+|a\\s+partir\\s+das\\s+)?${TIME}`, "g");
  for (const m of s.matchAll(single)) {
    // "1.5h" ou números soltos não contam; exige ":" ou "h".
    const start = toTime(m[1], m[2], m[3]);
    if (start) return { start, end: undefined, span: [m.index!, m.index! + m[0].length] };
  }
  return null;
}

// ---------------- Classificação ----------------

const EXAM_RE = /\b(prova|avaliacao|exame|teste|simulado|osce|n1|n2|n3|ap1|ap2|av1|av2|aim(?:\s*\d+)?|naf|segunda chamada|recuperacao)\b/;
/** Tarefa de estudo: começa com um verbo de estudo ("Revisar X", "Estudar Y"). Vale mais que palavras como "exame". */
const STUDY_RE = /^(estudar|revisar|rever|ler|resolver|fazer|refazer|assistir|resumir|praticar|treinar|memorizar)\b/i;
const TASK_RE = /\b(entrega|entregar|enviar|envio|ler|leitura|estudar|revisar|revisao|resumo|resumir|lista de exercicios|questoes|preparar|pagar|comprar)\b/;
const CATEGORY_RULES: [RegExp, CategoryKey][] = [
  [/\b(tutoria|tutorial|tutora?|apg|pbl|sessao tutorial|abertura|fechamento)\b/, "tutoria"],
  [/\b(pratica|praticas|laboratorio|lab|habilidades|simulacao|ambulatorio|estagio|plantao|campo|microscopia|dissecacao|oficina|extensao|ubs)\b/, "pratica"],
  [/\b(estudo|estudar|revisao|revisar|resumo|questoes|leitura|ler|flashcards?)\b/, "estudo"],
  [/\b(aula|teorica|conferencia|palestra|seminario)\b/, "aula"],
  [/\b(pagar|comprar|academia|consulta|pessoal|medico|dentista|lazer|dormir|descanso|descansar)\b/, "pessoal"],
];

export function guessCategory(text: string, kind: CandidateKind): { category: CategoryKey; presumed: boolean } {
  if (kind === "prova") return { category: "prova", presumed: false };
  const s = strip(text);
  for (const [re, cat] of CATEGORY_RULES) if (re.test(s)) return { category: cat, presumed: false };
  return { category: kind === "tarefa" ? "estudo" : "aula", presumed: true };
}

// ---------------- Local e título ----------------

const LOCATION_RE = /(?:\blocal\s*:\s*([^|;]+))|\b((?:sala|audit[oó]rio|anfiteatro|lab(?:orat[oó]rio)?\.?|bloco|ambulat[oó]rio|hospital|centro de simula[cç][aã]o|cl[ií]nica)\b[^|;,()]*)/i;

function extractLocation(text: string): { location?: string; rest: string } {
  const paren = text.match(/\(([^)]*)\)/);
  if (paren && LOCATION_RE.test(paren[1])) {
    return { location: collapse(paren[1]), rest: text.replace(paren[0], " ") };
  }
  const m = text.match(LOCATION_RE);
  if (!m) return { rest: text };
  const loc = collapse((m[1] ?? m[2]).replace(/[-–—:]+$/, ""));
  return { location: loc || undefined, rest: text.replace(m[0], " ") };
}

function removeSpans(text: string, spans: [number, number][]): string {
  // As posições vêm do texto sem acentos, que tem o mesmo tamanho do original (NFD remove só marcas combinantes).
  const chars = [...text.normalize("NFC")];
  for (const [a, b] of spans) for (let i = a; i < b && i < chars.length; i++) chars[i] = " ";
  return chars.join("");
}

function cleanTitle(text: string): string {
  let t = text
    .replace(/[|•·*]+/g, " ")
    .replace(/\(\s*\)/g, " ");
  t = collapse(t);
  // Sobras de conectores no início/fim: "das", "às", "dia", "horário", traços…
  for (let i = 0; i < 4; i++) {
    t = t
      .replace(/^(?:[-–—:,;./]+|\b(?:dia|das|de|da|do|as|às|a|e|horario|horário|hora|data|em)\b)\s*/i, "")
      .replace(/\s*(?:[-–—:,;./]+|\b(?:das|de|às|as|e|em)\b)$/i, "")
      .trim();
  }
  return t;
}

function examSubject(title: string): string {
  return collapse(
    title
      .replace(/\b(prova|avalia[cç][aã]o|exame|teste|simulado|osce|n[123]|ap[12]|av[12]|aim(?:\s*\d+)?|naf|te[oó]rica|pr[aá]tica|final|parcial|segunda chamada|recupera[cç][aã]o)\b/gi, " ")
      .replace(/^\s*[–—-]\s*/, "")
      .replace(/^\s*(?:de|da|do|-|–|:)\s*/i, "")
      .replace(/\s*[-–:]\s*$/, ""),
  ).replace(/^(?:de|da|do)\s+/i, "");
}

// ---------------- Conteúdos de prova ----------------

const TOPICS_HEADING_RE = /^(?:conte[uú]dos?(?:\s+program[aá]tico)?|assuntos?|temas?|t[oó]picos?|mat[eé]ria)\s*(?:cobrad[oa]s?)?\s*:?\s*(.*)$/i;
const BULLET_RE = /^\s*(?:[-•*·–—]|\[\s?[xX]?\s?\]|\d{1,3}[.)]|[a-zA-Z][.)](?=\s))\s*/;

function splitInlineTopics(s: string): string[] {
  return s
    .split(/[;,]|\s+e\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((x) => collapse(x.replace(BULLET_RE, "")))
    .filter((x) => x.length > 1);
}

// ---------------- Leitor principal ----------------

export function parsePlanning(text: string, today: ISODate, makeId: () => string = () => crypto.randomUUID()): ParseResult {
  const lines = text.replace(/ /g, " ").replace(/\t+/g, " | ").split(/\r?\n/);
  const candidates: ImportCandidate[] = [];
  const unrecognized: UnrecognizedLine[] = [];

  let ctxWeekdays: number[] = [];
  let ctxDate: { date: ISODate | null; yearPresumed: boolean } | null = null;
  let topicTarget: ImportCandidate | null = null;
  let lastExam: ImportCandidate | null = null;
  /** Bloco de horário ("19-22h" sozinho na linha): as tarefas de estudo abaixo dele herdam o horário. */
  let block: { start: HHMM; end?: HHMM; id: string } | null = null;

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    // Marcadores de lista vindos de PDF/Word ("•", "o", "▪") não fazem parte do texto.
    const line = collapse(raw.normalize("NFC")).replace(/^(?:[•◦▪●○·]\s*\|?|o\s*\|)\s*/, "");
    if (!line) {
      // Linha em branco encerra o bloco: a data/dia de contexto não vale para o próximo bloco.
      ctxDate = null;
      ctxWeekdays = [];
      topicTarget = null;
      block = null;
      return;
    }
    const plain = strip(line);

    // Cabeçalho de conteúdos: "Conteúdos:" (lista a seguir) ou "Conteúdos: a; b; c"
    const heading = line.match(TOPICS_HEADING_RE);
    if (heading && !findTime(line) && findDates(line, today).length === 0) {
      topicTarget = lastExam;
      if (topicTarget && heading[1]) {
        topicTarget.topics.push(...splitInlineTopics(heading[1]));
        topicTarget.sourceLines.push(lineNo);
      } else if (!topicTarget) {
        unrecognized.push({ line: lineNo, text: line });
      }
      return;
    }

    const wd = findWeekdays(line);
    const dates = findDates(line, today);
    const time = findTime(line);

    // Item de lista dentro de um bloco de conteúdos
    if (topicTarget && !time && dates.length === 0 && wd.days.length === 0) {
      const topic = collapse(line.replace(BULLET_RE, ""));
      if (topic) {
        topicTarget.topics.push(topic);
        topicTarget.sourceLines.push(lineNo);
      }
      return;
    }
    topicTarget = null;

    // Linha só com dia da semana ("Segunda-feira:") ou só com data ("12/03 (quinta)") = contexto
    const leftover = cleanTitle(removeSpans(line, [...wd.spans, ...dates.map((d) => d.span)]));
    if (!time && leftover.replace(/[()]/g, "").trim() === "") {
      if (dates.length === 1) {
        // "SEGUNDA (23/11)": o dia da semana confirma o ano.
        const d = dates[0];
        const [, mm, dd] = (d.date ?? "").split("-").map(Number);
        const byWeekday = d.yearPresumed && d.date && wd.days.length === 1 ? inferYear(dd, mm, wd.days[0], today) : null;
        ctxDate = byWeekday?.inferred ? { date: byWeekday.date, yearPresumed: false } : { date: d.date, yearPresumed: d.yearPresumed };
        ctxWeekdays = [];
        block = null;
        return;
      }
      if (wd.days.length > 0 && dates.length === 0) {
        ctxWeekdays = wd.days;
        ctxDate = null;
        return;
      }
    }

    // "data a definir", "a confirmar": não herda data/dia de contexto.
    const undefinedDate = /\b(a definir|a confirmar|sem data|indefinid[oa]|em breve)\b/.test(plain);
    if (undefinedDate) {
      ctxDate = null;
      ctxWeekdays = [];
    }
    // Horário sozinho na linha ("19-22h"): abre um bloco para as tarefas de estudo seguintes.
    const timeOnly = time && dates.length === 0 && wd.days.length === 0 && !cleanTitle(removeSpans(line, [time.span])).replace(/[–—-]/g, "").trim();
    if (timeOnly) {
      block = { start: time.start, end: time.end, id: makeId() };
      return;
    }
    const probeTitle = cleanTitle(removeSpans(line, [...wd.spans, ...dates.map((d) => d.span), ...(time ? [time.span] : [])]));
    const isStudy = STUDY_RE.test(probeTitle);
    let effTime = time;
    let group: string | undefined;
    if (time || dates.length || wd.days.length) block = null;
    else if (block && isStudy) {
      effTime = { start: block.start, end: block.end, span: [0, 0] };
      group = block.id;
    }
    const isExam = !isStudy && EXAM_RE.test(plain);
    const isTask = isStudy || (!isExam && TASK_RE.test(plain) && !(time && time.end));
    // Sem nenhum sinal de agenda: não é um item (texto corrido, títulos de seção…)
    if (!effTime && dates.length === 0 && wd.days.length === 0 && !(isExam && (ctxDate || ctxWeekdays.length || undefinedDate))) {
      if (/\d/.test(line) && (isExam || isTask)) unrecognized.push({ line: lineNo, text: line });
      return;
    }

    const flags: Flag[] = [];
    const kind: CandidateKind = isExam ? "prova" : isTask ? "tarefa" : "evento";

    // Agenda: data explícita > dias explícitos > contexto
    let date: ISODate | undefined;
    let weekdays: number[] = [];
    if (dates.length > 0) {
      const first = dates[0];
      if (dates.length > 1) flags.push(flag("varias-datas", "aviso", "usada a primeira"));
      if (!first.date) flags.push(flag("data-invalida", "erro", line.slice(first.span[0], first.span[1])));
      else date = first.date;
      if (first.yearPresumed && first.date && wd.days.length === 1) {
        const [, mm, dd] = first.date.split("-").map(Number);
        const r = inferYear(dd, mm, wd.days[0], today);
        if (r.inferred && r.date) date = r.date;
        else flags.push(flag("ano-presumido", "aviso", `considerado ${today.slice(0, 4)}`));
      } else if (first.yearPresumed) flags.push(flag("ano-presumido", "aviso", `considerado ${today.slice(0, 4)}`));
    } else if (wd.days.length > 0) {
      weekdays = wd.days;
    } else if (ctxDate) {
      if (!ctxDate.date) flags.push(flag("data-invalida", "erro"));
      else date = ctxDate.date;
      if (ctxDate.yearPresumed) flags.push(flag("ano-presumido", "aviso", `considerado ${today.slice(0, 4)}`));
    } else if (ctxWeekdays.length) {
      weekdays = ctxWeekdays;
    }
    if (kind === "prova" && weekdays.length > 0 && !date) {
      // Prova precisa de data; dia da semana não basta.
      weekdays = [];
    }
    if (!date && weekdays.length === 0) flags.push(flag("sem-data", kind === "tarefa" ? "aviso" : "erro"));

    // Título e local
    const spans: [number, number][] = [...wd.spans, ...dates.map((d) => d.span)];
    if (time) spans.push(time.span);
    const { location, rest } = extractLocation(removeSpans(line, spans));
    let title = cleanTitle(rest);
    let examTitle: string | undefined;
    if (kind === "prova") {
      // Nome da avaliação quando é uma sigla conhecida ("AIM 2", "NAF", "OSCE", "N1")
      const named = title.match(/\b(segunda chamada\s+)?(aim(?:\s*\d+)?|naf|osce|n[123]|av[12]|ap[12])\b/i);
      if (named) examTitle = named[0].toUpperCase().replace(/^SEGUNDA CHAMADA/, "Segunda chamada");
      const subject = examSubject(title);
      if (!subject) flags.push(flag("titulo-incerto", "erro", "informe a disciplina"));
      title = subject || "";
    } else if (!title || title.length < 2) {
      flags.push(flag("titulo-incerto", "erro"));
      title = "";
    }

    if (kind !== "tarefa" && kind !== "prova" && !effTime) flags.push(flag("sem-horario"));
    if (kind === "evento" && effTime && !effTime.end) flags.push(flag("sem-termino"));

    const { category, presumed } = isStudy ? { category: "estudo" as CategoryKey, presumed: false } : guessCategory(line, kind);
    if (presumed) flags.push(flag("categoria-presumida"));

    // Horário sem título reconhecível e sem agenda: provavelmente lixo de tabela
    if (!title && !date && weekdays.length === 0) {
      unrecognized.push({ line: lineNo, text: line });
      return;
    }

    const candidate: ImportCandidate = {
      id: makeId(),
      include: true,
      kind,
      title,
      category,
      weekdays,
      date,
      startTime: effTime?.start,
      endTime: effTime?.end,
      location,
      group,
      examTitle,
      topics: [],
      sourceLines: [lineNo],
      sourceText: line,
      flags,
    };

    // Conteúdos na mesma linha: "Prova de X - 12/03 - conteúdos: a, b, c"
    const inline = line.match(/conte[uú]dos?\s*:\s*(.+)$/i);
    if (kind === "prova" && inline) {
      candidate.topics.push(...splitInlineTopics(inline[1]));
      candidate.title = examSubject(cleanTitle(removeSpans(line.slice(0, line.search(/conte[uú]dos?\s*:/i)), spans))) || candidate.title;
    }

    candidates.push(candidate);
    if (kind === "prova") {
      lastExam = candidate;
      topicTarget = null;
    }
  });

  // Lista de conteúdos logo após uma prova sem cabeçalho "Conteúdos:" já foi tratada pelo cabeçalho;
  // lastExam é mantido só para cabeçalhos posteriores.
  void lastExam;
  return { candidates, unrecognized };
}
