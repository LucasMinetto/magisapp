import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface ArquivoPessoaRow {
  id: string;
  campaign_id: string;
  user_id: string;
  nome: string;
  retrato_url: string | null;
  o_que_sabe: string;
  versao_atual: number;
  updated_at: string;
}

export interface ArquivoLugarRow {
  id: string;
  campaign_id: string;
  user_id: string;
  nome: string;
  imagem_url: string | null;
  descricao_publica: string;
  versao_atual: number;
  updated_at: string;
}

export interface ArquivoAnotacaoRow {
  id: string;
  campaign_id: string;
  user_id: string;
  titulo: string;
  conteudo: string;
  linked_pessoa_id: string | null;
  linked_lugar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArquivoHistoricoRow {
  id: string;
  campaign_id: string;
  user_id: string;
  tipo: 'pessoa_v1' | 'lugar_v2' | 'interludio' | 'anotacao';
  ref_id: string;
  titulo: string;
  conteudo: string;
  autor: 'mestre' | 'jogador';
  created_at: string;
}

export interface ArquivoPessoa {
  id: string;
  campaignId: string;
  userId: string;
  nome: string;
  retratoUrl: string | null;
  oQueSabe: string;
  versaoAtual: number;
  updatedAt: string;
}

export interface ArquivoLugar {
  id: string;
  campaignId: string;
  userId: string;
  nome: string;
  imagemUrl: string | null;
  descricaoPublica: string;
  versaoAtual: number;
  updatedAt: string;
}

export interface ArquivoAnotacao {
  id: string;
  campaignId: string;
  userId: string;
  titulo: string;
  conteudo: string;
  linkedPessoaId: string | null;
  linkedLugarId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArquivoHistorico {
  id: string;
  campaignId: string;
  userId: string;
  tipo: 'pessoa_v1' | 'lugar_v2' | 'interludio' | 'anotacao';
  refId: string;
  titulo: string;
  conteudo: string;
  autor: 'mestre' | 'jogador';
  createdAt: string;
}

export interface UseArquivoResult {
  pessoas: ArquivoPessoa[];
  lugares: ArquivoLugar[];
  anotacoes: ArquivoAnotacao[];
  historico: ArquivoHistorico[];
  loading: boolean;
  error: string | null;
  savePessoa: (pessoa: Omit<ArquivoPessoa, 'id' | 'versaoAtual' | 'updatedAt'>) => Promise<ArquivoPessoa>;
  updatePessoa: (id: string, pessoa: Partial<Omit<ArquivoPessoa, 'id' | 'versaoAtual' | 'updatedAt'>>) => Promise<ArquivoPessoa>;
  deletePessoa: (id: string) => Promise<void>;
  saveLugar: (lugar: Omit<ArquivoLugar, 'id' | 'versaoAtual' | 'updatedAt'>) => Promise<ArquivoLugar>;
  updateLugar: (id: string, lugar: Partial<Omit<ArquivoLugar, 'id' | 'versaoAtual' | 'updatedAt'>>) => Promise<ArquivoLugar>;
  deleteLugar: (id: string) => Promise<void>;
  saveAnotacao: (anotacao: Omit<ArquivoAnotacao, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ArquivoAnotacao>;
  updateAnotacao: (id: string, anotacao: Partial<Omit<ArquivoAnotacao, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<ArquivoAnotacao>;
  deleteAnotacao: (id: string) => Promise<void>;
  addHistorico: (historico: Omit<ArquivoHistorico, 'id' | 'createdAt'>) => Promise<ArquivoHistorico>;
  refresh: () => Promise<void>;
}

type Scalar = string | number | null;

function rowToPessoa(row: Record<string, unknown>): ArquivoPessoa {
  const r = row as unknown as ArquivoPessoaRow;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    userId: r.user_id,
    nome: r.nome,
    retratoUrl: r.retrato_url,
    oQueSabe: r.o_que_sabe,
    versaoAtual: r.versao_atual,
    updatedAt: r.updated_at,
  };
}

function rowToLugar(row: Record<string, unknown>): ArquivoLugar {
  const r = row as unknown as ArquivoLugarRow;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    userId: r.user_id,
    nome: r.nome,
    imagemUrl: r.imagem_url,
    descricaoPublica: r.descricao_publica,
    versaoAtual: r.versao_atual,
    updatedAt: r.updated_at,
  };
}

function rowToAnotacao(row: Record<string, unknown>): ArquivoAnotacao {
  const r = row as unknown as ArquivoAnotacaoRow;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    userId: r.user_id,
    titulo: r.titulo,
    conteudo: r.conteudo,
    linkedPessoaId: r.linked_pessoa_id,
    linkedLugarId: r.linked_lugar_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToHistorico(row: Record<string, unknown>): ArquivoHistorico {
  const r = row as unknown as ArquivoHistoricoRow;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    userId: r.user_id,
    tipo: r.tipo,
    refId: r.ref_id,
    titulo: r.titulo,
    conteudo: r.conteudo,
    autor: r.autor,
    createdAt: r.created_at,
  };
}

function pessoaToRow(pessoa: Partial<Omit<ArquivoPessoa, 'id' | 'versaoAtual' | 'updatedAt'>>): Partial<Omit<ArquivoPessoaRow, 'id' | 'versao_atual' | 'updated_at'>> {
  const row: Partial<Omit<ArquivoPessoaRow, 'id' | 'versao_atual' | 'updated_at'>> = {};
  if (pessoa.campaignId !== undefined) row.campaign_id = pessoa.campaignId;
  if (pessoa.userId !== undefined) row.user_id = pessoa.userId;
  if (pessoa.nome !== undefined) row.nome = pessoa.nome;
  if (pessoa.retratoUrl !== undefined) row.retrato_url = pessoa.retratoUrl;
  if (pessoa.oQueSabe !== undefined) row.o_que_sabe = pessoa.oQueSabe;
  return row;
}

function lugarToRow(lugar: Partial<Omit<ArquivoLugar, 'id' | 'versaoAtual' | 'updatedAt'>>): Partial<Omit<ArquivoLugarRow, 'id' | 'versao_atual' | 'updated_at'>> {
  const row: Partial<Omit<ArquivoLugarRow, 'id' | 'versao_atual' | 'updated_at'>> = {};
  if (lugar.campaignId !== undefined) row.campaign_id = lugar.campaignId;
  if (lugar.userId !== undefined) row.user_id = lugar.userId;
  if (lugar.nome !== undefined) row.nome = lugar.nome;
  if (lugar.imagemUrl !== undefined) row.imagem_url = lugar.imagemUrl;
  if (lugar.descricaoPublica !== undefined) row.descricao_publica = lugar.descricaoPublica;
  return row;
}

function anotacaoToRow(anotacao: Partial<Omit<ArquivoAnotacao, 'id' | 'createdAt' | 'updatedAt'>>): Partial<Omit<ArquivoAnotacaoRow, 'id' | 'created_at' | 'updated_at'>> {
  const row: Partial<Omit<ArquivoAnotacaoRow, 'id' | 'created_at' | 'updated_at'>> = {};
  if (anotacao.campaignId !== undefined) row.campaign_id = anotacao.campaignId;
  if (anotacao.userId !== undefined) row.user_id = anotacao.userId;
  if (anotacao.titulo !== undefined) row.titulo = anotacao.titulo;
  if (anotacao.conteudo !== undefined) row.conteudo = anotacao.conteudo;
  if (anotacao.linkedPessoaId !== undefined) row.linked_pessoa_id = anotacao.linkedPessoaId;
  if (anotacao.linkedLugarId !== undefined) row.linked_lugar_id = anotacao.linkedLugarId;
  return row;
}

function historicoToRow(historico: Omit<ArquivoHistorico, 'id' | 'createdAt'>): Omit<ArquivoHistoricoRow, 'id' | 'created_at'> {
  return {
    campaign_id: historico.campaignId,
    user_id: historico.userId,
    tipo: historico.tipo,
    ref_id: historico.refId,
    titulo: historico.titulo,
    conteudo: historico.conteudo,
    autor: historico.autor,
  };
}

function insertParts(row: Record<string, unknown>): { cols: string; placeholders: string; values: Scalar[] } {
  const keys = Object.keys(row);
  return {
    cols: keys.join(', '),
    placeholders: keys.map(() => '?').join(', '),
    values: keys.map((k) => row[k] as Scalar),
  };
}

function setParts(row: Record<string, unknown>): { clause: string; values: Scalar[] } {
  const keys = Object.keys(row);
  return {
    clause: keys.map((k) => `${k} = ?`).join(', '),
    values: keys.map((k) => row[k] as Scalar),
  };
}

export function useArquivo(campaignId: string, userId: string): UseArquivoResult {
  const [pessoas, setPessoas] = useState<ArquivoPessoa[]>([]);
  const [lugares, setLugares] = useState<ArquivoLugar[]>([]);
  const [anotacoes, setAnotacoes] = useState<ArquivoAnotacao[]>([]);
  const [historico, setHistorico] = useState<ArquivoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const doRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pessoasResult, lugaresResult, anotacoesResult, historicoResult] = await Promise.all([
        db.execute(`SELECT * FROM arquivo_pessoa WHERE campaign_id = ? AND user_id = ? ORDER BY updated_at DESC`, [campaignId, userId]),
        db.execute(`SELECT * FROM arquivo_lugar WHERE campaign_id = ? AND user_id = ? ORDER BY updated_at DESC`, [campaignId, userId]),
        db.execute(`SELECT * FROM arquivo_anotacao WHERE campaign_id = ? AND user_id = ? ORDER BY updated_at DESC`, [campaignId, userId]),
        db.execute(`SELECT * FROM arquivo_historico WHERE campaign_id = ? AND user_id = ? ORDER BY created_at DESC`, [campaignId, userId]),
      ]);

