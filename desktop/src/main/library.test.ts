import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { itemForSheet, LibraryStore, OWN_SOURCE_NAME, ritualForSheet, threatForCampaign } from './library'

let dir: string
let lib: LibraryStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-bib-'))
  lib = new LibraryStore(join(dir, 'biblioteca.sqlite'))
})

afterEach(() => {
  lib.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('biblioteca: origens', () => {
  it('já vem com "Criações próprias", que não pode ser apagada', () => {
    const [own] = lib.sources()
    expect(own).toMatchObject({ name: OWN_SOURCE_NAME, kind: 'propria', builtin: true, count: 0 })
    expect(() => lib.deleteSource(own.id)).toThrow(/vem com o app/)
    // Abrir de novo não cria outra.
    lib.close()
    lib = new LibraryStore(join(dir, 'biblioteca.sqlite'))
    expect(lib.sources()).toHaveLength(1)
  })

  it('cria livro novo, recusa nome repetido e só apaga origem vazia', () => {
    const livro = lib.saveSource({ name: 'Livro de Regras', kind: 'oficial', abbreviation: 'OP' })
    expect(() => lib.saveSource({ name: 'livro de regras', kind: 'outro', abbreviation: '' })).toThrow(/Já existe/)
    lib.save('ritual', { sourceId: livro.id, data: { nome: 'Cinerária', elemento: 'Morte', circulo: 1 } })
    expect(lib.sources().find((s) => s.id === livro.id)?.count).toBe(1)
    expect(() => lib.deleteSource(livro.id)).toThrow(/ainda tem 1/)
    const vazio = lib.saveSource({ name: 'Sobrevivendo ao Horror', kind: 'oficial', abbreviation: 'SaH' })
    lib.deleteSource(vazio.id)
    expect(lib.sources().map((s) => s.name)).toEqual([OWN_SOURCE_NAME, 'Livro de Regras'])
  })
})

describe('biblioteca: registros', () => {
  it('cadastra com origem, filtra por origem e por nome', () => {
    const own = lib.ownSourceId()
    const livro = lib.saveSource({ name: 'Livro de Regras', kind: 'oficial', abbreviation: 'OP' }).id
    lib.save('item', { sourceId: livro, data: { nome: 'Pistola', tipo: 'Arma', categoria: 1 } })
    lib.save('item', { sourceId: own, data: { nome: 'Lanterna tática', espacos: 1 } })
    lib.save('ameaca', { sourceId: own, data: { nome: 'A Vigia', elemento: 'Morte', vd: 40 } })
    expect(lib.list('item').map((i) => i.name)).toEqual(['Lanterna tática', 'Pistola'])
    expect(lib.list('item', { sourceId: livro }).map((i) => i.sourceName)).toEqual(['Livro de Regras'])
    expect(lib.list('item', { q: 'TATICA' }).map((i) => i.name)).toEqual(['Lanterna tática'])
    expect(lib.list('ameaca')[0].data).toMatchObject({ nome: 'A Vigia', vd: 40, pv: 0 })
  })

  it('recusa registro sem nome ou com origem que não existe', () => {
    expect(() => lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: '' } })).toThrow()
    expect(() => lib.save('item', { sourceId: crypto.randomUUID(), data: { nome: 'X' } })).toThrow(/origem/)
  })

  it('edita mudando a origem', () => {
    const livro = lib.saveSource({ name: 'Livro de Regras', kind: 'oficial', abbreviation: '' }).id
    const r = lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Decadência' } })
    const r2 = lib.save('ritual', { id: r.id, sourceId: livro, data: { ...r.data, circulo: 2 } })
    expect(r2).toMatchObject({ id: r.id, sourceName: 'Livro de Regras', data: { circulo: 2 } })
    expect(lib.list('ritual')).toHaveLength(1)
  })

  it('a cópia para a campanha guarda a origem e sobrevive ao apagar o original', () => {
    const own = lib.ownSourceId()
    const item = lib.save('item', { sourceId: own, data: { nome: 'Colete', tipo: 'Proteção', defesa: 5, categoria: 1 } })
    const ritual = lib.save('ritual', { sourceId: own, data: { nome: 'Eletrocussão', circulo: 1, alvoTipo: 'Alvo' } })
    const ameaca = lib.save('ameaca', { sourceId: own, data: { nome: 'Zumbi de Sangue', vd: 20, pv: 45 } })
    const noInventario = itemForSheet(item)
    const naFicha = ritualForSheet(ritual)
    const naCampanha = threatForCampaign(ameaca)
    lib.remove('item', item.id)
    lib.remove('ritual', ritual.id)
    lib.remove('ameaca', ameaca.id)
    expect(noInventario).toMatchObject({ nome: 'Colete', defesa: 5, quantidade: 1, equipado: false, origem: { libraryId: item.id, sourceName: OWN_SOURCE_NAME } })
    expect(noInventario.id).not.toBe(item.id)
    expect(naFicha).toMatchObject({ nome: 'Eletrocussão', origem: { libraryId: ritual.id } })
    expect(naFicha).not.toHaveProperty('alvoTipo')
    expect(naCampanha).toMatchObject({ name: 'Zumbi de Sangue', sheetData: { vd: 20, pv: 45 }, origin: { libraryId: ameaca.id } })
    expect(naCampanha.sheetData).not.toHaveProperty('nome')
  })
})

