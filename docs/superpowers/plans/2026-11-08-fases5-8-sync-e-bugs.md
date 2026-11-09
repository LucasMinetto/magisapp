# Plan: Fechar os bugs do banco e concluir as fases 3, 5, 6, 7 e 8

## Context

App mobile (PWA) do Magistrado para **jogadores** de Ordem Paranormal RPG, em
`.worktrees/hermes-app-celular`, branch `hermes-app-celular`. O app desktop em
`desktop/` é intocável.

Estado real no início deste plano (commit `bcd2459`):
- **Fase 1 (setup Expo + PWA + deploy)** — feita: expo-router, `public/manifest.json`,
  `baseUrl: /magistrado`, workflow de deploy.
- **Fase 2 (banco local + schema + hooks CRUD)** — feita, **com um bug**: as migrações
  nunca rodam no boot do app, então as telas consultam tabelas que não existem
  (`no such table: ficha`). Os testes passam porque chamam `runMigrations` na mão.
- **Fase 4 (tela Ficha)** — feita e ligada aos hooks reais (13 telas reescritas).
- **Fases 3, 5, 6, 7 e 8** — funcionais em versão mínima, abaixo do plano original.

Verde no início: `tsc` 0 erros, `vitest` 68/68, `expo-doctor` 20/20,
`expo export --platform web` exit 0 (e o app carrega e loga num browser real).

## Global Constraints

- **Stack**: Expo SDK 58, React Native 0.88, TypeScript, expo-router, op-sqlite,
  Zustand, Zod, Fuse.js. Portas de entrada: `package.json` `main: "expo-router/entry"`.
- **Rotas**: todo arquivo em `app/` é rota. Telas de jogador vivem em
  `app/campanha/(tabs)/`. Não crie nada em `app/` fora de rotas.
- **Estilo**: **não** existe NativeWind/Tailwind neste projeto — use
  `StyleSheet.create` e a prop `style`. Nenhum `className`. Paleta usada:
  fundo `#0f0f1a`, cartão `#1a1a2e`, borda `#2a2a3e`, texto `#e8e8f0`,
  texto secundário `#8888a0`, azul `#3b82f6`, verde `#22c55e`, vermelho `#ef4444`,
  âmbar `#f59e0b`.
- **Ícones**: só nomes válidos do Ionicons (`person`, `cube`, `book`, `library`,
  `folder`, `sync`, ...). Nome inválido quebra o bundle.
- **Componentes do kit** (`src/components/ui/`): `Input` recebe `onChangeText`
  (nunca `onChange`), `value` string, `label`, `multiline`; `Select` recebe
  `options: { label, value }[]` e `onChange: (v: string) => void`;
  `Card` / `CardContent`; `Button`; `Spinner`; `SpinnerOverlay`; `Modal`; `Toast`;
  `DiceDisplay`.
- **Banco**: `src/db/driver.ts` (nativo) e `src/db/driver.web.ts` (web). O backend web
  do op-sqlite é **async-only**: `open()` lança no web. Nunca use `executeSync` em
  código de app — só `await db.execute(...)` / `await db.executeBatch(...)`.
  Migrações são versionadas por `PRAGMA user_version` e precisam ser idempotentes.
- **Regras derivadas**: use `derivados()` de `src/shared/ordem/regras.ts`. Chaves
  devolvidas: `nivel, pv, pe, san, defesa, esquiva, bloqueio, limitePe, dtRitual,
  deslocamento, patente, itensPorCategoria, carga, cargaMax, sobrecarregado`
  (cada um de pv/pe/san/defesa/carga é um objeto com `.total`). **Não existe
  `iniciativa`.**
- **Tipos compartilhados**: `src/shared/ordem/esquemas.ts` é a autoridade para
  `FichaAgente`, `RitualBiblioteca`, `ItemBiblioteca`, `itemSchema`, `ataqueSchema`,
  `habilidadeSchema`, `ritualDaFichaSchema`. Importe por `@/shared/ordem/esquemas`
  ou `shared/ordem/esquemas` (alias do tsconfig).
- **Idioma**: toda string de interface em português (pt-BR).
- **Web**: `app.json` → `web.output: "single"`, `experiments.baseUrl: "/magistrado"`.
  O export web serve em subpasta, então nada de caminho absoluto sem o prefixo.
