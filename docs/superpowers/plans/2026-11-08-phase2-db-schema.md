# Phase 2: DB Local (op-sqlite) + Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create local SQLite database with op-sqlite for offline-first storage of ficha, biblioteca (rituais/itens), regras, arquivo, sync queue, and auth data.

**Architecture:** op-sqlite provides SQLite on iOS/Android/Web (WASM). Single database file with 7 tables. Schema migrations via versioned SQL files. React hooks wrap CRUD operations. All writes go through sync queue for eventual consistency with desktop.

**Tech Stack:** @op-engineering/op-sqlite (v1.x), React hooks, TypeScript, zod for validation (from shared/esquemas.ts)

**Spec:** task_plan.md (Phase 2), findings.md (Banco Local no Mobile, Dados que o Mobile Precisa)

## Global Constraints

- Database file: `magistrado.db` in app document directory (op-sqlite default)
- Schema version: 1 (initial)
- All timestamps: ISO 8601 UTC strings
- UUIDs: crypto.randomUUID()
- Sync queue: append-only, processed FIFO, items marked `synced` after ack
- Foreign keys: ON (enforced by op-sqlite)
- WAL mode: ON for concurrent reads/writes
- No direct server calls from UI — all writes go through sync queue
- Reuse types from `shared/ordem/esquemas.ts` and `shared/types.ts`

## Review Focus

1. **Offline writes lost on app uninstall** — sync queue must persist until server ack; test: kill app mid-sync, reopen, queue processes
2. **Schema migration breaks existing data** — migration scripts must be idempotent and preserve user data; test: v1→v2 with seeded data
3. **Race condition: simultaneous sync + local edit** — last-write-wins per field with timestamp; test: two rapid edits, one offline, one online
4. **Large biblioteca import OOM** — batch inserts in transactions of 100 rows; test: import 500 rituais + 500 itens
5. **Corrupt DB on power loss mid-transaction** — WAL + op-sqlite transactions are atomic; test: simulate crash during bulk insert

---

### Task 1: Database Init + Schema v1

**Files:**
- Create: `src/db/index.ts`
- Create: `src/db/schema.sql`
- Create: `src/db/migrations/001_init.sql`
- Test: `src/db/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `openDB(): Promise<SQLiteDatabase>`, `runMigrations(db): Promise<void>`, `DB_TABLES` enum

- [ ] **Step 1: Write failing test for schema creation**

```typescript
// src/db/__tests__/schema.test.ts
import { openDB, runMigrations, DB_TABLES } from '../index';
import { describe, it, expect, beforeEach } from 'vitest';

