/**
 * Leitor de GRADE SEMANAL em PDF (dias nas colunas, horários nas linhas, células coloridas).
 *
 * Funciona a partir da geometria da página:
 * - colunas: cabeçalhos "SEGUNDA … SEXTA" com a data (dd/mm) logo abaixo;
 * - faixas de horário: rótulos "08:00 – 10:00" na primeira coluna;
 * - células: retângulos preenchidos (coloridos) — uma célula mesclada cobre várias faixas;
 * - texto da célula: tudo o que está dentro do retângulo.
 * O ano é deduzido pelo dia da semana (03/08 numa segunda ⇒ 2026); se não bater, fica sinalizado.
 */
import { parseISODate, timeToMinutes, type HHMM, type ISODate } from "../time";
import type { CategoryKey } from "../types";
import { itemsToLines, type PositionedText } from "./line-assembly";
import { findTime, flag } from "./parser";
import type { Flag, ImportCandidate } from "./types";

export interface FilledRect {
  x0: number;
  y0: number; // base (PDF: y cresce para cima)
  x1: number;
  y1: number; // topo
  color: string; // #rrggbb
}

export interface GridColumn {
  weekday: number;
  date: ISODate | null;
  yearInferred: boolean;
  dateText: string;
  cx: number;
  x0: number;
  x1: number;
}

export interface GridBand {
  start: HHMM;
  end: HHMM;
  y0: number;
  y1: number;
}

export interface WeekGrid {
  columns: GridColumn[];
  bands: GridBand[];
  headerBottom: number;
  labelRight: number;
}