- **Intocável**: `desktop/` e o app original do PC. Nenhum arquivo fora de
  `.worktrees/hermes-app-celular` pode ser alterado.
- **Portões de qualidade** (todos precisam continuar verdes):
  `npx tsc --noEmit` → 0 erros; `npx vitest run` → todos passando (hoje 68);
  `npx expo-doctor` → 20/20; `npx expo export --platform web --output-dir dist` → exit 0.
- **Commits**: um commit por task, mensagem em português, sem tocar em `main`.

## Interfaces já existentes (não recriar)

- `src/db/index.ts`: `getDB()`, `openDB(path)`, `runMigrations(db)`, `closeDB()`,
  `DB_TABLES`, `seedDatabase` (re-export de `./seed`).
- `src/hooks/`: `useFicha(campaignId, userId)`, `useBiblioteca(sourceId?)`,
  `useRegras()`, `useArquivo(campaignId, userId)`, `useSyncQueue(campaignId, userId)`,
  `useAuthDB()`, `useAuth()` (Zustand + persist), `useQRCode()`.
- `useFicha` devolve `{ ficha, loading, error, saveFicha, deleteFicha, markSynced, refresh }`.
- `useArquivo` devolve `{ pessoas, lugares, anotacoes, historico, loading, error,
  savePessoa, updatePessoa, deletePessoa, saveLugar, updateLugar?, deleteLugar,
  saveAnotacao, updateAnotacao?, deleteAnotacao, addHistorico?, refresh }` — confirme
  os nomes no arquivo antes de usar.
- `useSyncQueue` devolve `{ queue, pendingCount, loading, error, enqueue,
  markProcessing, markSynced, markFailed, retry, refresh }`; cada item tem
  `{ id, campaignId, userId, operacao, payload, status, tentativas, error }`.
- `useAuthDB` devolve `syncCredentials, saveCredentials, testConnection(credentials?)`.
- Tabelas da v1: `ficha, biblioteca_ritual, biblioteca_item, regras, arquivo_pessoa,
  arquivo_lugar, arquivo_anotacao, arquivo_historico, sync_queue, auth`.

## Tasks

### Task 1: Corrigir a inicialização do banco no boot e criar a migração v2 (`rolagens`)
**Files**: `src/db/index.ts`, `src/db/seed.ts`, `src/db/__tests__/`, `app/_layout.tsx`,
`src/hooks/useFicha.ts` (se necessário)
**Requirements**:
- Hoje nada no app executa `runMigrations`. Crie um bootstrap idempotente e
  memoizado (uma única promise por processo): abre o banco, roda as migrações e,
  se a tabela `regras` estiver vazia, roda o seed.
- **Toda** consulta feita pelas telas precisa acontecer depois desse bootstrap.
  Faça o gate na camada de acesso (em `src/db/index.ts`, envolvendo o `DB`
  devolvido por `getDB()`), não em cada tela — assim nenhum hook pode consultar
  antes da hora, e nenhuma das 13 telas precisa mudar.
- Exporte `ensureDatabaseReady(): Promise<void>` e chame no layout raiz
  (`app/_layout.tsx`) junto do `checkAuth()`.
- Erro de bootstrap não pode deixar o app em tela em branco: guarde o erro,
  exponha-o e permita nova tentativa.
- **Migração v2**: crie a tabela `rolagens` (histórico de rolagens do jogador) e
  incremente `PRAGMA user_version` para 2 mantendo a v1 intacta e idempotente.
  Colunas mínimas: `id TEXT PRIMARY KEY`, `campaign_id TEXT NOT NULL`,
  `user_id TEXT NOT NULL`, `tipo TEXT NOT NULL` (um de `teste|ataque|dano|ritual|iniciativa`),
  `rotulo TEXT`, `formula TEXT NOT NULL`, `dados TEXT NOT NULL` (JSON dos dados
  individuais), `total INTEGER NOT NULL`, `critico INTEGER NOT NULL DEFAULT 0`,
  `falha INTEGER NOT NULL DEFAULT 0`, `created_at TEXT NOT NULL`, `synced_at TEXT`.
  Índice por `(campaign_id, user_id, created_at)`.
- Migrações rodando em banco já existente (user_version 1) precisam aplicar só a v2;
  banco novo aplica v1 e v2.
