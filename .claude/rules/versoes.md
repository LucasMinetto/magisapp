# Versões do Magistrado

Toda entrega que vai para o uso do Lucas sai como versão numerada (maior.menor.correção), publicada com `tools/publicar-versao.ps1`. Não edite à mão o número no `package.json`, o `versao.json` nem o `HISTORICO.md`: o script faz isso.

- Correção sobe a correção (0.9.0 → 0.9.1); função ou tela nova sobe a menor (0.9.1 → 0.10.0). A 1.0.0 saiu em 2026-11-07 com a fusão fechada (T1–T12); a T13 é o teste de mesa dela.
- As notas de versão vão em português simples, uma linha por mudança que o mestre percebe.
- Ao terminar uma tarefa do `TASKS.md` ou uma issue, ofereça publicar a versão. Não publique sem o Lucas pedir.
- Quem roda o script pelo agente passa `-Rodape` com a linha de coautoria do commit.
- Detalhes em `docs/magistrado/VERSOES.md`.