describe('DB Schema v1', () => {
  let db: SQLiteDatabase;
  beforeEach(async () => {
    db = await openDB(':memory:');
    await runMigrations(db);
  });

  it('creates all 7 tables', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const names = tables.map(t => t.name).sort();
    expect(names).toEqual([
      'ficha',
      'biblioteca_ritual',
      'biblioteca_item',
      'regras',
      'arquivo_pessoa',
      'arquivo_lugar',
      'arquivo_anotacao',
      'arquivo_historico',
      'sync_queue',
      'auth',
    ].sort());
  });

  it('enforces foreign keys', async () => {
    await expect(db.runAsync(
      "INSERT INTO biblioteca_ritual (id, ficha_id, nome) VALUES ('r1', 'nonexistent', 'Test')"
    )).rejects.toThrow();
  });

  it('has indexes on sync_queue.status and ficha.updated_at', async () => {
    const indexes = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index'"
    );
    const names = indexes.map(i => i.name);
    expect(names).toContain('idx_sync_queue_status');
    expect(names).toContain('idx_ficha_updated_at');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/__tests__/schema.test.ts`
Expected: FAIL — `openDB` not defined

- [ ] **Step 3: Implement schema.sql + migrations/001_init.sql**

```sql
-- src/db/migrations/001_init.sql
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
```

- [ ] **Step 4: Implement src/db/index.ts**

```typescript
// src/db/index.ts
import { openDatabaseSync, SQLiteDatabase } from '@op-engineering/op-sqlite';
import * as FileSystem from 'expo-file-system';

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

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (!_db) {
    _db = openDatabaseSync('magistrado.db');
    _db.execSync('PRAGMA foreign_keys = ON;');
    _db.execSync('PRAGMA journal_mode = WAL;');
  }
  return _db;
}

export async function openDB(path: string = 'magistrado.db'): Promise<SQLiteDatabase> {
  const db = openDatabaseSync(path);
  db.execSync('PRAGMA foreign_keys = ON;');
  db.execSync('PRAGMA journal_mode = WAL;');
  return db;
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const currentVersion = db.getFirstSync<{ version: number }>(
    "PRAGMA user_version;"
  )?.version ?? 0;

  if (currentVersion === 0) {
    const migrationSQL = `
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      -- (copie o conteúdo de migrations/001_init.sql aqui)
    `;
    db.execSync(migrationSQL);
    db.execSync('PRAGMA user_version = 1;');
  }
  // Futuras migrações: if (currentVersion === 1) { ... }
}

export function closeDB(): void {
  if (_db) {
    _db.closeSync();
    _db = null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/db/__tests__/schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.sql src/db/migrations/001_init.sql src/db/index.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): schema v1 with 7 tables, indexes, FK, WAL mode"
```

---

### Task 2: CRUD Hooks (useFicha, useBiblioteca, useRegras, useArquivo, useSyncQueue, useAuthDB)

**Files:**
- Create: `src/hooks/useFicha.ts`
- Create: `src/hooks/useBiblioteca.ts`
- Create: `src/hooks/useRegras.ts`
- Create: `src/hooks/useArquivo.ts`
- Create: `src/hooks/useSyncQueue.ts`
- Create: `src/hooks/useAuthDB.ts`
- Test: `src/hooks/__tests__/useFicha.test.ts` (representativo)

**Interfaces:**
- Consumes: `getDB()`, `DB_TABLES`, types from `shared/ordem/esquemas.ts` (FichaAgente, RitualBiblioteca, ItemBiblioteca)
- Produces: hooks returning `{ data, loading, error, create, update, delete, upsert }`

- [ ] **Step 1: Write failing test for useFicha**

```typescript
// src/hooks/__tests__/useFicha.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useFicha } from '../useFicha';
import { getDB } from '@/db';

describe('useFicha', () => {
  beforeEach(async () => {
    const db = getDB();
    await db.execAsync('DELETE FROM ficha');
  });

  it('upsert + getByCampaignUser', async () => {
    const { result } = renderHook(() => useFicha('camp-1', 'user-1'));
    await act(async () => {
      await result.current.upsert({
        id: 'ficha-1',
        sheet_data: { jogador: 'Teste', classe: 'Combatente', nex: 5 } as any,
        updated_at: new Date().toISOString(),
      });
    });
    const ficha = await result.current.getByCampaignUser();
    expect(ficha).not.toBeNull();
    expect(ficha!.id).toBe('ficha-1');
  });

  it('marks synced_at on sync', async () => {
    const { result } = renderHook(() => useFicha('camp-1', 'user-1'));
    await act(async () => {
      await result.current.upsert({ id: 'f-1', sheet_data: {}, updated_at: new Date().toISOString() });
      await result.current.markSynced('f-1');
    });
    const ficha = await result.current.getById('f-1');
    expect(ficha!.synced_at).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useFicha.test.ts`
Expected: FAIL — hook not defined

- [ ] **Step 3: Implement useFicha.ts (padrão para os outros)**

```typescript
// src/hooks/useFicha.ts
import { useCallback, useState } from 'react';
import { getDB } from '@/db';
import { DB_TABLES } from '@/db';
import type { FichaAgente } from 'shared/ordem/esquemas';

interface FichaRow {
  id: string;
  campaign_id: string;
  user_id: string;
  sheet_data: string; // JSON
  updated_at: string;
  synced_at: string | null;
}

export function useFicha(campaignId: string, userId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const rowToFicha = (row: FichaRow) => ({
    ...row,
    sheet_data: JSON.parse(row.sheet_data) as FichaAgente,
  });

  const upsert = useCallback(async (input: {
    id: string;
    sheet_data: FichaAgente;
    updated_at: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      db.runSync(
        `INSERT INTO ${DB_TABLES.FICHA} (id, campaign_id, user_id, sheet_data, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(campaign_id, user_id) DO UPDATE SET
           sheet_data = excluded.sheet_data,
           updated_at = excluded.updated_at,
           id = excluded.id`,
        [input.id, campaignId, userId, JSON.stringify(input.sheet_data), input.updated_at]
      );
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [campaignId, userId]);

  const getByCampaignUser = useCallback(async () => {
    const row = db.getFirstSync<FichaRow>(
      `SELECT * FROM ${DB_TABLES.FICHA} WHERE campaign_id = ? AND user_id = ?`,
      [campaignId, userId]
    );
    return row ? rowToFicha(row) : null;
  }, [campaignId, userId]);

  const getById = useCallback(async (id: string) => {
    const row = db.getFirstSync<FichaRow>(
      `SELECT * FROM ${DB_TABLES.FICHA} WHERE id = ?`,
      [id]
    );
    return row ? rowToFicha(row) : null;
  }, []);

  const markSynced = useCallback(async (id: string) => {
    db.runSync(
      `UPDATE ${DB_TABLES.FICHA} SET synced_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );
  }, []);

  return { loading, error, upsert, getByCampaignUser, getById, markSynced };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useFicha.test.ts`
Expected: PASS

- [ ] **Step 5: Implement remaining hooks (useBiblioteca, useRegras, useArquivo, useSyncQueue, useAuthDB) following same pattern**

Each hook: CRUD + sync markers + indexes for queries. useSyncQueue adds `enqueue(operacao, payload)`, `processNext()`, `markSynced(id)`, `markFailed(id, error)`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFicha.ts src/hooks/useBiblioteca.ts src/hooks/useRegras.ts src/hooks/useArquivo.ts src/hooks/useSyncQueue.ts src/hooks/useAuthDB.ts src/hooks/__tests__/useFicha.test.ts
git commit -m "feat(hooks): CRUD hooks for all 7 tables with sync integration"
```

---

### Task 3: Seed Data + Integration Test

**Files:**
- Create: `src/db/seed.ts`
- Test: `src/db/__tests__/integration.test.ts`

**Interfaces:**
- Consumes: all hooks from Task 2
- Produces: seeded DB for manual testing

- [ ] **Step 1: Write integration test**

```typescript
// src/db/__tests__/integration.test.ts
import { getDB, runMigrations } from '../index';
import { useFicha } from '@/hooks/useFicha';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { renderHook, act } from '@testing-library/react-native';

describe('DB Integration', () => {
  let db: SQLiteDatabase;
  beforeEach(async () => {
    db = await openDB(':memory:');
    await runMigrations(db);
  });

  it('full cycle: seed → upsert ficha → add ritual → enqueue sync → process', async () => {
    // seed
    await seedDatabase(db);
    
    // ficha
    const { result: fichaHook } = renderHook(() => useFicha('camp-1', 'user-1'));
    await act(async () => {
      await fichaHook.current.upsert({ id: 'f-1', sheet_data: { jogador: 'João' } as any, updated_at: new Date().toISOString() });
    });
    const ficha = await fichaHook.current.getByCampaignUser();
    expect(ficha).toBeTruthy();

    // biblioteca
    const { result: bibHook } = renderHook(() => useBiblioteca('camp-1'));
    await act(async () => {
      await bibHook.current.upsertRitual({ id: 'r-1', source_id: 'oprpg', nome: 'Tocha', ... } as any);
    });
    const rituais = await bibHook.current.getRituais();
    expect(rituais.length).toBeGreaterThan(0);

    // sync queue
    const { result: syncHook } = renderHook(() => useSyncQueue('camp-1', 'user-1'));
    await act(async () => {
      await syncHook.current.enqueue('push_ficha', { fichaId: 'f-1' });
    });
    const queue = await syncHook.current.getPending();
    expect(queue.length).toBe(1);
  });
});
```

- [ ] **Step 2: Implement seed.ts with sample ficha, 3 rituais, 3 itens, 1 regra capítulo**

- [ ] **Step 3: Run integration test**

Run: `npx vitest run src/db/__tests__/integration.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/seed.ts src/db/__tests__/integration.test.ts
git commit -m "feat(db): seed data + integration test for full cycle"
```

---

### Task 4: Expo Dev Tools Verification

**Files:** (none new)

- [ ] **Step 1: Run expo-doctor**

Run: `npx expo-doctor`
Expected: 20/20 checks passed

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run all vitest tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 4: Manual smoke test**

```bash
npx expo start --web
# Abrir no navegador → console: zero erros → localStorage tem auth → IndexedDB tem magistrado.db
```

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: phase 2 complete - db + hooks + tests passing"
```