- Testes: banco novo cria todas as tabelas; banco v1 existente migra para v2 sem
  perder linhas; bootstrap é idempotente (duas chamadas = uma execução); o gate
  garante que uma query disparada junto do boot não falha.
**Acceptance**: abrir o app no browser logado não mostra mais `no such table`;
`SELECT` em `rolagens` funciona; `tsc` 0; `vitest` verde; `expo export --platform web` exit 0.

### Task 2: Fase 5 — Rolagem persistida com as 6 rotas do plano
**Files**: `src/hooks/useRolagens.ts` (novo), `src/services/dados.ts` (novo, se ajudar),
`app/campanha/(tabs)/rolagem/_layout.tsx`, `app/campanha/(tabs)/rolagem/index.tsx`,
`teste.tsx`, `ataque.tsx`, `dano.tsx`, `ritual.tsx`, `iniciativa.tsx`, `historico.tsx`
(substitui o `app/campanha/(tabs)/rolagem.tsx` atual)
**Requirements**:
- `useRolagens(campaignId, userId)`: CRUD na tabela `rolagens` (Task 1) +
  enfileiramento no `sync_queue` (`operacao: 'push_rolagem'`).
- Rolagem de expressões com suporte a múltiplos termos (`2d6+3`, `1d8+1d4+2`),
  devolvendo os dados individuais e o total.
- Rotas conforme o plano original: seletor (`index`), Teste (perícia ou atributo →
  bônus automático pela ficha → d20 com crítico em 20 natural e falha em 1),
  Ataque (ataque da ficha → teste → dano com breakdown por tipo), Dano (expressão
  livre), Ritual (ritual da ficha → teste de Ocultismo → mostra resistência/efeito),
  Iniciativa (1d20+AGI), Histórico (lista persistida com data, tipo, fórmula e total).
- O teste de ataque/dano precisa usar os dados da ficha carregada
  (`useFicha(campaignId, userId)`), sem inventar valores.
**Acceptance**: rolar `3d20+5` mostra dados, total e crítico; ataque+danos mostram
breakdown; o histórico sobrevive a recarregar a página; `tsc`/`vitest`/`doctor` verdes.

### Task 3: Fase 6 — Regras com o conteúdo do livro, busca e sumário
**Files**: `src/hooks/useRegras.ts` (aprimorar), `app/campanha/(tabs)/regras/_layout.tsx`,
`index.tsx`, `[capitulo].tsx`, `src/assets/` ou `assets/` (dados das regras)
**Requirements**:
- Sumário por capítulo (o livro tem capítulos 1 a 8 + apêndices) com marcação do
  capítulo atual; navegação anterior/próximo.
- Busca full-text no título e no conteúdo com trecho do resultado (Fuse.js já é
  dependência; FTS5 do SQLite é alternativa).
- Renderizar o markdown do livro (`.conteudo`) de forma legível no celular:
  títulos, listas, tabelas e negrito. Não precisa editor.
- Manter o filtro por capítulo e a marca de `visivel_para_jogadores`.
- Respeitar o tamanho: nada de embutir o livro inteiro se ficar pesado — se os
  dados vierem do sync, deixe o caminho pronto e um fallback local pequeno.
**Acceptance**: abrir o capítulo 3, buscar "crítico", chegar na seção certa;
`tsc`/`vitest`/`doctor` verdes; export web exit 0.

### Task 4: Fase 3 — Cliente de sync (HTTP + WebSocket) e integração com a fila
**Files**: `src/api/client.ts`, `src/api/protocol.ts`, `src/api/sync.ts` (novos),
`src/hooks/useSync.ts` (novo), `src/hooks/useSyncQueue.ts` (aprimorar),
`app/campanha/(tabs)/sync.tsx` (ligar ao hook novo)
**Requirements**:
- `protocol.ts`: tipos das mensagens (`pull`, `push`, `delta`, `ack`, `error`) com
  `X-Protocol-Version` (v1) em toda requisição.
- `client.ts`: wrapper de `fetch` com timeout, retry exponencial (máx. 3) e
  tratamento de erro tipado; cliente WebSocket com reconexão automática e
  heartbeat.
- `sync.ts`: `pull(campaignId, userId)` (ficha, biblioteca liberada, regras
  visíveis, arquivo, rolagens) aplicando no SQLite e marcando `synced_at`;
  `push(campaignId, userId)` drenando a `sync_queue`. Conflito: last-write-wins
  por timestamp, conflitos registrados.
