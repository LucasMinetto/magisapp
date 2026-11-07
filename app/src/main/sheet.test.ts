// Ficha completa e compacta, rolagens, iniciativa e cópia da biblioteca (T5), com desfazer e lixeira.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dumpJson, loadJson } from './backup'
import { openDb } from './db'
import { copyToCampaign, LibraryStore } from './library'
import { initCampaignRow, seedExample } from './seed'
import { CampaignStore } from './store'
import { UndoLog } from './undo'
import { derivados } from '../shared/ordem/regras'
import type { FichaAgente } from '../shared/ordem/esquemas'
import type { Entity, EntityInput } from '../shared/types'

let dir: string
let store: CampaignStore
let history: UndoLog

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-ficha-'))
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso do Hospital', '2026-07-22')), dir)
  seedExample(store)
  history = new UndoLog(store.db)
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const byName = (name: string) => store.getEntity(store.listEntities().find((e) => e.name === name)!.id)
/** Uma ação da tela = um passo do desfazer, como no ipc.ts. */
const act = <T>(label: string, fn: () => T): T => {
  const end = history.begin(label)
  try {
    return fn()
  } finally {
    end()
  }
}
const input = (e: Entity): EntityInput => ({ ...e })
const ficha = (e: Entity) => e.sheetData as FichaAgente

describe('ficha completa e compacta', () => {
  it('agente usa a completa, montada da compacta sem perder nada', () => {
    const lia = byName('Lia Moraes')
    expect(lia).toMatchObject({ isPlayer: true, sheet: 'completa' })
    expect(ficha(lia)).toMatchObject({ classe: 'Ocultista', nex: 15, pvAtual: 14, sanAtual: 20 })
    // Pedir compacta para um agente não pega.
    expect(store.saveEntity({ ...input(lia), sheet: 'compacta' }).sheet).toBe('completa')
    expect(() => store.setSheet(lia.id, 'compacta')).toThrow(/Agente/)
  })

  it('NPC começa compacto e não tem ficha completa', () => {
    const aurelio = byName('Dr. Aurélio Bastos')
    expect(aurelio).toMatchObject({ sheet: 'compacta', sheetData: null })
    expect(() => store.saveEntity({ ...input(aurelio), sheetData: { classe: 'Combatente' } })).toThrow(/ficha completa/)
  })

  it('tela que devolve a ficha inteira sem mexer na completa não congela a compacta', () => {
    const lia = byName('Lia Moraes')
    // Ex.: a Sessão muda o PV pela ficha compacta e manda o resto como recebeu.
    store.saveEntity({ ...input(lia), stats: { ...lia.stats, pv: { current: 3, max: 14 } } })
    expect(ficha(byName('Lia Moraes')).pvAtual).toBe(3)
    expect(store.db.prepare('select sheet_data from entities where id = ?').get(lia.id)).toEqual({ sheet_data: '{}' })
  })

  it('editar a ficha completa grava, valida e recalcula pelas regras', () => {
    const lia = byName('Lia Moraes')
    const f = { ...ficha(lia), atributos: { ...ficha(lia).atributos, vig: 3 }, nex: 40 }
    const saved = store.saveEntity({ ...input(lia), sheetData: f })
    expect(derivados(ficha(saved)).pv.total).toBe(12 + 3 + 7 * (2 + 3))
    expect(() => store.saveEntity({ ...input(lia), sheetData: { ...f, ataques: [{ id: 'x', margemCritico: 30 }] } })).toThrow()
    expect(ficha(byName('Lia Moraes')).nex).toBe(40)
  })

  it('NPC vira vilão e volta, sem perder o que estava preenchido, e o desfazer volta o tamanho', () => {
    const aurelio = byName('Dr. Aurélio Bastos')
    const vilao = act('mudar o tamanho da ficha', () => store.setSheet(aurelio.id, 'completa'))
    expect(vilao.sheet).toBe('completa')
    expect(vilao.stats).toEqual(aurelio.stats)
    const editado = store.saveEntity({ ...input(vilao), sheetData: { ...ficha(vilao), trilha: 'Graduado' } })
    const compacto = store.setSheet(editado.id, 'compacta')
    expect(compacto).toMatchObject({ sheet: 'compacta', sheetData: null, stats: aurelio.stats })
    expect(ficha(store.setSheet(editado.id, 'completa')).trilha).toBe('Graduado') // a completa ficou guardada
    history.undo()
    history.undo()
    expect(byName('Dr. Aurélio Bastos').sheet).toBe('compacta')
  })

  it('ameaça antiga abre como bloco e o texto da ficha entra na busca', () => {
    const vigia = byName('A Vigia')
    expect(vigia.kind).toBe('ameaca')
    expect(vigia.sheetData).toMatchObject({ elemento: 'Morte' })
    const lia = byName('Lia Moraes')
    store.saveEntity({ ...input(lia), sheetData: { ...ficha(lia), habilidades: [{ id: 'h', nome: 'Sangue de Ferro', descricao: 'resiste a veneno' }] } })
    expect(store.search('resiste a veneno')[0]).toMatchObject({ refType: 'entity', title: 'Lia Moraes' })
  })

  it('ficha completa vai para a lixeira e volta com a ficha', () => {
    const lia = byName('Lia Moraes')
    store.saveEntity({ ...input(lia), sheetData: { ...ficha(lia), jogador: 'Bruna' } })
    store.trashEntity(lia.id)
    expect(store.listEntities().some((e) => e.id === lia.id)).toBe(false)
    store.restore('entity', lia.id)
    expect(ficha(byName('Lia Moraes')).jogador).toBe('Bruna')
  })
})

