# StudyMed — Arquitetura, modelo de dados e etapas

## 1. Visão geral

```
┌──────────────────────── Dispositivos ────────────────────────┐
│  iPhone (Safari/PWA)   Tablet Samsung (Chrome/PWA)   Desktop │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────┐      ┌─────────────────────────┐
│ Next.js 16 (App Router)     │      │ Supabase (plano gratuito)│
│  • UI React + Tailwind 4    │◄────►│  • Auth (e-mail + senha │
│  • Store local (Zustand)    │ supa │    ou link mágico)      │
│  • Camada de repositório    │ base │  • Postgres + RLS        │
│  • Parser de importação     │  -js │  • Realtime (sincroniza) │
│    (roda no navegador)      │      └─────────────────────────┘
│  • Service worker (PWA)     │
└─────────────────────────────┘
Hospedagem: Vercel (plano Hobby, gratuito) ou qualquer host Node.
```

### Decisões principais

| Tema | Decisão | Motivo |
|---|---|---|
| Renderização | Telas do app são Client Components; servidor entrega só o "casco" | Dados são privados e vêm do Supabase direto do navegador, protegidos por RLS. Simplifica PWA/offline. |
| Estado | Zustand com interface de repositório (`mock` → `supabase`) | A Etapa 1 usa dados fictícios; a Etapa 2 troca a implementação sem reescrever telas. |
| Datas | Datas como `YYYY-MM-DD` e horas como `HH:mm`, sempre no fuso **America/Fortaleza** | Rotina acadêmica é "hora de parede" local. Fortaleza não tem horário de verão (UTC−3 fixo). "Hoje" é calculado em Fortaleza mesmo que o aparelho esteja em outro fuso. |
| Recorrência | Regra semanal simples (dias da semana + início/fim) + exceções por ocorrência | Cobre horários de faculdade sem a complexidade de RRULE completo. |
| Conclusão de tarefas recorrentes | Tabela separada por ocorrência | Concluir "Revisão de Fisiologia" desta terça não marca as próximas. |
| Importação | Extração de texto no navegador (pdf.js) + parser por regras → prévia editável → confirmação | Gratuito, sem enviar documentos a terceiros. Interface `Extractor` permite plugar OCR/IA depois. |
| Autenticação | Supabase Auth, cadastro público desativado, RLS `user_id = auth.uid()` em todas as tabelas | Uso exclusivamente pessoal. |
| PWA | `manifest.webmanifest` + service worker próprio (cache do casco) | Instalável no iPhone (Adicionar à Tela de Início) e Android. |
| Custo | Supabase Free + Vercel Hobby + bibliotecas open source | Nenhum serviço pago na v1. |

## 2. Estrutura de pastas

```
src/
  app/
    (app)/            # telas com casco (sidebar/tab bar)
      page.tsx        # Dashboard
      calendario/     # dia | semana | mês
      tarefas/
      provas/ [id]/
      importar/
      ajustes/
    login/            # (Etapa 2)
  components/
    ui/               # Checkbox, Card, ProgressBar, Sheet, Button...
    calendar/         # DayView, WeekView, MonthView, EventBlock
    exams/  tasks/  dashboard/  layout/
  lib/
    time.ts           # fuso America/Fortaleza, helpers de data
    recurrence.ts     # expansão de recorrências
    exams.ts          # progresso, contagem regressiva
    conflicts.ts      # conflitos/duplicatas (usado na importação)
    categories.ts     # categorias e cores padrão
    import/           # (Etapa 5) extractors + parser
  store/              # Zustand + repositório
  data/mock.ts        # dados fictícios (Etapa 1)
supabase/migrations/  # SQL versionado (Etapa 2)
```

## 3. Modelo de dados (Postgres / Supabase)

Todas as tabelas têm `user_id uuid not null default auth.uid()` e RLS
`using (user_id = auth.uid()) with check (user_id = auth.uid())`.
Tabelas filhas usam chave estrangeira composta `(pai_id, user_id)`, garantindo que
ocorrências e conteúdos só se liguem a itens/provas da mesma conta.
SQL completo: `supabase/migrations/0001_init.sql`.

