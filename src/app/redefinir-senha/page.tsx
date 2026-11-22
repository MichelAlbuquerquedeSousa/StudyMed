"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthCard, authErrorMessage, PasswordInput } from "@/components/auth/auth-card";
import { supabase } from "@/lib/supabase/client";

/** Destino do link "Esqueci minha senha": o cliente troca o código do link por uma sessão e permite definir a nova senha. */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) setReady(true);
    });
    // Dá tempo para o cliente processar o código do link; sem sessão, o link expirou ou foi aberto em outro navegador.
    const t = setTimeout(async () => {
      const { data: s } = await sb.auth.getSession();
      setReady(Boolean(s.session));
    }, 1500);
    return () => {
      clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(authErrorMessage(error.message));
    // Recarga completa de propósito: o proxy precisa reler os cookies da sessão.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  return (
    <AuthCard title="Nova senha" subtitle="Defina a senha que você usará para entrar">
      {ready === null && <p className="text-center text-sm text-muted">Verificando o link…</p>}
      {ready === false && (
        <div className="space-y-4 text-center text-sm">
          <p>Este link expirou ou foi aberto em outro navegador. Peça um novo link e abra-o no mesmo navegador em que fez o pedido.</p>
          <Link href="/login" className="inline-block font-medium text-accent">
            Voltar para o login
          </Link>
        </div>
      )}
      {ready && (
        <form onSubmit={submit} className="space-y-4">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" label="Nova senha" />
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" label="Confirme a nova senha" />
          {error && (
            <p role="alert" className="rounded-xl bg-[color-mix(in_oklab,var(--cat-prova)_30%,var(--surface))] px-3 py-2 text-sm font-medium">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-accent font-semibold text-accent-fg disabled:opacity-60">
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
