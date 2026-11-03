import { describe, expect, it } from 'vitest'
import { ameacaDeStats, fichaAgenteSchema, fichaDeStats, rolagemSchema, ritualBibliotecaSchema } from './esquemas'
import { derivados } from './regras'

describe('esquemas da ficha', () => {
  it('ficha vazia ganha os padrões do taberna e calcula os derivados', () => {
    const f = fichaAgenteSchema.parse({ classe: 'Combatente' })
    expect(f.nex).toBe(5)
    expect(f.atributos).toEqual({ agi: 1, for: 1, int: 1, pre: 1, vig: 1 })
    expect(derivados(f).pv.total).toBe(21) // 20 + VIG 1
  })

  it('recusa margem de crítico fora do livro e expressão de rolagem sem total', () => {
    expect(() => fichaAgenteSchema.parse({ ataques: [{ id: 'a', margemCritico: 1 }] })).toThrow()
    expect(rolagemSchema.safeParse({ dados: [5] }).success).toBe(false)
    expect(rolagemSchema.safeParse({ dados: [0], total: 0 }).success).toBe(false)
  })

  it('ritual da biblioteca exige nome', () => {
    expect(ritualBibliotecaSchema.safeParse({ nome: '  ' }).success).toBe(false)
    expect(ritualBibliotecaSchema.parse({ nome: 'Decadência', circulo: '2' }).circulo).toBe(2)
  })
})

describe('ficha compacta para completa (NPC vira vilão)', () => {
  it('leva NEX, classe, atributos, recursos e listas sem perder nada', () => {
    const f = fichaDeStats({
      nex: '15%',
      classe: 'Ocultista',
      patente: 'Operador',
      agi: 2,
      pre: 3,
      pv: { current: 9, max: 14 },
      san: { current: 20, max: 20 },
      rituais: ['Cinerária', 'Decadência'],
      inventario: ['Lanterna']
    })
    expect(f).toMatchObject({ nex: 15, classe: 'Ocultista', prestigio: 20, pvAtual: 9, pvMax: 14, sanAtual: 20 })
    expect(f.atributos).toEqual({ agi: 2, for: 0, int: 0, pre: 3, vig: 0 })
    expect(f.rituais.map((r) => r.nome)).toEqual(['Cinerária', 'Decadência'])
    expect(f.inventario[0]).toMatchObject({ nome: 'Lanterna', quantidade: 1, equipado: false })
  })

  it('ficha compacta vazia vira ficha completa padrão', () => {
    expect(fichaDeStats({})).toEqual(fichaAgenteSchema.parse({}))
  })

  it('criatura do modelo antigo vira bloco de ameaça', () => {
    const b = ameacaDeStats({ elemento: 'Morte', vd: '40', pv: { current: 30, max: 60 }, acoes: ['Garras'], resistencias: ['Morte 10', 'balístico 5'] })
    expect(b).toMatchObject({ elemento: 'Morte', vd: 40, pv: 60, resistencias: 'Morte 10, balístico 5' })
    expect(b.acoes).toEqual([{ tipo: '', nome: 'Garras', descricao: '' }])
  })
})