      setPessoas(pessoasResult.rows.map(rowToPessoa));
      setLugares(lugaresResult.rows.map(rowToLugar));
      setAnotacoes(anotacoesResult.rows.map(rowToAnotacao));
      setHistorico(historicoResult.rows.map(rowToHistorico));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load arquivo');
    } finally {
      setLoading(false);
    }
  }, [campaignId, userId, db]);

  const refresh = useCallback(async () => {
    await Promise.resolve();
    await doRefresh();
  }, [doRefresh]);

  useEffect(() => {
    Promise.resolve().then(() => doRefresh());
  }, [doRefresh]);

  const savePessoa = useCallback(async (pessoa: Omit<ArquivoPessoa, 'id' | 'versaoAtual' | 'updatedAt'>): Promise<ArquivoPessoa> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const id = uuidv4();
      const row = pessoaToRow(pessoa) as Record<string, unknown>;
      const { cols, placeholders, values } = insertParts(row);

      await db.execute(
        `INSERT INTO arquivo_pessoa (id, ${cols}, versao_atual, updated_at) VALUES (?, ${placeholders}, 1, ?)`,
        [id, ...values, now]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = pessoas.find(p => p.id === id);
      if (!saved) throw new Error('Pessoa not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save pessoa');
      throw e;
    }
  }, [db, pessoas, doRefresh]);

  const updatePessoa = useCallback(async (id: string, pessoa: Partial<Omit<ArquivoPessoa, 'id' | 'versaoAtual' | 'updatedAt'>>): Promise<ArquivoPessoa> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const row = pessoaToRow(pessoa) as Record<string, unknown>;

      const current = await db.execute(`SELECT versao_atual FROM arquivo_pessoa WHERE id = ?`, [id]);
      const currentVersion = (current.rows[0] as unknown as { versao_atual: number })?.versao_atual ?? 1;

      const { clause, values } = setParts(row);

      await db.execute(
        `UPDATE arquivo_pessoa SET ${clause}, versao_atual = ?, updated_at = ? WHERE id = ?`,
        [...values, currentVersion + 1, now, id]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = pessoas.find(p => p.id === id);
      if (!saved) throw new Error('Pessoa not found after update');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update pessoa');
      throw e;
    }
  }, [db, pessoas, doRefresh]);

  const deletePessoa = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`DELETE FROM arquivo_pessoa WHERE id = ?`, [id]);
      setPessoas(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete pessoa');
      throw e;
    }
  }, [db]);

  const saveLugar = useCallback(async (lugar: Omit<ArquivoLugar, 'id' | 'versaoAtual' | 'updatedAt'>): Promise<ArquivoLugar> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const id = uuidv4();
      const row = lugarToRow(lugar) as Record<string, unknown>;
      const { cols, placeholders, values } = insertParts(row);

      await db.execute(
        `INSERT INTO arquivo_lugar (id, ${cols}, versao_atual, updated_at) VALUES (?, ${placeholders}, 1, ?)`,
        [id, ...values, now]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = lugares.find(l => l.id === id);
      if (!saved) throw new Error('Lugar not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save lugar');
      throw e;
    }
  }, [db, lugares, doRefresh]);

  const updateLugar = useCallback(async (id: string, lugar: Partial<Omit<ArquivoLugar, 'id' | 'versaoAtual' | 'updatedAt'>>): Promise<ArquivoLugar> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const row = lugarToRow(lugar) as Record<string, unknown>;

      const current = await db.execute(`SELECT versao_atual FROM arquivo_lugar WHERE id = ?`, [id]);
      const currentVersion = (current.rows[0] as unknown as { versao_atual: number })?.versao_atual ?? 1;

      const { clause, values } = setParts(row);

      await db.execute(
        `UPDATE arquivo_lugar SET ${clause}, versao_atual = ?, updated_at = ? WHERE id = ?`,
        [...values, currentVersion + 1, now, id]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = lugares.find(l => l.id === id);
      if (!saved) throw new Error('Lugar not found after update');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update lugar');
      throw e;
    }
  }, [db, lugares, doRefresh]);

  const deleteLugar = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`DELETE FROM arquivo_lugar WHERE id = ?`, [id]);
      setLugares(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete lugar');
      throw e;
    }
  }, [db]);

  const saveAnotacao = useCallback(async (anotacao: Omit<ArquivoAnotacao, 'id' | 'createdAt' | 'updatedAt'>): Promise<ArquivoAnotacao> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const id = uuidv4();
      const row = anotacaoToRow(anotacao) as Record<string, unknown>;
      const { cols, placeholders, values } = insertParts(row);

      await db.execute(
        `INSERT INTO arquivo_anotacao (id, ${cols}, created_at, updated_at) VALUES (?, ${placeholders}, ?, ?)`,
        [id, ...values, now, now]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = anotacoes.find(a => a.id === id);
      if (!saved) throw new Error('Anotação not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save anotação');
      throw e;
    }
  }, [db, anotacoes, doRefresh]);

  const updateAnotacao = useCallback(async (id: string, anotacao: Partial<Omit<ArquivoAnotacao, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ArquivoAnotacao> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const row = anotacaoToRow(anotacao) as Record<string, unknown>;
      const { clause, values } = setParts(row);

      await db.execute(
        `UPDATE arquivo_anotacao SET ${clause}, updated_at = ? WHERE id = ?`,
        [...values, now, id]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = anotacoes.find(a => a.id === id);
      if (!saved) throw new Error('Anotação not found after update');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update anotação');
      throw e;
    }
  }, [db, anotacoes, doRefresh]);

  const deleteAnotacao = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`DELETE FROM arquivo_anotacao WHERE id = ?`, [id]);
      setAnotacoes(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete anotação');
      throw e;
    }
  }, [db]);

  const addHistorico = useCallback(async (historicoEntry: Omit<ArquivoHistorico, 'id' | 'createdAt'>): Promise<ArquivoHistorico> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const id = uuidv4();
      const row = historicoToRow(historicoEntry) as unknown as Record<string, unknown>;
      const { cols, placeholders, values } = insertParts(row);

      await db.execute(
        `INSERT INTO arquivo_historico (id, ${cols}, created_at) VALUES (?, ${placeholders}, ?)`,
        [id, ...values, now]
      );

      await Promise.resolve();
      await doRefresh();
      const saved = historico.find(h => h.id === id);
      if (!saved) throw new Error('Histórico not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add histórico');
      throw e;
    }
  }, [db, historico, doRefresh]);

  return {
    pessoas,
    lugares,
    anotacoes,
    historico,
    loading,
    error,
    savePessoa,
    updatePessoa,
    deletePessoa,
    saveLugar,
    updateLugar,
    deleteLugar,
    saveAnotacao,
    updateAnotacao,
    deleteAnotacao,
    addHistorico,
    refresh,
  };
}
