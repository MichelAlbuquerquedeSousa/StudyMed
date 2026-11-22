// Verifica o projeto Supabase real usando a chave pública (sem login):
// cada tabela deve EXISTIR e estar BLOQUEADA para visitantes.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const tables = ["items", "item_occurrences", "exams", "exam_topics", "user_settings", "import_batches"];
let ok = true;

const settings = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })).json();
console.log(settings.disable_signup ? "ok - cadastro público desativado" : "ATENÇÃO - cadastro público está ATIVADO");
ok &&= settings.disable_signup;

for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: key } });
  const body = await res.json().catch(() => ({}));
  if (body.code === "PGRST205") { console.log(`FALTA  - tabela ${t} não existe (rode a migração)`); ok = false; }
  else if (body.code === "42501" || res.status === 401 || res.status === 403) console.log(`ok - ${t}: existe e bloqueada para visitantes`);
  else if (Array.isArray(body) && body.length === 0) console.log(`ok - ${t}: existe; visitante não vê linhas`);
  else { console.log(`ATENÇÃO - ${t}: resposta inesperada ${res.status} ${JSON.stringify(body).slice(0, 120)}`); ok = false; }
}

const ins = await fetch(`${url}/rest/v1/items`, {
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "tarefa", title: "teste", category: "estudo", date: "2026-01-01" }),
});
console.log(ins.status >= 400 ? `ok - visitante não consegue gravar (HTTP ${ins.status})` : "ATENÇÃO - visitante conseguiu gravar!");
ok &&= ins.status >= 400;
process.exit(ok ? 0 : 1);
