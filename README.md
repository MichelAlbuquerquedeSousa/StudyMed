# StudyMed

Planner acadêmico pessoal (PWA) para a rotina da faculdade de Medicina.
Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase (a partir da Etapa 2).

> **Etapa atual: 1 — interface com dados fictícios.** Tudo o que aparece no app é
> demonstrativo (faixa amarela "Modo demonstração" no topo). Os dados ficam só no
> navegador (localStorage) até a Etapa 2.

Arquitetura, modelo de dados e plano de etapas: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Rodar localmente

Requisitos: Node.js 20.9+ (testado com 22).

```bash
npm install
npm run dev        # http://localhost:3000
```

Para testar no iPhone/tablet na mesma rede Wi-Fi: `npm run dev -- -H 0.0.0.0` e abra
`http://IP-DO-COMPUTADOR:3000` no aparelho.

## Verificações

```bash
npm test           # testes unitários (datas/fuso, recorrência, progresso, conflitos, contraste)
npm run lint
npm run typecheck
npm run build
```

## O que já funciona (Etapa 1)

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
