"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildMockData } from "@/data/mock";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { reorder } from "@/lib/exams";
import { reschedule, type RescheduleTarget } from "@/lib/forms";
import { occurrenceKey } from "@/lib/recurrence";
import { supabase } from "@/lib/supabase/client";
import * as repo from "@/lib/supabase/repo";
import { STORE_KEY } from "@/lib/theme-script";
import { clearOfflinePages, warmOfflinePages } from "@/lib/pwa-client";
import { todayInTZ } from "@/lib/time";
import type { CalendarEntry, Category, CategoryKey, Exam, Item, OccurrenceOverride } from "@/lib/types";

/**
 * Estado do app.
 * - Leituras: tudo é carregado do Supabase (RLS garante que só vêm os dados da usuária logada)
 *   e guardado em cache local para abrir rápido, inclusive sem internet.
 * - Escritas: atualização otimista na tela + gravação no Supabase. Se a gravação falhar,
 *   mostramos o erro e recarregamos do servidor (que é a fonte da verdade).
 */
export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface AppState {
  status: LoadStatus;
  ready: boolean;
  userId: string | null;
  email: string | null;
  items: Item[];
  overrides: OccurrenceOverride[];
  exams: Exam[];
  categories: Category[];
  pending: number;
  lastError: string | null;
  lastSyncedAt: number | null;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  dismissError: () => void;

  loadDemo: () => Promise<void>;
  clearDemo: () => Promise<void>;

  toggleEntry: (entry: CalendarEntry) => void;
  addItem: (item: Omit<Item, "id" | "source">) => void;
  updateItem: (id: string, data: Omit<Item, "id" | "source">) => void;
  deleteItem: (id: string) => void;
  rescheduleEntry: (entry: CalendarEntry, target: RescheduleTarget) => void;
  cancelOccurrence: (entry: CalendarEntry) => void;

  addExam: (fields: Omit<Exam, "id" | "source" | "topics">, topicTitles: string[]) => string;
  updateExam: (id: string, fields: Omit<Exam, "id" | "source" | "topics">) => void;
  deleteExam: (id: string) => void;

  toggleTopic: (examId: string, topicId: string) => void;
  addTopic: (examId: string, title: string) => void;
  renameTopic: (examId: string, topicId: string, title: string) => void;
  deleteTopic: (examId: string, topicId: string) => void;
  moveTopic: (examId: string, from: number, to: number) => void;

  setCategoryColor: (key: CategoryKey, color: string) => void;
  resetCategoryColors: () => void;
}

export const newId = () => crypto.randomUUID();

const updateExam = (exams: Exam[], examId: string, fn: (e: Exam) => Exam) => exams.map((e) => (e.id === examId ? fn(e) : e));

/** Mensagens de erro em português para os casos mais comuns. */
export function friendlyError(message: string): string {
  if (/fetch|network|Failed to fetch|NetworkError|Load failed/i.test(message)) return "Sem conexão. A alteração não foi salva.";
  if (/JWT|token|session|not authenticated/i.test(message)) return "Sua sessão expirou. Entre novamente.";
  if (/row-level security|permission denied/i.test(message)) return "Sem permissão para salvar esta alteração.";
  if (/schema cache|does not exist/i.test(message)) return "As tabelas do banco ainda não foram criadas (rode o SQL da migração).";
  return `Não foi possível salvar: ${message}`;
}

