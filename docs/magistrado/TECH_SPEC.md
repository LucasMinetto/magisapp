# TECH_SPEC: Magistrado

> Iniciativa: `magistrado` · 2026-11-02 · Status: proposta (o código ainda não foi copiado)
> Produto: [PRD.md](PRD.md) · Tarefas: [TASKS.md](TASKS.md) · Memória: [PROJECT_MEMORY.md](PROJECT_MEMORY.md)

Legenda: **[confirmado]** = decidido com o usuário · **[recomendação]** = proposta minha, pode mudar · **[aberto]** = precisa da decisão do usuário.

## Sistema atual

A fusão partiu de `autore@28fa658` e `taberna@71f7b1c` (2026-11-02). As cópias locais foram apagadas em 2026-11-07.

### autore (base)

- Electron 45 + electron-vite 6, React 19, react-router 8, Tailwind 4, TipTap 3, @xyflow/react 12.12.0, better-sqlite3 13, zod 4, vitest 5, Playwright para e2e. O nome interno do pacote é `mesa`.
- **Uma campanha é uma pasta** `<nome>.mesa/` com `campanha.sqlite`, `anexos/` e `.lock` (`docs/arquitetura/arquitetura.md`).
- Esquema em `app/src/main/schema.sql`, migrações em `app/src/main/db.ts`, versão 3. Antes de migrar, o app grava uma cópia do banco.
- Fichas: tabela `entities` com `kind in ('personagem','criatura','local','grupo','lore')` e `stats` em JSON, descritos por `system_templates` e `template_fields`. O modelo Ordem Paranormal é sincronizado ao abrir (`syncOrdemTemplate`, `app/src/main/seed.ts`).
- O renderer só fala com o processo principal por IPC validado com zod (`app/src/main/ipc.ts`, `app/src/preload/index.ts`), com sandbox e contextIsolation ligados.
- Já existem: menções automáticas, busca FTS5, desfazer global, lixeira, backup `.mesa-backup` (banco + anexos + `legivel/` + `campanha.json` formato 1), exportar, tela de Sessão (N03, sem iniciativa nem rolagens), Arquivos (PDF).
- Tokens de design: `design/tokens.json`, gerador `build_tokens.py` e teste de contraste `contrast.py`.

### taberna (o que vem dele)

- Fastify + node:sqlite, React 18, react-router-dom 6, Tailwind 3, zod 3. O banco cria as colunas a partir dos esquemas zod (`server/src/db.ts`).
- **Regras puras** em `shared/regras.ts` (262 linhas), com testes em `shared/regras.test.ts`: `nivelNex`, `patentePorPrestigio`, `bonusPericia`, `dadosDoTeste`, `derivados`, `resolverTeste`, `lerExpressao`, `resolverDano`, `descreverExpressao`.
- **Esquemas** em `shared/esquemas.ts`: `agenteSchema`, `ataqueSchema`, `ritualDaFichaSchema`, `habilidadeSchema`, `itemSchema`, `rolagemSchema`, `ameacaSchema` (com `acaoSchema`), `ritualSchema`, mais `ELEMENTOS`, `TIPOS_ACAO`, `TIPOS_ITEM`.
- **Telas da ficha** em `web/src/ficha/`: Identidade, Perícias, Combate, Habilidades, Rituais, Inventário, Rolagem, Histórico. Página: `web/src/paginas/FichaPagina.tsx`. Editores: `AmeacaEditor.tsx`, `RituaisPagina.tsx`. Componente `BlocoAmeaca.tsx`.
- Spec visual: `docs/handoff-ficha-rpgpedia.md`.

## Abordagem

