"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "../layout/app-shell";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-[var(--cat-prova)] opacity-40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-[var(--cat-tutoria)] opacity-35 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-[1.75rem] border border-line bg-surface/90 p-7 shadow-soft backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-3 size-12" />
          <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3.5 text-[16px] text-fg outline-none transition-colors focus:border-accent";

export function PasswordInput({
  value,
  onChange,
  autoComplete,
  label = "Senha",
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  label?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-sm font-medium text-muted">
      {label}
      <span className="relative mt-1 block">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          minLength={autoComplete === "new-password" ? 8 : undefined}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-fg"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </span>
    </label>
  );
}

export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "E-mail ainda não confirmado. Confirme pelo link enviado ou pelo painel do Supabase.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/password should be|weak/i.test(message)) return "Senha fraca: use pelo menos 8 caracteres, misturando letras e números.";
  if (/same.*password|different from the old/i.test(message)) return "A nova senha precisa ser diferente da anterior.";
  if (/fetch|network/i.test(message)) return "Sem conexão com o servidor. Verifique a internet.";
  return message;
}
