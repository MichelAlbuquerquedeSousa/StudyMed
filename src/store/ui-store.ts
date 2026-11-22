"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { expandEntries } from "@/lib/recurrence";
import { occurrenceKey } from "@/lib/recurrence";
import type { ISODate } from "@/lib/time";
import type { CalendarEntry, CategoryKey } from "@/lib/types";
import { useApp, type AppState } from "./app-store";

interface UIState {
  quickAdd: { open: boolean; date?: ISODate; startTime?: string };
  selected: CalendarEntry | null;
  hidden: CategoryKey[];
  openQuickAdd: (date?: ISODate, startTime?: string) => void;
  closeQuickAdd: () => void;
  select: (e: CalendarEntry | null) => void;
  toggleHidden: (k: CategoryKey) => void;
}

export const useUI = create<UIState>()((set) => ({
  quickAdd: { open: false },
  selected: null,
  hidden: [],
  openQuickAdd: (date, startTime) => set({ quickAdd: { open: true, date, startTime } }),
  closeQuickAdd: () => set({ quickAdd: { open: false } }),
  select: (selected) => set({ selected }),
  toggleHidden: (k) => set((s) => ({ hidden: s.hidden.includes(k) ? s.hidden.filter((h) => h !== k) : [...s.hidden, k] })),
}));

/** Entradas do calendário no intervalo, já com recorrências e provas resolvidas. */
export function useEntries(from: ISODate | null, to: ISODate | null, opts: { respectFilters?: boolean } = {}) {
  const items = useApp((s) => s.items);
  const overrides = useApp((s) => s.overrides);
  const exams = useApp((s) => s.exams);
  const hidden = useUI((s) => s.hidden);
  const respect = opts.respectFilters ?? false;
  return useMemo(() => {
    if (!from || !to) return [];
    const all = expandEntries(items, overrides, exams, from, to);
    return respect ? all.filter((e) => !hidden.includes(e.category)) : all;
  }, [items, overrides, exams, from, to, hidden, respect]);
}

/** Estado de conclusão atual de uma entrada (para painéis abertos enquanto os dados mudam). */
export function isEntryDone(s: Pick<AppState, "items" | "overrides">, e: CalendarEntry): boolean {
  if (!e.itemId) return false;
  if (!e.recurring) return Boolean(s.items.find((i) => i.id === e.itemId)?.doneAt);
  const key = occurrenceKey(e.itemId, e.originalDate ?? e.date);
  return Boolean(s.overrides.find((o) => occurrenceKey(o.itemId, o.date) === key)?.done);
}