describe('rolagens', () => {
  it('guarda com a hora no jogo e o nome da ficha, lista por ficha e por sessão', () => {
    const lia = byName('Lia Moraes')
    const sessao = store.createSession('2026-11-03')
    const r = store.addRoll({ entityId: lia.id, sessionId: sessao.id, rotulo: 'Ocultismo', tipo: 'teste', formula: '3d20+10', dados: [4, 17, 9], total: 27 })
    store.addRoll({ rotulo: 'Dano da Vigia', tipo: 'dano', formula: '2d6', dados: [3, 5], total: 8, quem: 'A Vigia' })
    expect(r).toMatchObject({ who: 'Lia Moraes', gameMinute: store.campaign().currentGameMinute, dice: [4, 17, 9], total: 27, critical: false })
    expect(store.listRolls({ entityId: lia.id }).map((x) => x.label)).toEqual(['Ocultismo'])
    expect(store.listRolls({ sessionId: sessao.id })).toHaveLength(1)
    expect(store.listRolls().map((x) => x.label)).toEqual(['Dano da Vigia', 'Ocultismo'])
  })

  it('recusa dado impossível e ficha que não existe', () => {
    expect(() => store.addRoll({ dados: [0], total: 0 })).toThrow()
    expect(() => store.addRoll({ entityId: crypto.randomUUID(), dados: [5], total: 5 })).toThrow(/Ficha/)
  })

  it('rolagem pode ser desfeita e refeita', () => {
    act('rolagem', () => store.addRoll({ rotulo: 'Luta', dados: [12], total: 15 }))
    expect(store.listRolls()).toHaveLength(1)
    expect(history.undo()).toBe('rolagem')
    expect(store.listRolls()).toHaveLength(0)
    history.redo()
    expect(store.listRolls()[0].label).toBe('Luta')
  })

  it('apagar de vez a ficha leva as rolagens dela', () => {
    const lia = byName('Lia Moraes')
    store.addRoll({ entityId: lia.id, dados: [10], total: 10 })
    store.trashEntity(lia.id)
    expect(store.listRolls()).toHaveLength(1) // na lixeira ainda pode voltar
    store.purge('entity', lia.id)
    expect(store.listRolls()).toHaveLength(0)
  })
})

describe('iniciativa da sessão', () => {
  it('guarda ordem, rodada e turno, e o desfazer volta', () => {
    const s = store.createSession(null)
    expect(store.getInitiative(s.id)).toEqual({ rodada: 1, turno: 0, ordem: [] })
    const ordem = [
      { id: 'a', entityId: byName('Lia Moraes').id, nome: 'Lia Moraes', valor: 22, pv: null, condicoes: [] },
      { id: 'b', entityId: null, nome: 'Vigia', valor: 18, pv: { atual: 9, max: 12 }, condicoes: ['Agarrado'] }
    ]
    act('iniciativa', () => store.saveInitiative(s.id, { rodada: 2, turno: 1, ordem }))
    expect(store.getInitiative(s.id)).toMatchObject({ rodada: 2, turno: 1 })
    expect(store.getInitiative(s.id).ordem[1].pv).toEqual({ atual: 9, max: 12 })
    // Turno além do fim da lista volta para o primeiro.
    expect(store.saveInitiative(s.id, { rodada: 2, turno: 5, ordem }).turno).toBe(0)
    history.undo()
    expect(store.getInitiative(s.id).turno).toBe(0)
  })
})

