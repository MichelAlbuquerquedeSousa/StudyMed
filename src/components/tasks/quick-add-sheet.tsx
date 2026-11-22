"use client";

import { useState } from "react";
import clsx from "clsx";
import { Info } from "lucide-react";
import { CATEGORY_SINGULAR, DEFAULT_CATEGORIES } from "@/lib/categories";
import { draftToItem, emptyItemDraft, itemToDraft, validateItemDraft, type ItemDraft } from "@/lib/forms";
import { timeToMinutes, minutesToTime, weekdayOf, type ISODate } from "@/lib/time";
import type { Item } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useNow } from "@/store/use-now";
import { useUI } from "@/store/ui-store";
import { CATEGORY_ICONS, catVar } from "../ui/icons";
import { dateTimeGrid, Field, fieldClass, FormError, PrimaryButton, WeekdayPicker } from "../ui/form";
import { Sheet } from "../ui/sheet";

/** Formulário de atividade: cria (botão +, toque na agenda) ou edita (detalhes → Editar). */
export function QuickAddSheet() {
  const { open, date, startTime, itemId } = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  const item = useApp((s) => (itemId ? s.items.find((i) => i.id === itemId) : undefined));
  const now = useNow();
  if (!open || !now) return null;
  if (itemId && !item) return null;
  // `key` reinicia o formulário a cada abertura.
  return <ItemForm key={`${itemId ?? "novo"}-${date}-${startTime}`} item={item} initialDate={date ?? now.today} initialStart={startTime} onClose={close} />;
}

function ItemForm({ item, initialDate, initialStart, onClose }: { item?: Item; initialDate: ISODate; initialStart?: string; onClose: () => void }) {
  const addItem = useApp((s) => s.addItem);
  const updateItem = useApp((s) => s.updateItem);
  const openExamForm = useUI((s) => s.openExamForm);
  const [d, setD] = useState<ItemDraft>(() => (item ? itemToDraft(item, initialDate) : emptyItemDraft(initialDate, initialStart)));
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(item);
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateItemDraft(d);
    if (problem) return setError(problem);
    if (item) updateItem(item.id, draftToItem(d));
    else addItem(draftToItem(d));
    onClose();
  };

  const setStart = (v: string) =>
    setD((p) => {
      // Mantém a duração quando o início muda.
      if (v && p.startTime && p.endTime) {
        const end = timeToMinutes(v) + (timeToMinutes(p.endTime) - timeToMinutes(p.startTime));
        return { ...p, startTime: v, endTime: end <= 23 * 60 + 59 ? minutesToTime(end) : "" };
      }
      return { ...p, startTime: v };
    });

  const canBeUndated = d.kind === "tarefa" && !d.repeat;

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar atividade" : "Nova atividade"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <input
          autoFocus={!editing}
          value={d.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex.: Revisar sistema renal"
          aria-label="Título"
          maxLength={200}
          className={clsx(fieldClass, "min-h-12 text-[17px] font-medium")}
        />

        <div className={clsx("grid gap-2", editing ? "grid-cols-2" : "grid-cols-3")} role="radiogroup" aria-label="Tipo">
          {(
            [
              ["tarefa", "Tarefa", "com checkbox"],
              ["evento", "Evento fixo", "aula, prática…"],
              ...(editing ? [] : [["prova", "Prova", "com conteúdos"]]),
            ] as const
          ).map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={d.kind === v}
              onClick={() => {
                if (v === "prova") return openExamForm({ date: d.date || initialDate });
                setD((p) => ({ ...p, kind: v as ItemDraft["kind"], date: v === "evento" && !p.date ? initialDate : p.date }));
              }}
              className={clsx("rounded-xl border px-3 py-2 text-left transition-colors", d.kind === v ? "border-accent bg-accent-soft/40" : "border-line")}
            >
              <span className="block font-medium">{label}</span>
              <span className="text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">Categoria</legend>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_CATEGORIES.filter((c) => c.key !== "prova").map((c) => {
              const Icon = CATEGORY_ICONS[c.key];
              const active = d.category === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("category", c.key)}
                  style={catVar(c.key)}
                  className={clsx(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-all",
                    active ? "tint ring-2 ring-[color-mix(in_oklab,var(--c)_60%,var(--text))]" : "tint-soft",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                  {CATEGORY_SINGULAR[c.key]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-2">
          <div className={dateTimeGrid}>
            <Field label={d.repeat ? "A partir de" : "Data"}>
              <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} disabled={!d.date && canBeUndated} className={clsx(fieldClass, "disabled:opacity-50")} />
            </Field>
            <Field label="Início">
              <input type="time" value={d.startTime} onChange={(e) => setStart(e.target.value)} disabled={!d.date && !d.repeat} className={clsx(fieldClass, "disabled:opacity-50")} />
            </Field>
            <Field label="Fim">
              <input type="time" value={d.endTime} onChange={(e) => set("endTime", e.target.value)} disabled={!d.startTime} className={clsx(fieldClass, "disabled:opacity-50")} />
            </Field>
          </div>
          {canBeUndated && (
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!d.date}
                onChange={(e) => setD((p) => ({ ...p, date: e.target.checked ? "" : initialDate, startTime: e.target.checked ? "" : p.startTime, endTime: e.target.checked ? "" : p.endTime }))}
                className="size-5 accent-[var(--accent)]"
              />
              Sem data definida (fica na lista de tarefas)
            </label>
          )}
        </div>

        <input value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Local (opcional)" aria-label="Local" maxLength={200} className={fieldClass} />
        <textarea
          value={d.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Observações (opcional)"
          aria-label="Observações"
          maxLength={4000}
          rows={2}
          className={clsx(fieldClass, "min-h-20 py-2.5")}
        />

        <div className="rounded-xl border border-line p-3">
          <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3">
            <span className="font-medium">Repetir toda semana</span>
            <input
              type="checkbox"
              checked={d.repeat}
              onChange={(e) =>
                setD((p) => ({ ...p, repeat: e.target.checked, date: p.date || initialDate, weekdays: p.weekdays.length ? p.weekdays : [weekdayOf(p.date || initialDate)] }))
              }
              className="size-5 accent-[var(--accent)]"
            />
          </label>
          {d.repeat && (
            <div className="mt-3 space-y-3">
              <WeekdayPicker value={d.weekdays} onChange={(v) => set("weekdays", v)} style={catVar(d.category)} />
              <Field label="Termina em (opcional)" hint="Ex.: último dia do semestre">
                <input type="date" value={d.repeatUntil} min={d.date || undefined} onChange={(e) => set("repeatUntil", e.target.value)} className={fieldClass} />
              </Field>
            </div>
          )}
        </div>

        {editing && item?.recurrence && (
          <p className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0" />
            As alterações valem para toda a série. Para mudar só um dia, use “Reagendar” nos detalhes da ocorrência.
          </p>
        )}

        <FormError message={error} />
        <PrimaryButton type="submit" className="w-full">
          {editing ? "Salvar alterações" : "Adicionar"}
        </PrimaryButton>
      </form>
    </Sheet>
  );
}
