"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, FileUp, GraduationCap, House, ListChecks, Plus, Settings, Sparkles } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useUI } from "@/store/ui-store";
import { EntryDetailSheet } from "../tasks/entry-detail-sheet";
import { QuickAddSheet } from "../tasks/quick-add-sheet";
import { ThemeSwitcher } from "./theme";

const NAV = [
  { href: "/", label: "Início", Icon: House, mobile: true },
  { href: "/calendario", label: "Agenda", Icon: CalendarDays, mobile: true },
  { href: "/tarefas", label: "Tarefas", Icon: ListChecks, mobile: true },
  { href: "/provas", label: "Provas", Icon: GraduationCap, mobile: true },
  { href: "/importar", label: "Importar", Icon: FileUp, mobile: false },
  { href: "/ajustes", label: "Ajustes", Icon: Settings, mobile: true },
];

function isActive(pathname: string | null, href: string) {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useApp((s) => s.ready);
  const demo = useApp((s) => s.demo);
  const categories = useApp((s) => s.categories);
  const openQuickAdd = useUI((s) => s.openQuickAdd);

  // Carrega o estado salvo (ou os dados fictícios) apenas no navegador.
  useEffect(() => {
    Promise.resolve(useApp.persist.rehydrate()).then(() => useApp.getState().init());
  }, []);

  // Aplica as cores personalizadas das categorias como variáveis CSS.
  useEffect(() => {
    for (const c of categories) document.documentElement.style.setProperty(`--cat-${c.key}`, c.color);
  }, [categories]);

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral: tablet e desktop */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/70 px-3 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-5 backdrop-blur md:flex md:w-20 xl:w-64 xl:px-4">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 xl:px-3">
          <Logo />
          <span className="hidden font-display text-xl font-medium tracking-tight xl:inline">StudyMed</span>
        </Link>
        <Suspense fallback={<SideNav pathname={null} />}>
          <LiveNav Component={SideNav} />
        </Suspense>
        <button
          type="button"
          onClick={() => openQuickAdd()}
          className="mb-4 hidden min-h-12 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-accent-fg shadow-soft transition-transform active:scale-[0.98] xl:flex"
        >
          <Plus className="size-5" /> Nova atividade
        </button>
        <div className="hidden xl:block">
          <ThemeSwitcher compact />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {demo && ready && <DemoBanner />}
        <main className="mx-auto w-full max-w-6xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-32 sm:px-6 md:pb-12 lg:px-10 lg:pt-8">{ready ? children : <ShellSkeleton />}</main>
      </div>

      {/* Botão de adicionar — sempre acessível (oculto no desktop largo, onde há botão na lateral) */}
      <button
        type="button"
        onClick={() => openQuickAdd()}
        aria-label="Nova atividade"
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_10px_30px_-8px_rgb(184_67_111/0.6)] transition-transform active:scale-95 md:bottom-8 md:right-8 xl:hidden"
      >
        <Plus className="size-7" strokeWidth={2.2} />
      </button>

      {/* Barra inferior: celular */}
      <nav
        aria-label="Principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-lg md:hidden"
      >
        <Suspense fallback={<BottomNav pathname={null} />}>
          <LiveNav Component={BottomNav} />
        </Suspense>
      </nav>

      <QuickAddSheet />
      <EntryDetailSheet />
    </div>
  );
}

function DemoBanner() {
  const resetDemo = useApp((s) => s.resetDemo);
  return (
    <div className="border-b border-[color-mix(in_oklab,var(--cat-pessoal)_70%,var(--border))] bg-[color-mix(in_oklab,var(--cat-pessoal)_35%,var(--surface))] text-sm dark:bg-[color-mix(in_oklab,var(--cat-pessoal)_12%,var(--surface))]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-10">
        <Sparkles className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">Modo demonstração:</strong> todos os dados exibidos são fictícios.
        </p>
        <button
          type="button"
          onClick={() => confirm("Restaurar os dados fictícios originais?") && resetDemo()}
          className="shrink-0 rounded-full px-2.5 py-1 font-medium underline-offset-2 hover:underline"
        >
          Restaurar
        </button>
      </div>
    </div>
  );
}

export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--cat-prova)" />
      <path d="M20 29.5s-8.5-5.1-8.5-11a4.6 4.6 0 0 1 8.5-2.4 4.6 4.6 0 0 1 8.5 2.4c0 5.9-8.5 11-8.5 11Z" fill="#fff" fillOpacity=".9" />
      <path d="M14.5 20h3l1.6-3 2.4 6 1.6-3h2.4" fill="none" stroke="#b8436f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-3xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface-2" />
      </div>
    </div>
  );
}

/** Navegação ciente da rota atual; isolada em <Suspense> porque a URL só existe em tempo de execução. */
function LiveNav({ Component }: { Component: (p: { pathname: string | null }) => React.ReactNode }) {
  return <Component pathname={usePathname()} />;
}

function SideNav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Principal">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[0.95rem] font-medium transition-colors max-xl:flex-col max-xl:justify-center max-xl:gap-0.5 max-xl:py-2 max-xl:text-[0.7rem]",
              active ? "bg-accent-soft/55 text-fg dark:bg-accent-soft" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomNav({ pathname }: { pathname: string | null }) {
  return (
    <ul className="mx-auto flex max-w-md justify-around px-2">
      {NAV.filter((n) => n.mobile).map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.7rem] font-medium",
                active ? "text-fg" : "text-muted",
              )}
            >
              <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-accent-soft/60 dark:bg-accent-soft")}>
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
