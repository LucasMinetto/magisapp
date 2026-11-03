import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDb } from './db'
import { initCampaignRow, seedExample } from './seed'
import { CampaignStore } from './store'
import { UndoLog } from './undo'

let dir: string
let store: CampaignStore
let undo: UndoLog
const step = <T>(label: string, job: () => T): T => {
  const end = undo.begin(label)
  try {
    return job()
  } finally {
    end()
  }
}
const scene = (title: string) => store.listScenes().find((s) => s.title === title)!

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-undo-'))
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso', '2026-07-22')), dir)
  seedExample(store)
  undo = new UndoLog(store.db)
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('desfazer e refazer', () => {
  it('desfaz e refaz uma edição', () => {
    const ala = store.getScene(scene('Ala fechada').id)
    step('editar cena', () => store.saveScene({ ...ala, title: 'Ala trancada' }))
    expect(undo.state()).toEqual({ undo: 'editar cena', redo: null })
    expect(undo.undo()).toBe('editar cena')
    expect(store.getScene(ala.id).title).toBe('Ala fechada')
    expect(undo.state()).toEqual({ undo: null, redo: 'editar cena' })
    undo.redo()
    expect(store.getScene(ala.id).title).toBe('Ala trancada')
  })

  it('lixeira desfeita volta inteira, com busca e menções refeitas', () => {
    const vigia = store.listEntities().find((e) => e.name === 'A Vigia')!
    step('ficha para a lixeira', () => store.trashEntity(vigia.id))
    undo.undo()
    store.rebuildIndexes()
    expect(store.listEntities().some((e) => e.id === vigia.id)).toBe(true)
    expect(store.search('vigia').some((h) => h.refId === vigia.id)).toBe(true)
    expect(store.getScene(scene('Ala fechada').id).mentions.map((m) => m.name)).toContain('A Vigia')
  })

  it('apagar de vez com cascata (nós do quadro) também volta', () => {
    const vigia = store.listEntities().find((e) => e.name === 'A Vigia')!
    store.trashEntity(vigia.id)
    const board = store.listBoards()[0]
    const nodesBefore = store.getBoard(board.id).nodes.length
    step('apagar de vez', () => store.purge('entity', vigia.id))
    expect(store.getBoard(board.id).nodes.length).toBe(nodesBefore - 1)
    undo.undo()
    expect(store.getBoard(board.id).nodes.length).toBe(nodesBefore)
    expect(store.getBoard(board.id).edges.length).toBe(6)
  })

  it('relógio e criação desfeitos; ação nova apaga o refazer; passo vazio não conta', () => {
    step('avançar o relógio', () => store.advanceClock(60))
    step('criar quadro', () => store.createBoard('Novo'))
    undo.undo()
    expect(store.listBoards().map((b) => b.name)).toEqual(['O caso'])
    undo.undo()
    expect(store.campaign().currentGameMinute).toBe(19 * 60)
    expect(undo.state().redo).toBe('avançar o relógio')
    step('nada', () => store.listScenes())
    expect(undo.state().redo).toBe('avançar o relógio')
    step('avançar o relógio', () => store.advanceClock(10))
    expect(undo.state()).toEqual({ undo: 'avançar o relógio', redo: null })
  })

  it('guarda no máximo o limite de passos', () => {
    const small = new UndoLog(store.db, 3)
    for (let i = 0; i < 5; i++) {
      const end = small.begin(`passo ${i}`)
      store.advanceClock(1)
      end()
    }
    let n = 0
    while (small.undo()) n++
    expect(n).toBe(3)
    expect(store.campaign().currentGameMinute).toBe(19 * 60 + 2)
  })
})
