"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Clock, GraduationCap, MapPin } from "lucide-react";
import { countdownLabel, daysUntil, pastExams, topicProgress, upcomingExams, urgency } from "@/lib/exams";
import { capitalize, formatLongDate, type ISODate } from "@/lib/time";
import type { Exam } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useNow } from "@/store/use-now";
import { EmptyState, PageHeader } from "../ui/card";
import { catVar } from "../ui/icons";
import { ProgressBar, ProgressRing } from "../ui/progress";

export function ExamsView() {
  const now = useNow();
  const exams = useApp((s) => s.exams);
  const [showPast, setShowPast] = useState(false);
  const today = now?.today ?? null;
  const upcoming = useMemo(() => (today ? upcomingExams(exams, today) : []), [exams, today]);
  const past = useMemo(() => (today ? pastExams(exams, today) : []), [exams, today]);
  if (!today) return null;

  return (
    <div>
      <PageHeader title="Provas" subtitle="Próximas avaliações em ordem cronológica" />
      {upcoming.length === 0 ? (
        <EmptyState icon={<GraduationCap className="size-6" />} title="Nenhuma prova marcada" text="O cadastro de provas chega na Etapa 3." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {upcoming.map((e, i) => (
            <ExamCard key={e.id} exam={e} today={today} featured={i === 0} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2"
          >
            <ChevronDown className={clsx("size-4 transition-transform", showPast && "rotate-180")} />
            Provas realizadas ({past.length})
          </button>
          {showPast && (
            <ul className="grid gap-4 opacity-80 md:grid-cols-2 xl:grid-cols-3">
              {past.map((e) => (
                <ExamCard key={e.id} exam={e} today={today} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ExamCard({ exam, today, featured }: { exam: Exam; today: ISODate; featured?: boolean }) {
  const days = daysUntil(today, exam.date);
  const p = topicProgress(exam.topics);
  const u = urgency(days);
  return (
    <li className={clsx(featured && "md:col-span-2 xl:col-span-1")}>
      <Link
        href={`/provas/${exam.id}`}
        style={catVar("prova")}
        className={clsx(
          "flex h-full flex-col gap-4 rounded-[1.5rem] p-5 shadow-soft transition-transform hover:-translate-y-0.5",
          featured ? "tint" : "tint-soft border border-line",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide uppercase opacity-70">{exam.subject}</p>
            <h2 className="mt-0.5 text-lg leading-snug font-semibold">{exam.title}</h2>
          </div>
          <span
            className={clsx(
              "shrink-0 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap",
              days < 0 ? "bg-surface-2 text-muted" : u === "alta" ? "bg-accent text-accent-fg" : "bg-white/70 text-ink dark:bg-white/10 dark:text-fg",
            )}
          >
            {countdownLabel(days)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-80">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {capitalize(formatLongDate(exam.date))}
            {exam.startTime && `, ${exam.startTime}`}
          </span>
          {exam.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {exam.location}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-4">
          <ProgressRing percent={p.percent} size={56} stroke={6}>
            <span className="text-xs font-semibold tabular-nums">{p.percent}%</span>
          </ProgressRing>
          <div className="flex-1">
            <p className="mb-1.5 text-sm">
              <strong>{p.done}</strong> de {p.total} conteúdos estudados
            </p>
            <ProgressBar percent={p.percent} label={`Progresso de ${exam.subject}`} />
          </div>
        </div>
      </Link>
    </li>
  );
}
