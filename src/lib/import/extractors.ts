/**
 * Extratores: transformam o material enviado em texto para o leitor de planejamento.
 * v1: texto colado e PDF com texto selecionável (processados no navegador; nada é enviado a terceiros).
 * Futuro: OCR (imagens/PDF digitalizado) e IA — já previstos aqui, desativados.
 */
import type { ExtractedDocument } from "./types";

export interface Extractor {
  id: "texto" | "pdf" | "ocr" | "ia";
  label: string;
  available: boolean;
  accepts: (file: File) => boolean;
  extract: (file: File) => Promise<ExtractedDocument>;
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

// ---------------- Montagem de linhas a partir das posições do texto no PDF ----------------

export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  /** Tamanho da fonte (quando conhecido): referência para separar palavras de colunas. */
  size?: number;
}

/**
 * Agrupa pedaços de texto pela altura (y) e os ordena da esquerda para a direita.
 * Espaços grandes entre pedaços (colunas de tabela) viram " | ", que o leitor entende como separador.
 */
export function itemsToLines(items: PositionedText[], tolerance = 3): string[] {
  const rows: { y: number; parts: PositionedText[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
    if (row) row.parts.push(it);
    else rows.push({ y: it.y, parts: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(({ parts }) => {
    parts.sort((a, b) => a.x - b.x);
    let line = "";
    let prevEnd: number | null = null;
    for (const p of parts) {
      const charW = p.width / Math.max(p.str.length, 1);
      if (prevEnd !== null) {
        const gap = p.x - prevEnd;
        // Espaço entre palavras ≈ 0,25 × fonte; colunas de tabela ficam bem mais afastadas.
        const columnGap = p.size ? p.size * 0.6 : Math.max(6, charW * 1.6);
        line += gap > columnGap ? " | " : gap > charW * 0.25 && !line.endsWith(" ") && !p.str.startsWith(" ") ? " " : "";
      }
      line += p.str;
      prevEnd = p.x + p.width;
    }
    return line.replace(/\s+/g, " ").trim();
  });
}

// ---------------- PDF ----------------

async function extractPdf(file: File): Promise<ExtractedDocument> {
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
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is Extract<(typeof content.items)[number], { str: string }> => "str" in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, size: Math.hypot(it.transform[0], it.transform[1]) || undefined }));
    pages.push(itemsToLines(items).join("\n"));
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