- Endpoints do servidor do mestre (Fase 9, ainda não existe): use
  `GET /api/sync/status`, `POST /api/sync/push`, `GET /api/sync/pull` e
  `ws(s)://<host>/sync?token`. Documente no código que o contrato é assumido.
- A tela Sync passa a mostrar estado de conexão (offline/online/sincronizando),
  pendências e erro, com botão de sincronizar agora.
- Testes com servidor falso (msw ou stub de `fetch`): push drena a fila e marca
  como sincronizado; 500 mantém na fila e incrementa tentativas; pull aplica
  mudanças e não duplica.
**Acceptance**: com o servidor fora do ar a fila não perde itens; com um servidor
falso respondendo, o push drena e o pull aplica; `tsc`/`vitest`/`doctor` verdes.

### Task 5: Fase 7 — Biblioteca com filtros e detalhe
**Files**: `app/campanha/(tabs)/biblioteca/_layout.tsx`, `index.tsx`, `rituais.tsx`,
`itens.tsx`, `[id].tsx` (substitui o `biblioteca.tsx` atual)
**Requirements**:
- Rituais filtráveis por elemento (Sangue, Morte, Conhecimento, Energia, Medo) e
  círculo (1 a 4); itens filtráveis por tipo (Arma, Proteção, Equipamento,
  Munição, Amaldiçoado) e categoria (0 a 4).
- Busca unificada (nome + texto) com Fuse.js.
- Rota de detalhe mostrando todos os campos de `RitualBiblioteca` /
  `ItemBiblioteca` (inclusive `discente`, `verdadeiro`, danos por forma).
- Nunca exibir ameaças (fora do escopo do jogador).
**Acceptance**: filtrar "Energia + círculo 2" mostra só o que corresponde; abrir um
ritual mostra execução, alcance, dano e efeito; `tsc`/`vitest`/`doctor` verdes.

### Task 6: Fase 8 — Arquivo do agente com versionamento
**Files**: `app/campanha/(tabs)/arquivo/_layout.tsx`, `pessoas.tsx`, `lugares.tsx`,
`anotacoes.tsx`, `historico.tsx` (substitui o `arquivo.tsx` atual),
`src/hooks/useArquivo.ts` (aprimorar)
**Requirements**:
- Pessoas e lugares: cartão atual + histórico de versões anteriores (o schema já
  tem `versao_atual`); atualizar incrementa a versão e registra no
  `arquivo_historico`.
- Anotações: texto livre do jogador, persistido localmente e vinculável a uma
  pessoa e/ou lugar.
- Histórico: timeline unificada (versões de cartão + interlúdios + anotações) com
  data e autor.
- As anotações do jogador **não** são sobrescritas por atualização do mestre.
**Acceptance**: editar um cartão cria nova versão e a antiga continua visível no
histórico; anotação vinculada aparece nos dois lados; `tsc`/`vitest`/`doctor` verdes.

### Task 7: Revisão ampla da branch
**Files**: nenhum (somente leitura) — relatório em `.superpowers/sdd/`
**Requirements**:
- Revisar o diff completo da branch `hermes-app-celular` desde `cf1e67c` até o topo:
  arquitetura, contratos entre camadas (db → hooks → telas), vazamentos de
  plataforma (sync-only no web, paths absolutos no export), código morto, testes
  que não testam nada e inconsistências entre telas.
- Confirmar os portões: `tsc`, `vitest`, `expo-doctor`, `expo export --platform web`.
- Classificar achados em Crítico / Importante / Menor, com arquivo:linha.
**Acceptance**: relatório com veredito explícito e lista priorizada.

### Task 8: Onda de correção da Revisão 1 (bugs do kit, SQL, debounce, condições, teste)
**Files**: `src/components/ui/{Card,Button,Checkbox,Modal,Spinner,Toast}.tsx`,
`src/hooks/*.ts` (queries), `src/hooks/__tests__/useFicha.test.ts`,
`app/campanha/(tabs)/ficha/{atributos,condicoes}.tsx`, `src/db/migrations/002_*.sql` ou
o SQL embutido em `src/db/index.ts`, `tsconfig.json`, `src/db/seed.ts`
**Requirements**:
- **Kit de UI sem estilo (o mais grave)**: `Card`, `Button`, `Checkbox`, `Modal`,
  `Spinner` e `Toast` ainda usam `className` (NativeWind removido) — 48 ocorrências.
  Reescreva os seis com `StyleSheet.create` na paleta do app (fundo `#1a1a2e`,
  borda `#2a2a3e`, raio 12, padding 16, texto `#e8e8f0`), mantendo as props públicas
  (`variant`, `padding`, `children`, `style`, `onPress`, etc.). `className` não pode
  sobrar em nenhum arquivo de `src/`.
