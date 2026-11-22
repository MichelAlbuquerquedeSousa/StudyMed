/** Mensagens para o service worker (sem dependências de interface). */

/** Apaga as páginas guardadas pelo service worker (ao sair da conta). */
export function clearOfflinePages() {
  if (typeof navigator !== "undefined") navigator.serviceWorker?.controller?.postMessage("CLEAR_PAGES");
}

/** Telas principais guardadas para abrir sem internet mesmo antes de serem visitadas. */
export const WARM_ROUTES = ["/", "/calendario", "/tarefas", "/provas", "/ajustes", "/importar"];

export async function warmOfflinePages() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({ type: "WARM", urls: WARM_ROUTES });
}
