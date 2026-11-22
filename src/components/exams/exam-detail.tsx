"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Clock, GripVertical, MapPin, PartyPopper, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { countdownLabel, daysUntil, topicProgress } from "@/lib/exams";
import { capitalize, formatLongDate } from "@/lib/time";
import type { ExamTopic } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useUI } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useNow } from "@/store/use-now";
import { Card, EmptyState } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { catVar } from "../ui/icons";
import { ProgressBar, ProgressRing } from "../ui/progress";

export function ExamDetail({ id }: { id: string }) {
  const now = useNow();
  const exam = useApp((s) => s.exams.find((e) => e.id === id));
  const addTopic = useApp((s) => s.addTopic);
  const moveTopic = useApp((s) => s.moveTopic);
  const deleteExam = useApp((s) => s.deleteExam);
  const openExamForm = useUI((s) => s.openExamForm);
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [draft, setDraft] = useState("");

  if (!now) return null;
  if (!exam) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState icon={<StickyNote className="size-6" />} title="Prova não encontrada" text="Ela pode ter sido removida." />
      </div>
    );
  }

  const days = daysUntil(now.today, exam.date);
  const p = topicProgress(exam.topics);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => openExamForm({ examId: exam.id })}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Pencil className="size-4" /> Editar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Excluir “${exam.title}” e todos os seus conteúdos?`)) return;
              deleteExam(exam.id);
              router.push("/provas");
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Trash2 className="size-4" /> Excluir
          </button>
        </div>
      </div>

      <header className="tint relative overflow-hidden rounded-[1.75rem] p-6 shadow-soft md:p-8" style={catVar("prova")}>
        <span aria-hidden className="absolute -right-16 -bottom-24 size-72 rounded-full bg-white/25 dark:bg-white/5" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide uppercase opacity-75">{exam.subject}</p>
            <h1 className="font-display mt-1 text-3xl leading-tight font-medium tracking-tight md:text-4xl">{exam.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm opacity-85">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                {capitalize(formatLongDate(exam.date))}
                {exam.startTime && `, ${exam.startTime}`}
              </span>
              {exam.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {exam.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p className="text-5xl leading-none font-semibold tabular-nums">{Math.max(days, 0)}</p>
              <p className="mt-1 text-sm font-medium opacity-75">{countdownLabel(days)}</p>
            </div>
            <ProgressRing percent={p.percent} size={96} stroke={9}>
              <span className="text-lg font-semibold tabular-nums">{p.percent}%</span>
            </ProgressRing>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Conteúdos cobrados</h2>
            <span className="text-sm text-muted tabular-nums">
              {p.done}/{p.total} · {p.percent}%
            </span>
          </div>
          <ProgressBar percent={p.percent} className="mb-4" label="Progresso dos conteúdos" />

          {p.total > 0 && p.done === p.total && (
            <p className="anim-fade tint-soft mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium" style={catVar("estudo")}>
              <PartyPopper className="size-4" /> Todos os conteúdos revisados. Excelente!
            </p>
          )}

          <ol className="space-y-1.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }: DragEndEvent) => {
                if (!over || active.id === over.id) return;
                const ids = exam.topics.map((t) => t.id);
                moveTopic(exam.id, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
              }}
              accessibility={{
                screenReaderInstructions: { draggable: "Pressione espaço para pegar o conteúdo, use as setas para mover e espaço para soltar." },
                announcements: {
                  onDragStart: () => "Conteúdo selecionado.",
                  onDragOver: () => "Movendo.",
                  onDragEnd: () => "Conteúdo reposicionado.",
                  onDragCancel: () => "Movimento cancelado.",
                },
              }}
            >
              <SortableContext items={exam.topics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {exam.topics.map((t) => (
                  <TopicRow key={t.id} examId={exam.id} topic={t} />
                ))}
              </SortableContext>
            </DndContext>
          </ol>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              addTopic(exam.id, draft);
              setDraft("");
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Adicionar conteúdo…"
              aria-label="Novo conteúdo"
              className="min-h-11 flex-1 rounded-xl border border-dashed border-line bg-transparent px-3 text-[16px] outline-none focus:border-accent focus:bg-surface-2"
            />
            <button type="submit" aria-label="Adicionar conteúdo" className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg">
              <Plus className="size-5" />
            </button>
          </form>
          <p className="mt-2 text-xs text-muted md:hidden">Toque em um conteúdo para editar ou excluir; arraste pela alça ⋮⋮ para reordenar.</p>
        </Card>

        <aside className="space-y-5">
          {exam.notes && (
            <Card>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="size-4 text-muted" /> Observações
              </h2>
              <p className="text-sm leading-relaxed">{exam.notes}</p>
            </Card>
          )}
          {exam.source === "ficticio" && <p className="px-1 text-xs text-muted">Prova fictícia de demonstração.</p>}
        </aside>
      </div>
    </div>
  );
}

function TopicRow({ examId, topic }: { examId: string; topic: ExamTopic }) {
  const toggle = useApp((s) => s.toggleTopic);
  const rename = useApp((s) => s.renameTopic);
  const remove = useApp((s) => s.deleteTopic);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: topic.id });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(topic.title);

  const save = () => {
    if (value.trim()) rename(examId, topic.id, value);
    else setValue(topic.title);
    setEditing(false);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        "group relative flex items-center gap-1 rounded-2xl bg-surface pr-1 transition-colors hover:bg-surface-2",
        topic.done && "text-muted",
        isDragging && "z-10 shadow-soft ring-2 ring-[var(--cat-prova)]",
      )}
    >
      <Checkbox checked={topic.done} onChange={() => toggle(examId, topic.id)} label={topic.title} category="prova" />
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => {
            if (!e.relatedTarget?.closest("[data-topic-actions]")) save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(topic.title);
              setEditing(false);
            }
          }}
          aria-label="Editar conteúdo"
          className="min-h-10 flex-1 rounded-lg border border-accent bg-surface px-2 text-[16px] text-fg outline-none"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} title="Toque para editar" className={clsx("min-h-10 flex-1 text-left", topic.done && "line-through decoration-1")}>
          {topic.title}
        </button>
      )}
      <div className={clsx("items-center transition-opacity md:flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100", editing ? "flex" : "hidden")} data-topic-actions>
        <SmallBtn label="Excluir conteúdo" onClick={() => confirm(`Excluir “${topic.title}”?`) && remove(examId, topic.id)}>
          <Trash2 className="size-4" />
        </SmallBtn>
      </div>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar para reordenar: ${topic.title}`}
        className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full text-muted/70 hover:bg-surface hover:text-fg active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
    </li>
  );
}

function SmallBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function BackLink() {
  return (
    <Link href="/provas" className="inline-flex min-h-10 items-center gap-1.5 rounded-full pr-3 text-sm font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> Provas
    </Link>
  );
}