export interface GridCell {
  column: GridColumn;
  bands: GridBand[];
  lines: string[];
  color?: string;
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const WEEKDAY_HEADERS: Record<string, number> = { DOMINGO: 0, SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5, SABADO: 6 };
const center = (it: PositionedText) => it.x + it.width / 2;

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/** Ano em que dd/mm cai no dia da semana do cabeçalho (o mais próximo de hoje). */
export function inferYear(day: number, month: number, weekday: number, today: ISODate): { date: ISODate | null; inferred: boolean } {
  const ref = Number(today.slice(0, 4));
  const candidates = [ref, ref + 1, ref - 1]
    .map((y) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    .filter((iso) => {
      const d = parseISODate(iso);
      return d.getUTCDate() === day && d.getUTCDay() === weekday;
    });
  if (candidates.length) return { date: candidates[0], inferred: true };
  const iso = `${ref}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { date: parseISODate(iso).getUTCDate() === day ? iso : null, inferred: false };
}

/** Encontra a grade semanal na página (ou null se a página não for uma grade). */
export function detectGrid(items: PositionedText[], rects: FilledRect[], today: ISODate): WeekGrid | null {
  const heads = items
    .map((it) => ({ it, wd: WEEKDAY_HEADERS[strip(it.str).replace(/-?FEIRA$/, "").trim()] }))
    .filter((h) => h.wd !== undefined);
  if (heads.length < 3) return null;
  // Cabeçalhos na mesma altura
  const y = heads.map((h) => h.it.y).sort((a, b) => a - b)[Math.floor(heads.length / 2)];
  const row = heads.filter((h) => Math.abs(h.it.y - y) < 4).sort((a, b) => center(a.it) - center(b.it));
  if (row.length < 3) return null;

  const spacing = (center(row[row.length - 1].it) - center(row[0].it)) / (row.length - 1);
  let headerBottom = y;
  const columns: GridColumn[] = row.map(({ it, wd }) => {
    const cx = center(it);
    const dateItem = items.find((d) => /^\d{1,2}\/\d{1,2}$/.test(d.str.trim()) && Math.abs(center(d) - cx) < spacing / 2 && d.y < it.y && it.y - d.y < 30);
    let date: ISODate | null = null;
    let yearInferred = false;
    let dateText = "";
    if (dateItem) {
      const [dd, mm] = dateItem.str.trim().split("/").map(Number);
      const r = inferYear(dd, mm, wd, today);
      date = r.date;
      yearInferred = r.inferred;
      dateText = dateItem.str.trim();
      headerBottom = Math.min(headerBottom, dateItem.y);
    }
    return { weekday: wd, date, yearInferred, dateText, cx, x0: cx - spacing / 2, x1: cx + spacing / 2 };
  });
  headerBottom -= 4;
  const labelRight = columns[0].x0;

  // Rótulos de horário na primeira coluna ("08:00 –" e "10:00" podem estar em linhas separadas)
  const labelItems = items.filter((it) => center(it) < labelRight && it.y < headerBottom && it.str.trim()).sort((a, b) => b.y - a.y);
  const groups: PositionedText[][] = [];
  for (const it of labelItems) {
    const g = groups[groups.length - 1];
    const size = it.size ?? 10;
    if (g && g[g.length - 1].y - it.y < size * 1.8) g.push(it);
    else groups.push([it]);
  }
  const labels = groups
    .map((g) => ({ t: findTime(g.map((i) => i.str).join(" ")), cy: g.reduce((s, i) => s + i.y, 0) / g.length }))
    .filter((l): l is { t: NonNullable<ReturnType<typeof findTime>>; cy: number } => Boolean(l.t?.end));
  if (labels.length < 2) return null;

  // Limites das faixas: retângulo da célula do rótulo, se houver; senão, pontos médios entre rótulos.
  const bands: GridBand[] = labels.map((l, i) => {
    const cell = rects.find((r) => r.x1 <= labelRight + 3 && r.y0 <= l.cy && r.y1 >= l.cy && r.y1 - r.y0 < 400);
    const top = cell ? cell.y1 : i === 0 ? headerBottom : (labels[i - 1].cy + l.cy) / 2;
    const bottom = cell ? cell.y0 : i === labels.length - 1 ? l.cy - (top - l.cy) : (l.cy + labels[i + 1].cy) / 2;
    return { start: l.t.start, end: l.t.end!, y0: bottom, y1: top };
  });
  return { columns, bands, headerBottom, labelRight };
}

/** Faixas cobertas por um intervalo vertical. */
function bandsFor(grid: WeekGrid, y0: number, y1: number): GridBand[] {
  const covered = grid.bands.filter((b) => {
    const overlap = Math.min(y1, b.y1) - Math.max(y0, b.y0);
    return overlap > 0 && overlap >= (b.y1 - b.y0) * 0.5;
  });
  if (covered.length) return covered;
  let best: GridBand | null = null;
  let bestOverlap = 0;
  for (const b of grid.bands) {
    const overlap = Math.min(y1, b.y1) - Math.max(y0, b.y0);
    if (overlap > bestOverlap) {
      best = b;
      bestOverlap = overlap;
    }
  }
  return best ? [best] : [];
}

/** Agrupa o texto da página em células da grade. */
export function gridCells(items: PositionedText[], rects: FilledRect[], grid: WeekGrid): GridCell[] {
  const left = grid.columns[0].x0;
  const right = grid.columns[grid.columns.length - 1].x1;
  const colWidth = grid.columns[0].x1 - grid.columns[0].x0;
  const bodyBottom = Math.min(...grid.bands.map((b) => b.y0)) - 2;

  // Células coloridas dentro do corpo da tabela; destaques pequenos de texto (marca-texto) ficam de fora.
  let cells = rects.filter(
    (r) =>
      luminance(r.color) < 0.97 &&
      r.x0 >= left - 3 &&
      r.x1 <= right + 3 &&
      r.y1 <= grid.headerBottom + 6 &&
      r.y0 >= bodyBottom - 6 &&
      r.x1 - r.x0 >= colWidth * 0.3 &&
      r.y1 - r.y0 >= 14,
  );
  // Remove duplicados (mesmo retângulo desenhado duas vezes).
  cells = cells.filter((r, i) => cells.findIndex((s) => Math.abs(s.x0 - r.x0) < 1 && Math.abs(s.x1 - r.x1) < 1 && Math.abs(s.y0 - r.y0) < 1 && Math.abs(s.y1 - r.y1) < 1) === i);

  const inside = (it: PositionedText, r: { x0: number; x1: number; y0: number; y1: number }) => {
    const cx = center(it);
    const cy = it.y + (it.size ?? 8) * 0.3;
    return cx >= r.x0 - 1 && cx <= r.x1 + 1 && cy >= r.y0 - 1 && cy <= r.y1 + 1;
  };
  const body = items.filter((it) => it.str.trim() && center(it) >= left && center(it) <= right && it.y < grid.headerBottom && it.y > bodyBottom - 4);

  // Cada pedaço de texto vai para o MENOR retângulo que o contém (células lado a lado/empilhadas).
  const byCell = new Map<FilledRect, PositionedText[]>();
  const loose: PositionedText[] = [];
  for (const it of body) {
    const owners = cells.filter((r) => inside(it, r)).sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0));
    if (owners.length) byCell.set(owners[0], [...(byCell.get(owners[0]) ?? []), it]);
    else loose.push(it);
  }

  // Retângulo sem texto colado (mesma cor e coluna) a outro com texto = mesma célula mesclada.
  const merged = new Map<FilledRect, { x0: number; x1: number; y0: number; y1: number }>();
  for (const r of cells) if (byCell.has(r)) merged.set(r, { ...r });
  for (const r of cells) {
    if (byCell.has(r)) continue;
    for (const [owner, box] of merged) {
      const sameCol = Math.abs(owner.x0 - r.x0) < 3 && Math.abs(owner.x1 - r.x1) < 3 && owner.color === r.color;
      const touches = Math.abs(box.y0 - r.y1) < 3 || Math.abs(box.y1 - r.y0) < 3;
      if (sameCol && touches) {
        box.y0 = Math.min(box.y0, r.y0);
        box.y1 = Math.max(box.y1, r.y1);
        break;
      }
    }
  }

  const columnOf = (x0: number, x1: number) => {
    const cx = (x0 + x1) / 2;
    return grid.columns.find((c) => cx >= c.x0 && cx <= c.x1) ?? null;
  };

  const out: GridCell[] = [];
  for (const [r, its] of byCell) {
    const box = merged.get(r)!;
    const column = columnOf(box.x0, box.x1);
    if (!column) continue;
    out.push({ column, bands: bandsFor(grid, box.y0, box.y1), lines: itemsToLines(its), color: r.color });
  }

  // Texto fora de células coloridas (células brancas): agrupa por coluna e faixa.
  const looseGroups = new Map<string, { column: GridColumn; band: GridBand; its: PositionedText[] }>();
  for (const it of loose) {
    const column = columnOf(it.x, it.x + it.width);
    const band = grid.bands.find((b) => it.y >= b.y0 && it.y <= b.y1);
    if (!column || !band) continue;
    const key = `${column.cx}|${band.start}`;
    const g = looseGroups.get(key) ?? { column, band, its: [] };
    g.its.push(it);
    looseGroups.set(key, g);
  }
  for (const g of looseGroups.values()) out.push({ column: g.column, bands: [g.band], lines: itemsToLines(g.its) });

  return out.sort((a, b) => (a.column.cx - b.column.cx) || (timeToMinutes(a.bands[0]?.start ?? "00:00") - timeToMinutes(b.bands[0]?.start ?? "00:00")));
}

/**
 * Legenda de cores (ex.: capa com "PEDIATRIA", "NEFROLOGIA"… em faixas coloridas): cor → disciplina.
 * Usada só quando uma célula não traz o nome da disciplina.
 */
export function detectLegend(items: PositionedText[], rects: FilledRect[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rects) {
    if (luminance(r.color) > 0.97 || r.x1 - r.x0 < 120 || r.y1 - r.y0 > 40 || r.y1 - r.y0 < 8) continue;
    const text = items
      .filter((it) => it.str.trim() && center(it) > r.x0 && center(it) < r.x1 && it.y > r.y0 - 1 && it.y < r.y1)
      .map((it) => it.str.trim())
      .join(" ")
      .trim();
    if (text && text === text.toUpperCase() && text.length < 60 && !map.has(r.color)) map.set(r.color, text);
  }
  return map.size >= 3 ? map : new Map();
}

// ---------------- Interpretação do conteúdo de uma célula ----------------

/** Palavras que costumam ser quebradas no meio em células estreitas ("RADIOL OGIA"). */
const VOCAB = [
  "RADIOLOGIA", "PNEUMOLOGIA", "GINECOLOGIA", "OBSTETRÍCIA", "PEDIATRIA", "NEONATOLOGIA", "NEFROLOGIA", "UROLOGIA", "CARDIOLOGIA",
  "SEGUNDA CHAMADA", "CLINICAL SKILLS", "EMERGÊNCIAS", "CARDIOLÓGICAS", "ELETIVA", "IMAGEM", "ABDOME", "AGUDO",
  "DIAGNÓSTICOS", "NEUROIMAGEM", "INDEPENDÊNCIA", "GINECOLÓGICA", "ULTRASSONOGRAFIA", "TOMOGRAFIA", "RESSONÂNCIA",
];

export function repairBrokenWords(text: string): string {
  let out = text;
  for (const w of VOCAB) {
    const letters = [...w.replace(/\s+/g, "")];
    // Permite um espaço/quebra entre quaisquer letras da palavra; exige fronteira de palavra nas pontas.
    const re = new RegExp(`(?<![\\p{L}])${letters.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s?")}(?![\\p{L}])`, "giu");
    out = out.replace(re, (m) => {
      // Reaproveita as letras do original (mantém maiúsculas/minúsculas) com os espaços da palavra correta.
      const letters = [...m.replace(/\s+/g, "")];
      let i = 0;
      return [...w].map((ch) => (ch === " " ? " " : letters[i++])).join("");
    });
  }
  return out;
}

const ACRONYMS = new Set(["AIS", "HAP", "HAPVI", "AISVI", "AIM", "NAF", "OSCE", "TBL", "CBL", "UBS", "HDE", "NAPI", "FAMED", "UNINTA", "TCE", "DHEG", "II", "III", "IV", "V", "VI", "VII", "VIII", "I"]);
const SMALL = new Set(["e", "de", "da", "do", "das", "dos", "em", "a", "o", "com", "para", "ou", "to", "of", "the", "and"]);

/** "OBSTETRÍCIA" → "Obstetrícia"; mantém siglas e numerais romanos ("AIS VI"). */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|\/|-)/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up.replace(/[^A-Z]/g, "")) && /^[A-Za-zÀ-ú]+$/.test(w)) return up;
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

