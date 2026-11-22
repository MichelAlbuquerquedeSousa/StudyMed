"use client";

import Link from "next/link";
import { useMemo } from "react";
import clsx from "clsx";
import { CalendarDays, CheckCheck, Clock, FileUp, GraduationCap, ListChecks, MapPin, Plus, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import { countdownLabel, daysUntil, overallProgress, topicProgress, upcomingExams, urgency } from "@/lib/exams";
import { overdueTasks } from "@/lib/recurrence";
import { addDays, capitalize, formatLongDate, formatShortDate, formatWeekdayShort, greeting, timeToMinutes } from "@/lib/time";
import type { CalendarEntry, Exam } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useEntries, useUI } from "@/store/ui-store";
import { useNow } from "@/store/use-now";
import { EntryRow } from "../tasks/entry-row";
import { Card, CardHeader, EmptyState } from "../ui/card";
import { CATEGORY_ICONS, catVar } from "../ui/icons";
import { ProgressBar, ProgressRing } from "../ui/progress";

export function Dashboard() {
  const now = useNow();
  const items = useApp((s) => s.items);
  const exams = useApp((s) => s.exams);
  const today = now?.today ?? null;
  const todayEntries = useEntries(today, today);
  const weekEntries = useEntries(today ? addDays(today, 1) : null, today ? addDays(today, 6) : null);

  const upcoming = useMemo(() => (today ? upcomingExams(exams, today) : []), [exams, today]);
  const overdue = useMemo(() => (today ? overdueTasks(items, today) : []), [items, today]);

  if (!now || !today) return null;
  if (items.length === 0 && exams.length === 0) return <Welcome greetingText={greeting(now.minutes)} today={today} />;

  const schedule = todayEntries.filter((e) => e.startTime);
  const todayTasks = todayEntries.filter((e) => e.kind === "tarefa");
  const pendingToday = todayTasks.filter((e) => !e.done);
  const doneToday = todayTasks.length - pendingToday.length;
  const nextDaysTasks = weekEntries.filter((e) => e.kind === "tarefa" && !e.done && !e.recurring).slice(0, 4);
  const focus = currentOrNext(schedule, now.minutes);
  const nextExam = upcoming[0];

  return (
    <div className="space-y-6">
      {/* Saudação e resumo */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{capitalize(formatLongDate(today))}</p>
          <h1 className="font-display text-[2.1rem] leading-tight font-medium tracking-tight md:text-5xl">{greeting(now.minutes)}</h1>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          <SummaryChip cat="aula" icon={<CalendarDays className="size-4" />}>
            {schedule.length} {schedule.length === 1 ? "compromisso" : "compromissos"} hoje
          </SummaryChip>
          <SummaryChip cat="pessoal" icon={<ListChecks className="size-4" />}>
            {pendingToday.length + overdue.length} {pendingToday.length + overdue.length === 1 ? "tarefa pendente" : "tarefas pendentes"}
          </SummaryChip>
          {nextExam && (
            <SummaryChip cat="prova" icon={<GraduationCap className="size-4" />}>
              {nextExam.subject}: {countdownLabel(daysUntil(today, nextExam.date)).toLowerCase()}
            </SummaryChip>
          )}
        </ul>
      </header>

      <QuickAccess />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Coluna principal */}
        <div className="space-y-5 lg:col-span-7">
          {focus && <FocusCard entry={focus.entry} state={focus.state} />}

          <Card>
            <CardHeader title="Programação de hoje" icon={<Sun className="size-4 text-muted" />} href="/calendario" hrefLabel="Abrir agenda" />
            {todayEntries.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-6" />} title="Dia livre" text="Nenhum compromisso para hoje." />
            ) : (
              <ol className="relative space-y-2">
                {todayEntries.map((e) => (
                  <EntryRow key={e.key} entry={e} />
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <CardHeader title="Tarefas pendentes" icon={<ListChecks className="size-4 text-muted" />} href="/tarefas" />
            {todayTasks.length > 0 && (
              <div className="mb-3 flex items-center gap-3">
                <ProgressBar percent={Math.round((doneToday / todayTasks.length) * 100)} category="estudo" label="Tarefas de hoje concluídas" />
                <span className="shrink-0 text-sm text-muted tabular-nums">
                  {doneToday}/{todayTasks.length} hoje
                </span>
              </div>
            )}
            {overdue.length + pendingToday.length + nextDaysTasks.length === 0 ? (
              <EmptyState icon={<CheckCheck className="size-6" />} title="Tudo em dia!" text="Nenhuma tarefa pendente." />
            ) : (
              <div className="space-y-4">
                {overdue.length > 0 && (
                  <Group title="Atrasadas" tone="alert">
                    {overdue.map((e) => (
                      <EntryRow key={e.key} entry={e} showDate={formatShortDate(e.date)} />
                    ))}
                  </Group>
                )}
                {pendingToday.length > 0 && (
                  <Group title="Hoje">
                    {pendingToday.map((e) => (
                      <EntryRow key={e.key} entry={e} />
                    ))}
                  </Group>
                )}
                {nextDaysTasks.length > 0 && (
                  <Group title="Próximos dias">
                    {nextDaysTasks.map((e) => (
                      <EntryRow key={e.key} entry={e} showDate={`${formatWeekdayShort(e.date)} ${formatShortDate(e.date)}`} />
                    ))}
                  </Group>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Próximas provas" icon={<GraduationCap className="size-4 text-muted" />} href="/provas" />
            {upcoming.length === 0 ? (
              <EmptyState icon={<GraduationCap className="size-6" />} title="Nenhuma prova marcada" />
            ) : (
              <ul className="space-y-2.5">
                {upcoming.slice(0, 3).map((exam) => (
                  <ExamMini key={exam.id} exam={exam} today={today} />
                ))}
              </ul>
            )}
          </Card>

          <StudyProgress exams={upcoming} />
        </div>
      </div>
    </div>
  );
}

function currentOrNext(schedule: CalendarEntry[], minutes: number) {
  for (const e of schedule) {
    const start = timeToMinutes(e.startTime!);
    const end = e.endTime ? timeToMinutes(e.endTime) : start + 45;
    if (minutes >= start && minutes < end && !e.done) return { entry: e, state: "agora" as const };
    if (start > minutes && !e.done) return { entry: e, state: "a seguir" as const };
  }
  return null;
}

function SummaryChip({ cat, icon, children }: { cat: Parameters<typeof catVar>[0]; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="tint-soft inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 font-medium" style={catVar(cat)}>
      <span className="dot grid size-5 place-items-center rounded-full text-ink [&_svg]:size-3">{icon}</span>
      {children}
    </li>
  );
}

function QuickAccess() {
  const tiles = [
    { href: "/calendario", label: "Calendário", sub: "dia · semana · mês", cat: "aula" as const, Icon: CalendarDays },
    { href: "/provas", label: "Provas", sub: "conteúdos e progresso", cat: "prova" as const, Icon: GraduationCap },
    { href: "/tarefas", label: "Tarefas", sub: "pendentes e feitas", cat: "estudo" as const, Icon: ListChecks },
    { href: "/importar", label: "Importar", sub: "horários e roteiros", cat: "tutoria" as const, Icon: FileUp },
  ];
  return (
    <nav aria-label="Acesso rápido" className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
      {tiles.map(({ href, label, sub, cat, Icon }) => (
        <Link
          key={href}
          href={href}
          style={catVar(cat)}
          className="tint group flex min-w-[9.5rem] snap-start flex-col gap-3 rounded-[1.25rem] p-4 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-white/60 dark:bg-white/10">
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
          <span>
            <span className="block font-semibold">{label}</span>
            <span className="text-xs opacity-75">{sub}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

function FocusCard({ entry, state }: { entry: CalendarEntry; state: "agora" | "a seguir" }) {
  const select = useUI((s) => s.select);
  const Icon = CATEGORY_ICONS[entry.category];
  return (
    <button
      type="button"
      onClick={() => select(entry)}
      style={catVar(entry.category)}
      className="tint relative flex w-full items-center gap-4 overflow-hidden rounded-[1.5rem] p-5 text-left shadow-soft"
    >
      <span aria-hidden className="dot absolute -top-10 -right-10 size-40 rounded-full opacity-60 brightness-105" />
      <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/60 dark:bg-white/10">
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
      <span className="relative min-w-0">
        <span className="mb-0.5 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-80">
          {state === "agora" && <span className="size-2 animate-pulse rounded-full bg-current" />}
          {state === "agora" ? "Acontecendo agora" : "A seguir"}
        </span>
        <span className="block truncate text-xl font-semibold">{entry.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm opacity-80">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3.5" /> {entry.startTime}
            {entry.endTime && ` – ${entry.endTime}`}
          </span>
          {entry.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {entry.location}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function ExamMini({ exam, today }: { exam: Exam; today: string }) {
  const days = daysUntil(today, exam.date);
  const p = topicProgress(exam.topics);
  const u = urgency(days);
  return (
    <li>
      <Link href={`/provas/${exam.id}`} className="tint-soft flex items-center gap-3 rounded-2xl p-3 transition-colors hover:brightness-[0.98]" style={catVar("prova")}>
        <div className={clsx("grid w-14 shrink-0 place-items-center rounded-xl py-1.5 text-center", u === "alta" ? "tint" : "bg-surface")}>
          <span className="text-xl leading-none font-semibold tabular-nums">{days}</span>
          <span className="text-[0.65rem] font-medium uppercase opacity-75">{days === 1 ? "dia" : "dias"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{exam.subject}</p>
          <p className="mb-1.5 text-xs text-muted">
            {formatWeekdayShort(exam.date)} {formatShortDate(exam.date)}
            {exam.startTime && ` · ${exam.startTime}`} · {p.done}/{p.total} conteúdos
          </p>
          <ProgressBar percent={p.percent} label={`Progresso de ${exam.subject}`} />
        </div>
        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{p.percent}%</span>
      </Link>
    </li>
  );
}

function StudyProgress({ exams }: { exams: Exam[] }) {
  const total = overallProgress(exams);
  return (
    <Card>
      <CardHeader title="Progresso de estudos" icon={<CheckCheck className="size-4 text-muted" />} />
      <div className="flex items-center gap-5">
        <ProgressRing percent={total.percent} size={92} stroke={9} category="estudo">
          <span className="text-xl font-semibold tabular-nums">{total.percent}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="text-sm text-muted">
            <strong className="text-fg">{total.done}</strong> de {total.total} conteúdos das próximas provas
          </p>
          {exams.slice(0, 3).map((e) => {
            const p = topicProgress(e.topics);
            return (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate text-muted">{e.subject}</span>
                <ProgressBar percent={p.percent} category="estudo" className="h-1.5" label={e.subject} />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function Group({ title, tone, children }: { title: string; tone?: "alert"; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={clsx("mb-1.5 text-xs font-semibold tracking-wide uppercase", tone === "alert" ? "text-accent" : "text-muted")}>{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

/** Primeira visita: agenda vazia. */
function Welcome({ greetingText, today }: { greetingText: string; today: string }) {
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const loadDemo = useApp((s) => s.loadDemo);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-muted">{capitalize(formatLongDate(today))}</p>
        <h1 className="font-display text-[2.1rem] leading-tight font-medium tracking-tight md:text-5xl">{greetingText}</h1>
      </header>
      <Card className="text-center md:p-10">
        <div className="mx-auto mb-4 flex w-fit gap-2" aria-hidden>
          {(["aula", "pratica", "tutoria", "estudo", "pessoal", "prova"] as const).map((k) => (
            <span key={k} className="dot size-3 rounded-full" style={catVar(k)} />
          ))}
        </div>
        <h2 className="text-xl font-semibold">Sua agenda está vazia</h2>
        <p className="mx-auto mt-1 max-w-md text-muted">
          Comece adicionando seus horários da faculdade, ou carregue dados de exemplo para conhecer o app (você pode removê-los depois em Ajustes).
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => openQuickAdd()} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-fg">
            <Plus className="size-5" /> Adicionar atividade
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await loadDemo();
              setBusy(false);
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line px-6 font-medium hover:bg-surface-2 disabled:opacity-60"
          >
            <Sparkles className="size-5" /> {busy ? "Carregando…" : "Carregar dados de exemplo"}
          </button>
        </div>
      </Card>
    </div>
  );
}
