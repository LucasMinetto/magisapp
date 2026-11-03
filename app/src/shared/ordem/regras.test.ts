// Os mesmos casos de taberna/shared/regras.test.ts (taberna@71f7b1c), com os mesmos valores.
import { describe, expect, it } from 'vitest'
import { dadosDoDano, dadosDoTeste, derivados, descreverExpressao, lerExpressao, resolverDano, resolverTeste, type DadosFicha } from './regras'

// O "Kash" da ficha de exemplo: Ocultista, NEX 40%, AGI 2, FOR 1, INT 3, PRE 3, VIG 1.
const kash: DadosFicha = {
  classe: 'Ocultista',
  nex: 40,
  atributos: { agi: 2, for: 1, int: 3, pre: 3, vig: 1 },
  pericias: { Reflexos: { treino: 10, extra: 0 }, Fortitude: { treino: 5, extra: 0 } },
  bonus: { pv: 0, pe: 0, san: 0, defesaEquip: 0, defesaOutros: 0, deslocamento: 0 },
  prestigio: 0,
  inventario: [{ categoria: 1, espacos: 2, quantidade: 1, defesa: 5, equipado: true }]
}

describe('regras de Ordem Paranormal', () => {
  it('PV, PE e SAN do ocultista seguem a tabela da classe', () => {
    const d = derivados(kash)
    expect(d.nivel).toBe(8)
    expect(d.pv.total).toBe(12 + 1 + 7 * (2 + 1)) // 34
    expect(d.pe.total).toBe(4 + 3 + 7 * (4 + 3)) // 56
    expect(d.san.total).toBe(20 + 7 * 5) // 55
  })

  it('defesa, esquiva, bloqueio, limite de PE e DT de ritual', () => {
    const d = derivados(kash)
    expect(d.defesa.total).toBe(17) // 10 + AGI 2 + proteção 5
    expect(d.esquiva).toBe(27)
    expect(d.bloqueio).toBe(5)
    expect(d.limitePe).toBe(8)
    expect(d.dtRitual).toBe(21) // 10 + 8 + PRE 3
  })

  it('NEX 99% conta como nível 20 e NEX 5% como nível 1', () => {
    expect(derivados({ ...kash, nex: 99 }).nivel).toBe(20)
    expect(derivados({ ...kash, nex: 5 }).pv.total).toBe(13)
  })

  it('carga e limite de itens pela patente', () => {
    const d = derivados(kash)
    expect(d.cargaMax).toBe(5)
    expect(d.carga).toBe(2)
    expect(d.itensPorCategoria[0]).toEqual({ usados: 1, limite: 2 })
    expect(derivados({ ...kash, atributos: { ...kash.atributos, for: 0 } }).cargaMax).toBe(2)
    expect(derivados({ ...kash, prestigio: 60 }).patente.nome).toBe('Agente especial')
  })

  it('teste de perícia: maior d20, ou menor com atributo 0', () => {
    expect(dadosDoTeste(3)).toEqual({ quantidade: 3, regra: 'maior' })
    expect(dadosDoTeste(0)).toEqual({ quantidade: 2, regra: 'menor' })
    expect(dadosDoTeste(0, 1)).toEqual({ quantidade: 1, regra: 'maior' })
    expect(resolverTeste([4, 17, 9], 'maior', 10).total).toBe(27)
    expect(resolverTeste([4, 17], 'menor', 0).total).toBe(4)
  })

  it('crítico pela margem de ameaça e 20 natural', () => {
    const r = resolverTeste([19, 2], 'maior', 5, 19)
    expect(r.critico).toBe(true)
    expect(r.natural20).toBe(false)
    expect(resolverTeste([20], 'maior', 0).natural20).toBe(true)
    expect(resolverTeste([18], 'maior', 0, 19).critico).toBe(false)
  })

  it('dano: lê a expressão e multiplica só os dados no crítico', () => {
    const e = lerExpressao('1d8+2')
    expect(dadosDoDano(e, 2)).toEqual([{ faces: 8, quantidade: 2, sinal: 1 }])
    expect(resolverDano(e, [[5]])).toBe(7)
    expect(resolverDano(e, [[5, 6]], 2)).toBe(13)
    expect(descreverExpressao(lerExpressao('2d6 + 1d4 + 3'), 2)).toBe('4d6 + 2d4 + 3')
    expect(resolverDano(lerExpressao('1d3+1'), [[9]])).toBe(1) // valor impossível é ignorado
  })
})
