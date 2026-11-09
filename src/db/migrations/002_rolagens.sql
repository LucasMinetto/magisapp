-- Migration 002: histórico de rolagens do jogador
CREATE TABLE rolagens (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('teste', 'ataque', 'dano', 'ritual', 'livre')),
  rotulo TEXT,
  formula TEXT NOT NULL,
  dados TEXT NOT NULL,              -- JSON com os dados individuais da rolagem
  total INTEGER NOT NULL,
  critico INTEGER NOT NULL DEFAULT 0,
  falha INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,         -- ISO 8601
  synced_at TEXT
);
CREATE INDEX idx_rolagens_campaign_user_created ON rolagens(campaign_id, user_id, created_at);