let refreshQueued = false;
let colorTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /** Aplica a mudança na tela e grava no servidor; em caso de erro, avisa e recarrega. */
      const mutate = (optimistic: (s: AppState) => Partial<AppState>, remote: () => Promise<void>) => {
        const { items, overrides, exams, categories } = get();
        set((s) => ({ ...optimistic(s), pending: s.pending + 1 }));
        remote()
          .catch((e: Error) => {
            // Desfaz a mudança na tela: nada que não foi salvo deve parecer salvo.
            set({ items, overrides, exams, categories, lastError: friendlyError(e.message) });
            refreshQueued = true;
          })
          .finally(() => {
            set((s) => ({ pending: s.pending - 1 }));
            if (get().pending === 0 && refreshQueued) {
              refreshQueued = false;
              void get().refresh();
            }
          });
      };

      return {
        status: "idle",
        ready: false,
        userId: null,
        email: null,
        items: [],
        overrides: [],
        exams: [],
        categories: DEFAULT_CATEGORIES,
        pending: 0,
        lastError: null,
        lastSyncedAt: null,

        init: async () => {
          if (get().status === "loading") return;
          try {
            localStorage.removeItem("studymed-demo-v1"); // cache da Etapa 1
          } catch {}
          await useApp.persist.rehydrate();
          const { data } = await supabase().auth.getSession();
          const user = data.session?.user;
          if (!user) {
            set({ status: "ready", ready: true });
            return;
          }
          // Cache de outra conta: descarta.
          if (get().userId && get().userId !== user.id) {
            set({ items: [], overrides: [], exams: [], categories: DEFAULT_CATEGORIES });
          }
          const hasCache = get().userId === user.id;
          set({ userId: user.id, email: user.email ?? null, status: "loading", ready: hasCache });
          await get().refresh();
          set({ ready: true });
        },

        refresh: async () => {
          if (!get().userId) return;
          if (get().pending > 0) {
            refreshQueued = true; // evita sobrescrever alterações otimistas ainda em envio
            return;
          }
          try {
            const data = await repo.fetchAll(supabase());
            if (get().pending > 0) {
              refreshQueued = true;
              return;
            }
            set({ ...data, status: "ready", lastSyncedAt: Date.now() });
            if (process.env.NODE_ENV === "production") void warmOfflinePages().catch(() => {});
          } catch (e) {
            set({ status: get().ready ? "ready" : "error", lastError: friendlyError((e as Error).message) });
          }
        },

        signOut: async () => {
          await supabase().auth.signOut();
          clearOfflinePages();
          set({ userId: null, email: null, items: [], overrides: [], exams: [], categories: DEFAULT_CATEGORIES, ready: false, status: "idle" });
          try {
            localStorage.removeItem(STORE_KEY);
          } catch {}
          // Recarga completa de propósito: o proxy precisa reler os cookies da sessão.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login");
        },

        dismissError: () => set({ lastError: null }),

        loadDemo: async () => {
          const data = buildMockData(todayInTZ());
          set((s) => ({ items: [...s.items, ...data.items], overrides: [...s.overrides, ...data.overrides], exams: [...s.exams, ...data.exams] }));
          try {
            await repo.insertDemo(supabase(), data);
          } catch (e) {
            set({ lastError: friendlyError((e as Error).message) });
          }
          await get().refresh();
        },

        clearDemo: async () => {
          const demoItems = new Set(get().items.filter((i) => i.source === "ficticio").map((i) => i.id));
          set((s) => ({
            items: s.items.filter((i) => i.source !== "ficticio"),
            overrides: s.overrides.filter((o) => !demoItems.has(o.itemId)),
            exams: s.exams.filter((e) => e.source !== "ficticio"),
          }));
          try {
            await repo.clearDemo(supabase());
          } catch (e) {
            set({ lastError: friendlyError((e as Error).message) });
          }
          await get().refresh();
        },

        toggleEntry: (entry) => {
          if (entry.kind !== "tarefa" || !entry.itemId) return;
          const itemId = entry.itemId;
          if (!entry.recurring) {
            const item = get().items.find((i) => i.id === itemId);
            if (!item) return;
            const doneAt = item.doneAt ? null : new Date().toISOString();
            mutate(
              (s) => ({ items: s.items.map((i) => (i.id === itemId ? { ...i, doneAt } : i)) }),
              () => repo.setItemDone(supabase(), itemId, doneAt),
            );
            return;
          }
          const date = entry.originalDate ?? entry.date;
          const key = occurrenceKey(itemId, date);
          const existing = get().overrides.find((o) => occurrenceKey(o.itemId, o.date) === key);
          const next: OccurrenceOverride = existing ? { ...existing, done: !existing.done } : { itemId, date, done: true };
          mutate(
            (s) => ({ overrides: existing ? s.overrides.map((o) => (o === existing ? next : o)) : [...s.overrides, next] }),
            () => repo.upsertOccurrence(supabase(), next),
          );
        },

        addItem: (data) => {
          const item: Item = { ...data, id: newId(), source: "manual" };
          mutate((s) => ({ items: [...s.items, item] }), () => repo.upsertItem(supabase(), item));
        },

        updateItem: (id, data) => {
          const current = get().items.find((i) => i.id === id);
          if (!current) return;
          // Conclusão de tarefa avulsa é preservada; mudar para evento limpa a conclusão.
          const item: Item = { ...data, id, source: current.source, doneAt: data.kind === "tarefa" ? (current.doneAt ?? null) : null };
          mutate((s) => ({ items: s.items.map((i) => (i.id === id ? item : i)) }), () => repo.upsertItem(supabase(), item));
        },

        rescheduleEntry: (entry, target) => {
          const r = reschedule(entry, get().items, get().overrides, target);
          if (!r) return;
          if (r.kind === "item") {
            mutate((s) => ({ items: s.items.map((i) => (i.id === r.item.id ? r.item : i)) }), () => repo.upsertItem(supabase(), r.item));
            return;
          }
          const key = occurrenceKey(r.override.itemId, r.override.date);
          mutate(
            (s) => ({ overrides: [...s.overrides.filter((o) => occurrenceKey(o.itemId, o.date) !== key), r.override] }),
            () => repo.upsertOccurrence(supabase(), r.override),
          );
        },

        cancelOccurrence: (entry) => {
          if (!entry.itemId || !entry.recurring) return;
          const date = entry.originalDate ?? entry.date;
          const key = occurrenceKey(entry.itemId, date);
          const existing = get().overrides.find((o) => occurrenceKey(o.itemId, o.date) === key);
          const override: OccurrenceOverride = { ...existing, itemId: entry.itemId, date, cancelled: true };
          mutate(
            (s) => ({ overrides: [...s.overrides.filter((o) => occurrenceKey(o.itemId, o.date) !== key), override] }),
            () => repo.upsertOccurrence(supabase(), override),
          );
        },

        addExam: (fields, topicTitles) => {
          const exam: Exam = { ...fields, id: newId(), source: "manual", topics: topicTitles.map((title) => ({ id: newId(), title, done: false })) };
          mutate(
            (s) => ({ exams: [...s.exams, exam] }),
            async () => {
              await repo.upsertExam(supabase(), exam);
              await repo.insertTopics(supabase(), exam.id, exam.topics);
            },
          );
          return exam.id;
        },

        updateExam: (id, fields) => {
          const current = get().exams.find((e) => e.id === id);
          if (!current) return;
          const exam: Exam = { ...current, ...fields, id, source: current.source, topics: current.topics };
          mutate((s) => ({ exams: s.exams.map((e) => (e.id === id ? exam : e)) }), () => repo.upsertExam(supabase(), exam));
        },

        deleteExam: (id) => mutate((s) => ({ exams: s.exams.filter((e) => e.id !== id) }), () => repo.deleteExam(supabase(), id)),

        deleteItem: (id) =>
          mutate(
            (s) => ({ items: s.items.filter((i) => i.id !== id), overrides: s.overrides.filter((o) => o.itemId !== id) }),
            () => repo.deleteItem(supabase(), id),
          ),

        toggleTopic: (examId, topicId) => {
          const topic = get().exams.find((e) => e.id === examId)?.topics.find((t) => t.id === topicId);
          if (!topic) return;
          const done = !topic.done;
          mutate(
            (s) => ({ exams: updateExam(s.exams, examId, (e) => ({ ...e, topics: e.topics.map((t) => (t.id === topicId ? { ...t, done } : t)) })) }),
            () => repo.updateTopic(supabase(), topicId, { done }),
          );
        },

        addTopic: (examId, title) => {
          const exam = get().exams.find((e) => e.id === examId);
          if (!exam || !title.trim()) return;
          const topic = { id: newId(), title: title.trim(), done: false };
          const position = exam.topics.length;
          mutate(
            (s) => ({ exams: updateExam(s.exams, examId, (e) => ({ ...e, topics: [...e.topics, topic] })) }),
            () => repo.insertTopic(supabase(), examId, topic, position),
          );
        },

        renameTopic: (examId, topicId, title) => {
          const clean = title.trim();
          if (!clean) return;
          mutate(
            (s) => ({ exams: updateExam(s.exams, examId, (e) => ({ ...e, topics: e.topics.map((t) => (t.id === topicId ? { ...t, title: clean } : t)) })) }),
            () => repo.updateTopic(supabase(), topicId, { title: clean }),
          );
        },

        deleteTopic: (examId, topicId) =>
          mutate(
            (s) => ({ exams: updateExam(s.exams, examId, (e) => ({ ...e, topics: e.topics.filter((t) => t.id !== topicId) })) }),
            () => repo.deleteTopic(supabase(), topicId),
          ),

        moveTopic: (examId, from, to) => {
          const exam = get().exams.find((e) => e.id === examId);
          if (!exam) return;
          const topics = reorder(exam.topics, from, to);
          if (topics === exam.topics) return;
          mutate((s) => ({ exams: updateExam(s.exams, examId, (e) => ({ ...e, topics })) }), () => repo.saveTopicOrder(supabase(), examId, topics));
        },

        setCategoryColor: (key, color) => {
          set((s) => ({ categories: s.categories.map((c) => (c.key === key ? { ...c, color } : c)) }));
          // O seletor de cor dispara muitas mudanças seguidas: grava só a última.
          if (colorTimer) clearTimeout(colorTimer);
          colorTimer = setTimeout(() => {
            const categories = get().categories;
            mutate(() => ({}), () => repo.saveCategoryColors(supabase(), categories));
          }, 600);
        },

        resetCategoryColors: () =>
          mutate(() => ({ categories: DEFAULT_CATEGORIES }), () => repo.saveCategoryColors(supabase(), DEFAULT_CATEGORIES)),
      };
    },
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ userId, items, overrides, exams, categories }) => ({ userId, items, overrides, exams, categories }),
    },
  ),
);

export function useHasDemo(): boolean {
  return useApp((s) => s.items.some((i) => i.source === "ficticio") || s.exams.some((e) => e.source === "ficticio"));
}

export function useCategory(key: CategoryKey): Category {
  return useApp((s) => s.categories.find((c) => c.key === key) ?? DEFAULT_CATEGORIES[0]);
}
