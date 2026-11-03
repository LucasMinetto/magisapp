# Arquitetura: app de mestre para Ordem Paranormal (inspirado nas funções do Autor)

Lê: `recon.md`, `features.csv`, `research.md`. Esquema: `schema.sql` (testado em SQLite, 22 tabelas).
Data: 2026-11-02. Nome do app: provisório, a definir no `/replica-brand`.

## A forma do app

Desktop, offline, um usuário, sem conta e sem pagamento. Por isso o stack padrão de SaaS (Next.js, Postgres, auth, Stripe, Vercel) não se aplica. Igual ao Autor, que guarda um `.autor` por livro, aqui **uma campanha é uma pasta**:

```
Caso do Hospital.mesa/
  campanha.sqlite        tudo: fichas, cenas, pistas, tempo, canvas
  anexos/bilhete-rasgado-3f9a2c.png   imagens, PDFs, tokens (nome legível + 6 letras do hash, sem duplicar)
  .lock                  impede abrir a mesma campanha em duas janelas
```

A lista de campanhas recentes, o tema e a configuração de backup ficam em `settings.json`, na pasta de dados do app (`%APPDATA%`).

## Stack

| camada | escolha | por quê |
| --- | --- | --- |
| app desktop | Electron + electron-vite + TypeScript | você já tem Node 24; Tauri exigiria Rust, que não está instalado; o Autor também é Electron, então o desempenho é o mesmo que você já vê |
| interface | React 18 + Tailwind (tokens do `/replica-design`) | o ecossistema com mais peças prontas para editor e canvas |
| editor de texto | TipTap 2 (ProseMirror) | rich text sólido; as menções automáticas viram "decorations" sem sintaxe de link |
| canvas | @xyflow/react (React Flow) | nós, arestas, zoom e mini-mapa prontos; o "Arranjar" sai com elkjs |
| banco | SQLite via better-sqlite3 | um arquivo, offline, rápido, transações síncronas, FTS5 para busca |
| ORM | Drizzle (dialeto sqlite) + migrações | tipos gerados do esquema; SQL legível |
| validação | zod em toda chamada IPC | o renderer nunca manda dado sem checagem para o banco |
| PDF | visualizador do Chromium (embutido no Electron) | abrir a aventura importada na página certa, sem biblioteca extra |
| exportar | `docx` (npm) para Word; Markdown próprio; `webContents.printToPDF` para PDF | sem serviço externo |
| backup | um arquivo `.mesa-backup` (zip comum): cópia consistente do banco + anexos + `legivel/` (cofre Markdown para Obsidian) + `campanha.json`, manual e automático | um arquivo só para guardar onde quiser (pendrive, outro disco), que abre **sem o app** se ele quebrar; sem Google Drive nem serviço externo |
| empacotar | electron-builder (instalador Windows) | padrão; auto-update fica para depois |
| auth, pagamento, e-mail, hospedagem | nenhum | uso próprio, local |

Futuro (versão dos jogadores): os ids já são UUID para permitir sync. Quando chegar a hora, um servidor pequeno (ex.: Supabase) recebe só o que o mestre liberar. Fora desta versão.

### Backup que abre sem o app

O `.mesa-backup` é um zip comum (renomear para `.zip` abre no Windows):

```
Caso do Hospital 2026-11-02 21h30.mesa-backup
  campanha.sqlite      cópia consistente do banco (restaurar no app; abre no DB Browser for SQLite)
  anexos/              imagens, PDFs, tokens, com nome legível
  legivel/             Markdown e .canvas; abrir a PASTA DO BACKUP inteira como cofre no Obsidian
                       (o Obsidian só mostra imagens de dentro do cofre, e elas estão em anexos/)
    Personagens/  Criaturas/  Locais/  Grupos/  Lore/
    Cenas/01 - Chamado da Ordem.md
    Pistas/Bilhete rasgado.md
    Sessões/Sessão 4.md
    Linha do tempo.md
    LEIA-ME.md         o que é cada pasta e como abrir
  campanha.json        tudo em JSON versionado ("formato": 1), para importar em outro app
```

Regras do `legivel/`:
- uma nota por ficha, cena, pista, sessão e documento, com nome = título (caracteres proibidos no Windows trocados por `-`; nomes repetidos ganham ` (2)`);
- números e campos da ficha (NEX, PV, Sanidade...) no frontmatter YAML, que o Obsidian mostra como propriedades;
- menções e relações viram `[[Nome da ficha]]`, então links, backlinks e grafo funcionam;
- imagens embutidas com `![[../anexos/bilhete-rasgado-3f9a2c.png]]`, sem duplicar arquivo;
- datas sempre escritas por extenso ("qua, 22/07/2026, 23h10"), nunca o `game_minute`;
- `Linha do tempo.md` traz cenas, eventos e sessões em ordem, com as lacunas marcadas.

