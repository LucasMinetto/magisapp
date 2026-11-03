-- Esquema da campanha (SQLite). Um arquivo por campanha: <Campanha>/campanha.sqlite
-- Não há tabela "campaign_id" em cada linha: a campanha É o arquivo.
-- Aplicar na abertura de cada conexão:
--   PRAGMA foreign_keys = ON;
--   PRAGMA journal_mode = WAL;
--
-- Convenções
--   id          TEXT uuid v4 gerado no app (crypto.randomUUID), pronto para sync futuro
--   *_at        TEXT ISO-8601 em UTC ('2026-11-02T08:24:00.000Z'), hora real
--   game_minute INTEGER minutos desde 00:00 da data do caso (campaign.epoch_date), hora NO JOGO,
--               sem fuso nem horário de verão; negativo = antes do chamado
--   deleted_at  lixeira: preenchido = na lixeira; apagado de vez após 60 dias
--   body        JSON do documento TipTap/ProseMirror

-- ---------------------------------------------------------------- campanha

create table campaign (
  id                  text primary key,
  singleton           integer not null default 1 unique check (singleton = 1),
  name                text not null,
  system_template_id  text references system_templates(id) on delete set null,
  epoch_date          text not null                         -- data do caso 'YYYY-MM-DD' (ex.: '2026-07-22'), obrigatória
                        check (epoch_date glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and date(epoch_date) = epoch_date),
  current_game_minute integer not null default 0,
  tagline             text,
  schema_version      integer not null default 1,
  created_at          text not null,
  updated_at          text not null
);

-- ---------------------------------------------------------------- sistemas e fichas

create table system_templates (
  id          text primary key,
  name        text not null,                   -- 'Ordem Paranormal'
  builtin     integer not null default 0 check (builtin in (0, 1)),
  created_at  text not null,
  updated_at  text not null
);

create table template_fields (
  id           text primary key,
  template_id  text not null references system_templates(id) on delete cascade,
  entity_kind  text not null check (entity_kind in ('personagem','criatura','local','grupo','lore')),
  key          text not null,                  -- 'nex', 'pv', 'sanidade', 'agi'...
  label        text not null,
  type         text not null check (type in ('number','text','longtext','select','list','resource')),
  group_name   text not null default '',       -- 'Atributos', 'Recursos', 'Rituais'
  options      text not null default '{}',     -- JSON: opções do select, min/max, fórmula
  sort         integer not null default 0,
  created_at   text not null,
  updated_at   text not null,
  unique (template_id, entity_kind, key)
);
create index template_fields_template on template_fields (template_id, entity_kind, sort);

create table attachments (
  id          text primary key,
  kind        text not null check (kind in ('imagem','pdf','token','mapa','outro')),
  file_name   text not null,                   -- nome original
  rel_path    text not null unique,            -- 'anexos/bilhete-rasgado-3f9a2c.png': nome legível + 6 letras do hash
  mime        text not null,
  size_bytes  integer not null check (size_bytes >= 0),
  sha256      text not null unique,            -- mesmo arquivo importado duas vezes = um anexo
  width       integer,
  height      integer,
  deleted_at  text,
  created_at  text not null,
  updated_at  text not null
);
create index attachments_kind on attachments (kind) where deleted_at is null;

create table entities (
  id                   text primary key,
  kind                 text not null check (kind in ('personagem','criatura','local','grupo','lore')),
  is_player            integer not null default 0 check (is_player in (0, 1)),  -- personagem de jogador
  name                 text not null default '',
  role                 text not null default '',          -- "papel na história"
  aliases              text not null default '[]',        -- JSON array, usado nas menções
  portrait_id          text references attachments(id) on delete set null,
  system_template_id   text references system_templates(id) on delete set null,
  stats                text not null default '{}',        -- JSON: valores dos template_fields
  fields               text not null default '{}',        -- JSON: identidade, vida, aparência
  custom_attributes    text not null default '[]',        -- JSON [{label, value}]
  description          text not null default '',
  personality          text not null default '',
  notes                text,                              -- JSON TipTap
  parent_location_id   text references entities(id) on delete set null,  -- sala dentro do prédio
  deleted_at           text,
  created_at           text not null,
  updated_at           text not null
);
create index entities_kind_name on entities (kind, name) where deleted_at is null;
create index entities_portrait on entities (portrait_id);
create index entities_template on entities (system_template_id);
create index entities_parent on entities (parent_location_id);
create index entities_deleted on entities (deleted_at) where deleted_at is not null;

