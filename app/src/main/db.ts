import Database from 'better-sqlite3'
import schema from './schema.sql?raw'

export type DB = Database.Database

export const SCHEMA_VERSION = 4

/** Migração n leva o banco da versão n-1 para n. O schema.sql é sempre a versão 1. */
const MIGRATIONS: Record<number, string> = {
  2: 'alter table campaign add column cover_id text references attachments(id) on delete set null;',
  // Mapa do lugar (imagem pronta da internet) e blocos de notas do mestre por cena.
  3: `alter table entities add column map_id text references attachments(id) on delete set null;
      create table scene_notes (
        id          text primary key,
        scene_id    text not null references scenes(id) on delete cascade,
        title       text not null default '',
        body        text not null default '',
        sort        integer not null default 0,
        created_at  text not null,
        updated_at  text not null
      );
      create index scene_notes_scene on scene_notes (scene_id, sort);`,
  // Magistrado: criatura vira ameaça, ficha completa ou compacta, origem da biblioteca, rolagens e iniciativa.
  // O CHECK de kind só muda reconstruindo a tabela; os ids ficam (cenas, quadros e menções apontam para eles).
  4: `create table entities_v4 (
        id                   text primary key,
        kind                 text not null check (kind in ('personagem','ameaca','local','grupo','lore')),
        is_player            integer not null default 0 check (is_player in (0, 1)),
        name                 text not null default '',
        role                 text not null default '',
        aliases              text not null default '[]',
        portrait_id          text references attachments(id) on delete set null,
        system_template_id   text references system_templates(id) on delete set null,
        stats                text not null default '{}',
        fields               text not null default '{}',
        custom_attributes    text not null default '[]',
        description          text not null default '',
        personality          text not null default '',
        notes                text,
        parent_location_id   text references entities(id) on delete set null,
        deleted_at           text,
        created_at           text not null,
        updated_at           text not null,
        map_id               text references attachments(id) on delete set null,
        sheet                text not null default 'compacta' check (sheet in ('compacta','completa')),
        sheet_data           text not null default '{}',
        origin               text
      );
      insert into entities_v4 (id, kind, is_player, name, role, aliases, portrait_id, system_template_id, stats, fields, custom_attributes,
        description, personality, notes, parent_location_id, deleted_at, created_at, updated_at, map_id, sheet)
      select id, case kind when 'criatura' then 'ameaca' else kind end, is_player, name, role, aliases, portrait_id, system_template_id, stats,
        fields, custom_attributes, description, personality, notes, parent_location_id, deleted_at, created_at, updated_at, map_id,
        case when is_player = 1 then 'completa' else 'compacta' end
      from entities;
      drop table entities;
      alter table entities_v4 rename to entities;
      create index entities_kind_name on entities (kind, name) where deleted_at is null;
      create index entities_portrait on entities (portrait_id);
      create index entities_template on entities (system_template_id);
      create index entities_parent on entities (parent_location_id);
      create index entities_deleted on entities (deleted_at) where deleted_at is not null;

      create table template_fields_v4 (
        id           text primary key,
        template_id  text not null references system_templates(id) on delete cascade,
        entity_kind  text not null check (entity_kind in ('personagem','ameaca','local','grupo','lore')),
        key          text not null,
        label        text not null,
        type         text not null check (type in ('number','text','longtext','select','list','resource')),
        group_name   text not null default '',
        options      text not null default '{}',
        sort         integer not null default 0,
        created_at   text not null,
        updated_at   text not null,
        unique (template_id, entity_kind, key)
      );
      insert into template_fields_v4 select id, template_id, case entity_kind when 'criatura' then 'ameaca' else entity_kind end,
        key, label, type, group_name, options, sort, created_at, updated_at from template_fields;
      drop table template_fields;
      alter table template_fields_v4 rename to template_fields;
      create index template_fields_template on template_fields (template_id, entity_kind, sort);

      create table rolls (
        id               text primary key,
        entity_id        text references entities(id) on delete cascade,
        game_session_id  text references game_sessions(id) on delete set null,
        game_minute      integer,
        who              text not null default '',
        label            text not null default '',
        type             text not null default 'livre' check (type in ('teste','ataque','dano','ritual','livre')),
        formula          text not null default '',
        dice             text not null default '[]',
        total            integer not null default 0,
        critical         integer not null default 0 check (critical in (0, 1)),
        detail           text not null default '',
        created_at       text not null
      );
      create index rolls_entity on rolls (entity_id, created_at);
      create index rolls_session on rolls (game_session_id, created_at);

      alter table game_sessions add column initiative text not null default '{}';`
}

/** Banco vazio numa versão antiga, sem a linha de campaign. Só para os testes de migração. */
export function createDbAtVersion(file: string, version: number): DB {
  const db = new Database(file)
  db.exec(schema)
  for (let v = 2; v <= version; v++) db.exec(MIGRATIONS[v])
  return db
}

/** Banco vazio já na versão atual, sem a linha de campaign (para restaurar do campanha.json). */
export function createEmptyDb(file: string): DB {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(schema)
  for (let v = 2; v <= SCHEMA_VERSION; v++) db.exec(MIGRATIONS[v])
  return db
}

export const nowIso = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

/**
 * Abre o banco de uma campanha. Com `init`, cria o arquivo: aplica o esquema e roda `init`
 * (que insere a linha de campaign) na mesma transação.
 */
export function openDb(file: string, init?: (db: DB) => void): DB {
  const db = new Database(file, { fileMustExist: !init })
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  if (init) {
    // Campanha nova já nasce na versão atual: o init (modelo Ordem) usa o esquema novo.
    db.transaction(() => {
      db.exec(schema)
      for (let v = 2; v <= SCHEMA_VERSION; v++) db.exec(MIGRATIONS[v])
      init(db)
      db.prepare('update campaign set schema_version = ?').run(SCHEMA_VERSION)
    })()
  }
  const row = db.prepare('select schema_version as v from campaign').get() as { v: number } | undefined
  if (!row) throw new Error('Este arquivo não é uma campanha (tabela campaign vazia).')
  if (row.v > SCHEMA_VERSION) throw new Error('Campanha criada numa versão mais nova do app. Atualize o app para abrir.')
  if (row.v < SCHEMA_VERSION) {
    // Cópia do banco antes de mexer no esquema (VACUUM INTO é síncrono e consistente com o WAL).
    if (!init) db.exec(`vacuum into '${`${file}.v${row.v}.bak`.replaceAll("'", "''")}'`)
    // Reconstruir uma tabela com as chaves ligadas apagaria em cascata o que aponta para ela.
    // O pragma só muda fora de transação; as chaves são conferidas no fim.
    db.pragma('foreign_keys = OFF')
    try {
      db.transaction(() => {
        for (let v = row.v + 1; v <= SCHEMA_VERSION; v++) {
          db.exec(MIGRATIONS[v])
          db.prepare('update campaign set schema_version = ?').run(v)
        }
        const broken = db.pragma('foreign_key_check') as unknown[]
        if (broken.length) throw new Error(`A atualização da campanha deixou ${broken.length} referências quebradas. Nada foi mudado.`)
      })()
    } finally {
      db.pragma('foreign_keys = ON')
    }
  }
  return db
}