O `legivel/` é só leitura: o app não importa de volta dele. Restaurar é sempre pelo `campanha.sqlite` (ou pelo `campanha.json`, se o banco estiver corrompido).

## Schema

Tabelas: 22 (20 normais + `mentions`, que é derivada, e `search_index`, FTS5). Ver `schema.sql`.

Regras de acesso: não há multiusuário nem RLS. O acesso é controlado na fronteira do Electron: o renderer roda com `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`, e só fala com o processo principal pelas funções que o `preload` expõe, cada uma validada com zod. Só o processo principal abre o banco e mexe em arquivos.

Decisões do esquema:
- **Sem `campaign_id`.** A campanha é o arquivo, então nenhuma linha precisa dizer de qual campanha é.
- **Data do caso.** Toda campanha começa numa data real do calendário (ex.: quarta-feira, 22 de julho de 2026, quando os agentes são chamados). Ela é obrigatória ao criar a campanha e fica em `campaign.epoch_date`.
- **Tempo do jogo em `game_minute`** (inteiro, minutos desde 00:00 da data do caso). Na tela aparece sempre a data e hora de verdade, com dia da semana ("qua, 22 jul 2026, 23h10"); o número fica escondido. Valor negativo = antes do chamado (o crime 3 dias antes, a fundação do culto em 1998). Não tem fuso nem horário de verão, e a conta de lacuna é uma subtração.
- **Hora real** (criado, alterado, lixeira) em ISO-8601 UTC. A data de uma sessão real (`played_on`) é só data local.
- **Lixeira com `deleted_at`** nas tabelas principais. Apaga de vez após 60 dias, como no Autor.
- **`on delete` decidido:** apagar um lugar deixa cenas, pistas e eventos sem lugar (`set null`). Apagar uma ficha remove a presença dela em cenas, nós do canvas e listas de quem achou (`cascade`). Apagar uma sessão desmarca o "achada na sessão X" das pistas (`set null`).
- **Restrições que a pesquisa pediu:** pista "achada" precisa de sessão ou hora; o fim de uma cena ou evento não pode ser antes do início; um nó do canvas do tipo ficha precisa apontar para uma ficha.
- **`stats` em JSON + `template_fields`.** Ordem Paranormal vem como modelo embutido (NEX, PV, PE/PD, Sanidade, AGI/FOR/INT/PRE/VIG, perícias, rituais, elemento). D&D depois é outro modelo, sem migração.
- **Índices** em toda FK e em toda coluna usada para filtrar ou ordenar (tipo e nome da ficha, `game_minute_start`, status da pista, ordem).

## API (IPC entre a interface e o processo principal)

Não há HTTP. Cada linha é uma função do `preload` (`window.api.<canal>`). "Quem": só a janela da campanha aberta.

