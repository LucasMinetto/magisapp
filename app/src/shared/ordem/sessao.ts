// Regras da tela de Sessão: ordem de iniciativa e testes lidos do bloco da ameaça ("2d20+5").
import type { Iniciativa } from './esquemas'

export type Combatente = Iniciativa['ordem'][number]

/** "2d20+5" (ou "2O+5") → 2 dados, fica com o maior, +5. "0d20" ou "-1d20" → 2 ou 3 dados, fica com o menor. */
export function testeDoTexto(texto: string): { quantidade: number; regra: 'maior' | 'menor'; bonus: number } | null {
  // "O" é o d20 do livro: "3O+10" = 3d20+10; "O" sozinho = 1d20.
  const m = texto.replace(/\s+/g, '').match(/^(-?\d*)(?:[dD]20|O)([+-]\d+)?$/)
  if (!m) return null
  const n = m[1] === '' || m[1] === '-' ? Number(`${m[1]}1`) : Number(m[1])
  const bonus = Number(m[2] ?? 0)
  return n >= 1 ? { quantidade: n, regra: 'maior', bonus } : { quantidade: 2 - n, regra: 'menor', bonus }
}

/** Uma ação do bloco ("Teste 2d20+5 | Dano 1d6+5 corte") → o teste e o dano que ela pede. */
export function lerAcao(descricao: string): {
  teste: ReturnType<typeof testeDoTexto>
  dano: { expressao: string; tipo: string } | null
} {
  const teste = descricao.match(/[Tt]este\s+(-?\d*(?:[dD]20|O(?![A-Za-zÀ-ú]))\s*(?:[+-]\s*\d+)?)/)
  // Só a primeira parte do dano ("1d6+5 corte"); o resto da descrição fica para o mestre ler.
  const dano = descricao.match(/Dano\s+(\d+d\d+(?:\s*[+-]\s*\d+(?!d))?)\s*([A-Za-zÀ-ú]+)?/i)
  return {
    teste: teste ? testeDoTexto(teste[1]) : null,
    dano: dano
      ? {
          expressao: dano[1].replace(/\s+/g, ''),
          tipo: (dano[2] ?? '').toLowerCase()
        }
      : null
  }
}

/** Nome da próxima cópia de uma ameaça na ordem: "Zumbi", depois "Zumbi 2", "Zumbi 3"… */
export function nomeDaCopia(ordem: Combatente[], nome: string): string {
  const usados = new Set(ordem.map((c) => c.nome))
  if (!usados.has(nome)) return nome
  for (let i = 2; ; i++) if (!usados.has(`${nome} ${i}`)) return `${nome} ${i}`
}

/** Maior valor primeiro; empate fica na ordem em que entraram. O turno volta ao primeiro. */
export function ordenar(ini: Iniciativa): Iniciativa {
  return {
    ...ini,
    ordem: [...ini.ordem].sort((a, b) => b.valor - a.valor),
    turno: 0
  }
}

/** Passa a vez. Depois do último, volta ao primeiro e a rodada aumenta. */
export function proximo(ini: Iniciativa): Iniciativa {
  if (!ini.ordem.length) return ini
  const fim = ini.turno + 1 >= ini.ordem.length
  return {
    ...ini,
    turno: fim ? 0 : ini.turno + 1,
    rodada: fim ? ini.rodada + 1 : ini.rodada
  }
}

/** Volta a vez (corrigir um "próximo" a mais). Não passa da rodada 1, turno 0. */
export function anterior(ini: Iniciativa): Iniciativa {
  if (!ini.ordem.length) return ini
  if (ini.turno > 0) return { ...ini, turno: ini.turno - 1 }
  if (ini.rodada <= 1) return ini
  return { ...ini, turno: ini.ordem.length - 1, rodada: ini.rodada - 1 }
}

/** Tira um da ordem sem mudar de quem é a vez (se era a vez dele, passa ao seguinte). */
export function remover(ini: Iniciativa, id: string): Iniciativa {
  const i = ini.ordem.findIndex((c) => c.id === id)
  if (i < 0) return ini
  const ordem = ini.ordem.filter((c) => c.id !== id)
  let turno = i < ini.turno ? ini.turno - 1 : ini.turno
  if (turno >= ordem.length) turno = 0
  return { ...ini, ordem, turno }
}

export const SEM_COMBATE: Iniciativa = { rodada: 1, turno: 0, ordem: [], desafixadas: [] }

// ------------------------------------------------------------ fichas do combate (#18)

/** Cópias da mesma ficha formam um grupo; combatente sem ficha é um grupo só dele. */
export const chaveDoGrupo = (c: Combatente) => c.entityId ?? c.id

export interface Grupo {
  chave: string
  entityId: string | null
  combatentes: Combatente[]
}

/** Agrupa a ordem por ficha, na ordem em que cada ficha aparece pela primeira vez. */
export function agrupar(ordem: Combatente[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const c of ordem) {
    const chave = chaveDoGrupo(c)
    const g = grupos.get(chave) ?? { chave, entityId: c.entityId, combatentes: [] }
    g.combatentes.push(c)
    grupos.set(chave, g)
  }
  return [...grupos.values()]
}

/** Fixa ou desafixa a ficha de um grupo na área das ameaças. */
export function alternarFixa(ini: Iniciativa, chave: string): Iniciativa {
  const solta = ini.desafixadas.includes(chave)
  return { ...ini, desafixadas: solta ? ini.desafixadas.filter((k) => k !== chave) : [...ini.desafixadas, chave] }
}

/** Quem pode receber um ataque, um dano ou um ritual: cada combatente, inclusive cada cópia de ameaça. Gancho da #13. */
export interface Alvo {
  combatenteId: string
  entityId: string | null
  nome: string
}

export const alvosDoCombate = (ini: Iniciativa): Alvo[] => ini.ordem.map((c) => ({ combatenteId: c.id, entityId: c.entityId, nome: c.nome }))
