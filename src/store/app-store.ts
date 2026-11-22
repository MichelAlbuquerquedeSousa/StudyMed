"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildMockData } from "@/data/mock";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { reorder } from "@/lib/exams";
import { occurrenceKey } from "@/lib/recurrence";
import { todayInTZ } from "@/lib/time";
import { STORE_KEY } from "@/lib/theme-script";
import type { CalendarEntry, Category, CategoryKey, Exam, Item, OccurrenceOverride } from "@/lib/types";

/**
 * Etapa 1: estado local (localStorage) com dados fictícios.
 * Etapa 2: as ações passarão a chamar um repositório Supabase, mantendo a mesma interface
 * para as telas (atualização otimista + sincronização).
 */
export interface AppState {
  ready: boolean;
  demo: boolean;
  items: Item[];
  overrides: OccurrenceOverride[];
  exams: Exam[];
  categories: Category[];

  init: () => void;
  resetDemo: () => void;

  toggleEntry: (entry: CalendarEntry) => void;
  addItem: (item: Omit<Item, "id" | "source">) => void;
  deleteItem: (id: string) => void;

  toggleTopic: (examId: string, topicId: string) => void;
  addTopic: (examId: string, title: string) => void;
  renameTopic: (examId: string, topicId: string, title: string) => void;
  deleteTopic: (examId: string, topicId: string) => void;
  moveTopic: (examId: string, from: number, to: number) => void;

  setCategoryColor: (key: CategoryKey, color: string) => void;
  resetCategoryColors: () => void;
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const updateExam = (exams: Exam[], examId: string, fn: (e: Exam) => Exam) =>
  exams.map((e) => (e.id === examId ? fn(e) : e));

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ready: false,
      demo: true,
      items: [],
      overrides: [],
      exams: [],
      categories: DEFAULT_CATEGORIES,

      init: () => {
        if (get().items.length === 0 && get().exams.length === 0) {
          set({ ...buildMockData(todayInTZ()), demo: true });
        }
        set({ ready: true });
      },

      resetDemo: () => set({ ...buildMockData(todayInTZ()), demo: true, categories: DEFAULT_CATEGORIES }),

      toggleEntry: (entry) => {
        if (entry.kind !== "tarefa" || !entry.itemId) return;
        if (!entry.recurring) {
          set((s) => ({
            items: s.items.map((i) =>
              i.id === entry.itemId ? { ...i, doneAt: i.doneAt ? null : new Date().toISOString() } : i,
            ),
          }));
          return;
        }
        const date = entry.originalDate ?? entry.date;
        const key = occurrenceKey(entry.itemId, date);
        set((s) => {
          const existing = s.overrides.find((o) => occurrenceKey(o.itemId, o.date) === key);
          if (existing) {
            return { overrides: s.overrides.map((o) => (o === existing ? { ...o, done: !o.done } : o)) };
          }
          return { overrides: [...s.overrides, { itemId: entry.itemId!, date, done: true }] };
        });
      },

      addItem: (item) => set((s) => ({ items: [...s.items, { ...item, id: newId(), source: "manual" }] })),

      deleteItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id), overrides: s.overrides.filter((o) => o.itemId !== id) })),

      toggleTopic: (examId, topicId) =>
        set((s) => ({
          exams: updateExam(s.exams, examId, (e) => ({
            ...e,
            topics: e.topics.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)),
          })),
        })),

      addTopic: (examId, title) =>
        set((s) => ({
          exams: updateExam(s.exams, examId, (e) => ({
            ...e,
            topics: [...e.topics, { id: newId(), title: title.trim(), done: false }],
          })),
        })),

      renameTopic: (examId, topicId, title) =>
        set((s) => ({
          exams: updateExam(s.exams, examId, (e) => ({
            ...e,
            topics: e.topics.map((t) => (t.id === topicId ? { ...t, title: title.trim() } : t)),
          })),
        })),

      deleteTopic: (examId, topicId) =>
        set((s) => ({
          exams: updateExam(s.exams, examId, (e) => ({ ...e, topics: e.topics.filter((t) => t.id !== topicId) })),
        })),

      moveTopic: (examId, from, to) =>
        set((s) => ({ exams: updateExam(s.exams, examId, (e) => ({ ...e, topics: reorder(e.topics, from, to) })) })),

      setCategoryColor: (key, color) =>
        set((s) => ({ categories: s.categories.map((c) => (c.key === key ? { ...c, color } : c)) })),

      resetCategoryColors: () => set({ categories: DEFAULT_CATEGORIES }),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ demo, items, overrides, exams, categories }) => ({ demo, items, overrides, exams, categories }),
    },
  ),
);

export function useCategory(key: CategoryKey): Category {
  return useApp((s) => s.categories.find((c) => c.key === key) ?? DEFAULT_CATEGORIES[0]);
}
