# PROJECT_MEMORY: Magistrado

> [PRD.md](PRD.md) · [TECH_SPEC.md](TECH_SPEC.md) · [TASKS.md](TASKS.md)

## Propósito e status

- **O que é:** app de desktop do mestre de Ordem Paranormal. Junta o **autore** (a base) com a ficha do agente, a rolagem com dados físicos e os modelos de ameaças, itens e rituais do **taberna**.
- **Status (2026-11-07):** T1 a T9 e P1 concluídas: Biblioteca com ameaças, rituais e itens dos dois livros (com página e tokens) e a tela Regras. 127 testes e e2e 153/153. Faltam T10 a T13.
- **Status (2026-11-03):** T1 a T8 concluídas. Ficha completa com janela de rolagem; tela Biblioteca com ameaças no formato do livro (origem, trazer para a campanha); a ficha de ameaça edita o bloco em `sheet_data` e a Sessão mostra o bloco. 116 testes e e2e 142/142. Faltam rituais e itens da biblioteca (T9) e a Sessão com iniciativa (T10). As cópias dos dois projetos estão em `_fontes/` (fora do git).

## Restrições confirmadas

- **Repositório novo.** Não alterar nem dar push em `LucasMinetto/autore` e `LucasMinetto/taberna` no GitHub. As cópias locais em `_fontes/` podem ser usadas e modificadas.
- Só o mestre usa. É offline e sem servidor. A versão dos jogadores fica para depois.
- A ficha tem o **layout do RPGpédia** com os **tokens, as fontes e os temas do autore**.
- Fora do escopo: tela Livros, campanhas e missões do taberna, importar dados do taberna (não há dados, só modelos).
- **Próxima etapa depois da fusão:** extrair do livro de regras os dados de ameaças, itens e rituais e as regras para a tela Regras ([TASKS § P1](TASKS.md#depois-da-fusão-fora-deste-escopo-já-combinado), issue #14). Direcionar o dano ao alvo (antiga P3) foi juntado à P2 em 2026-11-04 (issue #13). A P2 está detalhada nas issues #1 a #13 e #15 e começa quando o Lucas pedir.

## Vocabulário

- **Agente:** personagem jogador de Ordem Paranormal (ficha com NEX, classe, trilha, origem, PV, PE, SAN).
- **Ameaça:** criatura ou inimigo no formato do livro (VD, Presença Perturbadora, ações).
- **Dados físicos:** os dados são rolados na mesa e os valores digitados no app, que faz as contas. No teste digita-se só o d20 que ficou; o dano é uma soma por tipo. A caixa "Rola dados físicos" de cada personagem escolhe entre digitar e o app rolar (T7 revisada em 2026-11-03).
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
- `npm.cmd run dev` · `npm.cmd run typecheck` · `npm.cmd test` (vitest) · `npm.cmd run build && node e2e/slice.mjs` (Playwright; o e2e usa o build em `out/`).
- O npm avisa que o script de instalação do better-sqlite3 não foi liberado: pode ignorar, o pacote traz o binário pronto em `prebuilds/`.
- Variáveis de teste: `MAGISTRADO_USER_DATA`, `MAGISTRADO_CAMPAIGNS_DIR`, `MAGISTRADO_BACKUP_DIR`.
- O computer use não controla o Electron de desenvolvimento: a verificação visual é feita com Playwright.

## Decisões

- Todas decididas em 2026-11-02, Q1 a Q7 ([TECH_SPEC § Decididas](TECH_SPEC.md#decididas-em-2026-11-02)). A Q5 trouxe o painel de iniciativa do taberna para a tela de sessão.
- Repositório: **github.com/LucasMinetto/magistrado** (vazio em 2026-11-02). Histórico do zero.
- Sem compatibilidade com `.mesa` (não há campanhas reais).
- `replica/` (arquitetura e design herdados) fica com esse nome: o e2e grava em `replica/clone-screens/` e os scripts de tokens citam `replica/design`.
- O rótulo "Mesa" do menu lateral e as frases "na mesa" são mesa de jogo e ficam.
- **Modelo da ficha (T4):** agente = `is_player`; `sheet` (compacta/completa); ficha completa e bloco de ameaça em `sheet_data`, montados de `stats` enquanto não editados (ver [TECH_SPEC § Modelo de dados](TECH_SPEC.md#modelo-de-dados-novo-migração-4)).
- **Biblioteca:** `%APPDATA%/Magistrado/biblioteca.sqlite` (`app/src/main/library.ts`), aberta só quando pedida.
- Git local com identidade `Lucas <lucasminetto13@gmail.com>` só neste repositório.

## Dados dos livros

- **PDFs (fora do git):** `C:/Users/lucas/Meu Drive/RPG/Livros/Ordem Paranormal RPG v1-3.pdf` (332 p.; página impressa = PDF − 10) e `Sobrevivendo-ao-Horror-v1-3.pdf` (226 p.; impressa = PDF − 1).
- **Regerar:** `cd tools/livros` e `python extrair.py "<OP.pdf>" "<SaH.pdf>"` (precisa de `pip install pymupdf`). Mudou os JSON? Suba `LIVROS_VERSAO` em `app/src/main/livros/index.ts`.
- **Tokens do Lucas:** `C:/Users/lucas/Meu Drive/RPG/Ameaças` (pasta por elemento e por criatura). Não vão para o git.

## Próximo passo

T10 (Sessão com PV das ameaças, rolagem e iniciativa). A P2 (jogadores, com a antiga P3) começa quando o Lucas pedir: issues #1 a #13 e #15.