const DESCRIPTOR_RE =
  /^(?:aulas?\s+[\d\s,e]+|class\s+\d+|pr[aá]tica(?:\s+(?:hospitalar|napi))?(?:\s*\d+)?(?:\s*-\s*ubs)?|aim\s*(?:\d+|[ivx]+)?|naf|osce|segunda chamada(?:\s+aim\s*(?:\d+|[ivx]+)?)?|extens[aã]o|confer[eê]ncia|oficina|tbl|cbl|caso cl[ií]nico|teste de resgate|simula[cç][aã]o.*|aula pr[aá]tica)$/i;
const EXAM_WORDS = /\b(aim\s*(?:\d+|[ivx]+)?|naf|osce|segunda chamada|teste de resgate|avalia[cç][aã]o|prova)\b/i;
const PROF_RE = /^(?:profs?\.?|profas?\.?|prof[ªº]\.?|prof\(a\)|respons[aá]vel)\b\s*:?/i;
const LOCAL_RE = /^local\s*:/i;
const NO_CLASS_RE = /\b(recesso|feriado|dia do (estudante|professor)|sem aula)\b/i;

interface CellPart {
  discipline: string;
  descriptors: string[];
  theme: string;
  professors: string[];
  location?: string;
}

function splitCellParts(lines: string[]): string[][] {
  const parts: string[][] = [[]];
  for (const l of lines) {
    if (/^ou$/i.test(l.trim())) parts.push([]);
    else parts[parts.length - 1].push(l);
  }
  return parts.filter((p) => p.length);
}

