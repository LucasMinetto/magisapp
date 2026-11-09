-- Schema reference (v1 = migrations/001_init.sql, v2 = migrations/002_rolagens.sql)
-- Shared types mapping (shared/ordem/esquemas.ts, shared/types.ts):
-- ficha              -> FichaAgente (zod), FichaAgenteDB (types.ts)
-- biblioteca_ritual  -> RitualBiblioteca (zod), RitualBibliotecaDB (types.ts)
-- biblioteca_item    -> ItemBiblioteca (zod), ItemBibliotecaDB (types.ts)
-- regras             -> RegraLivro (zod), RegraLivroDB (types.ts)
-- arquivo_pessoa     -> ArquivoPessoa (zod), ArquivoPessoaDB (types.ts)
-- arquivo_lugar      -> ArquivoLugar (zod), ArquivoLugarDB (types.ts)
-- arquivo_anotacao   -> ArquivoAnotacao (zod), ArquivoAnotacaoDB (types.ts)
-- arquivo_historico  -> ArquivoHistorico (zod), ArquivoHistoricoDB (types.ts)
-- sync_queue         -> SyncQueueItem (zod), SyncQueueItemDB (types.ts)
-- auth               -> AuthEntry (zod), AuthEntryDB (types.ts)

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Ficha do agente (um por campanha por usuário)
CREATE TABLE ficha (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sheet_data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE(campaign_id, user_id)
);
CREATE INDEX idx_ficha_updated_at ON ficha(updated_at);

-- Biblioteca: Rituais
CREATE TABLE biblioteca_ritual (
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
);
CREATE INDEX idx_bib_ritual_elemento_circulo ON biblioteca_ritual(elemento, circulo);

-- Biblioteca: Itens
CREATE TABLE biblioteca_item (
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
);
CREATE INDEX idx_bib_item_tipo_categoria ON biblioteca_item(tipo, categoria);

-- Regras
CREATE TABLE regras (
  id TEXT PRIMARY KEY,
  capitulo INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  pagina_livro INTEGER,
  visivel_para_jogadores INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(capitulo)
);

-- Arquivo: Pessoas
CREATE TABLE arquivo_pessoa (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  retrato_url TEXT,
  o_que_sabe TEXT NOT NULL,
  versao_atual INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, user_id, id)
);

-- Arquivo: Lugares
CREATE TABLE arquivo_lugar (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  imagem_url TEXT,
  descricao_publica TEXT NOT NULL,
  versao_atual INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, user_id, id)
);

-- Arquivo: Anotações
CREATE TABLE arquivo_anotacao (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  linked_pessoa_id TEXT REFERENCES arquivo_pessoa(id) ON DELETE SET NULL,
  linked_lugar_id TEXT REFERENCES arquivo_lugar(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_anotacao_campaign_user ON arquivo_anotacao(campaign_id, user_id);

-- Arquivo: Histórico
CREATE TABLE arquivo_historico (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  autor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (tipo IN ('pessoa_v1', 'lugar_v2', 'interludio', 'anotacao'))
);
CREATE INDEX idx_historico_campaign_user ON arquivo_historico(campaign_id, user_id);

-- Sync Queue
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  operacao TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  error TEXT,
  CHECK (operacao IN ('pull', 'push_ficha', 'push_rolagem', 'push_anotacao'))
);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);

-- Auth
CREATE TABLE auth (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (key = 'current_user' OR key LIKE 'token_%')
);

-- Rolagens (v2): histórico de rolagens do jogador
CREATE TABLE rolagens (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  rotulo TEXT,
  formula TEXT NOT NULL,
  dados TEXT NOT NULL,
  total INTEGER NOT NULL,
  critico INTEGER NOT NULL DEFAULT 0,
  falha INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  CHECK (tipo IN ('teste', 'ataque', 'dano', 'ritual', 'livre'))
);
CREATE INDEX idx_rolagens_campaign_user_created ON rolagens(campaign_id, user_id, created_at);