| canal | faz | entrada | saída | fluxo |
| --- | --- | --- | --- | --- |
| `campaign:create` | cria a pasta e o banco, aplica migrações e o modelo Ordem Paranormal | nome, pasta, data do caso | campanha | F01 |
| `campaign:open` | abre a pasta, cria o `.lock` e põe nos recentes | caminho | campanha + contadores | F01 |
| `campaign:recent` | lista as recentes | — | [{nome, caminho, aberta_em}] | F01 |
| `campaign:update` | renomeia, muda a frase, a data do caso, o sistema | campos | campanha | F01 |
| `campaign:reveal` | abre a pasta no Explorer | — | — | S15b |
| `entities:list` | fichas por tipo, com busca simples | tipo, texto? | [ficha resumida] | F02 |
| `entities:get` | ficha completa + relações + menções | id | ficha | F02 |
| `entities:save` | cria ou atualiza; recalcula menções e o índice de busca | ficha | ficha | F02 |
| `entities:relate` / `entities:unrelate` | liga duas fichas com um rótulo | from, to, rótulo | relação | F02 |
| `templates:list` / `templates:save` | modelos de sistema e seus campos | modelo | modelo | F02 |
| `scenes:list` | cenas por ordem ou por hora no jogo | ordenação | [cena] | F03 |
| `scenes:save` | cria ou atualiza; recalcula menções e busca | cena | cena | F03 |
| `scenes:reorder` | nova ordem (arrastar no corkboard) | [id] | — | F03 |
| `scenes:setEntities` / `scenes:attach` | NPCs da cena / anexos da cena (com página do PDF) | ids | — | F03, F13 |
| `documents:list` / `documents:save` | páginas livres | doc | doc | F13 |
| `clock:get` | hora atual no jogo + próximos eventos + lacunas | — | relógio | F12 |
| `clock:advance` / `clock:set` | avança (+10 min, +1 h, até a próxima cena) ou define a hora | minutos ou hora | relógio | F12 |
| `timeline:list` | cenas, eventos e sessões num intervalo, com as lacunas calculadas | de, até | [item], [lacuna] | F12 |
| `events:save` | cria ou atualiza evento da linha do tempo | evento | evento | F12 |
| `clues:list` | portfólio com filtro por status, sessão, lugar | filtros | [pista] | F11 |
| `clues:save` | cria ou atualiza pista | pista | pista | F11 |
| `clues:markFound` | marca como achada: sessão, hora no jogo, quem achou | id, sessão, minuto, [pj] | pista | F11 |
| `sessions:list` / `sessions:save` | sessões de jogo e notas | sessão | sessão | F11 |
| `sessions:current` | dados da tela de mesa: cena atual, relógio, pistas e NPCs da cena | — | painel | F14 |
| `boards:list` / `boards:get` / `boards:save` | quadros, nós e arestas (salva em lote, numa transação) | quadro | quadro | F04 |
| `attachments:import` | copia o arquivo para `anexos/`, calcula hash, evita duplicado | caminhos | [anexo] | F13 |
| `attachments:url` | caminho seguro (`mesa://anexo/<id>`) para mostrar a imagem ou o PDF | id | url | F13 |
| `search:query` | busca global FTS5 | texto, tipos? | [resultado com trecho] | F09, F14 |
| `trash:list` / `trash:restore` / `trash:purge` | lixeira | id | — | S14 |
| `export:run` | exporta campanha ou seleção para .docx, .pdf, ou a pasta Markdown/Obsidian (mesmo gerador do `legivel/`) | formato, escopo | caminho | S18 |
| `backup:now` / `backup:config` | gera um `.mesa-backup` agora / pasta e intervalo | caminho?, config | arquivo gerado | F10 |
| `backup:restore` | abre um `.mesa-backup` como campanha nova (pelo banco; se ele estiver corrompido, pelo `campanha.json`) | arquivo, pasta destino | campanha | F10 |

Total: 32 canais (contando os pares agrupados como um).

Webhooks: nenhum. Serviços externos: nenhum nesta versão. IA (Ollama ou chave própria) é "could" e fica fora.

Tarefas em segundo plano (no processo principal):
- **backup**: ao fechar a campanha e a cada N min (padrão 30), só se algo mudou. Gera `<pasta de backup>/<campanha> 2026-11-02 21h30.mesa-backup` (banco + anexos + `legivel/` + `campanha.json`) e mantém os 5 últimos. Se a geração do `legivel/` falhar, o backup do banco sai mesmo assim e o erro é avisado. A pasta padrão é `Documentos/Backups de campanhas`, fora da pasta da campanha, para não perder os dois juntos.
- **lixeira**: ao abrir a campanha, apaga de vez o que está lá há mais de 60 dias, inclusive anexos sem uso.
- **reindexar**: ao salvar um texto (com debounce de ~500 ms), recalcula `mentions` e `search_index` daquela origem. Um comando "reindexar tudo" serve para reparo.
- **checagem**: `PRAGMA integrity_check` na abertura, avisando se falhar.

## The parts that bite

- **Tempo:** a hora no jogo não tem fuso (`game_minute`), então não existe problema de horário de verão. A hora real é UTC. Cuidado na exibição: "qua 22/07, 23h50 + 20 min" vira "qui 23/07, 00h10", e a conta sai sempre da data do caso, nunca do texto mostrado. Mudar a data do caso depois desloca tudo junto, e é isso que se quer.
- **Menções automáticas:** é o núcleo e a parte mais arriscada. O casamento precisa:
  - normalizar acento e caixa;
  - respeitar limite de palavra ("Ana" não casa em "Banana");
  - preferir o nome mais longo ("João Silva" antes de "João");
  - ler os apelidos;
  - ignorar fichas sem nome.

  Montar um autômato (Aho-Corasick) com os nomes uma vez por campanha e atualizar quando uma ficha muda. Nome curto ou comum ("Rei", "Mãe") gera falso positivo; ter "não marcar no texto" por ficha.