describe('biblioteca: pacote por origem', () => {
  const outra = () => {
    mkdirSync(join(dir, 'outro'), { recursive: true })
    return new LibraryStore(join(dir, 'outro', 'biblioteca.sqlite'))
  }

  it('exporta só a origem pedida e importa noutra biblioteca como origem nova', () => {
    const livro = lib.saveSource({ name: 'Livro de Regras', kind: 'oficial', abbreviation: 'OPRPG' })
    lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Cinerária' } })
    lib.save('item', { sourceId: livro.id, data: { nome: 'Pé de cabra' } })
    const file = lib.exportPackage(join(dir, 'Livro.magistrado-biblioteca'), [livro.id])
    const b = outra()
    try {
      const prev = b.previewImport(file)
      expect(prev.origens).toEqual([expect.objectContaining({ name: 'Livro de Regras', match: null, novos: 1, total: 1 })])
      expect(b.importPackage(file, {})).toEqual({ origens: 1, novos: 1, atualizados: 0 })
      expect(b.sources().map((s) => s.name)).toEqual(['Criações próprias', 'Livro de Regras'])
      expect(b.list('item')[0]).toMatchObject({ name: 'Pé de cabra', sourceName: 'Livro de Regras' })
      expect(b.list('ritual')).toHaveLength(0)
    } finally {
      b.close()
    }
  })

  it('exportar tudo leva todas as origens; "Criações próprias" casa pelo nome', () => {
    lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Cinerária' } })
    const file = lib.exportPackage(join(dir, 'tudo.magistrado-biblioteca'))
    const b = outra()
    try {
      b.save('ritual', { sourceId: b.ownSourceId(), data: { nome: 'Decadência' } })
      const [propria] = b.previewImport(file).origens
      expect(propria).toMatchObject({ name: 'Criações próprias', match: { id: b.ownSourceId() }, novos: 1, soAqui: 1 })
      b.importPackage(file, { [propria.pacoteId]: 'atualizar' })
      expect(b.list('ritual').map((r) => r.name)).toEqual(['Cinerária', 'Decadência'])
    } finally {
      b.close()
    }
  })

  it('importar o mesmo pacote de novo avisa e não duplica sem o mestre pedir', () => {
    const r = lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Cinerária', circulo: 1 } })
    const file = lib.exportPackage(join(dir, 'p.magistrado-biblioteca'))
    const [o] = lib.previewImport(file).origens
    expect(o).toMatchObject({ match: { id: lib.ownSourceId() }, novos: 0, mudam: 0, iguais: 1, soAqui: 0 })
    // Sem escolha, a origem que já existe não muda.
    expect(lib.importPackage(file, {})).toEqual({ origens: 0, novos: 0, atualizados: 0 })
    // Atualizar: o que mudou volta ao do pacote; nada se duplica.
    lib.save('ritual', { id: r.id, sourceId: lib.ownSourceId(), data: { ...r.data, circulo: 3 } })
    expect(lib.previewImport(file).origens[0]).toMatchObject({ mudam: 1, iguais: 0 })
    expect(lib.importPackage(file, { [o.pacoteId]: 'atualizar' })).toEqual({ origens: 1, novos: 0, atualizados: 1 })
    expect(lib.list('ritual')).toHaveLength(1)
    expect(lib.list('ritual')[0].data.circulo).toBe(1)
    // Como cópia: outra origem, com outro nome, com tudo do pacote.
    lib.importPackage(file, { [o.pacoteId]: 'copia' })
    expect(lib.sources().map((s) => s.name)).toEqual(['Criações próprias', 'Criações próprias (cópia)'])
    expect(lib.list('ritual').map((x) => x.sourceName).sort()).toEqual(['Criações próprias', 'Criações próprias (cópia)'])
  })

  it('avisa quando o mesmo nome está em outra origem, e as duas convivem', () => {
    const livro = lib.saveSource({ name: 'Livro de Regras', kind: 'oficial', abbreviation: '' })
    lib.save('item', { sourceId: livro.id, data: { nome: 'Pé de cabra' } })
    const file = lib.exportPackage(join(dir, 'l.magistrado-biblioteca'), [livro.id])
    const b = outra()
    try {
      b.save('item', { sourceId: b.ownSourceId(), data: { nome: 'Pé de Cabra' } })
      expect(b.previewImport(file).origens[0]).toMatchObject({ match: null, novos: 1, mesmoNomeEmOutra: 1 })
      b.importPackage(file, {})
      expect(b.list('item')).toHaveLength(2)
    } finally {
      b.close()
    }
  })

  it('backup antes de atualizar o app é um pacote com tudo', () => {
    lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Cinerária' } })
    const file = lib.backup(join(dir, 'backups'), new Date(2026, 10, 3, 21, 30))
    expect(file.endsWith('Biblioteca 2026-11-03 21h30.magistrado-biblioteca')).toBe(true)
    expect(lib.previewImport(file).origens[0].iguais).toBe(1)
  })

  it('recusa arquivo que não é pacote e não mexe na atual', () => {
    lib.save('item', { sourceId: lib.ownSourceId(), data: { nome: 'Pé de cabra' } })
    const junk = join(dir, 'x.magistrado-biblioteca')
    writeFileSync(junk, 'não é zip')
    expect(() => lib.previewImport(junk)).toThrow(/pacote da biblioteca/)
    const campanha = join(dir, 'campanha.magistrado-backup')
    writeFileSync(campanha, zipSync({ 'campanha.json': strToU8('{}') }))
    expect(() => lib.importPackage(campanha, {})).toThrow(/campanha/)
    expect(lib.list('item').map((i) => i.name)).toEqual(['Pé de cabra'])
  })
})