create table entity_relations (
  id          text primary key,
  from_id     text not null references entities(id) on delete cascade,
  to_id       text not null references entities(id) on delete cascade,
  label       text not null default '',        -- 'irmão de', 'membro de', 'esconde-se em'
  created_at  text not null,
  updated_at  text not null,
  check (from_id <> to_id)
);
create index entity_relations_from on entity_relations (from_id);
create index entity_relations_to on entity_relations (to_id);

-- ---------------------------------------------------------------- cenas, texto e tempo

create table scenes (
  id                 text primary key,
  title              text not null default '',
  summary            text not null default '',
  body               text,                     -- JSON TipTap: texto para ler em voz alta + notas
  sort               integer not null default 0,
  act                text not null default '', -- agrupador livre ou beat do modelo
  status             text not null default 'planejada'
                       check (status in ('planejada','jogada','pulada')),
  location_id        text references entities(id) on delete set null,
  game_minute_start  integer,
  game_minute_end    integer,
  deleted_at         text,
  created_at         text not null,
  updated_at         text not null,
  check (game_minute_end is null or game_minute_start is not null),
  check (game_minute_end is null or game_minute_end >= game_minute_start)
);
create index scenes_sort on scenes (sort) where deleted_at is null;
create index scenes_time on scenes (game_minute_start) where deleted_at is null;
create index scenes_location on scenes (location_id);

create table scene_entities (                  -- NPCs e criaturas presentes na cena
  scene_id   text not null references scenes(id) on delete cascade,
  entity_id  text not null references entities(id) on delete cascade,
  primary key (scene_id, entity_id)
);
create index scene_entities_entity on scene_entities (entity_id);

create table scene_attachments (               -- páginas do PDF, tokens, imagens da cena
  scene_id       text not null references scenes(id) on delete cascade,
  attachment_id  text not null references attachments(id) on delete cascade,
  pdf_page       integer check (pdf_page is null or pdf_page >= 1),
  primary key (scene_id, attachment_id)
);
create index scene_attachments_attachment on scene_attachments (attachment_id);

create table documents (                       -- páginas livres: introdução, regras da casa, aventura importada
  id          text primary key,
  title       text not null default '',
  body        text,
  sort        integer not null default 0,
  deleted_at  text,
  created_at  text not null,
  updated_at  text not null
);
create index documents_sort on documents (sort) where deleted_at is null;

create table timeline_events (
  id                 text primary key,
  title              text not null,
  description        text not null default '',
  game_minute_start  integer not null,
  game_minute_end    integer,
  scene_id           text references scenes(id) on delete set null,
  location_id        text references entities(id) on delete set null,
  if_ignored         text not null default '',  -- o que acontece se os jogadores não agirem
  status             text not null default 'planejado'
                       check (status in ('planejado','aconteceu','evitado')),
  deleted_at         text,
  created_at         text not null,
  updated_at         text not null,
  check (game_minute_end is null or game_minute_end >= game_minute_start)
);
create index timeline_events_time on timeline_events (game_minute_start) where deleted_at is null;
create index timeline_events_scene on timeline_events (scene_id);
create index timeline_events_location on timeline_events (location_id);

create table timeline_event_entities (
  event_id   text not null references timeline_events(id) on delete cascade,
  entity_id  text not null references entities(id) on delete cascade,
  primary key (event_id, entity_id)
);
create index timeline_event_entities_entity on timeline_event_entities (entity_id);

-- ---------------------------------------------------------------- sessões de jogo e pistas

create table game_sessions (
  id                 text primary key,
  number             integer not null unique check (number >= 1),
  played_on          text,                     -- data real 'YYYY-MM-DD' (local, sem hora)
  game_minute_start  integer,
  game_minute_end    integer,
  notes              text,                     -- JSON TipTap
  deleted_at         text,
  created_at         text not null,
  updated_at         text not null
);

