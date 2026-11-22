"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./app-store";

const TABLES = ["items", "item_occurrences", "exams", "exam_topics", "user_settings"];

/**
 * Mantém computador, iPhone e tablet sincronizados:
 * - Realtime do Supabase: qualquer mudança nas tabelas recarrega os dados (com debounce);
 * - ao voltar para o app (foco/visibilidade) e ao reconectar à internet.
 */
export function useSync() {
  const userId = useApp((s) => s.userId);

  useEffect(() => {
    void useApp.getState().init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (ms = 400) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void useApp.getState().refresh(), ms);
    };

    const sb = supabase();
    const channel = sb.channel(`studymed-${userId}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => schedule());
    }
    channel.subscribe();

    const onVisible = () => document.visibilityState === "visible" && schedule(0);
    const onOnline = () => schedule(0);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    // Sessão encerrada em outro lugar (ex.: senha trocada): volta ao login.
    const { data: auth } = sb.auth.onAuthStateChange((event) => {
      // Recarga completa de propósito: o proxy precisa reler os cookies da sessão.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (event === "SIGNED_OUT") window.location.assign("/login");
    });

    return () => {
      if (timer) clearTimeout(timer);
      void sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      auth.subscription.unsubscribe();
    };
  }, [userId]);
}
