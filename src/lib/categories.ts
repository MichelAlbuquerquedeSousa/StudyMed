import type { Category, CategoryKey } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { key: "aula", name: "Aulas", color: "#A8DADC", icon: "BookOpen" },
  { key: "pratica", name: "Práticas", color: "#FFC5A5", icon: "FlaskConical" },
  { key: "tutoria", name: "Tutorias", color: "#CDB4F6", icon: "Users" },
  { key: "estudo", name: "Estudos e revisões", color: "#BDE7C3", icon: "Brain" },
  { key: "pessoal", name: "Tarefas pessoais", color: "#FFE29A", icon: "Sparkles" },
  { key: "prova", name: "Provas", color: "#F8BBD0", icon: "GraduationCap" },
];

export const CATEGORY_KEYS = DEFAULT_CATEGORIES.map((c) => c.key);

/** Nome singular para rótulos curtos. */
export const CATEGORY_SINGULAR: Record<CategoryKey, string> = {
  aula: "Aula",
  pratica: "Prática",
  tutoria: "Tutoria",
  estudo: "Estudo",
  pessoal: "Pessoal",
  prova: "Prova",
};

/** CSS custom properties com as cores das categorias, aplicadas no <html>. */
export function categoryCssVars(categories: Category[]): Record<string, string> {
  return Object.fromEntries(categories.map((c) => [`--cat-${c.key}`, c.color]));
}

/** Luminância relativa (WCAG) de uma cor #rrggbb. */
export function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Tinta escura usada sobre os fundos pastel. */
export const INK = "#2B2330";
