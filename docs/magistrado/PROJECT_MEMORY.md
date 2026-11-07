# PROJECT_MEMORY: Magistrado

> [PRD.md](PRD.md) · [TECH_SPEC.md](TECH_SPEC.md) · [TASKS.md](TASKS.md)

## Propósito e status

- **O que é:** app de desktop do mestre de Ordem Paranormal. Junta o **autore** (a base) com a ficha do agente, a rolagem com dados físicos e os modelos de ameaças, itens e rituais do **taberna**.
- **Status (2026-11-07, conferência):** dados e regras conferidos contra os dois livros (C1 no TASKS). 161 testes e e2e 195/195. A lista do que o livro manda e o app ainda não aplica espera a escolha do Lucas.
- **Status (2026-11-07, T11–T12):** fusão fechada. Repositório só com o Magistrado (sem `_fontes/` nem `replica/`). Backup, cofre e exportar com a ficha do agente, o bloco da ameaça, rituais, itens, iniciativa e rolagens; biblioteca exporta e importa por origem. Ajuda e README. 158 testes e e2e 195/195. Falta a T13 (teste de mesa do Lucas).
- **Status (2026-11-07, #18):** combate redesenhado (ameaças fixas com cópias agrupadas, cartões dos agentes com arsenal, destaque da vez, ganchos da #13). 147 testes e e2e 185/185. Vai na 0.10.0.
- **Status (2026-11-07, T10b):** a Sessão tem dois modos, cena (faixa do grupo, cena larga, abas Pistas · Notas · NPCs) e combate (ordem à esquerda, cartão com tudo do combatente à direita). 138 testes e e2e 181/181.
- **Status (2026-11-07, T10):** T1 a T10 e P1 concluídas. A Sessão conduz o combate: iniciativa salva na sessão de jogo, PV de cada cópia de ameaça, PV/PE/SAN dos agentes e rolagem por perícia, teste ou ação do bloco. 138 testes e e2e 176/176. Faltam T11 a T13.
- **Status (2026-11-07):** T1 a T9 e P1 concluídas: Biblioteca com ameaças, rituais e itens dos dois livros (com página e tokens) e a tela Regras. 127 testes e e2e 153/153. Faltam T10 a T13.
- **Status (2026-11-03):** T1 a T8 concluídas. Ficha completa com janela de rolagem; tela Biblioteca com ameaças no formato do livro (origem, trazer para a campanha); a ficha de ameaça edita o bloco em `sheet_data` e a Sessão mostra o bloco. 116 testes e e2e 142/142. Faltam rituais e itens da biblioteca (T9) e a Sessão com iniciativa (T10).

## Restrições confirmadas

- **Repositório novo.** Não alterar nem dar push em `LucasMinetto/autore` e `LucasMinetto/taberna` no GitHub. As cópias locais (`_fontes/`) foram apagadas em 2026-11-07, com a fusão concluída; o código dos originais fica no GitHub.
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

- Electron + React 19 + SQLite (better-sqlite3), IPC validado com zod. Detalhes em [TECH_SPEC § Sistema atual](TECH_SPEC.md#sistema-atual) e em `docs/arquitetura/arquitetura.md`.
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
- **Pastas (2026-11-07):** `replica/` saiu. O design (tokens, contraste) está em `design/`, a arquitetura e o esquema em `docs/arquitetura/`, e as capturas do e2e em `app/e2e/capturas/` (fora do git). Os documentos de engenharia reversa do autore (recon, research, build-log, features.csv) saíram; estão no histórico do git.
- O rótulo "Mesa" do menu lateral e as frases "na mesa" são mesa de jogo e ficam.
- **Modelo da ficha (T4):** agente = `is_player`; `sheet` (compacta/completa); ficha completa e bloco de ameaça em `sheet_data`, montados de `stats` enquanto não editados (ver [TECH_SPEC § Modelo de dados](TECH_SPEC.md#modelo-de-dados-novo-migração-4)).
- **Biblioteca:** `%APPDATA%/Magistrado/biblioteca.sqlite` (`app/src/main/library.ts`), aberta só quando pedida. Desde a T11 não há mais restaurar biblioteca: o que vai e vem é o pacote por origem (`.magistrado-biblioteca`), que casa origem e registro pelo id e depois pelo nome.
- **Combate (T10):** a iniciativa fica em `game_sessions.initiative` (por sessão de jogo). Cada ameaça entra como cópia com PV próprio no combatente (`pv`); o agente entra uma vez e usa o PV da ficha. Testes do bloco são lidos de "2d20+5" ou "2O+5" (`app/src/shared/ordem/sessao.ts`). Rolagens da Sessão gravam a sessão de jogo. Desde a T10b o combatente também guarda `condicoes` (as do agente com ficha completa ficam na ficha). Desde a #18 a iniciativa guarda `desafixadas` (chave do grupo = ficha) e a tela separa agentes de jogadores (`isPlayer`) do resto.
- Git local com identidade `Lucas <lucasminetto13@gmail.com>` só neste repositório.
- **Versões (2026-11-07):** número maior.menor.correção, publicado com `tools/publicar-versao.ps1` (`versao.json`, `HISTORICO.md`, tag e release). 0.9.0 = T1–T10b + P1; 1.0.0 = fusão fechada (T1–T12), publicada em 2026-11-07 antes da T13, a pedido do Lucas. Sem instalador: o app se atualiza pelo git (`app/src/main/atualizacao.ts`), no modelo do TEC. Ver [VERSOES.md](VERSOES.md).

## Dados dos livros

- **PDFs (fora do git):** `C:/Users/lucas/Meu Drive/RPG/Livros/Ordem Paranormal RPG v1-3.pdf` (332 p.; página impressa = PDF − 10) e `Sobrevivendo-ao-Horror-v1-3.pdf` (226 p.; impressa = PDF − 1).
- **Regerar:** `cd tools/livros` e `python extrair.py "<OP.pdf>" "<SaH.pdf>"` (precisa de `pip install pymupdf`). Mudou os JSON? Suba `LIVROS_VERSAO` em `app/src/main/livros/index.ts` e gere `livros/anteriores.json` com os registros que mudaram, como eram na versão anterior (a biblioteca troca os não editados).
- **Tokens das ameaças:** arte dos livros, vem com o app. Origem: `C:/Users/lucas/Meu Drive/RPG/Ameaças`. Regerar: `python tools/livros/tokens.py "<pasta Ameaças>"` (precisa de Pillow); a ligação arquivo → ameaça é a tabela `LIGACOES` do script. Saída: `app/resources/livros-tokens/*.webp` e `app/src/main/livros/tokens.json` (vão para o git). Mudou? Suba `LIVROS_VERSAO`.

## Próximo passo

T13: o Lucas conduz uma sessão só no Magistrado, já na 1.0.0; depois #13 (dano ao alvo, já com os ganchos) e #17. A P2 (jogadores) fica por último, a pedido do Lucas (2026-11-07): issues #1 a #12 e #15.
