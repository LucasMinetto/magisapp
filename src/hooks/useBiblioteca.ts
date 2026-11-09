import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../db';
import type { RitualBiblioteca as RitualBibliotecaBase, ItemBiblioteca as ItemBibliotecaBase } from '../shared/ordem/esquemas';
import { v4 as uuidv4 } from 'uuid';

export interface RitualBiblioteca extends RitualBibliotecaBase {
  id: string;
  sourceId: string;
}

export interface ItemBiblioteca extends ItemBibliotecaBase {
  id: string;
  sourceId: string;
  quantidade: number;
}

export interface RitualBibliotecaRow {
  id: string;
  source_id: string;
  nome: string;
  elemento: string;
  circulo: number;
  execucao: string | null;
  alcance: string | null;
  alvo: string | null;
  duracao: string | null;
  resistencia: string | null;
  efeito: string | null;
  discente: string | null;
  verdadeiro: string | null;
  dano_normal: string | null;
  dano_discente: string | null;
  dano_verdadeiro: string | null;
  tipo_dano: string | null;
  alvo_tipo: string | null;
  pagina: number | null;
  data: string;
  synced_at: string | null;
}

export interface ItemBibliotecaRow {
  id: string;
  source_id: string;
  nome: string;
  tipo: string;
  categoria: number;
  espacos: number;
  defesa: number;
  dano: string | null;
  tipo_dano: string | null;
  critico: string | null;
  alcance: string | null;
  proficiencia: string | null;
  empunhadura: string | null;
  elemento: string | null;
  descricao: string | null;
  quantidade: number;
  pagina: number | null;
  data: string;
  synced_at: string | null;
}

