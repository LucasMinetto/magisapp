import type { DB } from '@op-engineering/op-sqlite';
import { v4 as uuidv4 } from 'uuid';
import type { FichaAgente } from '../shared/ordem/esquemas';

/**
 * Camada de persistência da ficha, separada do React para poder ser exercitada
 * nos testes. Toda consulta é parametrizada (`?`): nenhum texto do usuário é
 * interpolado em SQL.
 */

export interface FichaRow {
  id: string;
  campaign_id: string;
  user_id: string;
  sheet_data: string;
  updated_at: string;
  synced_at: string | null;
}

export function rowToFicha(row: Record<string, unknown>): FichaAgente {
  return JSON.parse((row as unknown as FichaRow).sheet_data);
}

/** Lê a ficha da campanha/usuário, ou null se ainda não houver. */
export async function loadFicha(db: DB, campaignId: string, userId: string): Promise<FichaAgente | null> {
  const result = await db.execute(
    'SELECT * FROM ficha WHERE campaign_id = ? AND user_id = ?',
    [campaignId, userId]
  );
  return result.rows.length > 0 ? rowToFicha(result.rows[0] as unknown as Record<string, unknown>) : null;
}

/**
 * Grava a ficha (insere ou atualiza) e enfileira uma operação de sync.
 * Devolve o id da ficha. Uma chamada = uma linha em `sync_queue`.
 */
export async function saveFicha(
  db: DB,
  campaignId: string,
  userId: string,
  ficha: FichaAgente
): Promise<string> {
  const now = new Date().toISOString();
  const sheetData = JSON.stringify(ficha);

  const existing = await db.execute(
    'SELECT id FROM ficha WHERE campaign_id = ? AND user_id = ?',
    [campaignId, userId]
  );
  const fichaId = existing.rows.length > 0
    ? (existing.rows[0] as unknown as { id: string }).id
    : uuidv4();

  await db.execute(
    `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(campaign_id, user_id)
     DO UPDATE SET sheet_data = excluded.sheet_data, updated_at = excluded.updated_at`,
    [fichaId, campaignId, userId, sheetData, now]
  );

  await db.execute(
    `INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, status, tentativas, created_at)
     VALUES (?, ?, ?, 'push_ficha', ?, 'pending', 0, ?)`,
    [uuidv4(), campaignId, userId, JSON.stringify({ fichaId }), now]
  );

  return fichaId;
}

/** Remove a ficha da campanha/usuário. */
export async function deleteFicha(db: DB, campaignId: string, userId: string): Promise<void> {
  await db.execute('DELETE FROM ficha WHERE campaign_id = ? AND user_id = ?', [campaignId, userId]);
}

/** Marca a ficha como sincronizada (grava `synced_at`). */
export async function markFichaSynced(db: DB, campaignId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    'UPDATE ficha SET synced_at = ? WHERE campaign_id = ? AND user_id = ?',
    [now, campaignId, userId]
  );
}