create table clues (
  id                  text primary key,
  title               text not null,
  description         text not null default '',
  image_id            text references attachments(id) on delete set null,
  planned_scene_id    text references scenes(id) on delete set null,     -- onde o mestre plantou
  location_id         text references entities(id) on delete set null,   -- onde está / foi achada
  status              text not null default 'oculta'
                        check (status in ('oculta','achada','entendida')),
  found_game_minute   integer,
  found_session_id    text references game_sessions(id) on delete set null,
  reveals             text not null default '',  -- o que a pista prova (só o mestre vê)
  sort                integer not null default 0,
  deleted_at          text,
  created_at          text not null,
  updated_at          text not null,
  check (status = 'oculta' or found_session_id is not null or found_game_minute is not null)
);
create index clues_status on clues (status, sort) where deleted_at is null;
create index clues_image on clues (image_id);
create index clues_scene on clues (planned_scene_id);
create index clues_location on clues (location_id);
create index clues_session on clues (found_session_id);

create table clue_finders (                    -- quais personagens de jogador acharam
  clue_id    text not null references clues(id) on delete cascade,
  entity_id  text not null references entities(id) on delete cascade,
  primary key (clue_id, entity_id)
);
create index clue_finders_entity on clue_finders (entity_id);

create table clue_links (                      -- pista aponta para NPC, lugar, outra pista...
  clue_id    text not null references clues(id) on delete cascade,
  entity_id  text not null references entities(id) on delete cascade,
  primary key (clue_id, entity_id)
);
create index clue_links_entity on clue_links (entity_id);

-- ---------------------------------------------------------------- canvas (mapa mental)

create table boards (
  id          text primary key,
  name        text not null default 'Quadro',
  viewport    text not null default '{"x":0,"y":0,"zoom":1}',
  sort        integer not null default 0,
  deleted_at  text,
  created_at  text not null,
  updated_at  text not null
);

create table board_nodes (
  id             text primary key,
  board_id       text not null references boards(id) on delete cascade,
  type           text not null check (type in ('card','entity','clue','scene','image','text')),
  entity_id      text references entities(id) on delete cascade,
  clue_id        text references clues(id) on delete cascade,
  scene_id       text references scenes(id) on delete cascade,
  attachment_id  text references attachments(id) on delete cascade,
  content        text not null default '',     -- texto do card / nota
  color          text,
  x              real not null default 0,
  y              real not null default 0,
  w              real,
  h              real,
  created_at     text not null,
  updated_at     text not null,
  check (
    (type = 'entity' and entity_id is not null) or
    (type = 'clue'   and clue_id is not null) or
    (type = 'scene'  and scene_id is not null) or
    (type = 'image'  and attachment_id is not null) or
    (type in ('card','text'))
  )
);
create index board_nodes_board on board_nodes (board_id);
create index board_nodes_entity on board_nodes (entity_id);
create index board_nodes_clue on board_nodes (clue_id);
create index board_nodes_scene on board_nodes (scene_id);
create index board_nodes_attachment on board_nodes (attachment_id);

create table board_edges (
  id          text primary key,
  board_id    text not null references boards(id) on delete cascade,
  from_node   text not null references board_nodes(id) on delete cascade,
  to_node     text not null references board_nodes(id) on delete cascade,
  label       text not null default '',
  created_at  text not null,
  updated_at  text not null,
  check (from_node <> to_node)
);
create index board_edges_board on board_edges (board_id);
create index board_edges_from on board_edges (from_node);
create index board_edges_to on board_edges (to_node);

-- ---------------------------------------------------------------- modelos de estrutura (should)

create table structure_templates (
  id          text primary key,
  name        text not null unique,
  builtin     integer not null default 0 check (builtin in (0, 1)),
  beats       text not null default '[]',      -- JSON [{name, description}]
  created_at  text not null,
  updated_at  text not null
);

-- ---------------------------------------------------------------- índices derivados (reconstruíveis)

-- Menções: onde cada ficha aparece. Recalculado pelo app ao salvar um texto; pode ser apagado e refeito.
create table mentions (
  entity_id    text not null references entities(id) on delete cascade,
  source_type  text not null check (source_type in ('scene','document','clue','session','entity')),
  source_id    text not null,                  -- polimórfico: sem FK; o app limpa ao apagar a origem
  hits         integer not null check (hits >= 1),
  primary key (entity_id, source_type, source_id)
);
create index mentions_source on mentions (source_type, source_id);

-- Busca global (paleta de comando). Sem acento, sem caixa: "joao" acha "João".
create virtual table search_index using fts5 (
  ref_type unindexed,                          -- 'entity','scene','clue','document','session','event'
  ref_id   unindexed,
  title,
  body,
  tokenize = "unicode61 remove_diacritics 2"
);
