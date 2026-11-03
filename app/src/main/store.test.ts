import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDb, SCHEMA_VERSION } from './db'
import Database from 'better-sqlite3'
import { initCampaignRow, paragraphsDoc, seedExample, syncOrdemTemplate } from './seed'
import { CampaignStore } from './store'
import { applyStructure, BUILTIN_STRUCTURES, structureFromCampaign } from './structures'
import { formatGameTime } from '../shared/gameTime'

let dir: string
let store: CampaignStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-'))
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso do Hospital', '2026-07-22')), dir)
  seedExample(store)
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const byName = (name: string) => store.listEntities().find((e) => e.name === name)!

describe('notas, mapa e corkboard', () => {
  it('bloco de notas da cena entra na busca e liga a ficha citada', () => {
    const ala = store.listScenes().find((s) => s.title === 'Ala fechada')!
    const note = store.saveSceneNote({ sceneId: ala.id, title: 'Se forem ao porão', body: 'Lia Moraes ouve arranhões vindo da caldeira.' })
    expect(store.getScene(ala.id).notes).toEqual([note])
    expect(store.search('ouve arranhões')[0]).toMatchObject({ refType: 'scene', title: 'Ala fechada' })
    expect(store.getScene(ala.id).mentions.map((m) => m.name)).toContain('Lia Moraes')
    store.deleteSceneNote(note.id)
    expect(store.getScene(ala.id).notes).toEqual([])
    expect(store.getScene(ala.id).mentions.map((m) => m.name)).not.toContain('Lia Moraes')
  })

  it('notas da ficha ligam outras fichas e aparecem no "Aparece em" delas', () => {
    const tomas = store.getEntity(byName('Tomás Andrade').id)
    store.saveEntity({ ...tomas, notes: paragraphsDoc(['Desconfia do Dr. Aurélio Bastos desde o primeiro dia.']) })
    const aurelio = store.getEntity(byName('Dr. Aurélio Bastos').id)
    expect(aurelio.mentionedIn).toContainEqual(expect.objectContaining({ sourceType: 'entity', sourceId: tomas.id, title: 'Tomás Andrade' }))
    expect(store.search('desconfia')[0]?.title).toBe('Tomás Andrade')
  })

  it('mapa do lugar: põe, mantém ao salvar sem ele, tira com null', () => {
    const src = join(dir, 'mapa do hospital.png')
    writeFileSync(src, Buffer.from('89504e470d0a1a0a03', 'hex'))
    const map = store.importImage(src)
    const hospital = store.getEntity(byName('Hospital Santa Clara').id)
    expect(store.saveEntity({ ...hospital, mapId: map.id }).mapUrl).toBe(`magistrado://anexo/${map.id}`)
    const { mapId: _m, ...withoutMap } = store.getEntity(hospital.id)
    expect(store.saveEntity(withoutMap).mapId).toBe(map.id)
    expect(store.saveEntity({ ...store.getEntity(hospital.id), mapId: null }).mapId).toBeNull()
  })

  it('corkboard: reordenar muda a ordem de planejamento, não a da hora no jogo', () => {
    const [a, b] = store.listScenes()
    store.reorderScenes([b.id, a.id])
    expect(store.listScenesBySort().map((s) => s.title)).toEqual([b.title, a.title])
    expect(store.listScenes().map((s) => s.title)).toEqual([a.title, b.title])
  })
})

