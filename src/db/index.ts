import { open, type DB } from '@op-engineering/op-sqlite';

type OpenOptions = {
  name: string;
  location?: string;
  encryptionKey?: string;
  failOnCreate?: boolean;
  readOnly?: boolean;
};

export enum DB_TABLES {
  FICHA = 'ficha',
  BIBLIOTECA_RITUAL = 'biblioteca_ritual',
  BIBLIOTECA_ITEM = 'biblioteca_item',
  REGRAS = 'regras',
  ARQUIVO_PESSOA = 'arquivo_pessoa',
  ARQUIVO_LUGAR = 'arquivo_lugar',
  ARQUIVO_ANOTACAO = 'arquivo_anotacao',
  ARQUIVO_HISTORICO = 'arquivo_historico',
  SYNC_QUEUE = 'sync_queue',
  AUTH = 'auth',
}

let _db: DB | null = null;

export function getDB(): DB {
  if (!_db) {
    _db = open({ name: 'magistrado.db' });
    _db.executeSync('PRAGMA foreign_keys = ON;');
    _db.executeSync('PRAGMA journal_mode = WAL;');
  }
  return _db;
}

export async function openDB(path: string = 'magistrado.db'): Promise<DB> {
  const options: OpenOptions = { name: path };
  if (path === ':memory:') {
    options.location = ':memory:';
  }
  const db = open(options);
  db.executeSync('PRAGMA foreign_keys = ON;');
  db.executeSync('PRAGMA journal_mode = WAL;');
  return db;
}

export async function runMigrations(db: DB): Promise<void> {
  const currentVersion = db.executeSync('PRAGMA user_version;').rows[0]?.version ?? 0;

  if (currentVersion === 0) {
    const statements = [
      'PRAGMA foreign_keys = ON;',
      'PRAGMA journal_mode = WAL;',

      `CREATE TABLE ficha (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        sheet_data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        UNIQUE(campaign_id, user_id)
      )`,
      'CREATE INDEX idx_ficha_updated_at ON ficha(updated_at);',

      `CREATE TABLE biblioteca_ritual (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        elemento TEXT NOT NULL,
        circulo INTEGER NOT NULL,
        execucao TEXT,
        alcance TEXT,
        alvo TEXT,
        duracao TEXT,
        resistencia TEXT,
        efeito TEXT,
        discente TEXT,
        verdadeiro TEXT,
        dano_normal TEXT,
        dano_discente TEXT,
        dano_verdadeiro TEXT,
        tipo_dano TEXT,
        alvo_tipo TEXT,
        pagina INTEGER,
        data TEXT NOT NULL,
        synced_at TEXT,
        UNIQUE(source_id, nome)
      )`,
      'CREATE INDEX idx_bib_ritual_elemento_circulo ON biblioteca_ritual(elemento, circulo);',

      `CREATE TABLE biblioteca_item (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        categoria INTEGER NOT NULL,
        espacos REAL NOT NULL,
        defesa REAL NOT NULL,
        dano TEXT,
        tipo_dano TEXT,
        critico TEXT,
        alcance TEXT,
        proficiencia TEXT,
        empunhadura TEXT,
        elemento TEXT,
        descricao TEXT,
        quantidade INTEGER NOT NULL DEFAULT 1,
        pagina INTEGER,
        data TEXT NOT NULL,
        synced_at TEXT,
        UNIQUE(source_id, nome)
      )`,
      'CREATE INDEX idx_bib_item_tipo_categoria ON biblioteca_item(tipo, categoria);',

      `CREATE TABLE regras (
        id TEXT PRIMARY KEY,
        capitulo INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        pagina_livro INTEGER,
        visivel_para_jogadores INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        UNIQUE(capitulo)
      )`,

      `CREATE TABLE arquivo_pessoa (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        retrato_url TEXT,
        o_que_sabe TEXT NOT NULL,
        versao_atual INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        UNIQUE(campaign_id, user_id, id)
      )`,

      `CREATE TABLE arquivo_lugar (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        imagem_url TEXT,
        descricao_publica TEXT NOT NULL,
        versao_atual INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        UNIQUE(campaign_id, user_id, id)
      )`,

      `CREATE TABLE arquivo_anotacao (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        titulo TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        linked_pessoa_id TEXT REFERENCES arquivo_pessoa(id) ON DELETE SET NULL,
        linked_lugar_id TEXT REFERENCES arquivo_lugar(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX idx_anotacao_campaign_user ON arquivo_anotacao(campaign_id, user_id);',

      `CREATE TABLE arquivo_historico (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        titulo TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        autor TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX idx_historico_campaign_user ON arquivo_historico(campaign_id, user_id);',

      `CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        operacao TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        tentativas INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        processed_at TEXT,
        error TEXT
      )`,
      'CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);',

      `CREATE TABLE auth (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ];
    await db.executeBatch(statements.map(s => [s]));
    db.executeSync('PRAGMA user_version = 1;');
  }
  // Future migrations: if (currentVersion === 1) { ... }
}

export function closeDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}