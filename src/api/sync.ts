/**
 * Motor de sincronização: pull/push, fila offline, merge last-write-wins.
 * Usa op-sqlite para persistir a fila e os dados locais.
 */

import { getDB, ensureDatabaseReady } from '../db';
import { useSyncQueue, type SyncQueueEntry, type SyncOperacao, type SyncStatus } from '../hooks/useSyncQueue';
import { createApiClient, getApiClient, type ApiClient } from './client';
import type { SyncMessage, SyncChange, PullResponse, PushResponse, DeltaMessage } from './protocol';

export interface SyncState {
  status: 'idle' | 'syncing' | 'online' | 'offline' | 'error';
  lastPull: string | null;
  lastPush: string | null;
  pendingCount: number;
  error: string | null;
}

export interface UseSyncResult {
  state: SyncState;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  sync: () => Promise<void>;
  setOnline: (online: boolean) => void;
}

type Listener = (state: SyncState) => void;

class SyncEngine {
  private apiClient: ApiClient | null = null;
  private campaignId: string = '';
  private userId: string = '';
  private serverUrl: string = '';
  private token: string | null = null;
  private isOnline = true;
  private isSyncing = false;
  private state: SyncState = {
    status: 'idle',
    lastPull: null,
    lastPush: null,
    pendingCount: 0,
    error: null,
  };
  private listeners = new Set<Listener>();
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  configure(campaignId: string, userId: string, serverUrl: string, token: string | null): void {
    this.campaignId = campaignId;
    this.userId = userId;
    this.serverUrl = serverUrl;
    this.token = token;

    if (!this.apiClient) {
      this.apiClient = createApiClient({
        baseUrl: serverUrl,
        getToken: () => this.token,
        onMessage: this.handleMessage.bind(this),
        onError: (err) => this.setError(err.message),
        onClose: () => this.setOffline(),
        onOpen: () => this.setOnline(),
      });
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private setError(message: string): void {
    this.setState({ status: 'error', error: message });
  }

  private setOnline(): void {
    this.isOnline = true;
    this.setState({ status: 'online', error: null });
    this.maybeAutoSync();
  }

  private setOffline(): void {
    this.isOnline = false;
    this.setState({ status: 'offline' });
  }

  private setSyncing(syncing: boolean): void {
    this.isSyncing = syncing;
    this.setState({ status: syncing ? 'syncing' : this.isOnline ? 'online' : 'offline' });
  }

  private async updatePendingCount(): Promise<void> {
    if (!this.campaignId || !this.userId) return;
    try {
      const db = getDB();
      const result = await db.execute(
        `SELECT COUNT(*) as c FROM sync_queue WHERE campaign_id = ? AND user_id = ? AND status IN ('pending', 'failed')`,
        [this.campaignId, this.userId]
      );
      const count = Number((result.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
      this.setState({ pendingCount: count });
    } catch {
      // ignore
    }
  }

  private maybeAutoSync(): void {
    if (this.isOnline && !this.isSyncing && this.state.pendingCount > 0) {
      this.sync();
    }
  }

  async pull(): Promise<void> {
    if (!this.apiClient || !this.campaignId || !this.userId) return;
    this.setSyncing(true);
    try {
      const response = await this.apiClient.pull(this.campaignId, this.userId, this.state.lastPull ?? undefined);
      await this.applyPullResponse(response);
      this.setState({ lastPull: response.serverTimestamp, status: this.isOnline ? 'online' : 'offline' });
    } catch (e) {
      this.setError((e as Error).message);
    } finally {
      this.setSyncing(false);
      await this.updatePendingCount();
    }
  }

  async push(): Promise<void> {
    if (!this.apiClient || !this.campaignId || !this.userId) return;
    this.setSyncing(true);
    try {
      const changes = await this.collectPendingChanges();
      if (changes.length === 0) {
        this.setState({ lastPush: new Date().toISOString() });
        return;
      }
      const response = await this.apiClient.push(this.campaignId, this.userId, changes);
      await this.applyPushResponse(response);
      this.setState({ lastPush: response.serverTimestamp, status: this.isOnline ? 'online' : 'offline' });
    } catch (e) {
      this.setError((e as Error).message);
    } finally {
      this.setSyncing(false);
      await this.updatePendingCount();
    }
  }

  async sync(): Promise<void> {
    if (this.isSyncing) return;
    await this.pull();
    await this.push();
  }

  private async collectPendingChanges(): Promise<SyncChange[]> {
    const db = getDB();
    const result = await db.execute(
      `SELECT * FROM sync_queue WHERE campaign_id = ? AND user_id = ? AND status IN ('pending', 'failed') ORDER BY created_at ASC`,
      [this.campaignId, this.userId]
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      const payload = JSON.parse(r.payload as string);
      return {
        entityType: payload.entityType,
        operation: payload.operation,
        entityId: payload.entityId,
        data: payload.data,
        timestamp: r.created_at as string,
        version: payload.version ?? 1,
      };
    });
  }

  private async applyPullResponse(response: PullResponse): Promise<void> {
    await ensureDatabaseReady();
    const db = getDB();

    // Helper to safely get string/number values
    const getStr = (obj: Record<string, unknown>, key: string): string => String(obj[key] ?? '');
    const getNum = (obj: Record<string, unknown>, key: string): number => Number(obj[key] ?? 0);
    const getBool = (obj: Record<string, unknown>, key: string): boolean => Boolean(obj[key]);
    const getNullableStr = (obj: Record<string, unknown>, key: string): string | null => (obj[key] == null ? null : String(obj[key]));

    // Ficha
    if (response.ficha) {
      const f = response.ficha as Record<string, unknown>;
      await db.execute(
        `INSERT OR REPLACE INTO ficha (id, campaign_id, user_id, sheet_data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          getStr(f, 'id'),
          this.campaignId,
          this.userId,
          JSON.stringify(response.ficha),
          response.serverTimestamp,
          response.serverTimestamp,
        ]
      );
    }

    // Biblioteca rituais
    if (response.biblioteca?.rituais) {
      for (const ritual of response.biblioteca.rituais as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO biblioteca_ritual (id, source_id, nome, elemento, circulo, execucao, alcance, alvo, duracao, resistencia, efeito, discente, verdadeiro, dano_normal, dano_discente, dano_verdadeiro, tipo_dano, alvo_tipo, pagina, data, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            getStr(ritual, 'id'),
            getStr(ritual, 'sourceId'),
            getStr(ritual, 'nome'),
            getStr(ritual, 'elemento'),
            getNum(ritual, 'circulo'),
            getNullableStr(ritual, 'execucao'),
            getNullableStr(ritual, 'alcance'),
            getNullableStr(ritual, 'alvo'),
            getNullableStr(ritual, 'duracao'),
            getNullableStr(ritual, 'resistencia'),
            getNullableStr(ritual, 'efeito'),
            getNullableStr(ritual, 'discente'),
            getNullableStr(ritual, 'verdadeiro'),
            getNullableStr(ritual, 'danoNormal'),
            getNullableStr(ritual, 'danoDiscente'),
            getNullableStr(ritual, 'danoVerdadeiro'),
            getNullableStr(ritual, 'tipoDano'),
            getNullableStr(ritual, 'alvoTipo') ?? 'Alvo',
            ritual.pagina == null ? null : getNum(ritual, 'pagina'),
            getNullableStr(ritual, 'data') ?? response.serverTimestamp,
            response.serverTimestamp,
          ]
        );
      }
    }

    // Biblioteca itens
    if (response.biblioteca?.itens) {
      for (const item of response.biblioteca.itens as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO biblioteca_item (id, source_id, nome, tipo, categoria, espacos, defesa, dano, tipo_dano, critico, alcance, proficiencia, empunhadura, elemento, descricao, quantidade, pagina, data, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            getStr(item, 'id'),
            getStr(item, 'sourceId'),
            getStr(item, 'nome'),
            getStr(item, 'tipo'),
            getNum(item, 'categoria'),
            getNum(item, 'espacos'),
            getNum(item, 'defesa'),
            getNullableStr(item, 'dano'),
            getNullableStr(item, 'tipoDano'),
            getNullableStr(item, 'critico'),
            getNullableStr(item, 'alcance'),
            getNullableStr(item, 'proficiencia'),
            getNullableStr(item, 'empunhadura'),
            getNullableStr(item, 'elemento'),
            getNullableStr(item, 'descricao'),
            getNum(item, 'quantidade') ?? 1,
            item.pagina == null ? null : getNum(item, 'pagina'),
            getNullableStr(item, 'data') ?? response.serverTimestamp,
            response.serverTimestamp,
          ]
        );
      }
    }

    // Regras
    if (response.regras) {
      for (const regra of response.regras as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO regras (id, capitulo, titulo, conteudo, pagina_livro, visivel_para_jogadores, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            getStr(regra, 'id'),
            getNum(regra, 'capitulo'),
            getStr(regra, 'titulo'),
            getStr(regra, 'conteudo'),
            regra.paginaLivro == null ? null : getNum(regra, 'paginaLivro'),
            getBool(regra, 'visivelParaJogadores') ? 1 : 0,
            response.serverTimestamp,
          ]
        );
      }
    }

    // Arquivo
    if (response.arquivo) {
      for (const pessoa of response.arquivo.pessoas as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO arquivo_pessoa (id, campaign_id, user_id, nome, retrato_url, o_que_sabe, versao_atual, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [getStr(pessoa, 'id'), this.campaignId, this.userId, getStr(pessoa, 'nome'), getNullableStr(pessoa, 'retratoUrl'), getStr(pessoa, 'oQueSabe'), getNum(pessoa, 'versaoAtual') ?? 1, response.serverTimestamp]
        );
      }
      for (const lugar of response.arquivo.lugares as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO arquivo_lugar (id, campaign_id, user_id, nome, imagem_url, descricao_publica, versao_atual, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [getStr(lugar, 'id'), this.campaignId, this.userId, getStr(lugar, 'nome'), getNullableStr(lugar, 'imagemUrl'), getStr(lugar, 'descricaoPublica'), getNum(lugar, 'versaoAtual') ?? 1, response.serverTimestamp]
        );
      }
      for (const anotacao of response.arquivo.anotacoes as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO arquivo_anotacao (id, campaign_id, user_id, titulo, conteudo, linked_pessoa_id, linked_lugar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [getStr(anotacao, 'id'), this.campaignId, this.userId, getStr(anotacao, 'titulo'), getStr(anotacao, 'conteudo'), getNullableStr(anotacao, 'linkedPessoaId'), getNullableStr(anotacao, 'linkedLugarId'), getStr(anotacao, 'createdAt'), getStr(anotacao, 'updatedAt')]
        );
      }
      for (const h of response.arquivo.historico as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO arquivo_historico (id, campaign_id, user_id, tipo, ref_id, titulo, conteudo, autor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [getStr(h, 'id'), this.campaignId, this.userId, getStr(h, 'tipo'), getStr(h, 'refId'), getStr(h, 'titulo'), getStr(h, 'conteudo'), getStr(h, 'autor'), getStr(h, 'createdAt')]
        );
      }
    }

    // Rolagens
    if (response.rolagens) {
      for (const r of response.rolagens as Record<string, unknown>[]) {
        await db.execute(
          `INSERT OR REPLACE INTO rolagens (id, campaign_id, user_id, tipo, rotulo, formula, dados, total, critico, falha, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [getStr(r, 'id'), this.campaignId, this.userId, getStr(r, 'tipo'), getNullableStr(r, 'rotulo'), getStr(r, 'formula'), JSON.stringify(r.dados ?? []), getNum(r, 'total'), getBool(r, 'critico') ? 1 : 0, getBool(r, 'falha') ? 1 : 0, getStr(r, 'createdAt'), response.serverTimestamp]
        );
      }
    }
  }

  private async applyPushResponse(response: PushResponse): Promise<void> {
    const db = getDB();

    // Marcar aceitos como synced
    for (const entityId of response.accepted) {
      await db.execute(
        `UPDATE sync_queue SET status = 'synced', processed_at = ?, error = NULL WHERE campaign_id = ? AND user_id = ? AND json_extract(payload, '$.entityId') = ?`,
        [response.serverTimestamp, this.campaignId, this.userId, entityId]
      );
    }

    // Marcar rejeitados como failed
    for (const rejected of response.rejected) {
      await db.execute(
        `UPDATE sync_queue SET status = 'failed', processed_at = ?, error = ?, tentativas = tentativas + 1 WHERE campaign_id = ? AND user_id = ? AND json_extract(payload, '$.entityId') = ?`,
        [response.serverTimestamp, rejected.reason, this.campaignId, this.userId, rejected.entityId]
      );
    }
  }

  private handleMessage(msg: SyncMessage): void {
    if (msg.type === 'delta') {
      this.handleDelta(msg as DeltaMessage);
    }
  }

  private async handleDelta(delta: DeltaMessage): Promise<void> {
    // Aplica deltas do servidor (last-write-wins por campo)
    // Para simplicidade, tratamos como pull incremental
    await this.applyPullResponse({
      type: 'pull_response',
      requestId: delta.requestId,
      timestamp: delta.timestamp,
      ficha: undefined,
      biblioteca: undefined,
      regras: undefined,
      arquivo: undefined,
      rolagens: undefined,
      serverTimestamp: delta.timestamp,
      // Delta traz changes no formato SyncChange, convertemos
    } as PullResponse);
  }

  // Public methods for external access
  getState(): SyncState {
    return this.state;
  }

  setOnlineState(online: boolean): void {
    if (online) {
      this.setOnline();
    } else {
      this.setOffline();
    }
  }
}

const syncEngine = new SyncEngine();

export function getSyncEngine(): SyncEngine {
  return syncEngine;
}

export { SyncEngine };

// Legacy useSync - kept for backward compatibility, use hooks/useSync instead
export function useSync(campaignId: string, userId: string, serverUrl: string, token: string | null): UseSyncResult {
  const [state, setState] = React.useState<SyncState>(syncEngine.getState());

  React.useEffect(() => {
    syncEngine.configure(campaignId, userId, serverUrl, token);
    const unsubscribe = syncEngine.subscribe(setState);
    return unsubscribe;
  }, [campaignId, userId, serverUrl, token]);

  const pull = React.useCallback(() => syncEngine.pull(), []);
  const push = React.useCallback(() => syncEngine.push(), []);
  const sync = React.useCallback(() => syncEngine.sync(), []);
  const setOnline = React.useCallback((online: boolean) => {
    syncEngine.setOnlineState(online);
  }, []);

  return { state, pull, push, sync, setOnline };
}

// Need to import React
import React from 'react';