// Gera os ícones PNG do PWA a partir de scripts/icon.svg (requer Playwright instalado).
// Uso: node scripts/generate-icons.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
// require() encontra o Playwright instalado globalmente; o projeto não depende dele.
const { chromium } = createRequire(import.meta.url)("playwright");

const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
const out = (p) => new URL(`../${p}`, import.meta.url).pathname;

// [arquivo, tamanho, escala do desenho (maskable precisa de margem de segurança de 20%)]
const targets = [
  ["public/icons/icon-192.png", 192, 1],
  ["public/icons/icon-512.png", 512, 1],
  ["public/icons/maskable-512.png", 512, 0.78],
  ["src/app/apple-icon.png", 180, 1],
  ["src/app/icon.png", 64, 1],
];

const browser = await chromium.launch();
const page = await browser.newPage();
// Versão "maskable": só o coração (o Android recorta em círculo/forma livre; os enfeites seriam cortados).
const bare = svg.replace(/<rect[^>]*\/>/, "").replace(/<circle[^>]*\/>/g, "");

for (const [file, size, scale] of targets) {
  const art = scale < 1 ? bare : svg;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#F29BB8">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:linear-gradient(135deg,#FAD0DE,#F29BB8)">
      <div style="width:${size * scale}px;height:${size * scale}px">${art.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`);
  await page.screenshot({ path: out(file), omitBackground: false });
  console.log("gerado", file);
}
await browser.close();
