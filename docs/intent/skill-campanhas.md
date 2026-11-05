# Intenção: skill de criação de campanhas

> Confirmada com o Lucas em 2026-11-05 (entrevista). Issue relacionada: [#17](https://github.com/LucasMinetto/magistrado/issues/17).

- **Resultado:** um `SKILL.md` **portátil**, que o Lucas anexa ou cola em qualquer chatbot (Claude, Codex, Ollama). A skill monta a campanha com ele, entrevistando uma pergunta por vez, em dois modos:
  - **Campanha:** arco, facções e missões esboçadas, mais a primeira missão pronta para jogar.
  - **One-shot:** uma missão fechada, com começo, meio e fim.
- **Entrega:**
  - Campanha nova: `campanha.json` no formato que o app grava hoje (`formato: 1`; o dump das tabelas que o app restaura), com cenas (hora no jogo e descrição), pistas ligadas às cenas, NPCs e a ameaça com ficha.
  - Campanha em andamento: a skill lê os dados e o registro das sessões que o Lucas anexar e entrega a próxima missão como **roteiro em Markdown**.
  - Sempre: `memoria-<campanha>.md` (o que aconteceu, decisões, NPCs, pistas e ganchos abertos) e `regras-<campanha>.md` (tom, vetos, regras da casa, estilo), atualizados ao fim de cada conversa e reanexados no chat seguinte.
- **Usuário:** só o Lucas, por enquanto. Publicar fica para depois.
- **Sucesso:** a campanha abre no Magistrado sem digitar nada à mão. Num chat novo, com a memória anexada, a skill continua sem reexplicar.
- **Limites do chat:** a skill não pressupõe limitações. Se o chat não consegue algo de que ela precisa (ler arquivos, calcular, gerar o JSON), ela avisa e indica usar outra IA.
- **No app (#17):** tela para trazer os arquivos da skill: abrir um `campanha.json` solto (sem `.zip`) e acrescentar o roteiro `.md` a uma campanha aberta.
- **Fora do escopo:** publicar para clientes.
