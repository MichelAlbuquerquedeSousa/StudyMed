# Configuração do Supabase

Projeto: `qgrsoqmpdijuvoelhozr` · Plano gratuito.

## 1. Criar as tabelas (uma vez)

1. Abra o painel do Supabase → **SQL Editor** → **New query**.
2. Cole **todo** o conteúdo de [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
3. Clique em **Run**. Deve aparecer "Success. No rows returned".

Para conferir (no computador, com o projeto baixado):

```bash
npm run check:supabase
```

Ele confirma que o cadastro público está desativado, que cada tabela existe e que um visitante
sem login não lê nem grava nada.

## 2. Criar a sua conta

Como o cadastro público está desativado, a conta é criada pelo painel:

1. **Authentication → Users → Add user → Create new user**.
2. Informe seu e-mail e uma senha forte.
3. Marque **Auto Confirm User** e clique em **Create user**.

## 3. Endereços permitidos (para "Esqueci minha senha")

**Authentication → URL Configuration**:

- **Site URL**: o endereço onde o app ficar publicado (ex.: `https://studymed-seu-nome.vercel.app`).
  Enquanto não houver deploy, use `http://localhost:3000`.
- **Redirect URLs**: adicione
  - `http://localhost:3000/**`
  - `https://SEU-ENDERECO.vercel.app/**` (quando existir)

O link de redefinição deve ser aberto **no mesmo navegador** em que você pediu a recuperação.

> O e-mail de recuperação usa o servidor de e-mails embutido do Supabase, que tem limite
> de poucos envios por hora no plano gratuito — suficiente para uso pessoal.

## 4. Variáveis de ambiente

O arquivo `.env.local` (não vai para o Git) contém:

```
NEXT_PUBLIC_SUPABASE_URL=https://qgrsoqmpdijuvoelhozr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A chave *publishable* é pública por design (vai para o navegador). Quem protege os dados é o RLS.
**Nunca** coloque no app a chave `service_role`/`secret`.

No deploy (Vercel), cadastre as mesmas duas variáveis em **Settings → Environment Variables**.

## Segurança — resumo

| Camada | O que faz |
|---|---|
| Cadastro desativado | Ninguém além de você cria conta |
| RLS em todas as tabelas | Cada linha só é visível/alterável pela dona (`user_id = auth.uid()`) |
| Chaves estrangeiras compostas | Impossível anexar ocorrências/conteúdos a itens de outra conta |
| `anon` sem privilégios | Visitante sem login não acessa nenhuma tabela |
| Proxy do Next.js | Redireciona quem não está logado para `/login` (conveniência; a proteção real é o RLS) |

Testes locais das regras (Postgres temporário, sem tocar no projeto real):

```bash
npm run test:db
```
