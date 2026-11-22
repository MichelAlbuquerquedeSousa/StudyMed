"use client";

import Link from "next/link";
import { FileUp, RotateCcw } from "lucide-react";
import { contrastRatio, DEFAULT_CATEGORIES, INK } from "@/lib/categories";
import { TIME_ZONE } from "@/lib/time";
import { useApp } from "@/store/app-store";
import { ThemeSwitcher } from "../layout/theme";
import { Card, PageHeader } from "../ui/card";
import { CATEGORY_ICONS, catVar } from "../ui/icons";

export function SettingsView() {
  const categories = useApp((s) => s.categories);
  const setColor = useApp((s) => s.setCategoryColor);
  const resetColors = useApp((s) => s.resetCategoryColors);

  return (
    <div className="space-y-5">
      <PageHeader title="Ajustes" />

      <Card>
        <h2 className="mb-3 font-semibold">Aparência</h2>
        <ThemeSwitcher />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Cores das categorias</h2>
            <p className="text-sm text-muted">Toque na amostra para escolher outra cor.</p>
          </div>
          <button type="button" onClick={resetColors} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium hover:bg-surface-2">
            <RotateCcw className="size-4" /> Padrão
          </button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.key];
            const ratio = contrastRatio(c.color, INK);
            const isDefault = DEFAULT_CATEGORIES.find((d) => d.key === c.key)?.color.toLowerCase() === c.color.toLowerCase();
            return (
              <li key={c.key} className="tint-soft flex items-center gap-3 rounded-2xl p-2 pr-3" style={catVar(c.key)}>
                <label className="tint relative grid size-11 cursor-pointer place-items-center rounded-xl">
                  <Icon className="size-5" strokeWidth={1.8} />
                  <input
                    type="color"
                    value={c.color}
                    onChange={(e) => setColor(c.key, e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`Cor de ${c.name}`}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted uppercase tabular-nums">
                    {c.color}
                    {isDefault && " · padrão"}
                  </p>
                </div>
                {ratio < 4.5 && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-accent">contraste baixo</span>}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Fuso horário</h2>
        <p className="text-sm text-muted">
          Todas as datas e horários usam <strong className="text-fg">{TIME_ZONE}</strong> (UTC−3), mesmo se o aparelho estiver em outro fuso.
        </p>
      </Card>

      <Card className="md:hidden">
        <Link href="/importar" className="flex items-center gap-3 font-medium">
          <FileUp className="size-5 text-muted" /> Importar planejamento
        </Link>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Conta e sincronização</h2>
        <p className="text-sm text-muted">Login privado e sincronização entre computador, iPhone e tablet chegam na Etapa 2 (Supabase).</p>
      </Card>
    </div>
  );
}
