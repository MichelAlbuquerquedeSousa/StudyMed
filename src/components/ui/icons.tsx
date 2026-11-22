import { BookOpen, Brain, FlaskConical, GraduationCap, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { CategoryKey } from "@/lib/types";

export const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  aula: BookOpen,
  pratica: FlaskConical,
  tutoria: Users,
  estudo: Brain,
  pessoal: Sparkles,
  prova: GraduationCap,
};

export const catVar = (key: CategoryKey) => ({ "--c": `var(--cat-${key})` }) as React.CSSProperties;
