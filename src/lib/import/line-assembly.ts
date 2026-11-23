/** Montagem de linhas de texto a partir das posições dos pedaços de texto num PDF. */

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

