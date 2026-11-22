"use client";

import { useState } from "react";
import clsx from "clsx";
import { shiftEnd } from "@/lib/forms";
import { addDays, capitalize, formatLongDate, formatTimeRange, timeToMinutes } from "@/lib/time";
import type { CalendarEntry } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useUI } from "@/store/ui-store";
import { dateTimeGrid, Field, fieldClass, FormError, PrimaryButton, SecondaryButton } from "../ui/form";
import { Sheet } from "../ui/sheet";

export function RescheduleSheet() {
  const entry = useUI((s) => s.rescheduling);
  const close = useUI((s) => s.closeReschedule);
  if (!entry) return null;
  return <RescheduleForm key={entry.key} entry={entry} onClose={close} />;
}

function RescheduleForm({ entry, onClose }: { entry: CalendarEntry; onClose: () => void }) {
  const rescheduleEntry = useApp((s) => s.rescheduleEntry);
  const item = useApp((s) => s.items.find((i) => i.id === entry.itemId));
  const [date, setDate] = useState(entry.date);
  const [start, setStart] = useState(entry.startTime ?? "");
  const [end, setEnd] = useState(entry.endTime ?? "");
  const [error, setError] = useState<string | null>(null);

  const apply = (target: { date: string; startTime?: string; endTime?: string }) => {
    rescheduleEntry(entry, target);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return setError("Escolha a nova data.");
    if (end && !start) return setError("Informe o horário de início.");
    if (start && end && timeToMinutes(end) <= timeToMinutes(start)) return setError("O término deve ser depois do início.");
    apply({ date, startTime: start || undefined, endTime: start ? end || undefined : undefined });
  };

  const moved = entry.recurring && item && (entry.originalDate !== entry.date || entry.startTime !== item.startTime);
  const keep = { startTime: entry.startTime, endTime: entry.endTime };

  return (
    <Sheet open onClose={onClose} title="Reagendar">
      <p className="mb-1 font-semibold">{entry.title}</p>
      <p className="mb-4 text-sm text-muted">
        Agora: {capitalize(formatLongDate(entry.date))} · {formatTimeRange(entry.startTime, entry.endTime)}
        {entry.recurring && " · só esta ocorrência; as outras semanas não mudam"}
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <SecondaryButton onClick={() => apply({ date: addDays(entry.date, 1), ...keep })}>Adiar para amanhã</SecondaryButton>
        <SecondaryButton onClick={() => apply({ date: addDays(entry.date, 7), ...keep })}>Próxima semana</SecondaryButton>
        {moved && item && (
          <SecondaryButton onClick={() => apply({ date: entry.originalDate!, startTime: item.startTime, endTime: item.endTime })}>
            Voltar ao horário original
          </SecondaryButton>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className={dateTimeGrid}>
          <Field label="Nova data">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Início">
            <input
              type="time"
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                if (v && start && end) setEnd(shiftEnd(start, end, v) ?? "");
                setStart(v);
              }}
              className={fieldClass}
            />
          </Field>
          <Field label="Fim">
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!start} className={clsx(fieldClass, "disabled:opacity-50")} />
          </Field>
        </div>
        <FormError message={error} />
        <PrimaryButton type="submit" className="w-full">
          Reagendar
        </PrimaryButton>
      </form>
    </Sheet>
  );
}
