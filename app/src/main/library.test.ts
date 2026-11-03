import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

describe('biblioteca: backup', () => {
  it('faz backup e restaura, guardando a anterior', () => {
    lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Cinerária' } })
    const file = lib.backup(join(dir, 'backups'), new Date(2026, 10, 3, 21, 30))
    expect(file.endsWith('Biblioteca 2026-11-03 21h30.magistrado-backup')).toBe(true)
    lib.save('ritual', { sourceId: lib.ownSourceId(), data: { nome: 'Decadência' } })
    lib.restore(file)
    expect(lib.list('ritual').map((r) => r.name)).toEqual(['Cinerária'])
    // A versão de antes de restaurar continua guardada ao lado.
    const before = new LibraryStore(join(dir, 'biblioteca.sqlite.antes-de-restaurar'))
    expect(before.list('ritual')).toHaveLength(2)
    before.close()
  })

  it('recusa arquivo que não é backup de biblioteca e não mexe na atual', () => {
    lib.save('item', { sourceId: lib.ownSourceId(), data: { nome: 'Pé de cabra' } })
    const junk = join(dir, 'x.magistrado-backup')
    writeFileSync(junk, 'não é zip')
    expect(() => lib.restore(junk)).toThrow(/backup da biblioteca/)
    const campanha = join(dir, 'campanha.magistrado-backup')
    writeFileSync(campanha, zipSync({ 'campanha.json': strToU8('{}') }))
    expect(() => lib.restore(campanha)).toThrow(/campanha/)
    expect(lib.list('item').map((i) => i.name)).toEqual(['Pé de cabra'])
  })
})