describe('acervo: trazer fichas de outra campanha', () => {
  it('copia a ficha com retrato, notas e atributos; não duplica pelo nome', () => {
    const src = join(dir, 'retrato.png')
    writeFileSync(src, Buffer.from('89504e470d0a1a0a04', 'hex'))
    const portrait = store.importImage(src)
    const aurelio = store.getEntity(byName('Dr. Aurélio Bastos').id)
    store.saveEntity({ ...aurelio, portraitId: portrait.id, notes: paragraphsDoc(['Volta no próximo caso.']) })

    const otherDir = mkdtempSync(join(tmpdir(), 'magistrado-outra-'))
    const other = new CampaignStore(openDb(join(otherDir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Outro caso', '2026-09-01')), otherDir)
    try {
      const peek = CampaignStore.peekEntities(dir)
      expect(peek.map((e) => e.name)).toContain('Dr. Aurélio Bastos')
      const r = other.importEntitiesFrom(dir, [aurelio.id, byName('Lia Moraes').id])
      expect(r).toEqual({ imported: 2, skipped: [] })
      const copy = other.getEntity(other.listEntities().find((e) => e.name === 'Dr. Aurélio Bastos')!.id)
      expect(copy.id).not.toBe(aurelio.id)
      expect(copy.customAttributes.map((a) => a.label)).toContain('Deve favor a')
      expect(copy.stats.classe).toBe('Mundano')
      expect(copy.portraitUrl).not.toBeNull()
      expect(existsSync(join(otherDir, other.getAttachment(copy.portraitId!).relPath))).toBe(true)
      expect(other.search('volta proximo')[0]?.title).toBe('Dr. Aurélio Bastos')
      expect(other.importEntitiesFrom(dir, [aurelio.id])).toEqual({ imported: 0, skipped: ['Dr. Aurélio Bastos'] })
    } finally {
      other.close()
      rmSync(otherDir, { recursive: true, force: true })
    }
  })
})

describe('modelos de estrutura', () => {
  it('aplicar cria as cenas no fim, com hora contada do relógio', () => {
    store.setClock(20 * 60)
    const t = BUILTIN_STRUCTURES.find((x) => x.id === 'contagem-regressiva')!
    expect(applyStructure(store, t)).toBe(5)
    const created = store.listScenesBySort().slice(-5)
    expect(created.map((s) => s.title)).toEqual(t.scenes.map((s) => s.title))
    expect(created[0].gameMinuteStart).toBe(20 * 60)
    expect(formatGameTime('2026-07-22', created[4].gameMinuteStart!)).toBe('qui 23/07 · 16h00')
  })

  it('salvar como modelo guarda títulos, resumos e a distância entre as horas', () => {
    const t = structureFromCampaign(store, 'Meu hospital')
    expect(t).toMatchObject({ name: 'Meu hospital', builtin: false })
    expect(t.scenes.map((s) => [s.title, s.offset])).toEqual([
      ['Chamado da Ordem', 0],
      ['Ala fechada', 250]
    ])
  })

  it('todos os modelos embutidos têm cenas com título e resumo', () => {
    for (const t of BUILTIN_STRUCTURES) for (const s of t.scenes) expect(s.title && s.summary, `${t.name}: ${s.title}`).toBeTruthy()
  })
})

describe('sessão de jogo', () => {
  it('começa na hora do relógio; notas entram na busca e no "Aparece em"', () => {
    store.setClock(23 * 60)
    const s = store.createSession('2026-11-02')
    expect(s.number).toBe(2)
    expect(store.getSession(s.id)).toMatchObject({ gameMinuteStart: 23 * 60, notes: null })
    store.saveSessionNotes(s.id, paragraphsDoc(['Tomás Andrade quebrou a porta da ala e perdeu 4 de sanidade.']))
    expect(store.search('quebrou porta')[0]).toMatchObject({ refType: 'session', title: 'Sessão 2' })
    expect(store.getEntity(byName('Tomás Andrade').id).mentionedIn.map((m) => m.title)).toContain('Sessão 2')
  })
})

describe('modelo Ordem Paranormal', () => {
  it('tem os campos do livro básico e de Sobrevivendo ao Horror', () => {
    const [t] = store.templates()
    const keys = (kind: string) => t.fields.filter((f) => f.entityKind === kind).map((f) => f.key)
    expect(keys('personagem')).toEqual(expect.arrayContaining(['patente', 'trilha', 'deslocamento', 'inventario', 'estagio', 'pd']))
    expect(t.fields.find((f) => f.key === 'classe')?.options.choices).toContain('Sobrevivente')
    expect(keys('criatura')).toEqual(expect.arrayContaining(['tamanho', 'fortitude', 'reflexos', 'vontade', 'imunidades', 'vulnerabilidades']))
  })

  it('campanha antiga ganha os campos novos sem perder valores', () => {
    const tid = store.templates()[0].id
    store.db.prepare("delete from template_fields where template_id = ? and key in ('patente', 'pd', 'tamanho')").run(tid)
    store.db.prepare("update template_fields set group_name = 'Recursos' where template_id = ? and entity_kind = 'criatura' and key = 'pv'").run(tid)
    const aurelio = byName('Dr. Aurélio Bastos')
    const before = store.getEntity(aurelio.id).stats
    syncOrdemTemplate(store.db)
    const fields = store.templates()[0].fields
    expect(fields.filter((f) => ['patente', 'pd', 'tamanho'].includes(f.key))).toHaveLength(3)
    expect(fields.find((f) => f.entityKind === 'criatura' && f.key === 'pv')?.groupName).toBe('Combate')
    expect(store.getEntity(aurelio.id).stats).toEqual(before)
  })
})

describe('migração do esquema', () => {
  it('campanha da versão 1 ganha a coluna da capa, com cópia do banco antes', () => {
    const file = join(dir, 'campanha.sqlite')
    store.close()
    const raw = new Database(file)
    raw.exec('drop table scene_notes; alter table entities drop column map_id; alter table campaign drop column cover_id; update campaign set schema_version = 1;')
    raw.close()
    store = new CampaignStore(openDb(file), dir)
    expect(store.campaign()).toMatchObject({ coverId: null, name: 'Caso do Hospital' })
    expect((store.db.prepare('select schema_version as v from campaign').get() as { v: number }).v).toBe(SCHEMA_VERSION)
    expect(existsSync(`${file}.v1.bak`)).toBe(true)
  })
})

describe('campanha de exemplo', () => {
  it('cria a campanha com a data do caso e o modelo Ordem Paranormal', () => {
    const c = store.campaign()
    expect(c.epochDate).toBe('2026-07-22')
    expect(formatGameTime(c.epochDate, c.currentGameMinute)).toBe('qua 22/07 · 19h00')
    const [t] = store.templates()
    expect(t.name).toBe('Ordem Paranormal')
    expect(t.fields.filter((f) => f.entityKind === 'personagem').map((f) => f.key)).toContain('san')
    expect(store.counts()).toMatchObject({ entities: 6, scenes: 2 })
  })

  it('liga sozinho o NPC às cenas em que o nome aparece', () => {
    const aurelio = store.getEntity(byName('Dr. Aurélio Bastos').id)
    expect(aurelio.mentionedIn.map((m) => m.title)).toEqual(['Ala fechada', 'O diretor queima o livro de ponto', 'Chave da ala fechada'])
    const vigia = store.getEntity(byName('A Vigia').id)
    expect(vigia.mentionedIn.map((m) => m.title)).toEqual(['Ala fechada', 'A Vigia cruza a porta da ala', 'Arranhões na porta da ala']) // apelido "Vigia"
  })

  it('refaz as menções quando um apelido novo é dado', () => {
    const lia = store.getEntity(byName('Lia Moraes').id)
    expect(lia.mentionedIn.map((m) => m.title)).toEqual(['Chamado da Ordem'])
    const sede = byName('Escritório da Ordem')
    const full = store.getEntity(sede.id)
    store.saveEntity({ ...full, aliases: ['pasta fina'], portraitId: null })
    expect(store.getEntity(sede.id).mentionedIn.map((m) => m.title)).toEqual(['Chamado da Ordem'])
  })

  it('ordena as cenas pela hora no jogo e recusa fim antes do início', () => {
    expect(store.listScenes().map((s) => s.title)).toEqual(['Chamado da Ordem', 'Ala fechada'])
    const [first] = store.listScenes()
    const scene = store.getScene(first.id)
    expect(() => store.saveScene({ ...scene, gameMinuteStart: 600, gameMinuteEnd: 500 })).toThrow(/antes do início/)
  })

  it('busca sem acento, por prefixo, em fichas e cenas', () => {
    const hits = store.search('aurel')
    expect(hits[0]).toMatchObject({ refType: 'entity', title: 'Dr. Aurélio Bastos', kind: 'personagem' })
    expect(hits.some((h) => h.refType === 'scene' && h.title === 'Ala fechada')).toBe(true)
    expect(store.search('cloro ferrugem')[0]?.title).toBe('Ala fechada')
    expect(store.search('"; drop table')).toEqual([])
  })

  it('linha do tempo junta cenas e eventos, e o evento liga as fichas citadas', () => {
    const { scenes, events } = store.timeline()
    expect(scenes).toHaveLength(2)
    expect(events.map((e) => e.title)).toEqual(['Último ponto do enfermeiro', 'A Vigia cruza a porta da ala', 'O diretor queima o livro de ponto'])
    expect(formatGameTime('2026-07-22', events[0].gameMinuteStart)).toBe('dom 19/07 · 21h58')
    expect(events[2].entities.map((e) => e.name)).toEqual(['Dr. Aurélio Bastos'])
    expect(events[1].locationName).toBe('Hospital Santa Clara')
    expect(store.search('caldeira')[0]).toMatchObject({ refType: 'event', title: 'O diretor queima o livro de ponto' })
  })

  it('evento recusa fim antes do início e sai da busca na lixeira', () => {
    const e = store.timeline().events[1]
    expect(() => store.saveEvent({ ...e, gameMinuteEnd: e.gameMinuteStart - 1 })).toThrow(/antes do início/)
    store.trashEvent(e.id)
    expect(store.timeline().events).toHaveLength(2)
    expect(store.search('porão')).toEqual([])
  })

  it('relógio avança, volta e é definido', () => {
    expect(store.advanceClock(70).currentGameMinute).toBe(19 * 60 + 70)
    expect(store.advanceClock(-10).currentGameMinute).toBe(20 * 60)
    expect(formatGameTime('2026-07-22', store.setClock(24 * 60 + 30).currentGameMinute)).toBe('qui 23/07 · 00h30')
  })

  it('pistas: achada guarda onde, quando, sessão e quem achou', () => {
    const [ponto, chave] = store.listClues()
    expect(ponto).toMatchObject({ status: 'achada', locationName: 'Escritório da Ordem', plannedSceneTitle: 'Chamado da Ordem', foundSessionNumber: 1 })
    expect(formatGameTime('2026-07-22', ponto.foundGameMinute!)).toBe('qua 22/07 · 19h40')
    expect(ponto.finders.map((f) => f.name)).toEqual(['Lia Moraes'])
    expect(chave).toMatchObject({ status: 'oculta', foundGameMinute: null, finders: [] })
    expect(chave.links.map((l) => l.name)).toEqual(['Dr. Aurélio Bastos'])
  })

  it('pista achada sem hora ganha a hora do relógio; voltar a oculta limpa tudo', () => {
    const chave = store.listClues()[1]
    const tomas = byName('Tomás Andrade')
    store.setClock(23 * 60 + 30)
    const found = store.saveClue({ ...chave, imageId: null, status: 'achada', foundGameMinute: null, foundSessionId: null, finderIds: [tomas.id] })
    expect(found.foundGameMinute).toBe(23 * 60 + 30)
    expect(found.finders.map((f) => f.name)).toEqual(['Tomás Andrade'])
    const hidden = store.saveClue({ ...found, imageId: null, status: 'oculta', finderIds: [tomas.id] })
    expect(hidden).toMatchObject({ foundGameMinute: null, foundSessionId: null, finders: [] })
  })

  it('imagem vai para anexos/ com nome legível, sem duplicar', () => {
    const src = join(dir, 'Bilhete Rasgado.PNG')
    writeFileSync(src, Buffer.from('89504e470d0a1a0a', 'hex'))
    const a = store.importImage(src)
    expect(a.relPath).toMatch(/^anexos\/bilhete-rasgado-[0-9a-f]{6}\.png$/)
    expect(existsSync(join(dir, a.relPath))).toBe(true)
    expect(a.url).toBe(`magistrado://anexo/${a.id}`)
    expect(store.importImage(src).id).toBe(a.id)
    expect(store.attachmentFile(a.id)?.mime).toBe('image/png')
    expect(() => store.importImage(join(dir, 'campanha.sqlite'))).toThrow(/Formato/)
    const chave = store.listClues()[1]
    expect(store.saveClue({ ...chave, imageId: a.id, finderIds: [] }).image?.id).toBe(a.id)
  })

  it('busca acha pista pelo que ela revela; lixeira tira', () => {
    const hit = store.search('diretor entra')[0]
    expect(hit).toMatchObject({ refType: 'clue', title: 'Chave da ala fechada' })
    store.trashClue(hit.refId)
    expect(store.listClues()).toHaveLength(2)
    expect(store.search('diretor entra').some((h) => h.refType === 'clue')).toBe(false)
  })

  it('quadro de exemplo: nós ligados a fichas, pistas e cenas', () => {
    const [summary] = store.listBoards()
    expect(summary).toMatchObject({ name: 'O caso', nodeCount: 7 })
    const board = store.getBoard(summary.id)
    expect(board.edges).toHaveLength(6)
    const titles = board.nodes.map((n) => n.ref?.title ?? n.content)
    expect(titles).toContain('Dr. Aurélio Bastos')
    expect(board.nodes.find((n) => n.type === 'clue')?.ref).toMatchObject({ title: 'Chave da ala fechada', clueStatus: 'oculta', missing: false })
    expect(board.nodes.find((n) => n.type === 'scene')?.ref?.subtitle).toBe('Hospital Santa Clara')
  })

  it('quadro salva em lote: tira nó e as ligações dele somem juntas', () => {
    const board = store.getBoard(store.listBoards()[0].id)
    const aurelio = board.nodes.find((n) => n.ref?.title === 'Dr. Aurélio Bastos')!
    const moved = board.nodes.filter((n) => n.id !== aurelio.id).map(({ ref: _ref, ...n }) => ({ ...n, x: n.x + 10 }))
    const saved = store.saveBoard({ id: board.id, name: 'Renomeado', viewport: { x: 5, y: 6, zoom: 1.5 }, nodes: moved, edges: board.edges })
    expect(saved.nodes).toHaveLength(6)
    expect(saved.edges).toHaveLength(3) // as 3 ligações do Aurélio foram junto
    expect(saved).toMatchObject({ name: 'Renomeado', viewport: { x: 5, y: 6, zoom: 1.5 } })
    expect(saved.nodes[0].x).toBe(board.nodes[0].x + 10)
  })

  it('ficha na lixeira vira nó "na lixeira" no quadro, sem quebrar', () => {
    const vigia = byName('A Vigia')
    store.trashEntity(vigia.id)
    const board = store.getBoard(store.listBoards()[0].id)
    expect(board.nodes.find((n) => n.entityId === vigia.id)?.ref).toMatchObject({ title: 'A Vigia', missing: true })
  })

  it('atributos próprios da ficha entram na busca', () => {
    const aurelio = store.getEntity(byName('Dr. Aurélio Bastos').id)
    expect(aurelio.customAttributes.map((a) => a.label)).toEqual(['Deve favor a', 'Se pressionado'])
    expect(store.search('pressionado')[0]?.title).toBe('Dr. Aurélio Bastos')
    store.saveEntity({ ...aurelio, customAttributes: [{ label: 'Arma', value: 'bisturi' }, { label: ' ', value: '' }] })
    expect(store.getEntity(aurelio.id).customAttributes).toEqual([{ label: 'Arma', value: 'bisturi' }]) // linha vazia não fica
  })

  it('retrato e capa usam anexos', () => {
    const src = join(dir, 'retrato.png')
    writeFileSync(src, Buffer.from('89504e470d0a1a0aff', 'hex'))
    const a = store.importImage(src)
    const lia = store.getEntity(byName('Lia Moraes').id)
    store.saveEntity({ ...lia, portraitId: a.id })
    expect(store.listEntities('personagem').find((e) => e.id === lia.id)?.portraitUrl).toBe(`magistrado://anexo/${a.id}`)
    const c = store.updateCampaign({ name: 'Caso do Hospital', tagline: '  Um enfermeiro sumiu.  ', coverId: a.id })
    expect(c).toMatchObject({ tagline: 'Um enfermeiro sumiu.', coverUrl: `magistrado://anexo/${a.id}` })
    expect(store.updateCampaign({ name: 'Caso do Hospital', tagline: '', coverId: null })).toMatchObject({ tagline: null, coverUrl: null })
  })

  it('textos: menções, busca e "Aparece em"', () => {
    const doc = store.saveDocument({ title: 'Regras da casa', body: paragraphsDoc(['Sanidade a zero com a Vigia: a cena para.']) })
    expect(doc.mentions.map((m) => m.name)).toEqual(['A Vigia'])
    expect(store.search('sanidade')[0]).toMatchObject({ refType: 'document', title: 'Regras da casa' })
    expect(store.getEntity(byName('A Vigia').id).mentionedIn.map((m) => m.title)).toContain('Regras da casa')
    store.trashDocument(doc.id)
    expect(store.listDocuments()).toEqual([])
    expect(store.getEntity(byName('A Vigia').id).mentionedIn.map((m) => m.title)).not.toContain('Regras da casa')
  })

  it('lixeira: lista, restaura com busca e ligações, apaga de vez', () => {
    const vigia = byName('A Vigia')
    const ala = store.listScenes().find((s) => s.title === 'Ala fechada')!
    store.trashEntity(vigia.id)
    store.trashScene(ala.id)
    expect(store.listTrash().map((i) => [i.type, i.title])).toEqual(
      expect.arrayContaining([['entity', 'A Vigia'], ['scene', 'Ala fechada']])
    )
    store.restore('entity', vigia.id)
    store.restore('scene', ala.id)
    expect(store.search('vigia').some((h) => h.refId === vigia.id)).toBe(true)
    expect(store.getScene(ala.id).mentions.map((m) => m.name)).toContain('A Vigia')
    expect(store.listTrash()).toEqual([])
    expect(() => store.purge('entity', vigia.id)).toThrow(/lixeira/)
    store.trashEntity(vigia.id)
    store.purge('entity', vigia.id)
    expect(() => store.getEntity(vigia.id)).toThrow()
    expect(store.getBoard(store.listBoards()[0].id).nodes.some((n) => n.entityId === vigia.id)).toBe(false) // nó do quadro foi junto
  })

  it('lixeira esvazia sozinha o que tem mais de 60 dias', () => {
    const chave = store.listClues()[1]
    store.trashClue(chave.id)
    store.db.prepare('update clues set deleted_at = ? where id = ?').run('2026-01-01T00:00:00.000Z', chave.id)
    const sede = byName('Escritório da Ordem')
    store.trashEntity(sede.id)
    expect(store.purgeOld(60)).toBe(1)
    expect(store.listTrash().map((i) => i.title)).toEqual(['Escritório da Ordem'])
  })

  it('ficha na lixeira some da busca e das menções', () => {
    const vigia = byName('A Vigia')
    store.trashEntity(vigia.id)
    expect(store.search('vigia').some((h) => h.refId === vigia.id)).toBe(false)
    const ala = store.listScenes().find((s) => s.title === 'Ala fechada')!
    expect(store.getScene(ala.id).mentions.map((m) => m.name)).not.toContain('A Vigia')
  })
})
