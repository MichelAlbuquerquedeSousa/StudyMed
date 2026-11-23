/**
 * Verificação com um PDF real que NÃO fica no repositório.
 * Uso: LOCAL_PDF=/caminho/arquivo.pdf npx vitest run tests/local-pdf.test.ts
 * (sem LOCAL_PDF, o teste é ignorado)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cellToCandidates, detectGrid, detectLegend, gridCells, renderCandidates } from "@/lib/import/grid";
import { filledRects } from "@/lib/import/pdf-geometry";

const file = process.env.LOCAL_PDF;
const today = process.env.TODAY ?? "2026-11-23";

describe.skipIf(!file)("PDF local", () => {
  it("lê a grade semanal", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file!)) }).promise;
    let n = 0;
    const all = [];
    const report: string[] = [];
    let legend = new Map<string, string>();
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter((it) => "str" in it)
        .map((it) => {
          const t = it as { str: string; transform: number[]; width: number };
          return { str: t.str, x: t.transform[4], y: t.transform[5], width: t.width, size: Math.hypot(t.transform[0], t.transform[1]) };
        });
      const ops = await page.getOperatorList();
      const rects = filledRects(ops.fnArray, ops.argsArray as unknown[][], pdfjs.OPS as never);
      const grid = detectGrid(items, rects, today);
      if (!grid) {
        const l = detectLegend(items, rects);
        if (l.size) legend = l;
        report.push(`p${p}: sem grade; legenda: ${[...l].map(([c, t]) => `${c}=${t}`).join(", ")}`);
        continue;
      }
      const cells = gridCells(items, rects, grid);
      const cands = cells.flatMap((c) => cellToCandidates(c, today, () => `c${++n}`, legend));
      all.push(...cands);
      report.push(`p${p}: ${grid.columns.map((c) => c.date).join(",")} | faixas ${grid.bands.map((b) => `${b.start}-${b.end}`).join(",")} | ${cells.length} células → ${cands.length}`);
    }
    writeFileSync(process.env.OUT ?? "/dev/null", report.join("\n") + "\n\n" + renderCandidates(all) + "\n\n" + JSON.stringify(all, null, 1));
    expect(all.length).toBeGreaterThan(0);
  }, 60_000);
});
