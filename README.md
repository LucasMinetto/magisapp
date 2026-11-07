# Magistrado

App de desktop do mestre de **Ordem Paranormal RPG**. Prepara e conduz a mesa num lugar só: cenas com hora no jogo, linha do tempo, pistas, quadros, sessão, backup e exportação, a ficha do agente calculada pelas regras do livro, a rolagem com dados físicos e a biblioteca de ameaças, itens e rituais dos livros.

## O que faz

- **Preparar:** campanha com a data do caso; fichas de agentes, NPCs, ameaças, locais, grupos e lore; cenas com hora no jogo e lugar; linha do tempo com eventos e lacunas; pistas com quem achou e quando; quadros (mapa mental); arquivos (PDF da aventura, mapas, tokens). Nomes de fichas no texto viram ligação sozinhos.
- **Ficha do agente:** classe, NEX, atributos e perícias calculam PV, PE, SAN, Defesa, Esquiva, Bloqueio e DT de ritual pelas regras do livro. Ataques, rituais, habilidades, inventário com limite por patente e carga.
- **Rolagem:** o jogador rola os dados físicos e o mestre digita o que saiu, ou o app rola. Teste pelo maior (ou menor) d20, dano por tipo, crítico só nos dados da arma. Tudo fica no histórico da ficha e da sessão.
- **Biblioteca:** ameaças, rituais e itens dos livros *Ordem Paranormal RPG* e *Sobrevivendo ao Horror*, com tokens e página, mais as criações do mestre. Cada registro tem uma origem; uma origem (ou tudo) vira um pacote para levar a outro computador ou mandar a outro mestre.
- **Regras:** as regras dos livros com sumário, busca e página.
- **Sessão:** modo cena (quem está na cena, PV/PE/SAN à mão, pistas, notas) e modo combate (iniciativa, fichas das ameaças fixas na tela, um cartão por agente).
- **Guardar e levar:** backup automático em zip, que abre no Obsidian sem o app; exportar para PDF, Word, texto ou pasta do Obsidian, na versão do mestre ou dos jogadores. Desfazer e lixeira em tudo.
- **Versões:** o app avisa quando há versão nova e se atualiza sozinho.

Offline, um usuário, sem conta. Nada sai do computador.

O planejamento está em [docs/magistrado](docs/magistrado/).

## Rodar

No PowerShell deste PC o `npm.ps1` é bloqueado; use `npm.cmd`.

```bash
cd app
npm.cmd install
npm.cmd run dev
```

## Verificar

```bash
cd app
npm.cmd run typecheck
npm.cmd test
npm.cmd run build && node e2e/slice.mjs
```

## Versões

A versão instalada está em `app/package.json` e o histórico em [HISTORICO.md](HISTORICO.md). O app avisa quando há versão nova no GitHub e se atualiza pelo git (Ajustes → Versão do Magistrado). Para publicar uma versão, veja [docs/magistrado/VERSOES.md](docs/magistrado/VERSOES.md).

## Pastas

- `app/`: o app Electron (React, SQLite).
- `tools/livros/`: extrai dos PDFs dos livros os rituais, itens, ameaças e regras (`python extrair.py <livro básico> <Sobrevivendo ao Horror>`). Os PDFs não vão para o git. `python tokens.py <pasta Ameaças>` reduz as imagens das ameaças para `app/resources/livros-tokens/`.
- `design/`: tokens de cor e tipo, temas e o teste de contraste (`contrast.py`).
- `docs/arquitetura/`: arquitetura de partida e esquema do banco.
- `docs/magistrado/`: PRD, especificação técnica, tarefas e memória do projeto.
