"use client";

import Link from "next/link";
import { CalendarClock, CalendarX, FlaskRound, MapPin, Pencil, Repeat, StickyNote, Trash2 } from "lucide-react";
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
  const cancelOccurrence = useApp((s) => s.cancelOccurrence);
  const editItem = useUI((s) => s.editItem);
  const openReschedule = useUI((s) => s.openReschedule);
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
          {entry.date ? (
            <>
              {capitalize(formatLongDate(entry.date))} · <span className="tabular-nums">{formatTimeRange(entry.startTime, entry.endTime)}</span>
              {entry.recurring && entry.originalDate && entry.originalDate !== entry.date && (
                <span className="block text-sm text-muted">Reagendada (originalmente {formatLongDate(entry.originalDate)})</span>
              )}
            </>
          ) : (
            "Sem data definida"
          )}
        </Row>
        {item?.recurrence && (
          <Row icon={<Repeat className="size-4" />}>
            Toda semana: {item.recurrence.weekdays.map((d) => WEEKDAY_NAMES[d]).join(", ")}
            {item.recurrence.endsOn && ` · até ${formatLongDate(item.recurrence.endsOn).replace(/^[^,]+, /, "")}`}
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

      <div className="mt-6 space-y-3">
        {entry.examId && (
          <Link href={`/provas/${entry.examId}`} onClick={close} className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-medium text-accent-fg">
            Abrir prova e conteúdos
          </Link>
        )}

        {item && !entry.recurring && (
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={<Pencil className="size-4" />} onClick={() => editItem(item.id)}>
              Editar
            </ActionButton>
            {entry.date && (
              <ActionButton icon={<CalendarClock className="size-4" />} onClick={() => openReschedule(entry)}>
                Reagendar
              </ActionButton>
            )}
            <ActionButton icon={<Trash2 className="size-4" />} onClick={() => confirm("Excluir este item?") && (deleteItem(item.id), close())}>
              Excluir
            </ActionButton>
          </div>
        )}

        {item && entry.recurring && (
          <>
            <ActionGroup title="Só esta ocorrência">
              <ActionButton icon={<CalendarClock className="size-4" />} onClick={() => openReschedule(entry)}>
                Reagendar
              </ActionButton>
              <ActionButton
                icon={<CalendarX className="size-4" />}
                onClick={() => confirm(`Cancelar só a ocorrência de ${formatLongDate(entry.date)}?`) && (cancelOccurrence(entry), close())}
              >
                Cancelar este dia
              </ActionButton>
            </ActionGroup>
            <ActionGroup title="Toda a série">
              <ActionButton icon={<Pencil className="size-4" />} onClick={() => editItem(item.id)}>
                Editar série
              </ActionButton>
              <ActionButton
                icon={<Trash2 className="size-4" />}
                onClick={() => confirm("Excluir todas as ocorrências desta série?") && (deleteItem(item.id), close())}
              >
                Excluir série
              </ActionButton>
            </ActionGroup>
          </>
        )}
      </div>
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

function ActionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ActionButton({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:bg-surface-2">
      {icon}
      {children}
    </button>
  );
}
