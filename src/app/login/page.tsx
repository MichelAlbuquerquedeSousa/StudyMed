"use client";

import { useState } from "react";
import { AuthCard, authErrorMessage, inputClass, PasswordInput } from "@/components/auth/auth-card";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"entrar" | "recuperar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(authErrorMessage(error.message));
      setBusy(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    // Só redireciona para caminhos internos.
    // Recarga completa de propósito: o proxy precisa reler os cookies da sessão.
    window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  };

  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    if (error) return setError(authErrorMessage(error.message));
    setInfo("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Abra-o neste mesmo navegador.");
  };

  return (
    <AuthCard title="StudyMed" subtitle={mode === "entrar" ? "Seu planner da faculdade" : "Recuperar acesso"}>
      <form onSubmit={mode === "entrar" ? signIn : recover} className="space-y-4">
        <label className="block text-sm font-medium text-muted">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
            className={`${inputClass} mt-1`}
          />
        </label>
        {mode === "entrar" && <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />}

        {error && (
          <p role="alert" className="rounded-xl bg-[color-mix(in_oklab,var(--cat-prova)_30%,var(--surface))] px-3 py-2 text-sm font-medium">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-xl bg-[color-mix(in_oklab,var(--cat-estudo)_35%,var(--surface))] px-3 py-2 text-sm">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-full bg-accent font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Enviar link"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "entrar" ? "recuperar" : "entrar");
          setError(null);
          setInfo(null);
        }}
        className="mt-4 w-full text-center text-sm font-medium text-accent"
      >
        {mode === "entrar" ? "Esqueci minha senha" : "Voltar para o login"}
      </button>
      <p className="mt-6 text-center text-xs text-muted">Acesso privado. Novos cadastros estão desativados.</p>
    </AuthCard>
  );
}
