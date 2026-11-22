import type { Metadata } from "next";
import { ClipboardPaste, FileText, ScanLine, ShieldCheck } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Importar planejamento" };

const STEPS = [
  { Icon: ClipboardPaste, title: "Cole texto ou envie um PDF", text: "Horários da faculdade, da tutora ou roteiros de estudo." },
  { Icon: FileText, title: "Revise a prévia editável", text: "Disciplinas, datas, horários e conteúdos identificados — nada é inventado." },
  { Icon: ShieldCheck, title: "Confirme antes de salvar", text: "Duplicatas, conflitos e dados ambíguos ficam sinalizados." },
  { Icon: ScanLine, title: "Depois: imagens e PDFs digitalizados", text: "A arquitetura já prevê OCR/IA em uma versão futura." },
];

export default function Page() {
  return (
    <div>
      <PageHeader title="Importar planejamento" subtitle="Disponível na Etapa 5 — veja como vai funcionar" />
      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map(({ Icon, title, text }, i) => (
          <Card key={title} className="flex gap-4">
            <span className="tint grid size-11 shrink-0 place-items-center rounded-2xl" style={{ "--c": "var(--cat-tutoria)" } as React.CSSProperties}>
              <Icon className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">Passo {i + 1}</p>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