export interface UseBibliotecaResult {
  rituais: RitualBiblioteca[];
  itens: ItemBiblioteca[];
  loading: boolean;
  error: string | null;
  saveRitual: (ritual: Omit<RitualBiblioteca, 'id'>) => Promise<RitualBiblioteca>;
  saveItem: (item: Omit<ItemBiblioteca, 'id'>) => Promise<ItemBiblioteca>;
  deleteRitual: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function rowToRitual(row: Record<string, unknown>): RitualBiblioteca {
  const r = row as unknown as RitualBibliotecaRow;
  return {
    id: r.id,
    sourceId: r.source_id,
    nome: r.nome,
    elemento: r.elemento,
    circulo: r.circulo,
    execucao: r.execucao ?? '',
    alcance: r.alcance ?? '',
    alvo: r.alvo ?? '',
    duracao: r.duracao ?? '',
    resistencia: r.resistencia ?? '',
    efeito: r.efeito ?? '',
    discente: r.discente ?? '',
    verdadeiro: r.verdadeiro ?? '',
    danoNormal: r.dano_normal ?? '',
    danoDiscente: r.dano_discente ?? '',
    danoVerdadeiro: r.dano_verdadeiro ?? '',
    tipoDano: r.tipo_dano ?? '',
    alvoTipo: (r.alvo_tipo as 'Alvo' | 'Área' | 'Efeito') ?? 'Alvo',
    pagina: r.pagina ?? 0,
  };
}

function rowToItem(row: Record<string, unknown>): ItemBiblioteca {
  const r = row as unknown as ItemBibliotecaRow;
  return {
    id: r.id,
    sourceId: r.source_id,
    nome: r.nome,
    tipo: r.tipo,
    categoria: r.categoria,
    espacos: r.espacos,
    defesa: r.defesa,
    dano: r.dano ?? '',
    tipoDano: r.tipo_dano ?? '',
    critico: r.critico ?? '',
    alcance: r.alcance ?? '',
    proficiencia: r.proficiencia ?? '',
    empunhadura: r.empunhadura ?? '',
    elemento: r.elemento ?? '',
    descricao: r.descricao ?? '',
    quantidade: r.quantidade,
    pagina: r.pagina ?? 0,
  };
}

function ritualToRow(ritual: Omit<RitualBiblioteca, 'id'>): Omit<RitualBibliotecaRow, 'id' | 'synced_at'> {
  return {
    source_id: ritual.sourceId,
    nome: ritual.nome,
    elemento: ritual.elemento,
    circulo: ritual.circulo,
    execucao: ritual.execucao ?? null,
    alcance: ritual.alcance ?? null,
    alvo: ritual.alvo ?? null,
    duracao: ritual.duracao ?? null,
    resistencia: ritual.resistencia ?? null,
    efeito: ritual.efeito ?? null,
    discente: ritual.discente ?? null,
    verdadeiro: ritual.verdadeiro ?? null,
    dano_normal: ritual.danoNormal ?? null,
    dano_discente: ritual.danoDiscente ?? null,
    dano_verdadeiro: ritual.danoVerdadeiro ?? null,
    tipo_dano: ritual.tipoDano ?? null,
    alvo_tipo: ritual.alvoTipo ?? 'Alvo',
    pagina: ritual.pagina ?? null,
    data: new Date().toISOString(),
  };
}

function itemToRow(item: Omit<ItemBiblioteca, 'id'>): Omit<ItemBibliotecaRow, 'id' | 'synced_at'> {
  return {
    source_id: item.sourceId,
    nome: item.nome,
    tipo: item.tipo,
    categoria: item.categoria,
    espacos: item.espacos,
    defesa: item.defesa,
    dano: item.dano ?? null,
    tipo_dano: item.tipoDano ?? null,
    critico: item.critico ?? null,
    alcance: item.alcance ?? null,
    proficiencia: item.proficiencia ?? null,
    empunhadura: item.empunhadura ?? null,
    elemento: item.elemento ?? null,
    descricao: item.descricao ?? null,
    quantidade: item.quantidade,
    pagina: item.pagina ?? null,
    data: new Date().toISOString(),
  };
}

/** Colunas fixas (nomeadas no código) + valores parametrizados. */
function insertColumns(row: Record<string, unknown>): { cols: string; placeholders: string; values: (string | number | null)[] } {
  const keys = Object.keys(row);
  return {
    cols: keys.join(', '),
    placeholders: keys.map(() => '?').join(', '),
    values: keys.map((k) => row[k] as string | number | null),
  };
}

export function useBiblioteca(sourceId?: string): UseBibliotecaResult {
  const [rituais, setRituais] = useState<RitualBiblioteca[]>([]);
  const [itens, setItens] = useState<ItemBiblioteca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let ritualSql = `SELECT * FROM biblioteca_ritual`;
      let itemSql = `SELECT * FROM biblioteca_item`;
      const params: string[] = [];

      if (sourceId) {
        ritualSql += ` WHERE source_id = ?`;
        itemSql += ` WHERE source_id = ?`;
        params.push(sourceId);
      }

      ritualSql += ` ORDER BY elemento, circulo, nome`;
      itemSql += ` ORDER BY tipo, categoria, nome`;

      const [ritualResult, itemResult] = await Promise.all([
        db.execute(ritualSql, params),
        db.execute(itemSql, params),
      ]);

      setRituais(ritualResult.rows.map(rowToRitual));
      setItens(itemResult.rows.map(rowToItem));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load biblioteca');
    } finally {
      setLoading(false);
    }
  }, [sourceId, db]);

  useEffect(() => {
    Promise.resolve().then(() => refresh());
  }, [refresh]);

  const saveRitual = useCallback(async (ritual: Omit<RitualBiblioteca, 'id'>): Promise<RitualBiblioteca> => {
    setError(null);
    try {
      const id = uuidv4();
      const row = ritualToRow(ritual) as unknown as Record<string, unknown>;
      const { cols, placeholders, values } = insertColumns(row);

      await db.execute(
        `INSERT INTO biblioteca_ritual (id, ${cols}) VALUES (?, ${placeholders})`,
        [id, ...values]
      );

      await refresh();
      const saved = rituais.find(r => r.id === id);
      if (!saved) throw new Error('Ritual not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save ritual');
      throw e;
    }
  }, [db, refresh, rituais]);

  const saveItem = useCallback(async (item: Omit<ItemBiblioteca, 'id'>): Promise<ItemBiblioteca> => {
    setError(null);
    try {
      const id = uuidv4();
      const row = itemToRow(item) as unknown as Record<string, unknown>;
      const { cols, placeholders, values } = insertColumns(row);

      await db.execute(
        `INSERT INTO biblioteca_item (id, ${cols}) VALUES (?, ${placeholders})`,
        [id, ...values]
      );

      await refresh();
      const saved = itens.find(i => i.id === id);
      if (!saved) throw new Error('Item not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save item');
      throw e;
    }
  }, [db, refresh, itens]);

  const deleteRitual = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`DELETE FROM biblioteca_ritual WHERE id = ?`, [id]);
      setRituais(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete ritual');
      throw e;
    }
  }, [db]);

  const deleteItem = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`DELETE FROM biblioteca_item WHERE id = ?`, [id]);
      setItens(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete item');
      throw e;
    }
  }, [db]);

  return {
    rituais,
    itens,
    loading,
    error,
    saveRitual,
    saveItem,
    deleteRitual,
    deleteItem,
    refresh,
  };
}
