import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ameacaBibliotecaSchema, itemBibliotecaSchema, ritualBibliotecaSchema } from '../shared/ordem/esquemas'
import { itemForSheet, LibraryStore, ritualForSheet, threatForCampaign } from './library'
import { LIVROS, LIVROS_VERSAO } from './livros'

describe('dados dos livros', () => {
  const texto = JSON.stringify(LIVROS)

  it('não trazem marca d’água: nenhum e-mail e nenhum nome de comprador', () => {
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
    expect(texto.toLowerCase()).not.toMatch(/rpgpedia|minetto/)
  })

  it('tudo passa pela validação da biblioteca, com nome, página e id único', () => {
    const ids = new Set<string>()
    for (const livro of LIVROS) {
      for (const [lista, schema] of [
        [livro.rituais, ritualBibliotecaSchema],
        [livro.itens, itemBibliotecaSchema],
        [livro.ameacas, ameacaBibliotecaSchema]
      ] as const) {
        for (const r of lista) {
          const ok = schema.safeParse(r)
          expect(ok.success, `${livro.fonte.sigla}: ${r.nome}`).toBe(true)
          expect(ok.success && ok.data.pagina).toBeGreaterThan(0)
          expect(ids.has(r.id), `id repetido: ${r.nome}`).toBe(false)
          ids.add(r.id)
        }
      }
    }
  })

  it('trazem os rituais, itens e ameaças dos dois livros', () => {
    const [op, sah] = LIVROS
    expect(op.fonte.nome).toBe('Ordem Paranormal RPG')
    expect(op.rituais.length).toBeGreaterThanOrEqual(82)
    expect(sah.rituais.length).toBeGreaterThanOrEqual(16)
    expect(op.ameacas.map((a) => a.nome)).toContain('Zumbi de Sangue')
    const zumbi = ameacaBibliotecaSchema.parse(op.ameacas.find((a) => a.nome === 'Zumbi de Sangue'))
    expect(zumbi).toMatchObject({ vd: 20, defesa: 17, pv: 45, pvMachucado: 22, elemento: 'Sangue', percepcao: '1d20+10' })
    const faca = itemBibliotecaSchema.parse(op.itens.find((i) => i.nome === 'Faca'))
    expect(faca).toMatchObject({ tipo: 'Arma', dano: '1d4', critico: '19', tipoDano: 'Corte', empunhadura: 'Leve' })
    const eletro = ritualBibliotecaSchema.parse(op.rituais.find((r) => r.nome === 'Eletrocussão'))
    expect(eletro).toMatchObject({ elemento: 'Energia', circulo: 1, danoNormal: '3d6', tipoDano: 'Eletricidade' })
  })
})

describe('biblioteca semeada com os livros', () => {
  let dir: string
  let lib: LibraryStore
  const abrir = () => new LibraryStore(join(dir, 'biblioteca.sqlite'), { dados: LIVROS, versao: LIVROS_VERSAO })

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'magistrado-livros-'))
    lib = abrir()
  })
  afterEach(() => {
    lib.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('cria as origens oficiais e os registros, sem duplicar ao abrir de novo', () => {
    const fontes = lib.sources().filter((s) => s.kind === 'oficial')
    expect(fontes.map((s) => s.name).sort()).toEqual(['Ordem Paranormal RPG', 'Sobrevivendo ao Horror'])
    const total = lib.list('ritual').length
    expect(total).toBe(LIVROS.reduce((n, l) => n + l.rituais.length, 0))
    lib.close()
    lib = abrir()
    expect(lib.list('ritual')).toHaveLength(total)
  })

  it('não desfaz o que o mestre editou ou apagou', () => {
    const [primeiro, segundo] = lib.list('ritual')
    lib.save('ritual', { id: primeiro.id, sourceId: primeiro.sourceId, data: { ...primeiro.data, efeito: 'Do meu jeito.' } })
    lib.remove('ritual', segundo.id)
    lib.close()
    lib = abrir()
    expect(lib.get('ritual', primeiro.id).data.efeito).toBe('Do meu jeito.')
    expect(lib.list('ritual').some((r) => r.id === segundo.id)).toBe(false)
  })

  it('a página fica na biblioteca e não vai para a ficha nem para a campanha', () => {
    const faca = lib.list('item', { q: 'Faca' }).find((i) => i.name === 'Faca')!
    expect(faca.data.pagina).toBeGreaterThan(0)
    const naFicha = itemForSheet(faca)
    expect(naFicha).toMatchObject({ nome: 'Faca', dano: '1d4', critico: '19' })
    expect(naFicha).not.toHaveProperty('pagina')
    expect(ritualForSheet(lib.list('ritual')[0])).not.toHaveProperty('pagina')
    expect(threatForCampaign(lib.list('ameaca')[0]).sheetData).not.toHaveProperty('pagina')
  })
})

describe('regras dos livros', () => {
  it('têm seções com página, sem marca d’água e sem as entradas da biblioteca', async () => {
    const regras = (await import('../renderer/src/regras/regras.json')).default as { titulo: string; pagina: number; texto: string }[]
    expect(regras.length).toBeGreaterThan(40)
    const texto = JSON.stringify(regras)
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
    expect(texto.toLowerCase()).not.toMatch(/rpgpedia|minetto/)
    for (const s of regras) expect(s.pagina, s.titulo).toBeGreaterThan(0)
    expect(regras.map((s) => s.titulo)).toEqual(expect.arrayContaining(['Combate', 'Condições', 'Rituais', 'Sanidade']))
    // a descrição de um ritual fica na biblioteca, não no texto da regra
    const rituais = regras.find((s) => s.titulo === 'Rituais')!
    expect(rituais.texto).not.toMatch(/\*\*Eletrocussão\.?\*\*/)
  })
})