- **Corridas:** um só escritor (o processo principal, better-sqlite3 síncrono) e salvamento com debounce. O canvas salva em lote numa transação. O `.lock` impede duas janelas na mesma campanha. Sem conflito multiusuário nesta versão.
- **Idempotência:** importar o mesmo arquivo duas vezes reaproveita o anexo (hash único). Se `clues:markFound` for chamado de novo, só sobrescreve.
- **Arquivos grandes:** PDFs e tokens ficam na pasta, nunca no banco. Avisar acima de 200 MB por arquivo. As imagens mostram miniatura gerada uma vez.
- **Busca:** FTS5 com `remove_diacritics`, atualizada a cada salvamento. A meta é resposta em menos de 100 ms com milhares de itens, e menos de 3 s da tecla até a ficha aberta (F14).
- **Offline:** total. Nada depende de internet.
- **Backup:** nunca copiar o `campanha.sqlite` com o app aberto (o WAL deixa a cópia incompleta). O backup usa `db.backup()` para tirar uma cópia consistente e só então zipa com os anexos. Restaurar = abrir o `.mesa-backup`, que vira uma pasta de campanha nova, sem sobrescrever a atual. Guardar as últimas 5 automáticas. O `campanha.json` tem número de formato e é testado com um ida-e-volta (exportar, importar, comparar) a cada mudança de esquema; um backup que não restaura não é backup.
- **Segurança do Electron:** `contextIsolation`, sandbox, CSP sem script remoto. HTML colado no editor é limpo pelo esquema do TipTap. Os anexos são servidos só pelo protocolo `mesa://`, nunca por `file://` solto.
- **Migrações:** `campaign.schema_version` e as migrações do Drizzle rodam ao abrir. Fazer backup antes de migrar.
- **Ativos e textos:** nada do Autor (arte, carimbos, textos, fontes). Ícones de biblioteca livre (ex.: Lucide) e fontes OFL.

## Build order

1. **Fatia vertical (feia, ponta a ponta).** Criar uma campanha, criar um NPC com o modelo Ordem Paranormal, criar uma cena com hora no jogo e lugar, escrever o nome do NPC no texto e ver a menção aparecer na ficha, e achar tudo pela busca.
   - Telas: S01 (simples), S03, S04, S05 (lista), S02 (editor dentro da cena), S11.
   - Tabelas: campaign, system_templates, template_fields, entities, scenes, scene_entities, mentions, search_index.
   - Canais: campaign:create/open/recent, entities:list/get/save, templates:list, scenes:list/save, search:query.
   - Prova o stack inteiro: Electron, IPC, SQLite, TipTap, menções e FTS.
2. **Tempo da investigação (must, maior dor da pesquisa).** Relógio, linha do tempo com lacunas e calendário.
   - Telas: N02; hora na cena (S05).
   - Tabelas: timeline_events, timeline_event_entities.
   - Canais: clock:*, timeline:list, events:save.
3. **Pistas (must).** Portfólio, imagem, marcar achada.
   - Telas: N01.
   - Tabelas: attachments, clues, clue_finders, clue_links, game_sessions.
   - Canais: attachments:import/url, clues:*, sessions:list/save.
4. **Canvas / mapa mental (must).** Nós de ficha, pista, cena, card e imagem, ligações, vários quadros.
   - Telas: S06.
   - Tabelas: boards, board_nodes, board_edges.
   - Canais: boards:*.
5. **Fechar os must.** Relações entre fichas, barra de formatação, lixeira, autosave com indicador, biblioteca completa.
   - Telas: S01, S04, S14.
   - Canais: entities:relate, trash:*.
6. **Should.**
   - Tela de sessão N03 (`sessions:current`) e notas de sessão.
   - Importar aventura (PDF na página certa, ligado à cena).
   - Corkboard e modelos de estrutura de investigação.
   - Exportar .docx/.md/.pdf.
   - Backup em arquivo com `legivel/` (Obsidian) e `campanha.json`, restaurar incluído. O gerador de Markdown é o mesmo do "exportar para Obsidian".
   - Ações do projeto (S15b).
7. **Could.** Outros sistemas, versão dos jogadores (sync), Owlbear, idiomas, IA, skins, tutoriais.
8. **Correções do `/replica-entrepreneur`.** Para uso próprio, pode pular. Se for abrir o app para outros mestres, rodar antes.