/** Linha que parece continuação de nomes ("Linhares, Renata Nogueira", "Sousa Taumaturgo / Prof. Peter"). */
function looksLikeNames(l: string): boolean {
  if (/[:;?]/.test(l) || DESCRIPTOR_RE.test(l)) return false;
  if (/\bprof/i.test(l)) return true;
  const words = l.replace(/[,/]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 8) return false;
  return words.every((w) => /^(e|de|da|do|das|dos)$/.test(w) || /^\p{Lu}[\p{Ll}'.]+$/u.test(w) || /^\p{Lu}\.$/u.test(w));
}

function parsePart(lines: string[]): CellPart {
  const professors: string[] = [];
  const locationParts: string[] = [];
  const rest: string[] = [];
  let mode: "texto" | "prof" | "local" = "texto";
  for (const raw of lines) {
    const l = raw.replace(/\s*\*\s*$/, "").replace(/[-–—_]{3,}/g, "").trim();
    if (!l || (mode !== "local" && /^aula$/i.test(l))) continue;
    if (LOCAL_RE.test(l)) {
      mode = "local";
      locationParts.push(l.replace(LOCAL_RE, "").trim());
    } else if (/^classroom$/i.test(l)) {
      locationParts.push(l);
    } else if (PROF_RE.test(l)) {
      mode = "prof";
      professors.push(l);
    } else if (mode === "local" && !DESCRIPTOR_RE.test(l) && l.split(/\s+/).length <= 4) {
      locationParts.push(l);
    } else if (mode === "prof" && (/(,|\b(e|de|da|do|das|dos)|\/)$/.test(professors[professors.length - 1]) || looksLikeNames(l))) {
      professors[professors.length - 1] += " " + l;
    } else if (mode === "texto" && /^(AUTODIRIGIDO|AUTO DIRIGIDO)$/i.test(l)) {
      locationParts.push("Autodirigido");
    } else {
      mode = "texto";
      rest.push(l);
    }
  }
  // Disciplina: primeiras linhas em maiúsculas até o primeiro descritor ("Aula 1", "PRÁTICA 1"…)
  const disc: string[] = [];
  const descriptors: string[] = [];
  const theme: string[] = [];
  let phase: "disc" | "body" = "disc";
  for (const l of rest) {
    if (DESCRIPTOR_RE.test(l)) {
      const split = l.match(/^(segunda chamada)\s+(.+)$/i);
      descriptors.push(...(split ? [split[1], split[2]] : [l]));
      phase = "body";
    } else if (phase === "disc" && l === l.toUpperCase() && /\p{Lu}/u.test(l)) {
      const [head, ...tail] = l.split(":");
      // "NEFROLOGIA CBL" / "CLÍNICA CIRÚRGICA I AIM I": descritor no fim da linha da disciplina
      const m = head.match(/^(.*?)\s+((?:segunda chamada\s+)?(?:aim\s*(?:\d+|[ivx]+)?|naf|osce|tbl|cbl|extens[aã]o|pr[aá]tica\s*\d*|segunda chamada))$/i);
      if (m && m[1].trim()) {
        disc.push(m[1].trim());
        descriptors.push(m[2].trim());
      } else disc.push(head.trim());
      if (tail.length) {
        const t = tail.join(":").trim().toLowerCase();
        theme.push(t.charAt(0).toUpperCase() + t.slice(1));
        phase = "body";
      }
    } else {
      phase = "body";
      theme.push(l);
    }
  }
  const location = dedupeTail(locationParts.join(" ").replace(/\s*[-–]\s*$/, "").replace(/\s+/g, " ").trim());
  return {
    discipline: repairBrokenWords(disc.join(" ").replace(/\s+/g, " ").trim()),
    descriptors,
    theme: repairBrokenWords(theme.join(" ").replace(/\s+/g, " ").trim()),
    professors: professors.map((p) => p.replace(/\s+/g, " ").trim()),
    location: location || undefined,
  };
}

/** "Sala de Aula - FAMED sala de aula" → "Sala de Aula - FAMED" (remove repetição no fim). */
export function dedupeTail(s: string): string {
  const words = s.split(" ");
  const norm = words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
  for (let k = Math.floor(words.length / 2); k >= 2; k--) {
    const tail = norm.slice(-k).join(" ");
    for (let i = 0; i + k <= words.length - k; i++) {
      if (norm.slice(i, i + k).join(" ") === tail) return words.slice(0, -k).join(" ").replace(/\s*[-–]\s*$/, "");
    }
  }
  return s;
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function categoryOf(text: string): CategoryKey {
  if (/tutoria|apg|pbl/i.test(text)) return "tutoria";
  if (/pr[aá]tica|laborat[oó]rio|oficina|extens[aã]o|\bubs\b|hospitalar|simula[cç][aã]o|territ[oó]rio|ambulat/i.test(text)) return "pratica";
  return "aula";
}

/**
 * Converte uma célula da grade em candidatos (um por opção quando há "ou").
 * Itens com data anterior a `today` vêm desmarcados.
 */
export function cellToCandidates(cell: GridCell, today: ISODate, makeId: () => string, legend: Map<string, string> = new Map()): ImportCandidate[] {
  const raw = repairBrokenWords(cell.lines.map((l) => l.replace(/\s*\|\s*/g, " ")).join("\n"))
    .split("\n")
    .map((l) => l.trim());
  if (!raw.join("").trim()) return [];
  const parts = splitCellParts(raw);
  const group = parts.length > 1 ? makeId() : undefined;
  const all = raw.join(" ");
  const sharedLocation = parts.map(parsePart).find((p) => p.location)?.location;
  const start = cell.bands[0]?.start;
  const end = cell.bands[cell.bands.length - 1]?.end;
  const col = cell.column;

  return parts.map((lines) => {
    const p = parsePart(lines);
    const flags: Flag[] = [];
    const noClass = NO_CLASS_RE.test(lines.join(" "));
    let fromLegend = false;
    if (!p.discipline && cell.color && legend.has(cell.color) && (p.descriptors.length || p.theme)) {
      p.discipline = legend.get(cell.color)!;
      fromLegend = true;
    }
    const isExam = !noClass && EXAM_WORDS.test([p.discipline, ...p.descriptors].join(" "));
    const discipline = titleCase(p.discipline || "");
    if (fromLegend) flags.push(flag("categoria-presumida", "aviso", `disciplina “${discipline}” deduzida pela cor da legenda`));
    const descriptors = p.descriptors.map((d) => (d === d.toUpperCase() ? titleCase(d) : d.charAt(0).toUpperCase() + d.slice(1)));

    if (!col.date) flags.push(flag("data-invalida", "erro", col.dateText || "data não encontrada no cabeçalho"));
    else if (!col.yearInferred) flags.push(flag("ano-presumido", "aviso", `o dia da semana não confere com ${col.dateText}`));
    if (group) flags.push(flag("alternativa"));
    if (noClass) flags.push(flag("sem-aula"));
    const past = Boolean(col.date && col.date < today);
    if (past && !noClass) flags.push(flag("passado"));
    const makeup = isExam && /segunda chamada/i.test([p.discipline, ...p.descriptors].join(" "));
    if (makeup && !past) flags.push(flag("segunda-chamada"));

    let title: string;
    let kind: ImportCandidate["kind"] = isExam ? "prova" : "evento";
    let examTitle: string | undefined;
    if (noClass) {
      title = titleCase(lines.join(" ").replace(/\s+/g, " ").trim());
      kind = "evento";
    } else if (isExam && discipline && !/^teste de/i.test(discipline)) {
      title = discipline;
      examTitle = clip(descriptors.join(" · ") || "Avaliação", 80);
    } else if (isExam || /^teste de/i.test(discipline)) {
      // Avaliação institucional sem disciplina (ex.: Teste de Progresso): evento na cor de provas.
      kind = "evento";
      title = clip([discipline, ...descriptors].filter(Boolean).join(" · ") || titleCase(p.theme), 200);
    } else {
      const head = [discipline, descriptors.join(" · ")].filter(Boolean).join(" — ");
      title = clip(head && p.theme ? `${head}: ${p.theme}` : head || p.theme, 200);
      if (!discipline) flags.push(flag("titulo-incerto", "aviso", "disciplina não identificada — confira o título"));
    }

    const notes = [p.theme && (isExam || title.endsWith("…")) ? p.theme : "", p.professors.join("; ")].filter(Boolean).join("\n");
    return {
      id: makeId(),
      include: !noClass && !past && !makeup,
      kind,
      title,
      category: noClass ? "pessoal" : isExam || /^teste de/i.test(discipline) ? "prova" : categoryOf(lines.join(" ") || all),
      weekdays: [],
      date: col.date ?? undefined,
      startTime: noClass ? undefined : start,
      endTime: noClass ? undefined : end,
      location: clip(p.location ?? sharedLocation ?? "", 200) || undefined,
      notes: notes ? clip(notes, 4000) : undefined,
      examTitle,
      group,
      topics: [],
      sourceLines: [],
      sourceText: clip(raw.join(" · "), 300),
      flags,
    } satisfies ImportCandidate;
  });
}

/** Texto legível (e compatível com o leitor de texto) para a pessoa conferir o que foi lido da grade. */
export function renderCandidates(cands: ImportCandidate[]): string {
  const fmt = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "??/??");
  return cands
    .map((c) => {
      const time = c.startTime ? ` ${c.startTime}-${c.endTime ?? ""}` : "";
      const title = c.kind === "prova" ? `${c.examTitle ?? "Prova"} de ${c.title}` : c.title;
      const loc = c.location ? ` | Local: ${c.location}` : "";
      return `${fmt(c.date)}${time} ${title}${loc}`;
    })
    .join("\n");
}