- **`rolagens.tipo`**: o `CHECK` criado na migração v2 usa
  `teste|ataque|dano|ritual|iniciativa`, que diverge de `TIPOS_ROLAGEM` em
  `src/shared/ordem/esquemas.ts`. Alinhe o `CHECK` ao conjunto do shared (a
  autoridade). A migração v2 não foi publicada, então pode ser corrigida no lugar
  (não crie uma v3 para isso); garanta que os testes de migração continuem passando.
- **Consultas parametrizadas**: troque a concatenação de SQL com escape caseiro por
  parâmetros (`?`) em todos os hooks (`useFicha`, `useBiblioteca`, `useRegras`,
  `useArquivo`, `useSyncQueue`, `useAuthDB`). Nenhuma string vinda do usuário pode
  ser interpolada em SQL.
- **Debounce no salvamento da ficha**: hoje cada tecla grava no SQLite e insere uma
  linha em `sync_queue`. Faça o salvamento ser debounced (ex.: 400-800 ms) com
  *flush* ao sair da tela, e garanta que uma única edição gere **uma** linha na fila,
  não uma por tecla.
- **Lista de condições**: `app/campanha/(tabs)/ficha/condicoes.tsx` tem 17 itens
  hardcoded; a fonte autoritativa é `src/shared/ordem/regras.ts`. Use a lista de lá
  (não reescreva os nomes à mão). Se a lista de lá não servir para jogador, reporte
  como DONE_WITH_CONCERNS em vez de inventar.
- **Teste que não testa**: `src/hooks/__tests__/useFicha.test.ts` não importa nem
  exercita `useFicha`. Faça o teste exercitar o hook de verdade (ou, se o hook não for
  testável sem renderer, teste a camada que ele usa de fato) — o teste precisa falhar
  quando o comportamento do alvo quebra.
- **Menores**: remova `nativewind-env.d.ts` do `include` do `tsconfig.json`; alinhe
  os ids do seed (`campaign-seed-001`/`user-seed-001`) ao `campaignId`/`userId` que o
  app realmente usa, para o jogador ver dados de exemplo; troque `btoa`/`AbortSignal.timeout`
  por equivalentes portáteis (devem funcionar no Hermes nativo e no web).
- **Não** remova componentes do kit nem hooks (fases 5–8 ainda vão usá-los).
**Acceptance**: nenhum `className` em `src/`; `SELECT` de rolagens aceita exatamente
`TIPOS_ROLAGEM`; nenhuma interpolação de string em SQL; editar um campo da ficha gera
uma gravação e uma linha de fila; a tela de condições usa a lista do shared; o teste
de `useFicha` exercita o alvo; `tsc` 0, `vitest` verde, `expo-doctor` 20/20,
`expo export --platform web` exit 0; e uma verificação real no browser (o kit agora
tem fundo/borda/raio visíveis).

## Rulings

- **Ruling**: o gate das migrações fica em `src/db/index.ts`, não nas telas — evita
  tocar em 13 arquivos de UI e cobre qualquer consulta futura.
  Custo se errado: um proxy a mais no caminho de acesso; trivial de remover.
- **Ruling**: `rolagens` entra como migração v2 (não como tabela criada no seed) —
  o histórico do jogador é dado persistente, precisa do mesmo versionamento do resto.
- **Ruling**: o contrato HTTP/WS do sync é assumido porque o servidor (Fase 9, app
  desktop) está fora do escopo autorizado. Fica documentado e isolado em `src/api/`.
  Custo se errado: trocar caminho de endpoint em um arquivo só.
- **Ruling**: Fases 7 e 8 eram "pós-MVP" no plano original, mas o usuário pediu
  para concluí-las agora — entram como tasks normais, com o escopo acima.
