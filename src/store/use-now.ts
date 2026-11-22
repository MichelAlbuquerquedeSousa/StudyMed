"use client";

import { useSyncExternalStore } from "react";
import { minutesNowInTZ, todayInTZ, type ISODate } from "@/lib/time";

export interface Now {
  today: ISODate;
  minutes: number;
}

let snapshot: Now | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function compute(): Now {
  const d = new Date();
  return { today: todayInTZ(d), minutes: minutesNowInTZ(d) };
}

function tick() {
  const next = compute();
  if (!snapshot || next.today !== snapshot.today || next.minutes !== snapshot.minutes) {
    snapshot = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) timer = setInterval(tick, 20_000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): Now {
  if (!snapshot) snapshot = compute();
  return snapshot;
}

/**
 * Data e hora atuais em Fortaleza. Retorna `null` no servidor/primeira hidratação
 * (a data depende do momento da visita, então só é calculada no navegador).
 */
export function useNow(): Now | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
