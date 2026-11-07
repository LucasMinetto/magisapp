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

export const SEM_COMBATE: Iniciativa = { rodada: 1, turno: 0, ordem: [] }