describe('biblioteca para a campanha', () => {
  let lib: LibraryStore
  beforeEach(() => {
    lib = new LibraryStore(join(dir, 'biblioteca.sqlite'))
  })
  afterEach(() => lib.close())

  it('ameaça vira ficha nova com a origem; item e ritual entram na ficha completa', () => {
    const own = lib.ownSourceId()
    const zumbi = lib.save('ameaca', { sourceId: own, data: { nome: 'Zumbi de Sangue', elemento: 'Sangue', vd: 20, pv: 45 } })
    const colete = lib.save('item', { sourceId: own, data: { nome: 'Colete leve', tipo: 'Proteção', defesa: 5, categoria: 1 } })
    const ritual = lib.save('ritual', { sourceId: own, data: { nome: 'Eletrocussão', circulo: 1 } })

    const nova = act('trazer da biblioteca', () => copyToCampaign(store, lib, { kind: 'ameaca', id: zumbi.id }))
    expect(nova).toMatchObject({ kind: 'ameaca', name: 'Zumbi de Sangue', sheetData: { vd: 20, pv: 45 }, origin: { libraryId: zumbi.id } })

    const lia = byName('Lia Moraes')
    copyToCampaign(store, lib, { kind: 'item', id: colete.id, entityId: lia.id })
    const comRitual = copyToCampaign(store, lib, { kind: 'ritual', id: ritual.id, entityId: lia.id })
    expect(ficha(comRitual).inventario.map((i) => i.nome)).toEqual(['Colete leve'])
    expect(ficha(comRitual).rituais.map((r) => r.nome)).toEqual(['Eletrocussão'])

    // Apagar da biblioteca não mexe na campanha.
    lib.remove('item', colete.id)
    expect(ficha(byName('Lia Moraes')).inventario[0]).toMatchObject({ nome: 'Colete leve', origem: { libraryId: colete.id } })
    // E o desfazer tira a ameaça trazida.
    history.undo()
    expect(store.listEntities().some((e) => e.id === nova.id)).toBe(false)
  })

  it('item só entra em ficha completa', () => {
    const item = lib.save('item', { sourceId: lib.ownSourceId(), data: { nome: 'Lanterna' } })
    expect(() => copyToCampaign(store, lib, { kind: 'item', id: item.id, entityId: byName('Dr. Aurélio Bastos').id })).toThrow(/ficha completa/)
    expect(() => copyToCampaign(store, lib, { kind: 'item', id: item.id })).toThrow(/Escolha/)
  })
})

describe('campanha.json', () => {
  it('ida e volta mantém a ficha completa, a rolagem e a iniciativa', () => {
    const lia = byName('Lia Moraes')
    store.saveEntity({ ...input(lia), sheetData: { ...ficha(lia), jogador: 'Bruna' } })
    store.addRoll({ entityId: lia.id, dados: [20], total: 25, critico: true })
    const s = store.createSession(null)
    store.saveInitiative(s.id, { rodada: 3, turno: 0, ordem: [{ id: 'a', entityId: lia.id, nome: 'Lia', valor: 20, pv: null, condicoes: [] }] })
    const file = join(dir, 'volta.sqlite')
    loadJson(dumpJson(store.db), file)
    const back = new CampaignStore(openDb(file), dir)
    try {
      expect(ficha(back.getEntity(lia.id)).jogador).toBe('Bruna')
      expect(back.listRolls()[0]).toMatchObject({ critical: true, total: 25 })
      expect(back.getInitiative(s.id).rodada).toBe(3)
    } finally {
      back.close()
    }
  })

  it('json da versão 3 (com criatura) restaura na versão nova', () => {
    const json = dumpJson(store.db)
    json.schemaVersion = 3
    for (const e of json.tabelas.entities) if (e.kind === 'ameaca') e.kind = 'criatura'
    for (const f of json.tabelas.template_fields) if (f.entity_kind === 'ameaca') f.entity_kind = 'criatura'
    const file = join(dir, 'v3.sqlite')
    loadJson(json, file)
    const back = new CampaignStore(openDb(file), dir)
    try {
      expect(back.listEntities('ameaca').map((e) => e.name)).toEqual(['A Vigia'])
    } finally {
      back.close()
    }
  })
})