```
items                 id, user_id,
                      kind ('evento' | 'tarefa'),          -- fixo x concluível
                      title, category ('aula'|'pratica'|'tutoria'|'estudo'|'pessoal'|'prova'),
                      date (date) ?,                       -- itens avulsos
                      start_time (time)?, end_time (time)?,-- null = dia inteiro / sem horário
                      location?, notes?,
                      recurrence jsonb?                    -- {freq:'weekly', weekdays:[1,3], starts_on, ends_on?}
                      done_at timestamptz?,                -- conclusão de tarefa avulsa
                      source ('manual'|'importado'), import_batch_id?,
                      created_at, updated_at
item_occurrences      id, user_id, item_id, occurrence_date (date),
                      done, cancelled, move_date?, move_start_time?, move_end_time?
                      unique (item_id, occurrence_date)
exams                 id, user_id, subject, title, date, start_time?, location?, notes?
exam_topics           id, user_id, exam_id → exams (cascade), title,
                      done boolean, done_at?, position int
import_batches        id, user_id, source_type ('texto'|'pdf'|'imagem'),
                      file_name?, raw_text, status ('rascunho'|'confirmado'|'descartado'),
                      created_at                            -- permite desfazer uma importação
user_settings         user_id (pk), category_colors jsonb, week_starts_on
                      (o tema claro/escuro fica em cada aparelho)
```

Progresso de uma prova = `count(done) / count(*)` dos `exam_topics` (calculado no app;
uma *view* `exam_progress` pode ser adicionada para consultas).

## 4. Importação (Etapa 5)

```
Arquivo/Texto ──► Extractor ──► texto bruto ──► Parser ──► Candidatos ──► Prévia editável ──► Confirmação ──► insert
                  ├ TextExtractor (v1)            regras:            com flags:          (usuário corrige)    em lote,
                  ├ PdfTextExtractor (v1, pdf.js) datas, horas,      • ambíguo                                 ligado ao
                  ├ OcrExtractor (futuro)         dias da semana,    • incompleto                              import_batch
                  └ AiExtractor (futuro)          disciplinas,       • duplicata
                                                  categorias         • conflito de horário
```
Regra de ouro: **o parser nunca inventa** — campos não encontrados ficam vazios e marcados.

## 5. Etapas

| # | Etapa | Entrega | Verificação |
|---|---|---|---|
| 1 | ✅ Interface com dados fictícios | Casco responsivo, tema claro/escuro, Dashboard, Calendário (dia/semana/mês), Tarefas, Provas (checklist + %), personalização de cores | Testes unitários (datas, recorrência, progresso), lint, build, capturas em iPhone/tablet/desktop |
| 2 | ✅ Supabase: schema + RLS + autenticação | Migrações SQL, login, proteção de rotas, repositório Supabase, sincronização | Testes de RLS (usuário anônimo não lê nada), login real |
| 3 | Cadastro manual completo | Formulários de evento/tarefa/prova/conteúdo, recorrência, reagendar, reordenar (arrastar) | Testes de formulário e de recorrência com exceções |
| 4 | PWA | Manifest, ícones, service worker, ajustes iOS | Lighthouse PWA, instalação no iPhone/Android |
| 5 | Importação | Texto + PDF, prévia editável, ambiguidades, duplicatas, conflitos, confirmação | Testes do parser com roteiros reais anonimizados |

## 6. Sincronização (Etapa 2)

- Ao abrir: mostra o cache local (abre rápido, inclusive offline) e busca tudo do Supabase.
- Ao alterar: a tela muda na hora (otimista) e a gravação vai para o Supabase; se falhar,
  aparece um aviso e os dados são recarregados do servidor.
- Entre aparelhos: Supabase Realtime avisa sobre mudanças; o app também recarrega ao voltar
  para a aba/app e ao reconectar à internet.
- O volume de dados de uma pessoa é pequeno, então cada recarga busca tudo (simples e consistente).
