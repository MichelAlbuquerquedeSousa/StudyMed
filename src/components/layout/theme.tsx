"use client";

import { useEffect, useSyncExternalStore } from "react";
import clsx from "clsx";
import { MonitorSmartphone, Moon, Sun } from "lucide-react";

import { THEME_KEY } from "@/lib/theme-script";

export type ThemePref = "claro" | "escuro" | "sistema";

const listeners = new Set<() => void>();
function readPref(): ThemePref {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemePref) || "sistema";
  } catch {
    return "sistema";
  }
}
function applyTheme(p: ThemePref) {
  const dark = p === "escuro" || (p === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#161217" : "#fbf8fa");
}
export function setThemePref(p: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, p);
  } catch {}
  applyTheme(p);
  listeners.forEach((l) => l());
}

export function useThemePref(): ThemePref {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readPref,
    () => "sistema" as ThemePref,
  );
  // Acompanha mudanças do sistema quando a preferência é "sistema".
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => readPref() === "sistema" && applyTheme("sistema");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pref;
}

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "claro", label: "Claro", Icon: Sun },
  { value: "escuro", label: "Escuro", Icon: Moon },
  { value: "sistema", label: "Automático", Icon: MonitorSmartphone },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const pref = useThemePref();
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-full border border-line bg-surface-2 p-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={label}
          onClick={() => setThemePref(value)}
          className={clsx(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm transition-all",
            pref === value ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="size-4" />
          {!compact && <span>{label}</span>}
          {compact && <span className="sr-only">{label}</span>}
        </button>
      ))}
    </div>
  );
}
