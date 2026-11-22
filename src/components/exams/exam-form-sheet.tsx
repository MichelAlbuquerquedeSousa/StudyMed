"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { draftToExamFields, emptyExamDraft, examToDraft, parseTopicLines, validateExamDraft, type ExamDraft } from "@/lib/forms";
import type { Exam } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useUI } from "@/store/ui-store";
import { Field, fieldClass, FormError, PrimaryButton } from "../ui/form";
import { Sheet } from "../ui/sheet";

export function ExamFormSheet() {
  const { open, examId, date } = useUI((s) => s.examForm);
  const close = useUI((s) => s.closeExamForm);
  const exam = useApp((s) => (examId ? s.exams.find((e) => e.id === examId) : undefined));
  if (!open || (examId && !exam)) return null;
  return <ExamForm key={examId ?? `nova-${date}`} exam={exam} initialDate={date ?? ""} onClose={close} />;
}

function ExamForm({ exam, initialDate, onClose }: { exam?: Exam; initialDate: string; onClose: () => void }) {
  const router = useRouter();
  const addExam = useApp((s) => s.addExam);
  const updateExam = useApp((s) => s.updateExam);
  const [d, setD] = useState<ExamDraft>(() => (exam ? examToDraft(exam) : emptyExamDraft(initialDate)));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ExamDraft>(k: K, v: ExamDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const topics = parseTopicLines(d.topicsText);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateExamDraft(d);
    if (problem) return setError(problem);
    if (exam) {
      updateExam(exam.id, draftToExamFields(d));
      onClose();
    } else {
      const id = addExam(draftToExamFields(d), topics);
      onClose();
      router.push(`/provas/${id}`);
    }
  };

  return (
    <Sheet open onClose={onClose} title={exam ? "Editar prova" : "Nova prova"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Disciplina">
          <input autoFocus={!exam} value={d.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Ex.: Fisiologia Humana" maxLength={120} className={clsx(fieldClass, "font-medium")} />
        </Field>
        <Field label="Título (opcional)" hint={d.subject.trim() && !d.title.trim() ? `Será salvo como “Prova — ${d.subject.trim()}”` : undefined}>
          <input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: N1, Prova prática, OSCE…" maxLength={200} className={fieldClass} />
        </Field>
        <div className="grid grid-cols-[1.5fr_1fr] gap-2">
          <Field label="Data">
            <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Horário">
            <input type="time" value={d.startTime} onChange={(e) => set("startTime", e.target.value)} className={fieldClass} />
          </Field>
        </div>
        <input value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Local (opcional)" aria-label="Local" maxLength={200} className={fieldClass} />
        <textarea value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observações (opcional)" aria-label="Observações" rows={2} maxLength={4000} className={clsx(fieldClass, "min-h-20 py-2.5")} />

        {!exam && (
          <Field label="Conteúdos cobrados (opcional)" hint={topics.length ? `${topics.length} ${topics.length === 1 ? "conteúdo identificado" : "conteúdos identificados"}. Marcadores como “-”, “•” e “1.” são removidos.` : "Um por linha — pode colar a lista do roteiro."}>
            <textarea
              value={d.topicsText}
              onChange={(e) => set("topicsText", e.target.value)}
              placeholder={"Potencial de ação\nCiclo cardíaco\nECG básico"}
              rows={5}
              className={clsx(fieldClass, "min-h-32 py-2.5")}
            />
          </Field>
        )}

        <FormError message={error} />
        <PrimaryButton type="submit" className="w-full">
          {exam ? "Salvar alterações" : "Criar prova"}
        </PrimaryButton>
      </form>
    </Sheet>
  );
}