1. **[confirmado]** Repositório novo e base autore. Os remotos originais não são tocados, e as cópias locais podem ser usadas à vontade.
2. **[confirmado: Q4, Q7]** A pasta `C:\Users\lucas\Desktop\Magistrado` vira a raiz do repositório novo (remoto `github.com/LucasMinetto/magistrado`):
   ```
   Magistrado/
     app/        o app Electron
     design/     tokens, temas e contraste
     docs/       docs/magistrado/ e docs/arquitetura/
   ```
   O histórico começa do zero, e o primeiro commit registra os commits de origem (`autore@28fa658`, `taberna@71f7b1c`).
3. **[recomendação]** **Portar** o código do taberna, sem acoplar. O taberna não entra como dependência nem roda o servidor: as regras e os esquemas são copiados e adaptados para a estrutura do autore.
   - `taberna/shared/regras.ts` → `app/src/shared/ordem/regras.ts`, com os testes migrados para vitest.
   - Esquemas de zod 3 para zod 4. Os pontos de atenção são `.default`, `z.record` e mensagens de erro.
   - Telas de React 18 para 19 e de Tailwind 3 para 4, usando as primitivas de `app/src/renderer/src/ui/` e os tokens do autore em vez das cores e fontes do taberna (Cinzel, Special Elite etc. saem).
   - O acesso a dados passa a ser por IPC validado com zod, no lugar do `web/src/api.ts` (HTTP).
4. **[confirmado]** Ficha com o layout RPGpédia e a aparência do autore: três colunas com `overflow-y-auto` próprio e altura da janela menos a barra no PC (≥ 1024 px, que já é a janela mínima do autore). A moldura "rasgada" e as fontes do RPGpédia não entram.

## Componentes e dados afetados

### Renomear (Mesa → Magistrado) [suposição]

| Onde | Hoje | Novo |
|---|---|---|
| `app/package.json` `name` / `productName` | `mesa` / `Mesa` | `magistrado` / `Magistrado` |
| pasta da campanha | `<nome>.mesa/` | `<nome>.magistrado/` |
| protocolo de anexos | `mesa://` | `magistrado://` (CSP e `registerSchemesAsPrivileged`) |
| backup | `.mesa-backup` | `.magistrado-backup` |
| pasta de dados do app | `%APPDATA%/mesa` | `%APPDATA%/Magistrado` |

A busca por `mesa` em `app/src` acha todas as ocorrências. Cuidado com textos de interface onde "mesa" é a palavra comum ("mesa de jogo").

### Modelo de dados novo (migração 4)

- **Personagens: dois tamanhos de ficha.** **[confirmado]** Os agentes são os personagens dos jogadores e usam a **ficha completa**. A ficha dos NPCs é **compacta**, mas alguns NPCs (os vilões) usam a **ficha completa**, igual à dos agentes.
  - **[implementado em 2026-11-03, T4]** Tudo continua em `entities` com `kind = 'personagem'`. Agente = `is_player = 1`, coluna que o autore já tinha. **Não** foi criada a coluna `role`, porque ela já existe com o sentido de "papel na história". A coluna nova é só `sheet in ('compacta','completa')`. O agente é sempre `completa`. O NPC começa `compacta`, e `entities:setSheet` o transforma em vilão sem perder dados.
  - A ficha completa fica em `sheet_data` (JSON validado por `fichaAgenteSchema`), porque `stats` só aceita valores simples. A compacta continua nos campos do modelo Ordem em `stats`. Enquanto a completa não é editada, ela é **montada da compacta** a cada leitura (`fichaDeStats`), então nada se perde e as telas antigas continuam valendo. Ao salvar, o app reconhece quando a tela só devolveu o que recebeu e não grava.
  - Com isso, menções, busca, lixeira, desfazer, cenas, quadros e backup funcionam sem código novo.
