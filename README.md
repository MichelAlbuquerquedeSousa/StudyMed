# StudyMed

Planner acadêmico pessoal (PWA) para a rotina da faculdade de Medicina.
Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase (a partir da Etapa 2).

> **Etapa atual: 2 — Supabase, login e sincronização.** Os dados ficam no Supabase,
> protegidos por RLS, e sincronizam entre computador, iPhone e tablet.
> Configuração passo a passo: [`docs/CONFIGURACAO-SUPABASE.md`](docs/CONFIGURACAO-SUPABASE.md).

Arquitetura, modelo de dados e plano de etapas: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Rodar localmente

Requisitos: Node.js 20.9+ (testado com 22).

```bash
npm install
cp .env.example .env.local   # e preencha com os dados do Supabase
npm run dev                  # http://localhost:3000
```

Para testar no iPhone/tablet na mesma rede Wi-Fi: `npm run dev -- -H 0.0.0.0` e abra
`http://IP-DO-COMPUTADOR:3000` no aparelho.

## Verificações

```bash
npm test               # testes unitários (datas/fuso, recorrência, progresso, conversões banco ↔ app)
npm run test:db        # regras de segurança (RLS) num Postgres temporário local
npm run check:supabase # confere o projeto Supabase real (tabelas criadas e bloqueadas para visitantes)
npm run lint
npm run typecheck
npm run build
```

## Etapa 2

- Login com e-mail e senha, "esqueci minha senha", sair; rotas protegidas.
- Dados no Supabase com RLS; sincronização em tempo real entre aparelhos.
- Atualização otimista com aviso e recarga automática em caso de falha.
- Dados de exemplo opcionais (carregar/remover em Ajustes), sempre marcados como fictícios.

## Etapa 1

- **Dashboard**: saudação, "acontecendo agora / a seguir", programação do dia, tarefas pendentes
  (atrasadas, hoje, próximos dias), próximas provas com contagem regressiva, progresso de estudos,
  atalhos rápidos.
- **Agenda**: visões Dia, Semana e Mês; blocos coloridos por categoria; eventos sobrepostos lado a lado;
  linha do "agora"; filtro por categoria; toque num horário vazio para adicionar.
- **Tarefas**: pendentes e concluídas, agrupadas por dia; checkboxes grandes com microanimação.
- **Provas**: lista cronológica, dias restantes, % concluída; detalhe com checklist de conteúdos
  (marcar, adicionar, renomear, reordenar, excluir).
- **Nova atividade** (botão + sempre visível): tarefa ou evento fixo, categoria, data, horário,
  local e repetição semanal.
- **Ajustes**: tema claro/escuro/automático e cores das categorias personalizáveis (com aviso de contraste).
- Fuso **America/Fortaleza** em todos os cálculos, mesmo com o aparelho em outro fuso.
