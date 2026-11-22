"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardPaste, FileText, FileUp, Info, Loader2, OctagonAlert, RotateCcw, ScanLine, Sparkles, Trash2, Undo2 } from "lucide-react";
import { CATEGORY_SINGULAR, DEFAULT_CATEGORIES } from "@/lib/categories";
import { extractFile, fromPastedText } from "@/lib/import/extractors";
import { parsePlanning } from "@/lib/import/parser";
import { blockingErrors, review, summarize, type ImportPeriod } from "@/lib/import/review";
import type { CandidateKind, ExtractedDocument, FlagCode, ImportCandidate, UnrecognizedLine } from "@/lib/import/types";
import { supabase } from "@/lib/supabase/client";
import { listImportBatches, type ImportBatchInfo } from "@/lib/supabase/repo";
import { TIME_ZONE, weekdayOf, type ISODate } from "@/lib/time";
import type { CategoryKey } from "@/lib/types";
import { useApp } from "@/store/app-store";
import { useNow } from "@/store/use-now";
import { Card, PageHeader } from "../ui/card";
import { dateTimeGrid, Field, fieldClass, FormError, PrimaryButton, SecondaryButton, WeekdayPicker } from "../ui/form";
import { CATEGORY_ICONS, catVar } from "../ui/icons";
import { Segmented } from "../ui/segmented";
import { Sheet } from "../ui/sheet";

const EXAMPLE = `HORÁRIO 2026.1 — EXEMPLO FICTÍCIO
Segunda 07:30-09:10 Anatomia II - Auditório 2
Segunda 09:20 às 11:00 Prática de Anatomia - Laboratório Morfológico
Terça | 08h às 10h | Fisiologia Humana | Sala 104
Quarta 14h - 16h30 Tutoria APG (Sala de tutoria 12)

CRONOGRAMA
02/12 (quarta)
14h às 17h Tutoria — abertura do problema 3
Entrega do relatório de prática: 04/12
Prova N1 de Fisiologia - 10/12/2026 - 08:00 - Auditório 1
Conteúdos:
- Potencial de ação
- Ciclo cardíaco
- Regulação da pressão arterial`;

// Sinais que deixam de valer quando a pessoa edita o campo correspondente.
const CLEARS: Partial<Record<keyof ImportCandidate, FlagCode[]>> = {
  title: ["titulo-incerto"],
  category: ["categoria-presumida"],
  date: ["sem-data", "data-invalida", "ano-presumido", "varias-datas"],
  weekdays: ["sem-data"],
  startTime: ["sem-horario"],
  endTime: ["sem-termino"],
};

type Step = "entrada" | "previa" | "concluido";

export function ImportView() {
  const now = useNow();
  if (!now) return null;
  return <Importer today={now.today} />;
}

