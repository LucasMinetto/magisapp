import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, dumpJson, listBackups, loadJson, restoreBackup } from './backup'
import { openDb } from './db'
import { initCampaignRow, seedExample } from './seed'
import { CampaignStore } from './store'

let dir: string
let store: CampaignStore
const backups = () => join(dir, 'backups')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mesa-bk-'))
  const camp = join(dir, 'Caso.mesa')
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso do Hospital', '2026-07-22')), dir)
  void camp
  seedExample(store)
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const unzip = (file: string) => unzipSync(readFileSync(file))
const text = (files: Record<string, Uint8Array>, path: string) => strFromU8(files[path])
const without = (j: ReturnType<typeof dumpJson>) => ({ ...j, exportadoEm: '' })

describe('backup', () => {
  it('um arquivo com banco, json, LEIA-ME e o cofre do Obsidian', () => {
    const { file } = createBackup(store, backups(), { now: new Date(2026, 10, 2, 21, 30) })
    expect(file.endsWith('Caso do Hospital 2026-11-02 21h30.mesa-backup')).toBe(true)
    const z = unzip(file)
    expect(Object.keys(z)).toEqual(expect.arrayContaining(['LEIA-ME.md', 'campanha.sqlite', 'campanha.json', 'legivel/Linha do tempo.md']))
    const aurelio = text(z, 'legivel/Personagens/Dr. Aurélio Bastos.md')
    expect(aurelio).toContain('aliases:\n  - "Aurélio"')
    expect(aurelio).toContain('**Deve favor a:**')
    const ala = text(z, 'legivel/Cenas/02 - Ala fechada.md')
    expect(ala).toContain('[[legivel/Personagens/Dr. Aurélio Bastos|Dr. Aurélio Bastos]]')
    expect(ala).toContain('inicio: "quarta, 22/07/2026 · 23h10"')
    expect(text(z, 'legivel/Linha do tempo.md')).toContain('*lacuna de 3h10, nada marcado*')
    expect(text(z, 'legivel/Pistas/Cópia do livro de ponto.md')).toContain('sessao: "[[legivel/Sessões/Sessão 1|Sessão 1]]"')
  })

  it('quadro vira .canvas do Obsidian apontando para os arquivos do cofre', () => {
    const z = unzip(createBackup(store, backups()).file)
    const canvas = JSON.parse(text(z, 'legivel/Quadros/O caso.canvas')) as { nodes: { type: string; file?: string }[]; edges: unknown[] }
    expect(canvas.nodes).toHaveLength(7)
    expect(canvas.edges).toHaveLength(6)
    for (const n of canvas.nodes.filter((n) => n.type === 'file')) expect(z[n.file!], n.file).toBeDefined()
  })

  it('leva as imagens em anexos/ e o cofre as mostra', () => {
    const src = join(dir, 'chave.png')
    writeFileSync(src, Buffer.from('89504e470d0a1a0a01', 'hex'))
    const a = store.importImage(src)
    const chave = store.listClues()[1]
    store.saveClue({ ...chave, imageId: a.id, finderIds: [] })
    const z = unzip(createBackup(store, backups()).file)
    expect(z[a.relPath]).toBeDefined()
    expect(text(z, 'legivel/Pistas/Chave da ala fechada.md')).toContain(`![[${a.relPath}]]`)
  })

  it('campanha.json vai e volta sem perder nada', () => {
    const before = dumpJson(store.db)
    const file = join(dir, 'de-volta.sqlite')
    loadJson(JSON.parse(JSON.stringify(before)), file)
    const db = openDb(file)
    expect(without(dumpJson(db))).toEqual(without(before))
    db.close()
  })

  it('automáticos: guarda só os 5 mais novos; os manuais ficam', () => {
    createBackup(store, backups(), { now: new Date(2026, 0, 1, 10, 0) })
    for (let i = 0; i < 7; i++) createBackup(store, backups(), { auto: true, keep: 5, now: new Date(2026, 0, 2, 10, i) })
    const list = listBackups(backups(), 'Caso do Hospital')
    expect(list.filter((b) => b.auto)).toHaveLength(5)
    expect(list.filter((b) => !b.auto)).toHaveLength(1)
  })
})

describe('restaurar', () => {
  it('vira uma campanha nova, com anexos, sem sobrescrever', () => {
    const src = join(dir, 'retrato.png')
    writeFileSync(src, Buffer.from('89504e470d0a1a0a02', 'hex'))
    const a = store.importImage(src)
    const { file } = createBackup(store, backups())
    const dest = join(dir, 'campanhas')
    const first = restoreBackup(file, dest, new Date(2026, 10, 2))
    const second = restoreBackup(file, dest, new Date(2026, 10, 2))
    expect(first.path).not.toBe(second.path)
    expect(first.fromJson).toBe(false)
    expect(existsSync(join(first.path, a.relPath))).toBe(true)
    const restored = new CampaignStore(openDb(join(first.path, 'campanha.sqlite')), first.path)
    expect(restored.counts()).toEqual(store.counts())
    expect(restored.search('aurel')[0]?.title).toBe('Dr. Aurélio Bastos')
    restored.close()
  })

  it('banco corrompido: monta do campanha.json e refaz a busca', () => {
    const z = unzip(createBackup(store, backups()).file)
    z['campanha.sqlite'] = strToU8('isto não é um banco')
    const broken = join(dir, 'quebrado.mesa-backup')
    writeFileSync(broken, zipSync(z))
    const { path, fromJson } = restoreBackup(broken, join(dir, 'campanhas'))
    expect(fromJson).toBe(true)
    const restored = new CampaignStore(openDb(join(path, 'campanha.sqlite')), path)
    restored.rebuildIndexes()
    expect(restored.counts()).toEqual(store.counts())
    expect(restored.search('caldeira')[0]?.title).toBe('O diretor queima o livro de ponto')
    expect(restored.getEntity(restored.listEntities().find((e) => e.name === 'A Vigia')!.id).mentionedIn.length).toBeGreaterThan(0)
    restored.close()
  })

  it('ignora caminhos perigosos dentro do zip', () => {
    const z = unzip(createBackup(store, backups()).file)
    z['../fora.txt'] = strToU8('x')
    z['anexos/../../fora2.txt'] = strToU8('x')
    const evil = join(dir, 'mau.mesa-backup')
    writeFileSync(evil, zipSync(z))
    restoreBackup(evil, join(dir, 'campanhas', 'sub'))
    expect(existsSync(join(dir, 'campanhas', 'fora.txt'))).toBe(false)
    expect(existsSync(join(dir, 'fora2.txt'))).toBe(false)
  })

  it('arquivo que não é backup dá erro claro', () => {
    const junk = join(dir, 'x.mesa-backup')
    writeFileSync(junk, 'nada')
    expect(() => restoreBackup(junk, join(dir, 'campanhas'))).toThrow(/backup do Mesa/)
  })
})
