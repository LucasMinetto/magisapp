// O que se rola por um ataque ou um ritual da ficha completa. Usado na aba Combate e na aba Rituais da ficha e
// nos cartões dos agentes no combate da Sessão (#18), para as duas telas rolarem igual.
import type { Ataque, FichaAgente, RitualDaFicha } from '@shared/ordem/esquemas'
import { CUSTO_CIRCULO, PERICIAS, bonusPericia, dadosDoTeste, descreverExpressao, lerExpressao } from '@shared/ordem/regras'
import { sinal, type PedidoRolagem } from './contexto'

export interface RolagensDoAtaque {
  ataque: { texto: string; pedido: PedidoRolagem }
  dano: { texto: string; pedido: PedidoRolagem }
  /** "19/x3" ou "x2". */
  critico: string
  /** "Balístico + Energia". */
  tipos: string
}

/** Teste de ataque e dano de um ataque da ficha. `mod` é o modificador temporário de testes da ficha. */
export function rolagensDoAtaque(a: FichaAgente, at: Ataque, mod = { dados: 0, bonus: 0 }): RolagensDoAtaque {
  const atributo = PERICIAS.find((p) => p.nome === at.pericia)?.atributo ?? 'for'
  const t = dadosDoTeste(a.atributos[atributo], mod.dados)
  const bonus = bonusPericia(a, at.pericia) + at.bonusAtaque + mod.bonus
  // Ataque corpo a corpo (Luta) soma FOR ao dano.
  const somaFor = at.pericia === 'Luta' ? a.atributos.for : 0
  const expr = lerExpressao(at.dano)
  const extras = at.danosExtras.filter((x) => x.dano.trim())
  const textoDano = [descreverExpressao({ ...expr, fixo: expr.fixo + somaFor }), ...extras.map((x) => descreverExpressao(lerExpressao(x.dano)))].join(' + ')
  const partes = [{ expressao: `${at.dano}${somaFor ? sinal(somaFor) : ''}`, tipo: at.tipoDano }, ...extras.map((x) => ({ expressao: x.dano, tipo: x.tipoDano }))]
  const dano = { opcoes: [{ nome: 'Dano', partes }], mult: at.multCritico }
  return {
    ataque: {
      texto: `${t.quantidade}d20${bonus ? sinal(bonus) : ''}`,
      pedido: { rotulo: at.nome, tipo: 'ataque', teste: { ...t, bonus, margem: at.margemCritico }, dano }
    },
    dano: { texto: textoDano, pedido: { rotulo: at.nome, tipo: 'dano', dano } },
    critico: `${at.margemCritico < 20 ? `${at.margemCritico}/` : ''}x${at.multCritico}`,
    tipos: [at.tipoDano, ...extras.map((x) => x.tipoDano)].filter(Boolean).join(' + ')
  }
}

/** Custo em PE e o pedido de conjurar um ritual (com as formas de dano que ele tiver). */
export function rolagemDoRitual(r: RitualDaFicha): { custo: number; pedido: PedidoRolagem } {
  const custo = CUSTO_CIRCULO[r.circulo] ?? 0
  const opcoes = [
    { nome: 'Normal', expressao: r.danoNormal },
    { nome: 'Discente', expressao: r.danoDiscente },
    { nome: 'Verdadeiro', expressao: r.danoVerdadeiro }
  ]
    .filter((f) => f.expressao.trim())
    .map((f) => ({ nome: f.nome, partes: [{ expressao: f.expressao, tipo: r.tipoDano }] }))
  return { custo, pedido: { rotulo: r.nome, tipo: 'ritual', custoPe: custo, dano: opcoes.length ? { opcoes } : undefined } }
}
