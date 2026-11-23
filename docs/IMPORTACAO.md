# Importar planejamento

Tela **Importar** (barra inferior no celular). Fluxo: **material → prévia editável → confirmação**.

## Entradas aceitas (v1)

- **Texto colado** — de e-mail, WhatsApp, site da faculdade, planilha (colunas separadas por tabulação).
- **PDF com texto selecionável** — lido no próprio aparelho com pdf.js; o texto extraído aparece
  para conferência/correção antes da análise. Tabelas viram linhas com colunas separadas por " | ".
- **PDF de grade semanal** (dias nas colunas, horários nas linhas, células coloridas — como o cronograma
  da FAMED/UNINTA): lido pela **geometria da página** — ver seção abaixo.
- PDF digitalizado (imagem) → aviso; OCR/IA ficam para uma versão futura
  (`src/lib/import/extractors.ts` já tem os extratores previstos, desativados).

## O que é reconhecido

| Elemento | Exemplos |
|---|---|
| Dias da semana | `Segunda`, `terça-feira`, `SEG`, `Qua e Sex`, `3ª feira`, linha só com o dia como cabeçalho |
| Datas | `12/03`, `12/03/2026`, `12-03-26`, `12 de março`, linha só com a data como cabeçalho |
| Horários | `07:30-09:10`, `8h às 10h`, `das 14h30 até 16h`, `às 19h`, `08:00 \| 09:40` |
| Local | `Sala 104`, `Auditório 2`, `Lab. …`, `Centro de Simulação`, `Local: …`, entre parênteses |
| Tipo | prova (`prova`, `avaliação`, `N1`, `OSCE`…), tarefa (`entrega`, `ler`, `revisar`…), senão evento |
| Categoria | tutoria, prática, estudo, aula, pessoal por palavras-chave (sinalizada quando deduzida) |
| Conteúdos | lista após `Conteúdos:` / `Assuntos:` / `Temas:`, ou na mesma linha separados por `;` ou `,` |

## Regras de segurança dos dados

- **Nada é inventado.** O que não está escrito fica vazio e sinalizado.
- Presunções ficam visíveis: ano não escrito ("Ano não informado: considerado 2026"), categoria deduzida.
- A data/dia de um cabeçalho vale **só até a próxima linha em branco**; "data a definir" nunca herda data.
- Itens com erro (sem título, prova sem data, horário inválido…) **bloqueiam** a importação até serem
  corrigidos ou desmarcados. Avisos (duplicata, conflito, presunções) não bloqueiam.
- **Duplicatas**: mesmo título + mesmo dia/data + mesmo horário de algo já existente ou repetido no material.
- **Conflitos**: horários sobrepostos com a agenda atual ou entre itens do próprio material.
- Atividades semanais usam o **período** escolhido na prévia (início obrigatório, fim opcional).
- Cada importação gera um **lote** (`import_batches`, com o texto original). Os itens ficam ligados ao
  lote e podem ser **desfeitos** de uma vez — logo após importar ou em "Importações recentes".

## Grade semanal em PDF

Detectada automaticamente quando a página tem os cabeçalhos SEGUNDA…SEXTA com datas (dd/mm) e
rótulos de horário (08:00 – 10:00…) na primeira coluna.

- Cada **célula colorida** (retângulo preenchido no PDF) vira uma atividade; células mescladas ocupam
  todas as faixas cobertas (ex.: prática das 14:00 às 18:00); células lado a lado ou empilhadas são separadas.
- **Ano** deduzido pelo dia da semana do cabeçalho (03/08 numa segunda ⇒ 2026; 01/01 numa sexta ⇒ 2027).
- Célula: disciplina, "Aula N"/"Class N", tipo (Conferência, Prática, Oficina, TBL, CBL, Extensão…), tema,
  **professores → observações**, "Local:" → local. Palavras quebradas em células estreitas são consertadas.
- **AIM, NAF, OSCE** → provas ("AIM 2 — Pediatria"). "Teste de Progresso"/"Teste de Resgate" → evento na cor de provas.
- "**ou**" → duas opções alternativas (escolha a sua; não contam como conflito entre si).
- Desmarcados por padrão: **atividades que já passaram**, **segundas chamadas**, **recessos/feriados**.
- Célula sem nome da disciplina → usa a **legenda de cores** da capa (com aviso).
- Na prévia: filtros (selecionados, desmarcados, com aviso), filtro por disciplina e marcar/desmarcar em massa.

Para conferir um PDF real sem colocá-lo no repositório:

```bash
LOCAL_PDF=/caminho/cronograma.pdf OUT=/tmp/relatorio.txt npx vitest run tests/local-pdf.test.ts
```

## Código

- `src/lib/import/parser.ts` — leitor (funções puras, testes em `tests/import.test.ts`)
- `src/lib/import/review.ts` — duplicatas, conflitos, validação, conversão para itens/provas
- `src/lib/import/extractors.ts` — texto/PDF (e futuros OCR/IA)
- `src/lib/import/grid.ts` — grade semanal (colunas, faixas, células, interpretação; testes em `tests/grid.test.ts`)
- `src/lib/import/pdf-geometry.ts` — retângulos preenchidos a partir das operações de desenho do PDF
- `src/components/import/import-view.tsx` — tela
