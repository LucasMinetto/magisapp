# Magistrado

App de desktop do mestre de **Ordem Paranormal RPG**. Prepara e conduz a mesa num lugar só: cenas com hora no jogo, linha do tempo, pistas, quadros, sessão, backup e exportação, a ficha do agente calculada pelas regras do livro, a rolagem com dados físicos e a biblioteca de ameaças, itens e rituais dos livros.

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
