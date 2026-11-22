"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { CloudOff, Download, RefreshCw, Share, SquarePlus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null;
  waiting: ServiceWorker | null;
}

export const usePwa = create<PwaState>()(() => ({ installEvent: null, waiting: null }));

/** Registra o service worker (só em produção: em desenvolvimento ele atrapalharia o recarregamento). */
export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      usePwa.setState({ installEvent: e as BeforeInstallPromptEvent });
    };
    const onInstalled = () => usePwa.setState({ installEvent: null });
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          const track = (sw: ServiceWorker | null) => {
            if (!sw) return;
            const check = () => sw.state === "installed" && navigator.serviceWorker.controller && usePwa.setState({ waiting: sw });
            check();
            sw.addEventListener("statechange", check);
          };
          track(reg.waiting);
          reg.addEventListener("updatefound", () => track(reg.installing));
          // Procura versão nova ao voltar para o app.
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update().catch(() => {}));
        })
        .catch(() => {});

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || !usePwa.getState().waiting) return;
        reloading = true;
        window.location.reload();
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function useStandalone(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

/** Faixa discreta quando não há internet. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="border-b border-line bg-surface-2 text-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-10">
        <CloudOff className="size-4 shrink-0 text-muted" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">Sem internet.</strong> Mostrando os dados salvos neste aparelho; alterações só serão salvas quando a conexão voltar.
        </p>
      </div>
    </div>
  );
}

/** Aviso de nova versão publicada. */
export function UpdateToast() {
  const waiting = usePwa((s) => s.waiting);
  if (!waiting) return null;
  return (
    <div role="status" className="anim-sheet fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-soft">
      <RefreshCw className="size-5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-sm">Nova versão do StudyMed disponível.</p>
      <button type="button" onClick={() => waiting.postMessage("SKIP_WAITING")} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
        Atualizar
      </button>
    </div>
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Cartão de instalação para a tela Ajustes. */
export function InstallCard() {
  const installEvent = usePwa((s) => s.installEvent);
  const standalone = useStandalone();
  const ios = useSyncExternalStore(() => () => {}, isIOS, () => false);

  if (standalone) {
    return <p className="text-sm text-muted">O StudyMed já está instalado neste aparelho. ✓</p>;
  }
  if (installEvent) {
    return (
      <button
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          await installEvent.userChoice;
          usePwa.setState({ installEvent: null });
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
      >
        <Download className="size-4" /> Instalar o StudyMed
      </button>
    );
  }
  if (ios) {
    return (
      <ol className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">1</span>
          No Safari, toque em <Share className="inline size-4" aria-label="Compartilhar" /> <strong>Compartilhar</strong>.
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">2</span>
          Escolha <SquarePlus className="inline size-4" aria-hidden /> <strong>Adicionar à Tela de Início</strong>.
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">3</span>
          Toque em <strong>Adicionar</strong>.
        </li>
      </ol>
    );
  }
  return (
    <p className="text-sm text-muted">
      No Chrome do tablet ou do computador, abra o menu ⋮ e escolha <strong className="text-fg">Instalar app</strong> (ou “Adicionar à tela inicial”).
    </p>
  );
}
