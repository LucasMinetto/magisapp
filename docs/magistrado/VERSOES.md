# Versões e atualização

O Magistrado usa número de versão **maior.menor.correção** (ex.: `1.0.0`), no mesmo modelo do TEC.

| Mudou o quê | Sobe | Exemplo |
|---|---|---|
| Correção de defeito, ajuste pequeno | correção | 0.9.0 → 0.9.1 |
| Função nova, tela nova | menor | 0.9.1 → 0.10.0 |
| Marco do projeto (1.0.0 = fusão fechada, T1–T12; o Lucas pediu a 1.0.0 antes do teste de mesa da T13) ou mudança que quebra campanhas antigas | maior | 0.12.0 → 1.0.0 |

## Onde fica

- **`app/package.json`**: a versão instalada (o app lê com `app.getVersion()`).
- **`versao.json`** (raiz): a última versão publicada, o `minimo` e as notas. É o que o app consulta.
- **`HISTORICO.md`** (raiz): todas as versões, da mais nova para a mais antiga.
- **Tag `vX.Y.Z`** e **release no GitHub** para cada versão.

## Publicar uma versão

Com tudo commitado no `main`:

```powershell
powershell -ExecutionPolicy Bypass -Command "& .\tools\publicar-versao.ps1 -Versao 0.9.1 -Notas 'Correção: rolagem de dano','Combate mostra a rodada'"
```

(Este Windows bloqueia scripts .ps1 por padrão; o `-ExecutionPolicy Bypass` libera só esta execução. Use `-Command` e não `-File`, senão a lista de notas chega como um texto só.)

O script confere que o `main` está limpo e em dia com o GitHub e que o número é maior que o atual. Depois roda o typecheck e os testes, sobe o número no `package.json` e no `package-lock.json`, escreve o `versao.json` e o topo do `HISTORICO.md`, faz o commit `Versão X: …` e a tag `vX`, envia (`push --follow-tags`) e cria a release no GitHub.

- `-Obrigatoria`: quem estiver abaixo desta versão precisa atualizar (o aviso não fecha e oferece backup antes). Use quando a versão nova mudar o formato dos dados de um jeito que a antiga não entenda.
- `-SemEnviar`: só commit e tag locais.

## Como o app se atualiza (sem instalador)

O Magistrado roda de uma cópia do repositório: o atalho abre `npm run start`, que compila e abre. Por isso a atualização é pelo git (`app/src/main/atualizacao.ts`):

1. Alguns segundos depois de abrir, e depois a cada 24 h, o app roda `git fetch origin main` e lê `origin/main:versao.json`.
2. Se a versão publicada for maior que a instalada, aparece o aviso **Nova versão X** com as novidades, em qualquer tela.
   - **Depois** esconde o aviso por 24 h.
   - Na versão **obrigatória** não há Depois, e o aviso oferece **Fazer backup antes** (campanha aberta e biblioteca).
3. **Atualizar agora** confere que a cópia está no `main` e sem alterações no código, roda `git pull --ff-only`, roda `npm install` se o `package-lock.json` mudou e reabre o app pelo `npm run start`.
4. Em **Ajustes → Versão do Magistrado** aparecem a versão instalada e o botão **Verificar atualizações**.

As campanhas e a biblioteca ficam fora do repositório, então a atualização não as toca. Os testes e2e (`MAGISTRADO_USER_DATA`) não verificam atualização.

Quando houver instalador para vender, a verificação passa a usar um repositório público de versões com o instalador e o SHA-256, como o `tec-versoes`. O `versao.json` e o `HISTORICO.md` continuam iguais.
