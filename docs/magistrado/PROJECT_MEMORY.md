# PROJECT_MEMORY: Magistrado

> [PRD.md](PRD.md) · [TECH_SPEC.md](TECH_SPEC.md) · [TASKS.md](TASKS.md)

## Propósito e status

- **O que é:** app de desktop do mestre de Ordem Paranormal. Junta o **autore** (a base) com a ficha do agente, a rolagem com dados físicos e os modelos de ameaças, itens e rituais do **taberna**.
- **Status (2026-11-02):** intenção confirmada e documentos criados. **Nada implementado.** As cópias dos dois projetos estão em `_fontes/`.

## Restrições confirmadas

- **Repositório novo.** Não alterar nem dar push em `LucasMinetto/autore` e `LucasMinetto/taberna` no GitHub. As cópias locais em `_fontes/` podem ser usadas e modificadas.
- Só o mestre usa. É offline e sem servidor. A versão dos jogadores fica para depois.
- A ficha tem o **layout do RPGpédia** com os **tokens, as fontes e os temas do autore**.
- Fora do escopo: tela Livros, campanhas e missões do taberna, importar dados do taberna (não há dados, só modelos).
- **Próxima etapa depois da fusão:** extrair do livro de regras os dados de ameaças, itens e rituais ([TASKS § P1](TASKS.md#depois-da-fusão-fora-deste-escopo-já-combinado)).

## Vocabulário

- **Agente:** personagem jogador de Ordem Paranormal (ficha com NEX, classe, trilha, origem, PV, PE, SAN).
- **Ameaça:** criatura ou inimigo no formato do livro (VD, Presença Perturbadora, ações).
- **Dados físicos:** os dados são rolados na mesa e os valores digitados no app, que faz as contas.
- **Campanha:** uma pasta com banco SQLite e anexos (herdado do autore).
- **Biblioteca:** lugar **único**, compartilhado por todas as campanhas, com ameaças, itens e rituais. Cada registro tem uma **origem** (livro oficial, criação própria, outro livro). Usar na campanha copia o registro.
- **Ficha completa / compacta:** os agentes (jogadores) e os NPCs vilões usam a completa; os outros NPCs usam a compacta.
- **Ameaças:** o nome fica "Ameaças" (substitui "Criaturas" do autore).

## Arquitetura (resumo)

- Electron + React 19 + SQLite (better-sqlite3), IPC validado com zod. Detalhes em [TECH_SPEC § Sistema atual](TECH_SPEC.md#sistema-atual) e em `_fontes/autore/replica/architecture.md`.
- O taberna é **portado** (regras, esquemas, telas), não acoplado. O servidor Fastify dele não entra.

## Comandos (do autore, valem para `app/`)

- No PowerShell deste PC o `npm.ps1` é bloqueado: usar **`npm.cmd` / `npx.cmd`**.
- `npm.cmd install`: o Electron é baixado no `postinstall`.
- `npm.cmd run dev` · `npm.cmd run typecheck` · `npm.cmd test` (vitest) · `node e2e/slice.mjs` (Playwright).
- O computer use não controla o Electron de desenvolvimento: a verificação visual é feita com Playwright.

## Decisões

- Todas decididas em 2026-11-02, Q1 a Q7 ([TECH_SPEC § Decididas](TECH_SPEC.md#decididas-em-2026-11-02)). A Q5 trouxe o painel de iniciativa do taberna para a tela de sessão.
- Repositório: **github.com/LucasMinetto/magistrado** (vazio em 2026-11-02). Histórico do zero.
- Sem compatibilidade com `.mesa` (não há campanhas reais).

## Próximo passo

T1 (criar o repositório a partir do autore) e T2 (renomear) estão liberadas. Para executar, usar `planning-with-files` (tarefa longa, várias sessões).
