"use client";

import { useState } from "react";
import clsx from "clsx";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { timeToMinutes, weekdayOf, type ISODate } from "@/lib/time";
import type { CategoryKey, ItemKind } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useNow } from "@/store/use-now";
import { useUI } from "@/store/ui-store";
import { CATEGORY_ICONS, catVar } from "../ui/icons";
import { Sheet } from "../ui/sheet";

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function QuickAddSheet() {
  const { open, date, startTime } = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  const now = useNow();
  if (!open || !now) return null;
  // `key` reinicia o formulário a cada abertura com os valores sugeridos.
  return <QuickAddForm key={`${date}-${startTime}`} initialDate={date ?? now.today} initialStart={startTime} onClose={close} />;
}

function QuickAddForm({ initialDate, initialStart, onClose }: { initialDate: ISODate; initialStart?: string; onClose: () => void }) {
  const addItem = useApp((s) => s.addItem);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("tarefa");
  const [category, setCategory] = useState<CategoryKey>("estudo");
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(initialStart ?? "");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([weekdayOf(initialDate)]);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Dê um título para a atividade.");
    if (end && !start) return setError("Informe o horário de início.");
    if (start && end && timeToMinutes(end) <= timeToMinutes(start)) return setError("O término deve ser depois do início.");
    if (repeat && weekdays.length === 0) return setError("Escolha ao menos um dia da semana.");
    addItem({
      kind,
      title: title.trim(),
      category,
      date: repeat ? undefined : date,
      startTime: start || undefined,
      endTime: end || undefined,
      location: location.trim() || undefined,
      recurrence: repeat ? { freq: "weekly", weekdays, startsOn: date } : undefined,
      doneAt: null,
    });
    onClose();
  };

  const field = "w-full min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-[16px] outline-none focus:border-accent";

  return (
    <Sheet open onClose={onClose} title="Nova atividade">
      <form onSubmit={submit} className="space-y-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Revisar sistema renal"
          aria-label="Título"
          className={clsx(field, "min-h-12 text-[17px] font-medium")}
        />

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
          {(
            [
              ["tarefa", "Tarefa", "com checkbox"],
              ["evento", "Evento fixo", "aula, prática…"],
            ] as const
          ).map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={kind === v}
              onClick={() => setKind(v)}
              className={clsx(
                "rounded-xl border px-3 py-2 text-left transition-colors",
                kind === v ? "border-accent bg-accent-soft/40" : "border-line",
              )}
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
              const active = category === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(c.key)}
                  style={catVar(c.key)}
                  className={clsx(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-all",
                    active ? "tint ring-2 ring-[color-mix(in_oklab,var(--c)_60%,var(--text))]" : "tint-soft",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                  {c.name.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <label className="text-sm text-muted">
            {repeat ? "A partir de" : "Data"}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={clsx(field, "mt-1 text-fg")} required />
          </label>
          <label className="text-sm text-muted">
            Início
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={clsx(field, "mt-1 text-fg")} />
          </label>
          <label className="text-sm text-muted">
            Fim
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={clsx(field, "mt-1 text-fg")} />
          </label>
        </div>

        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Local (opcional)" aria-label="Local" className={field} />

        <div className="rounded-xl border border-line p-3">
          <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3">
            <span className="font-medium">Repetir toda semana</span>
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          </label>
          {repeat && (
            <div className="mt-3 flex justify-between gap-1">
              {WEEKDAY_ORDER.map((d) => {
                const on = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== d) : [...w, d]))}
                    style={catVar(category)}
                    className={clsx("grid size-10 place-items-center rounded-full text-sm font-semibold", on ? "tint" : "bg-surface-2 text-muted")}
                  >
                    {WEEKDAY_LETTERS[d]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-accent">
            {error}
          </p>
        )}

        <button type="submit" className="min-h-12 w-full rounded-full bg-accent font-semibold text-accent-fg transition-transform active:scale-[0.98]">
          Adicionar
        </button>
      </form>
    </Sheet>
  );
}
