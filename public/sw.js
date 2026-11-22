/*
 * Service worker do StudyMed.
 *
 * Objetivo: o app abrir e mostrar os dados salvos mesmo sem internet.
 * - Páginas (navegação): rede primeiro; se falhar, a última versão salva da página
 *   (ou da tela inicial, ou a página offline).
 * - Arquivos do Next (/_next/static, com hash no nome): cache primeiro — nunca mudam.
 * - Ícones e manifest: usa o salvo e atualiza em segundo plano.
 * - Supabase e qualquer outro domínio: NUNCA passam pelo service worker
 *   (dados pessoais ficam só no cache do app, protegido pela sessão).
 */
const VERSION = "v1";
const PAGES = `studymed-pages-${VERSION}`;
const STATIC = `studymed-static-${VERSION}`;
const ASSETS = `studymed-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_STATIC_ENTRIES = 250;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ASSETS).then((c) => c.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC, ASSETS]);
      for (const key of await caches.keys()) if (key.startsWith("studymed-") && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  // Ao sair da conta, apaga as páginas salvas deste aparelho.
  if (event.data === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGES));
  // Depois do login, guarda as telas principais (só respostas 200, sem redirecionamento para o login).
  if (event.data && event.data.type === "WARM" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES);
        for (const path of event.data.urls) {
          const url = new URL(path, self.location.origin);
          if (url.origin !== self.location.origin || (await cache.match(url.href))) continue;
          try {
            const res = await fetch(url.href, { credentials: "same-origin", redirect: "follow" });
            if (!isCacheable(res)) continue;
            const html = await res.clone().text();
            await cache.put(url.href, res);
            // A página só funciona offline se os scripts e estilos dela também estiverem guardados.
            const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
            const statics = await caches.open(STATIC);
            for (const a of assets) {
              if (await statics.match(a)) continue;
              const r = await fetch(a).catch(() => null);
              if (isCacheable(r)) await statics.put(a, r);
            }
          } catch {}
        }
      })(),
    );
  }
});

const isCacheable = (res) => res && res.ok && res.type === "basic" && !res.redirected;

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (isCacheable(res)) await cache.put(request.url.split("?")[0], res.clone());
    return res;
  } catch {
    const path = request.url.split("?")[0];
    // Nunca entrega a página de outra rota (o roteador do Next se confundiria): sem cópia, mostra a página offline.
    return (await cache.match(path)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (isCacheable(res)) {
    const cache = await caches.open(STATIC);
    await cache.put(request, res.clone());
    trim(STATIC, MAX_STATIC_ENTRIES);
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (isCacheable(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase etc.: direto para a rede

  if (request.mode === "navigate") {
    // Páginas públicas de autenticação não são guardadas.
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/redefinir-senha")) return;
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || /^\/(icon|apple-icon)/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Demais requisições (RSC, etc.) seguem normalmente pela rede.
});
