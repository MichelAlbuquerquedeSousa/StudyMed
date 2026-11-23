/** Retângulos preenchidos de uma página de PDF, a partir da lista de operações de desenho do pdf.js. */
import type { FilledRect } from "./grid";

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Aplica `m` e depois `ctm` (concatenação do operador "cm" do PDF). */
function concat(ctm: Matrix, m: Matrix): Matrix {
  const [a, b, c, d, e, f] = ctm;
  return [a * m[0] + c * m[1], b * m[0] + d * m[1], a * m[2] + c * m[3], b * m[2] + d * m[3], a * m[4] + c * m[5] + e, b * m[4] + d * m[5] + f];
}

const apply = (m: Matrix, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export interface OpCodes {
  save: number;
  restore: number;
  transform: number;
  setFillRGBColor: number;
  constructPath: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke?: number;
}

export function filledRects(fnArray: number[], argsArray: unknown[][], OPS: OpCodes): FilledRect[] {
  const fills = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((x) => x !== undefined));
  let ctm: Matrix = IDENTITY;
  let color = "#000000";
  const stack: [Matrix, string][] = [];
  const out: FilledRect[] = [];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] ?? [];
    if (fn === OPS.save) stack.push([ctm, color]);
    else if (fn === OPS.restore) [ctm, color] = stack.pop() ?? [IDENTITY, "#000000"];
    else if (fn === OPS.transform) ctm = concat(ctm, args as unknown as Matrix);
    else if (fn === OPS.setFillRGBColor && typeof args[0] === "string") color = args[0] as string;
    else if (fn === OPS.constructPath && fills.has(args[0] as number)) {
      const mm = args[2] as ArrayLike<number> | undefined;
      if (!mm || mm.length < 4) continue;
      const pts = [apply(ctm, mm[0], mm[1]), apply(ctm, mm[2], mm[3]), apply(ctm, mm[0], mm[3]), apply(ctm, mm[2], mm[1])];
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      out.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), color: color.toLowerCase() });
    }
  }
  return out;
}
