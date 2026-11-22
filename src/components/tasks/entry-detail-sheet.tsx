"use client";

import Link from "next/link";
import { CalendarClock, FlaskRound, MapPin, Repeat, StickyNote, Trash2 } from "lucide-react";
import { CATEGORY_SINGULAR } from "@/lib/categories";
import { capitalize, formatLongDate, formatTimeRange, WEEKDAY_NAMES } from "@/lib/time";
import { useApp } from "@/store/app-store";
import { isEntryDone, useUI } from "@/store/ui-store";
import { Checkbox } from "../ui/checkbox";
import { CATEGORY_ICONS, catVar } from "../ui/icons";
import { Sheet } from "../ui/sheet";

export function EntryDetailSheet() {
  const entry = useUI((s) => s.selected);
  const select = useUI((s) => s.select);
  const done = useApp((s) => (entry ? isEntryDone(s, entry) : false));
  const item = useApp((s) => (entry?.itemId ? s.items.find((i) => i.id === entry.itemId) : undefined));
  const toggle = useApp((s) => s.toggleEntry);
  const deleteItem = useApp((s) => s.deleteItem);
  const close = () => select(null);

  if (!entry) return null;
  const Icon = CATEGORY_ICONS[entry.category];
  const kindLabel = entry.kind === "tarefa" ? "Tarefa concluível" : entry.kind === "prova" ? "Prova" : "Evento fixo";

  return (
    <Sheet open onClose={close} title="Detalhes">
      <div className="tint mb-4 flex items-start gap-3 rounded-2xl p-4" style={catVar(entry.category)}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/55 dark:bg-white/10">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-75">
            {CATEGORY_SINGULAR[entry.category]} · {kindLabel}
          </p>
          <h3 className="text-lg leading-snug font-semibold">{entry.title}</h3>
        </div>
      </div>

      <dl className="space-y-3 text-[0.95rem]">
        <Row icon={<CalendarClock className="size-4" />}>
          {capitalize(formatLongDate(entry.date))} · <span className="tabular-nums">{formatTimeRange(entry.startTime, entry.endTime)}</span>
        </Row>
        {item?.recurrence && (
          <Row icon={<Repeat className="size-4" />}>
            Toda semana: {item.recurrence.weekdays.map((d) => WEEKDAY_NAMES[d]).join(", ")}
          </Row>
        )}
        {entry.location && <Row icon={<MapPin className="size-4" />}>{entry.location}</Row>}
        {entry.notes && <Row icon={<StickyNote className="size-4" />}>{entry.notes}</Row>}
        {entry.source === "ficticio" && (
          <Row icon={<FlaskRound className="size-4" />}>
            <span className="text-muted">Origem: dados fictícios de demonstração</span>
          </Row>
        )}
      </dl>

      {entry.kind === "tarefa" && (
        <div className="mt-5 flex items-center gap-1 rounded-2xl bg-surface-2 py-1 pr-4 pl-1">
          <Checkbox checked={done} onChange={() => toggle(entry)} category={entry.category} label="Concluída" />
          <span className="font-medium">{done ? "Concluída" : "Marcar como concluída"}</span>
          {entry.recurring && <span className="ml-auto text-xs text-muted">só esta ocorrência</span>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {entry.examId && (
          <Link
            href={`/provas/${entry.examId}`}
            onClick={close}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-medium text-accent-fg"
          >
            Abrir prova e conteúdos
          </Link>
        )}
        {entry.itemId && (
          <button
            type="button"
            onClick={() => {
              const what = entry.recurring ? "todas as ocorrências desta série" : "este item";
              if (confirm(`Excluir ${what}?`)) {
                deleteItem(entry.itemId!);
                close();
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium text-muted hover:text-fg"
          >
            <Trash2 className="size-4" />
            {entry.recurring ? "Excluir série" : "Excluir"}
          </button>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">Edição e reagendamento completos chegam na Etapa 3.</p>
    </Sheet>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="mt-0.5 text-muted">{icon}</dt>
      <dd>{children}</dd>
    </div>
  );
}