function Importer({ today }: { today: ISODate }) {
  const items = useApp((s) => s.items);
  const overrides = useApp((s) => s.overrides);
  const exams = useApp((s) => s.exams);
  const importPlanning = useApp((s) => s.importPlanning);

  const [step, setStep] = useState<Step>("entrada");
  const [mode, setMode] = useState<"texto" | "pdf">("texto");
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<ExtractedDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<ImportCandidate[]>([]);
  const [unrecognized, setUnrecognized] = useState<UnrecognizedLine[]>([]);
  const [period, setPeriod] = useState<ImportPeriod>({ startsOn: today });
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ batchId: string; items: number; exams: number } | null>(null);
  const [batchesVersion, setBatchesVersion] = useState(0);

  const reviewed = useMemo(() => review(edited, { items, overrides, exams }, period), [edited, items, overrides, exams, period]);
  const summary = summarize(reviewed);
  const totalSelected = summary.eventos + summary.tarefas + summary.provas;

  const analyze = () => {
    setError(null);
    if (!text.trim()) return setError(mode === "pdf" ? "Envie um PDF primeiro." : "Cole o texto do horário ou roteiro.");
    const parsed = parsePlanning(text, today);
    if (parsed.candidates.length === 0) {
      return setError("Não encontrei datas, dias da semana ou horários neste material. Confira o texto ou ajuste o formato (ex.: “Segunda 07:30-09:10 Anatomia”).");
    }
    setEdited(parsed.candidates);
    setUnrecognized(parsed.unrecognized);
    setStep("previa");
    window.scrollTo({ top: 0 });
  };

  const update = (id: string, patch: Partial<ImportCandidate>) =>
    setEdited((list) =>
      list.map((c) => {
        if (c.id !== id) return c;
        const cleared = new Set(Object.keys(patch).flatMap((k) => CLEARS[k as keyof ImportCandidate] ?? []));
        return { ...c, ...patch, flags: c.flags.filter((f) => !cleared.has(f.code)) };
      }),
    );

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await importPlanning({
        candidates: reviewed,
        period,
        source: { sourceType: doc?.source ?? "texto", fileName: doc?.fileName, rawText: text },
      });
      setResult(r);
      setStep("concluido");
      setBatchesVersion((v) => v + 1);
      window.scrollTo({ top: 0 });
    } catch {
      // A mensagem de erro aparece no aviso de sincronização; a tela continua na prévia para tentar de novo.
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const reset = () => {
    setStep("entrada");
    setText("");
    setDoc(null);
    setEdited([]);
    setUnrecognized([]);
    setResult(null);
    setError(null);
  };

  if (step === "concluido" && result) {
    return <Done result={result} onAnother={reset} onUndone={() => setBatchesVersion((v) => v + 1)} />;
  }

  if (step === "previa") {
    const hasRecurring = summary.recorrentes > 0;
    return (
      <div className="space-y-5">
        <PageHeader title="Prévia da importação" subtitle="Confira e corrija antes de salvar. Nada foi adicionado ainda." />

        <Card className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Chip cat="aula">{plural(summary.eventos, "evento", "eventos")}</Chip>
            <Chip cat="estudo">{plural(summary.tarefas, "tarefa", "tarefas")}</Chip>
            <Chip cat="prova">
              {plural(summary.provas, "prova", "provas")}
              {summary.conteudos ? ` · ${plural(summary.conteudos, "conteúdo", "conteúdos")}` : ""}
            </Chip>
            {summary.avisos > 0 && (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--cat-pessoal)_45%,var(--surface))] px-3 font-medium">
                <AlertTriangle className="size-4" /> {summary.avisos} com {summary.avisos === 1 ? "aviso" : "avisos"}
              </span>
            )}
            {summary.bloqueados > 0 && (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--cat-prova)_45%,var(--surface))] px-3 font-medium">
                <OctagonAlert className="size-4" /> {summary.bloqueados} {summary.bloqueados === 1 ? "precisa" : "precisam"} de correção
              </span>
            )}
          </div>

          {hasRecurring && (
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4 text-muted" /> Período das atividades semanais ({summary.recorrentes})
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="A partir de">
                  <input type="date" value={period.startsOn} onChange={(e) => setPeriod((p) => ({ ...p, startsOn: e.target.value || today }))} className={fieldClass} />
                </Field>
                <Field label="Até (opcional)">
                  <input
                    type="date"
                    value={period.endsOn ?? ""}
                    min={period.startsOn}
                    onChange={(e) => setPeriod((p) => ({ ...p, endsOn: e.target.value || undefined }))}
                    className={fieldClass}
                  />
                </Field>
              </div>
              <p className="mt-2 text-xs text-muted">O material não informa o período do semestre; ajuste se necessário.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" disabled={totalSelected === 0 || summary.bloqueados > 0} onClick={() => setConfirming(true)}>
              Revisar e importar ({totalSelected})
            </PrimaryButton>
            <SecondaryButton onClick={() => setStep("entrada")}>Voltar e editar o texto</SecondaryButton>
          </div>
          {summary.bloqueados > 0 && <p className="text-sm text-muted">Corrija ou desmarque os itens com erro para continuar.</p>}
        </Card>

        <ul className="grid gap-4 lg:grid-cols-2">
          {reviewed.map((c) => (
            <CandidateCard key={c.id} c={c} onChange={(p) => update(c.id, p)} onRemove={() => setEdited((l) => l.filter((x) => x.id !== c.id))} />
          ))}
        </ul>

        {unrecognized.length > 0 && (
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              <Info className="size-4 text-muted" /> Linhas não reconhecidas ({unrecognized.length})
            </h2>
            <p className="mb-3 text-sm text-muted">Parecem ter informação de agenda, mas não consegui interpretar com segurança. Elas não serão importadas; adicione manualmente se precisar.</p>
            <ul className="space-y-1 text-sm">
              {unrecognized.map((u) => (
                <li key={u.line} className="rounded-lg bg-surface-2 px-3 py-1.5">
                  <span className="mr-2 text-xs text-muted tabular-nums">linha {u.line}</span>
                  {u.text}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {confirming && (
          <Sheet open onClose={() => setConfirming(false)} title="Confirmar importação">
            <ul className="mb-4 space-y-1.5 text-[0.95rem]">
              {summary.eventos > 0 && <li>• {plural(summary.eventos, "evento fixo", "eventos fixos")}</li>}
              {summary.tarefas > 0 && <li>• {plural(summary.tarefas, "tarefa", "tarefas")}</li>}
              {summary.provas > 0 && (
                <li>
                  • {plural(summary.provas, "prova", "provas")} com {plural(summary.conteudos, "conteúdo", "conteúdos")}
                </li>
              )}
              {summary.recorrentes > 0 && (
                <li className="text-muted">
                  {summary.recorrentes} se repetem toda semana a partir de {fmt(period.startsOn)}
                  {period.endsOn ? ` até ${fmt(period.endsOn)}` : ", sem data de término"}.
                </li>
              )}
            </ul>
            {summary.avisos > 0 && (
              <p className="mb-4 flex gap-2 rounded-xl bg-[color-mix(in_oklab,var(--cat-pessoal)_35%,var(--surface))] px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {summary.avisos} {summary.avisos === 1 ? "item ainda tem aviso" : "itens ainda têm avisos"} (ex.: possível duplicata ou conflito). Eles serão importados mesmo assim.
              </p>
            )}
            <p className="mb-4 text-sm text-muted">Você poderá desfazer esta importação depois, na tela Importar.</p>
            <PrimaryButton type="button" className="w-full" disabled={busy} onClick={confirm}>
              {busy ? "Importando…" : `Importar ${totalSelected} ${totalSelected === 1 ? "item" : "itens"}`}
            </PrimaryButton>
          </Sheet>
        )}
      </div>
    );
  }

  // ---------------- Passo 1: material ----------------
  return (
    <div className="space-y-5">
      <PageHeader title="Importar planejamento" subtitle="Horários da faculdade, da tutora ou roteiros: cole o texto ou envie um PDF." />
      <Card className="space-y-4">
        <Segmented
          label="Tipo de material"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setError(null);
          }}
          options={[
            { value: "texto", label: "Colar texto" },
            { value: "pdf", label: "Enviar PDF" },
          ]}
        />

        {mode === "pdf" && (
          <PdfDrop
            busy={busy}
            doc={doc}
            onFile={async (file) => {
              setBusy(true);
              setError(null);
              try {
                const d = await extractFile(file);
                setDoc(d);
                setText(d.text);
              } catch (e) {
                setDoc(null);
                setText("");
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}

        {(mode === "texto" || doc) && (
          <Field label={mode === "pdf" ? "Texto extraído do PDF (pode corrigir antes de analisar)" : "Texto do horário ou roteiro"}>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (mode === "texto") setDoc(fromPastedText(e.target.value));
              }}
              rows={mode === "pdf" ? 10 : 12}
              placeholder={"Ex.:\nSegunda 07:30-09:10 Anatomia II - Auditório 2\nTerça 08h às 10h Fisiologia\nProva de Fisiologia 10/12 08:00\nConteúdos:\n- Ciclo cardíaco"}
              className={clsx(fieldClass, "min-h-56 py-3 font-mono text-[14px] leading-relaxed sm:text-[15px]")}
              spellCheck={false}
            />
          </Field>
        )}

        <FormError message={error} />

        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="button" onClick={analyze} disabled={busy || !text.trim()}>
            Analisar
          </PrimaryButton>
          {mode === "texto" && !text && (
            <SecondaryButton onClick={() => setText(EXAMPLE)}>
              <Sparkles className="size-4" /> Usar exemplo fictício
            </SecondaryButton>
          )}
          {text && (
            <SecondaryButton
              onClick={() => {
                setText("");
                setDoc(null);
              }}
            >
              <Trash2 className="size-4" /> Limpar
            </SecondaryButton>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Tip icon={<ClipboardPaste className="size-5" />} title="O que é reconhecido" text="Dias da semana, datas (12/03, 12 de março), horários (07:30-09:10, 8h às 10h), local (Sala, Auditório, Lab.), provas e listas de conteúdos." />
        <Tip icon={<CheckCircle2 className="size-5" />} title="Nada é inventado" text="O que não estiver escrito fica em branco e sinalizado. Você confere e corrige tudo na prévia antes de salvar." />
        <Tip icon={<ScanLine className="size-5" />} title="Imagens e PDFs digitalizados" text="Fotos e PDFs escaneados (OCR/IA) chegam numa versão futura. Por enquanto, use PDFs com texto selecionável." />
      </div>

      <RecentImports version={batchesVersion} />
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function fmt(d: ISODate) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(d + "T00:00:00Z"));
}

function Chip({ cat, children }: { cat: CategoryKey; children: React.ReactNode }) {
  return (
    <span className="tint-soft inline-flex min-h-8 items-center rounded-full px-3 font-medium" style={catVar(cat)}>
      {children}
    </span>
  );
}

function Tip({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <span className="text-muted">{icon}</span>
        {title}
      </div>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}

function PdfDrop({ busy, doc, onFile }: { busy: boolean; doc: ExtractedDocument | null; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={clsx(
          "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          over ? "border-accent bg-accent-soft/30" : "border-line hover:bg-surface-2",
        )}
      >
        {busy ? <Loader2 className="size-7 animate-spin text-muted" /> : <FileUp className="size-7 text-muted" />}
        <span className="font-medium">{busy ? "Lendo o PDF…" : doc?.fileName ? "Escolher outro PDF" : "Toque para escolher um PDF"}</span>
        <span className="text-sm text-muted">O arquivo é lido no seu aparelho; só o texto confirmado é salvo. Máx. 15 MB.</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {doc?.fileName && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <FileText className="size-4 text-muted" /> <strong className="truncate">{doc.fileName}</strong>
          <span className="text-muted">
            · {doc.pages} {doc.pages === 1 ? "página" : "páginas"}
          </span>
        </p>
      )}
      {doc?.warnings.map((w) => (
        <p key={w} className="mt-2 flex gap-2 rounded-xl bg-[color-mix(in_oklab,var(--cat-pessoal)_35%,var(--surface))] px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
        </p>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<CandidateKind, string> = { evento: "Evento", tarefa: "Tarefa", prova: "Prova" };

function CandidateCard({ c, onChange, onRemove }: { c: ImportCandidate; onChange: (p: Partial<ImportCandidate>) => void; onRemove: () => void }) {
  const errors = blockingErrors(c);
  const recurring = c.kind !== "prova" && c.weekdays.length > 0 && !c.date;
  const cat: CategoryKey = c.kind === "prova" ? "prova" : c.category;
  const Icon = CATEGORY_ICONS[cat];
  return (
    <li
      className={clsx("tint-bar min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft transition-opacity", !c.include && "opacity-55")}
      style={catVar(cat)}
    >
      <div className="mb-3 flex items-center gap-2">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 pr-1">
          <input type="checkbox" checked={c.include} onChange={(e) => onChange({ include: e.target.checked })} className="size-5 accent-[var(--accent)]" />
          <span className="sr-only">Incluir na importação</span>
        </label>
        <span className="tint grid size-8 shrink-0 place-items-center rounded-lg">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        <div className="inline-flex rounded-full border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Tipo">
          {(Object.keys(KIND_LABEL) as CandidateKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={c.kind === k}
              onClick={() => onChange({ kind: k, ...(k !== "prova" && c.category === "prova" ? { category: "aula" as CategoryKey } : {}) })}
              className={clsx("min-h-8 rounded-full px-2.5 text-xs font-medium", c.kind === k ? "bg-surface shadow-soft" : "text-muted")}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove} aria-label="Remover da prévia" className="ml-auto grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="space-y-3">
        <Field label={c.kind === "prova" ? "Disciplina" : "Título"}>
          <input value={c.title} onChange={(e) => onChange({ title: e.target.value })} className={clsx(fieldClass, "font-medium", !c.title.trim() && "border-accent")} />
        </Field>

        {c.kind !== "prova" && (
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {DEFAULT_CATEGORIES.filter((k) => k.key !== "prova").map((k) => (
              <button
                key={k.key}
                type="button"
                aria-pressed={c.category === k.key}
                onClick={() => onChange({ category: k.key })}
                style={catVar(k.key)}
                className={clsx("min-h-8 shrink-0 rounded-full px-3 text-xs font-medium", c.category === k.key ? "tint ring-2 ring-[color-mix(in_oklab,var(--c)_60%,var(--text))]" : "tint-soft")}
              >
                {CATEGORY_SINGULAR[k.key]}
              </button>
            ))}
          </div>
        )}

        {c.kind !== "prova" && (
          <div className="inline-flex rounded-full border border-line bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label="Quando">
            {(
              [
                ["semanal", "Toda semana"],
                ["data", "Data específica"],
              ] as const
            ).map(([v, label]) => {
              const active = v === "semanal" ? recurring : !recurring;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    v === "semanal"
                      ? onChange({ date: undefined, weekdays: c.weekdays.length ? c.weekdays : [c.date ? weekdayOf(c.date) : 1] })
                      : onChange({ weekdays: [] })
                  }
                  className={clsx("min-h-8 rounded-full px-3 font-medium", active ? "bg-surface shadow-soft" : "text-muted")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {recurring && <WeekdayPicker value={c.weekdays} onChange={(v) => onChange({ weekdays: v.length ? v : c.weekdays })} style={catVar(cat)} />}

        <div className={dateTimeGrid}>
          {recurring ? (
            <div className="text-sm text-muted sm:pt-6">{c.weekdays.length ? "Dias marcados acima" : "Escolha os dias acima"}</div>
          ) : (
            <Field label="Data">
              <input type="date" value={c.date ?? ""} onChange={(e) => onChange({ date: e.target.value || undefined })} className={clsx(fieldClass, !c.date && c.kind !== "tarefa" && "border-accent")} />
            </Field>
          )}
          <Field label="Início">
            <input type="time" value={c.startTime ?? ""} onChange={(e) => onChange({ startTime: e.target.value || undefined })} className={fieldClass} />
          </Field>
          <Field label="Fim">
            <input type="time" value={c.endTime ?? ""} onChange={(e) => onChange({ endTime: e.target.value || undefined })} disabled={!c.startTime} className={clsx(fieldClass, "disabled:opacity-50")} />
          </Field>
        </div>

        <input value={c.location ?? ""} onChange={(e) => onChange({ location: e.target.value || undefined })} placeholder="Local (opcional)" aria-label="Local" className={fieldClass} />

        {c.kind === "prova" && (
          <Field label={`Conteúdos (${c.topics.filter((t) => t.trim()).length}) — um por linha`}>
            <textarea
              value={c.topics.join("\n")}
              onChange={(e) => onChange({ topics: e.target.value.split("\n") })}
              rows={Math.min(Math.max(c.topics.length, 2), 8)}
              className={clsx(fieldClass, "py-2")}
            />
          </Field>
        )}

        {(errors.length > 0 || c.flags.length > 0) && (
          <ul className="space-y-1.5">
            {errors.map((e) => (
              <li key={e} className="flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--cat-prova)_35%,var(--surface))] px-3 py-1.5 text-sm font-medium">
                <OctagonAlert className="mt-0.5 size-4 shrink-0" /> {e}
              </li>
            ))}
            {c.flags
              .filter((f) => f.severity === "aviso")
              .map((f) => (
                <li key={f.code + f.message} className="flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--cat-pessoal)_35%,var(--surface))] px-3 py-1.5 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {f.message}
                </li>
              ))}
          </ul>
        )}

        <p className="truncate text-xs text-muted" title={c.sourceText}>
          Linha {c.sourceLines[0]}: {c.sourceText}
        </p>
      </div>
    </li>
  );
}

function Done({ result, onAnother, onUndone }: { result: { batchId: string; items: number; exams: number }; onAnother: () => void; onUndone: () => void }) {
  const undoImport = useApp((s) => s.undoImport);
  const [state, setState] = useState<"ok" | "desfazendo" | "desfeito">("ok");
  return (
    <div className="mx-auto max-w-lg space-y-5 pt-4 text-center">
      <span className="tint mx-auto grid size-16 place-items-center rounded-3xl" style={catVar(state === "desfeito" ? "pessoal" : "estudo")}>
        {state === "desfeito" ? <Undo2 className="size-8" /> : <CheckCircle2 className="size-8" />}
      </span>
      <div>
        <h1 className="font-display text-3xl font-medium">{state === "desfeito" ? "Importação desfeita" : "Importação concluída"}</h1>
        <p className="mt-1 text-muted">
          {state === "desfeito"
            ? "Os itens deste material foram removidos."
            : `${result.items} ${result.items === 1 ? "atividade adicionada" : "atividades adicionadas"} e ${result.exams} ${result.exams === 1 ? "prova" : "provas"}.`}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {state !== "desfeito" && (
          <>
            <Link href="/calendario" className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-semibold text-accent-fg">
              Ver na agenda
            </Link>
            {result.exams > 0 && (
              <Link href="/provas" className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-medium">
                Ver provas
              </Link>
            )}
          </>
        )}
        <SecondaryButton onClick={onAnother} className="min-h-12">
          <RotateCcw className="size-4" /> Importar outro material
        </SecondaryButton>
      </div>
      {state !== "desfeito" && (
        <button
          type="button"
          disabled={state === "desfazendo"}
          onClick={async () => {
            if (!confirm("Remover tudo o que foi importado agora?")) return;
            setState("desfazendo");
            try {
              await undoImport(result.batchId);
              setState("desfeito");
              onUndone();
            } catch {
              setState("ok");
            }
          }}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-fg disabled:opacity-50"
        >
          <Undo2 className="size-4" /> {state === "desfazendo" ? "Desfazendo…" : "Desfazer esta importação"}
        </button>
      )}
    </div>
  );
}

function RecentImports({ version }: { version: number }) {
  const items = useApp((s) => s.items);
  const exams = useApp((s) => s.exams);
  const undoImport = useApp((s) => s.undoImport);
  const [batches, setBatches] = useState<ImportBatchInfo[] | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    listImportBatches(supabase())
      .then((b) => alive && setBatches(b))
      .catch(() => alive && setBatches([]));
    return () => {
      alive = false;
    };
  }, [version, reload]);

  const visible = (batches ?? []).filter((b) => b.status === "confirmado");
  if (!visible.length) return null;
  const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Importações recentes</h2>
      <ul className="divide-y divide-line">
        {visible.map((b) => {
          const nItems = items.filter((i) => i.importBatchId === b.id).length;
          const nExams = exams.filter((e) => e.importBatchId === b.id).length;
          return (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              {b.sourceType === "pdf" ? <FileText className="size-5 shrink-0 text-muted" /> : <ClipboardPaste className="size-5 shrink-0 text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.fileName ?? "Texto colado"}</p>
                <p className="text-xs text-muted">
                  {when(b.createdAt)} · {nItems} {nItems === 1 ? "atividade" : "atividades"}, {nExams} {nExams === 1 ? "prova" : "provas"}
                </p>
              </div>
              <SecondaryButton
                onClick={async () => {
                  if (!confirm("Desfazer esta importação? Os itens que vieram dela serão removidos.")) return;
                  await undoImport(b.id).catch(() => {});
                  setReload((r) => r + 1);
                }}
              >
                <Undo2 className="size-4" /> Desfazer
              </SecondaryButton>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
