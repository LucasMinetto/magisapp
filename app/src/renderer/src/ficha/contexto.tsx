// Estado compartilhado pelas partes da ficha completa.
import { createContext, useContext } from 'react'
import type { FichaAgente } from '@shared/ordem/esquemas'
import { CLASSES, derivados } from '@shared/ordem/regras'

export type Derivados = ReturnType<typeof derivados>

/** Uma parte do dano, de um tipo só (cada alvo resiste a um tipo). */
export interface ParteDano {
  expressao: string
  tipo: string
}

/** Pedido de rolagem: o que a JanelaRolagem pede ou rola. */
export interface PedidoRolagem {
  rotulo: string
  tipo: 'teste' | 'ataque' | 'dano' | 'ritual' | 'livre'
  teste?: { quantidade: number; regra: 'maior' | 'menor'; bonus: number; margem?: number }
  // Opções de dano (ex.: ritual normal/discente/verdadeiro); a primeira é a padrão. No crítico, só a primeira parte multiplica.
  dano?: { opcoes: { nome: string; partes: ParteDano[] }[]; mult?: number }
  custoPe?: number
}

export interface ContextoFicha {
  entityId: string
  a: FichaAgente
  alterar: (patch: Partial<FichaAgente>) => void
  d: Derivados
  max: { pv: number; pe: number; san: number }
  rolar?: (p: PedidoRolagem) => void
  /** A janela de rolagem abre em "digitar" (dados físicos) ou em "o app rola". */
  dadosFisicos: boolean
  // Modificador de testes temporário (dados e bônus extras), não fica salvo.
  mod: { dados: number; bonus: number }
  setMod: (m: { dados: number; bonus: number }) => void
}

export const Ficha = createContext<ContextoFicha | null>(null)

export function useFicha() {
  const c = useContext(Ficha)
  if (!c) throw new Error('useFicha fora da ficha')
  return c
}

// Classes com tabela calculam PV/PE/SAN; as outras usam os máximos digitados.
export function maximos(a: FichaAgente, d: Derivados) {
  const temTabela = a.classe in CLASSES
  return {
    pv: temTabela ? d.pv.total : a.pvMax,
    pe: temTabela ? d.pe.total : a.peMax,
    san: temTabela ? d.san.total : a.sanMax
  }
}

export const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export const novoId = () => crypto.randomUUID()
