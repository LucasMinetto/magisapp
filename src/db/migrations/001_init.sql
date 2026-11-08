-- Migration 001: Initial schema v1
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Ficha do agente (um por campanha por usuário)
CREATE TABLE ficha (
  id TEXT PRIMARY KEY,                    -- UUID da entidade no desktop
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,                  -- jogador dono desta ficha
  sheet_data TEXT NOT NULL,               -- JSON completo FichaAgente (zod validated)
  updated_at TEXT NOT NULL,               -- ISO 8601
  synced_at TEXT,                         -- último sync bem-sucedido
  UNIQUE(campaign_id, user_id)
);
CREATE INDEX idx_ficha_updated_at ON ficha(updated_at);

-- Biblioteca: Rituais (cache local do que o mestre liberou)
CREATE TABLE biblioteca_ritual (
  id TEXT PRIMARY KEY,                    -- UUID local
  source_id TEXT NOT NULL,                -- biblioteca source ID
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
  data TEXT NOT NULL,                     -- JSON completo RitualBiblioteca
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
  data TEXT NOT NULL,                     -- JSON completo ItemBiblioteca
  synced_at TEXT,
  UNIQUE(source_id, nome)
);
CREATE INDEX idx_bib_item_tipo_categoria ON biblioteca_item(tipo, categoria);

-- Regras (cache do JSON filtrado visivelParaJogadores)
CREATE TABLE regras (
  id TEXT PRIMARY KEY,                    -- ex: 'capitulo-3'
  capitulo INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,                 -- HTML/markdown
  pagina_livro INTEGER,
  visivel_para_jogadores INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(capitulo)
);

-- Arquivo do Agente: Pessoas (NPCs "Para os jogadores")
CREATE TABLE arquivo_pessoa (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  retrato_url TEXT,
  o_que_sabe TEXT NOT NULL,               -- cartão "Para os jogadores"
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

-- Arquivo: Anotações livres do jogador
CREATE TABLE arquivo_anotacao (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,                 -- markdown
  linked_pessoa_id TEXT REFERENCES arquivo_pessoa(id) ON DELETE SET NULL,
  linked_lugar_id TEXT REFERENCES arquivo_lugar(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_anotacao_campaign_user ON arquivo_anotacao(campaign_id, user_id);

-- Arquivo: Histórico unificado (versões de cartões + interlúdios)
CREATE TABLE arquivo_historico (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,                     -- 'pessoa_v1' | 'lugar_v2' | 'interludio' | 'anotacao'
  ref_id TEXT NOT NULL,                   -- ID da pessoa/lugar/anotacao
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  autor TEXT NOT NULL,                    -- 'mestre' | 'jogador'
  created_at TEXT NOT NULL
);
CREATE INDEX idx_historico_campaign_user ON arquivo_historico(campaign_id, user_id);

-- Sync Queue (append-only, FIFO)
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  operacao TEXT NOT NULL,                 -- 'pull' | 'push_ficha' | 'push_rolagem' | 'push_anotacao'
  payload TEXT NOT NULL,                  -- JSON do request
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'synced' | 'failed'
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  error TEXT
);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);

-- Auth (tokens, usuário logado)
CREATE TABLE auth (
  key TEXT PRIMARY KEY,                   -- 'current_user' | 'token_<campaign_id>'
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);