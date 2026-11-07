import { describe, expect, it } from 'vitest'
import { iniciativaSchema } from './esquemas'
import { anterior, lerAcao, nomeDaCopia, ordenar, proximo, remover, testeDoTexto } from './sessao'

const c = (id: string, valor = 0) => ({
  id,
  entityId: null,
  nome: id,
  valor,
  pv: null
})

describe('testes lidos do bloco', () => {
  it('lê "2d20+5", "1d20" e dados negativos', () => {
    expect(testeDoTexto('2d20+5')).toEqual({
      quantidade: 2,
      regra: 'maior',
      bonus: 5
    })
    expect(testeDoTexto(' 1d20 ')).toEqual({
      quantidade: 1,
      regra: 'maior',
      bonus: 0
    })
    expect(testeDoTexto('0d20-2')).toEqual({
      quantidade: 2,
      regra: 'menor',
      bonus: -2
    })
    expect(testeDoTexto('3O+10')).toEqual({ quantidade: 3, regra: 'maior', bonus: 10 })
    expect(testeDoTexto('O')).toEqual({ quantidade: 1, regra: 'maior', bonus: 0 })
    expect(testeDoTexto('')).toBeNull()
    expect(testeDoTexto('veja o texto')).toBeNull()
  })

  it('lê o teste e o dano de uma ação', () => {
    const a = lerAcao('Garras: Corpo a corpo x2\nTeste 2d20+5 | Dano 1d6+5 corte')
    expect(a.teste).toEqual({ quantidade: 2, regra: 'maior', bonus: 5 })
    expect(a.dano).toEqual({ expressao: '1d6+5', tipo: 'corte' })
    expect(lerAcao('Dano 2d8 sangue e 1d6 fogo').dano).toEqual({
      expressao: '2d8',
      tipo: 'sangue'
    })
    expect(lerAcao('Teste 2O+15 | Dano 3d8 sangue').teste).toEqual({ quantidade: 2, regra: 'maior', bonus: 15 })
    expect(lerAcao('Teste oposto de Ocultismo').teste).toBeNull()
    expect(lerAcao('O zumbi grita.')).toEqual({ teste: null, dano: null })
  })
})

describe('iniciativa', () => {
  const base = iniciativaSchema.parse({
    ordem: [c('a', 10), c('b', 25), c('c', 18)]
  })

  it('dados antigos, sem PV no combatente, continuam válidos', () => {
    expect(iniciativaSchema.parse({ ordem: [{ id: 'x', nome: 'X', valor: 3 }] }).ordem[0].pv).toBeNull()
  })

  it('ordena do maior para o menor e volta ao primeiro', () => {
    const o = ordenar({ ...base, turno: 2 })
    expect(o.ordem.map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(o.turno).toBe(0)
  })

  it('passa a vez e vira a rodada depois do último', () => {
    let i = proximo(base)
    expect([i.turno, i.rodada]).toEqual([1, 1])
    i = proximo(proximo(i))
    expect([i.turno, i.rodada]).toEqual([0, 2])
    expect(anterior(i)).toMatchObject({ turno: 2, rodada: 1 })
    expect(anterior(base)).toEqual(base)
  })

  it('remover mantém a vez de quem estava jogando', () => {
    expect(remover({ ...base, turno: 2 }, 'a')).toMatchObject({ turno: 1 })
    expect(remover({ ...base, turno: 1 }, 'b').ordem[1].id).toBe('c')
    expect(remover({ ...base, turno: 2 }, 'c').turno).toBe(0)
  })

  it('cópias da mesma ameaça ganham número', () => {
    const ordem = [c('Zumbi'), c('Zumbi 2')]
    expect(nomeDaCopia(ordem, 'Zumbi')).toBe('Zumbi 3')
    expect(nomeDaCopia(ordem, 'Anjo')).toBe('Anjo')
  })
})
