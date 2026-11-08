import { describe, expect, it } from 'vitest'
import { compararVersoes, decidirAtualizacao, lerVersaoPublicada } from './versao'

describe('versão', () => {
  it('compara número a número, não como texto', () => {
    expect(compararVersoes('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compararVersoes('1.0.0', '0.99.99')).toBeGreaterThan(0)
    expect(compararVersoes('0.9.1', '0.9.1')).toBe(0)
    expect(compararVersoes('0.9.0', '0.9.1')).toBeLessThan(0)
  })

  it('recusa número fora do formato', () => {
    expect(() => compararVersoes('1.0', '1.0.0')).toThrow(/inválida/)
  })

  it('só avisa quando a publicada é maior', () => {
    const pub = lerVersaoPublicada('{"versao":"0.9.1","minimo":"0.0.0","publicada_em":"2026-11-08","notas":["a"]}')
    expect(decidirAtualizacao('0.9.0', pub)).toEqual({ nova: '0.9.1', obrigatoria: false })
    expect(decidirAtualizacao('0.9.1', pub)).toEqual({ nova: null, obrigatoria: false })
    expect(decidirAtualizacao('1.0.0', pub)).toEqual({ nova: null, obrigatoria: false })
  })

  it('é obrigatória abaixo do mínimo', () => {
    const pub = lerVersaoPublicada('{"versao":"1.1.0","minimo":"1.0.0","notas":[]}')
    expect(decidirAtualizacao('0.9.0', pub).obrigatoria).toBe(true)
    expect(decidirAtualizacao('1.0.0', pub).obrigatoria).toBe(false)
  })

  it('versao.json malformado dá erro claro; mínimo ausente vira 0.0.0', () => {
    expect(() => lerVersaoPublicada('{"versao":"x"}')).toThrow(/formato/)
    expect(lerVersaoPublicada('{"versao":"1.0.0"}').minimo).toBe('0.0.0')
  })
})