- **Ameaças.** **[confirmado]** O nome na interface é **Ameaças**. **[implementado, T4]** A `kind = 'criatura'` do autore virou `ameaca`, com `entities` e `template_fields` reconstruídas e os mesmos ids. O bloco do livro (`blocoAmeacaSchema`) fica em `sheet_data`, montado dos campos antigos (`ameacaDeStats`) enquanto não for editado. **Pendente para a T8:** o editor atual ainda edita os campos do modelo em `stats`. Uma ameaça trazida da biblioteca chega com o bloco em `sheet_data` e `stats` vazio, então a T8 tem de passar a tela a usar o bloco.
- **Biblioteca única com origem.** **[confirmado]** Ameaças-modelo, itens e rituais ficam numa **biblioteca única**, compartilhada por todas as campanhas, e cada registro diz **de onde veio**.
  - **[recomendação]** Banco próprio em `%APPDATA%/Magistrado/biblioteca.sqlite`, com as tabelas `sources`, `lib_threats`, `lib_items` e `lib_rituals`.
  - `sources` = a origem: `nome` (ex.: "Livro de Regras", "Sobrevivendo ao Horror", "Criações próprias"), `tipo in ('oficial','propria','outro')` e `abreviacao`. "Criações próprias" já vem criada. O usuário pode adicionar outros livros.
  - Cada item, ritual ou ameaça-modelo tem `source_id` obrigatório. A biblioteca filtra por origem.
  - Usar na campanha **copia** o registro para dentro dela (uma ameaça na cena, um ritual ou item na ficha) e guarda a origem `{ libraryId, sourceId, sourceName }` (coluna `entities.origin` ou campo `origem` do item ou ritual). A campanha continua funcionando sozinha (backup, outro PC) mesmo sem a biblioteca.
  - A biblioteca tem backup próprio (`Biblioteca <data>.magistrado-backup`, com `biblioteca.sqlite` e `biblioteca.json`). Restaurar guarda a anterior em `biblioteca.sqlite.antes-de-restaurar`. A tela fica em Ajustes. Os dados do livro (P1) entram aqui.
- **Ritual ou item na ficha.** Fica no `sheet_data` do personagem (lista de `ritualDaFichaSchema` e de itens com quantidade), copiado da biblioteca com o id de origem. Apagar da biblioteca não quebra a ficha.
- **Rolagem.** Tabela `rolls` (`entity_id`, `game_session_id` opcional, `game_minute`, `who`, `label`, `type`, `formula`, `dice`, `total`, `critical`, `detail`, `created_at`), no formato do `rolagemSchema`. Entra no desfazer e no backup.
- **Iniciativa.** Coluna `game_sessions.initiative` (JSON `{ rodada, turno, ordem }`), já criada na migração 4 para a T10.
- **Backup e export.** O `campanha.json` passa para o `formato: 2`, com o teste de ida e volta atualizado. O `legivel/` ganha as pastas `Agentes/` e `Ameaças/` (no lugar de `Criaturas/`), e as rolagens entram no Markdown da sessão. Rituais e itens aparecem dentro da ficha.

### IPC novo (implementado em 2026-11-03, T5)

- `entities:save` aceita `sheet` e `sheetData`.
- `entities:setSheet`.
- `rolls:list`, `rolls:add` e `rolls:remove`.
- `sessions:initiative` e `sessions:saveInitiative`.
- Biblioteca: `library:sources`, `library:saveSource`, `library:deleteSource`, `library:list`, `library:get`, `library:save`, `library:remove`, `library:copyToCampaign`, `library:backup` e `library:pickAndRestore`.

Todos os canais são validados com zod. As regras rodam no renderer pelo `shared/ordem`, sem canal próprio. A biblioteca não entra no desfazer da campanha nem a marca como alterada, com exceção de `library:copyToCampaign`.

### Telas novas