describe('biblioteca: correções dos livros', () => {
  const ID_A = '00000000-0000-4000-8000-00000000000a'
  const ID_B = '00000000-0000-4000-8000-00000000000b'
  const livro = (rituais: { id: string; nome: string; circulo: number }[]) => [{ fonte: { nome: 'Livro Teste', sigla: 'LT' }, rituais, itens: [], ameacas: [] }]

  it('troca o que ainda está como veio do livro e deixa o que o mestre editou, com aviso', () => {
    const file = join(dir, 'livros.sqlite')
    const v1 = new LibraryStore(file, { dados: livro([{ id: ID_A, nome: 'Alfa', circulo: 1 }, { id: ID_B, nome: 'Beta', circulo: 1 }]), versao: 1 })
    const beta = v1.get('ritual', ID_B)
    v1.save('ritual', { id: ID_B, sourceId: beta.sourceId, data: { ...beta.data, efeito: 'minha versão' } })
    v1.close()
    const anteriores = { [ID_A]: { id: ID_A, nome: 'Alfa', circulo: 1 }, [ID_B]: { id: ID_B, nome: 'Beta', circulo: 1 } }
    const v2 = new LibraryStore(file, { dados: livro([{ id: ID_A, nome: 'Alfa', circulo: 2 }, { id: ID_B, nome: 'Beta', circulo: 2 }]), versao: 2, anteriores })
    try {
      expect(v2.get('ritual', ID_A).data.circulo).toBe(2)
      expect(v2.get('ritual', ID_B).data).toMatchObject({ circulo: 1, efeito: 'minha versão' })
      expect(v2.livrosEditados()).toEqual(['Beta'])
      v2.dispensarLivrosEditados()
      expect(v2.livrosEditados()).toEqual([])
    } finally {
      v2.close()
    }
  })
})
