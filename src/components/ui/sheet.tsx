"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Painel que sobe do rodapé no celular e vira diálogo centralizado no tablet/desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="anim-fade absolute inset-0 bg-[rgb(43_35_48/0.28)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="anim-sheet pb-safe relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-line bg-surface shadow-soft outline-none md:max-w-lg md:rounded-[1.75rem]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-surface/95 px-5 pt-4 pb-2 backdrop-blur">
          <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line md:hidden" aria-hidden />
          <h2 className="pt-2 text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 pt-1 pb-6">{children}</div>
      </div>
    </div>
  );
}