- `screens/FullSheet.tsx` + `screens/sheet/*`: ficha completa, para agente e vilão (porte de `web/src/ficha/*`). A ficha compacta continua no `EntitySheet.tsx`, com o botão "usar ficha completa".
- `screens/Library.tsx` (já existe no autore; ver o que reaproveitar): abas Ameaças, Itens e Rituais, filtro por origem e cadastro de origens.
- Ameaça: estender `EntitySheet.tsx` com o modo ameaça (porte de `AmeacaEditor.tsx` e `BlocoAmeaca.tsx`).
- Rolagem: componente reaproveitável (porte de `ficha/Rolagem.tsx`) usado na ficha e na Sessão.
- `screens/Session.tsx`: PV, PE e SAN dos agentes, PV das ameaças e painel de iniciativa (Q5). A iniciativa, a rodada e o turno ficam salvos na sessão de jogo (`game_sessions`) e entram no desfazer.
- Navegação: entradas em `Shell.tsx` e na paleta de comandos (`CommandPalette.tsx`).

## Erros e casos limite

- **Valores digitados inválidos** na rolagem (fora de 1..faces, quantidade errada de dados): o app recusa e mostra o que falta. Os cálculos ficam com `resolverTeste` e `resolverDano`.
- **Expressão de dano inválida** (`lerExpressao`): o erro aparece no campo, e nada é salvo.
- **Ritual ou item apagado da biblioteca** depois de estar numa ficha: a ficha guarda a cópia (ver acima) e continua funcionando.
- **Migração 4** em campanha existente: a cópia `campanha.sqlite.v3.bak` é feita antes, como o autore já faz. A reconstrução de `entities` preserva os ids (FKs de `scene_entities`, nós do canvas e `mentions`).
- **Menções:** o nome dos agentes passa a entrar no autômato de menções. Os agentes têm "não marcar no texto" como as outras fichas.

## Segurança, desempenho, compatibilidade

- Segurança: sem mudanças em relação ao autore. Sem servidor e sem rede, já que a versão dos jogadores está fora do escopo.
- Desempenho: as regras são puras e baratas. A ficha recalcula no renderer a cada mudança, e o salvamento usa o debounce do autore.
- **Compatibilidade com `.mesa`:** não é necessária (Q6). Pode-se trocar a extensão sem migração.

## Verificação

- `npm.cmd run typecheck` e `npm.cmd test` (vitest) no `app/`. Os testes do autore têm de passar sem mudança de comportamento.
- Os testes de `taberna/shared/regras.test.ts` são migrados e passam igual.
- Teste de ida e volta do `campanha.json` (formato 2) com agente, ameaça, ritual, item e rolagem.
- `node e2e/slice.mjs` (Playwright), ampliado com: criar agente → mudar atributo → conferir PV → rolar teste → ver no histórico.
- `design/contrast.py` passa nos dois temas com as cores novas da ficha (barras de PV, SAN e PE).
- Aceite final: o usuário conduz uma sessão de teste só no Magistrado (PRD, sinal de sucesso).

## Decisões pendentes

| # | Pergunta | Recomendação | Bloqueia |
|---|---|---|---|
Nenhuma no momento.

### Decididas em 2026-11-02

| # | Decisão |
|---|---|
| Q1 | **Biblioteca única** para ameaças, itens e rituais, com a **origem** de cada registro (livro oficial, criação própria, outros livros no futuro). |
| Q2 | Agente = personagem do jogador, com **ficha completa**. NPC com **ficha compacta**. NPC vilão pode usar a **ficha completa**. |
| Q3 | Manter o nome **Ameaças** (a `criatura` do autore vira ameaça). |
| Q4 | Histórico do git começa do zero, e o primeiro commit registra `autore@28fa658` e `taberna@71f7b1c` (o usuário deixou a escolha comigo). |
| Q5 | A tela de sessão ganha o **painel de iniciativa** do taberna (lista de agentes e ameaças com valor, ordenar, turno e rodada, próximo turno). Base: `PainelIniciativa` em `taberna/web/src/paginas/SessaoPagina.tsx`. |
| Q6 | Não há campanhas `.mesa` reais (o autore só foi testado). **Sem compatibilidade com `.mesa`.** |
| Q7 | Repositório **github.com/LucasMinetto/magistrado**, criado pelo usuário, vazio em 2026-11-02. |
