# Importar planejamento

Tela **Importar** (barra inferior no celular). Fluxo: **material → prévia editável → confirmação**.

## Entradas aceitas (v1)

- **Texto colado** — de e-mail, WhatsApp, site da faculdade, planilha (colunas separadas por tabulação).
- **PDF com texto selecionável** — lido no próprio aparelho com pdf.js; o texto extraído aparece
  para conferência/correção antes da análise. Tabelas viram linhas com colunas separadas por " | ".
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

## Código

- `src/lib/import/parser.ts` — leitor (funções puras, testes em `tests/import.test.ts`)
- `src/lib/import/review.ts` — duplicatas, conflitos, validação, conversão para itens/provas
- `src/lib/import/extractors.ts` — texto/PDF (e futuros OCR/IA)
- `src/components/import/import-view.tsx` — tela
