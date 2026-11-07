# Magistrado

App de desktop do mestre de **Ordem Paranormal RPG**. Prepara e conduz a mesa num lugar só: cenas com hora no jogo, linha do tempo, pistas, quadros, sessão, backup e exportação, e (em construção) a ficha do agente calculada pelas regras do livro, a rolagem com dados físicos e a biblioteca de ameaças, itens e rituais.

Nasceu da junção de dois projetos:

- **autore** (`autore@28fa658`): a base. Todo o app de mestre veio daqui.
- **taberna** (`taberna@71f7b1c`): a ficha do agente, as regras, a rolagem e os modelos de ameaças, itens e rituais, que estão sendo portados.

Os repositórios originais continuam como estão. O planejamento está em [docs/magistrado](docs/magistrado/).

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

## Pastas

- `app/`: o app Electron (React, SQLite).
- `tools/livros/`: extrai dos PDFs dos livros os rituais, itens, ameaças e regras (`python extrair.py <livro básico> <Sobrevivendo ao Horror>`). Os PDFs não vão para o git.
- `replica/`: arquitetura, esquema e o design (tokens, temas, `contrast.py`) herdados do autore.
- `docs/magistrado/`: PRD, especificação técnica, tarefas e memória do projeto.
