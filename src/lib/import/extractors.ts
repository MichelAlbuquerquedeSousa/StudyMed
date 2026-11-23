/**
 * Extratores: transformam o material enviado em texto para o leitor de planejamento.
 * v1: texto colado e PDF com texto selecionável (processados no navegador; nada é enviado a terceiros).
 * Futuro: OCR (imagens/PDF digitalizado) e IA — já previstos aqui, desativados.
 */
import { cellToCandidates, detectGrid, detectLegend, gridCells, renderCandidates, type FilledRect } from "./grid";
import { filledRects, type OpCodes } from "./pdf-geometry";
import type { ExtractedDocument, ImportCandidate } from "./types";
import { todayInTZ } from "../time";

export interface Extractor {
  id: "texto" | "pdf" | "ocr" | "ia";
  label: string;
  available: boolean;
  accepts: (file: File) => boolean;
  extract: (file: File) => Promise<ExtractedDocument>;
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export { itemsToLines, type PositionedText } from "./line-assembly";
import { itemsToLines, type PositionedText } from "./line-assembly";

// ---------------- PDF ----------------

async function extractPdf(file: File, today: string = todayInTZ()): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "PasswordException") throw new Error("Este PDF é protegido por senha. Remova a senha e tente de novo.");
    throw new Error("Não foi possível ler este PDF. Ele pode estar corrompido.");
  }
  const pages: string[] = [];
  const pageData: { items: PositionedText[]; rects: FilledRect[] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is Extract<(typeof content.items)[number], { str: string }> => "str" in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, size: Math.hypot(it.transform[0], it.transform[1]) || undefined }));
    const ops = await page.getOperatorList();
    pageData.push({ items, rects: filledRects(ops.fnArray, ops.argsArray as unknown[][], pdfjs.OPS as unknown as OpCodes) });
    pages.push(itemsToLines(items).join("\n"));
  }

  // Grade semanal (dias nas colunas, horários nas linhas): lida pela geometria da página.
  let legend = new Map<string, string>();
  for (const pd of pageData) {
    const l = detectLegend(pd.items, pd.rects);
    if (l.size > legend.size) legend = l;
  }
  const structured: ImportCandidate[] = [];
  const rendered: string[] = [];
  let gridPages = 0;
  pageData.forEach((pd, idx) => {
    const grid = detectGrid(pd.items, pd.rects, today);
    if (!grid) return;
    gridPages++;
    const cands = gridCells(pd.items, pd.rects, grid).flatMap((c) => cellToCandidates(c, today, () => crypto.randomUUID(), legend));
    cands.forEach((c) => (c.sourceLines = [idx + 1]));
    structured.push(...cands);
    rendered.push(`# Semana ${gridPages} (página ${idx + 1})`, renderCandidates(cands), "");
  });
  if (gridPages > 0) {
    await task.destroy();
    return {
      text: rendered.join("\n").trim(),
      structured,
      source: "pdf",
      fileName: file.name,
      pages: pages.length,
      warnings: [],
      info: `Grade semanal reconhecida em ${gridPages} ${gridPages === 1 ? "página" : "páginas"}: ${structured.length} atividades. Atividades que já passaram, segundas chamadas e recessos vêm desmarcados.`,
    };
  }
  const text = pages.join("\n\n");
  const warnings: string[] = [];
  const letters = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (letters < 20 * doc.numPages) {
    warnings.push(
      "Este PDF tem pouco ou nenhum texto selecionável — provavelmente é uma imagem digitalizada. A leitura por OCR chega numa versão futura; por enquanto, copie o texto manualmente.",
    );
  }
  await task.destroy();
  return { text, source: "pdf", fileName: file.name, pages: pages.length, warnings };
}

export const EXTRACTORS: Extractor[] = [
  {
    id: "pdf",
    label: "PDF com texto",
    available: true,
    accepts: (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    extract: extractPdf,
  },
  {
    id: "ocr",
    label: "Imagem ou PDF digitalizado (OCR)",
    available: false,
    accepts: (f) => /^image\//.test(f.type),
    extract: async () => {
      throw new Error("Leitura de imagens ainda não disponível.");
    },
  },
];

export async function extractFile(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error("Arquivo muito grande (máximo de 15 MB).");
  const ex = EXTRACTORS.find((e) => e.accepts(file));
  if (!ex) throw new Error("Formato não suportado. Envie um PDF ou cole o texto.");
  if (!ex.available) throw new Error(`${ex.label}: ainda não disponível nesta versão. Por enquanto, cole o texto.`);
  return ex.extract(file);
}

export function fromPastedText(text: string): ExtractedDocument {
  return { text, source: "texto", warnings: [] };
}
