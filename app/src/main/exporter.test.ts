import { strFromU8, unzipSync } from 'fflate'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EXPORT_SECTIONS } from '../shared/types'
import { openDb } from './db'
import { buildExport, docToBlocks, imageSize, toDocx, toHtml, toText } from './exporter'
import { initCampaignRow, paragraphsDoc, seedExample } from './seed'
import { CampaignStore } from './store'

let dir: string
let store: CampaignStore
const all = { sections: [...EXPORT_SECTIONS], gmOnly: true }
const players = { sections: [...EXPORT_SECTIONS], gmOnly: false }

/** PNG mínimo: só o cabeçalho com largura e altura importa aqui. */
const pngHeader = (w: number, h: number) => {
  const b = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b)
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mesa-exp-'))
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso do Hospital', '2026-07-22')), dir)
  seedExample(store)
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('exportar', () => {
  it('versão do mestre leva segredos, pistas ocultas e eventos futuros', () => {
    const txt = toText(buildExport(store, all))
    expect(txt).toContain('LINHA DO TEMPO')
    expect(txt).toContain('lacuna de 3h10, nada marcado')
    expect(txt).toContain('Chave da ala fechada')
    expect(txt).toContain('[O que revela] O diretor entra na ala')
    expect(txt).toContain('A Vigia cruza a porta da ala')
    expect(txt).toContain('Deve favor a:')
  })

  it('versão dos jogadores não entrega nada que só o mestre vê', () => {
    const txt = toText(buildExport(store, players))
    expect(txt).toContain('Cópia do livro de ponto') // achada: pode
    expect(txt).not.toContain('Chave da ala fechada') // oculta
    expect(txt).not.toContain('O que revela')
    expect(txt).not.toContain('Personalidade e segredos')
    expect(txt).not.toContain('A Vigia cruza a porta da ala') // evento planejado
    expect(txt).not.toContain('Se ninguém agir')
    expect(txt).toContain('para os jogadores')
  })

  it('só as seções escolhidas', () => {
    const txt = toText(buildExport(store, { sections: ['pistas'], gmOnly: true }))
    expect(txt).toContain('PISTAS')
    expect(txt).not.toContain('CENAS')
    expect(txt).not.toContain('FICHAS')
  })

  it('texto do editor mantém negrito, listas e citação no Word e no PDF', () => {
    const body = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'forte', marks: [{ type: 'bold' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item um' }] }] }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dito' }] }] }
      ]
    })
    expect(docToBlocks(body).map((b) => b.t)).toEqual(['p', 'list', 'quote'])
    store.saveDocument({ title: 'Regras da casa', body })
    const html = toHtml(buildExport(store, { sections: ['textos'], gmOnly: true }), 'x')
    expect(html).toContain('<strong>forte</strong>')
    expect(html).toContain('<li>item um</li>')
    expect(html).toContain('<blockquote>dito</blockquote>')
  })

  it('Word: arquivo .docx de verdade, com a imagem da pista', async () => {
    const src = join(dir, 'chave.png')
    writeFileSync(src, pngHeader(400, 200))
    const a = store.importImage(src)
    const chave = store.listClues()[1]
    store.saveClue({ ...chave, imageId: a.id, finderIds: [] })
    store.saveDocument({ title: 'Introdução', body: paragraphsDoc(['Os agentes chegam <tarde> & cansados.']) })
    const files = unzipSync(await toDocx(buildExport(store, all), 'Caso'))
    const xml = strFromU8(files['word/document.xml'])
    expect(xml).toContain('Dr. Aurélio Bastos')
    expect(xml).toContain('&lt;tarde&gt; &amp; cansados')
    expect(Object.keys(files).some((k) => k.startsWith('word/media/'))).toBe(true)
  })

  it('PDF: o HTML escapa texto e embute imagens, sem buscar nada de fora', () => {
    store.saveDocument({ title: '<script>x</script>', body: null })
    const src = join(dir, 'capa.png')
    writeFileSync(src, pngHeader(10, 10))
    store.updateCampaign({ name: 'Caso do Hospital', tagline: '', coverId: store.importImage(src).id })
    const html = toHtml(buildExport(store, all), 'Caso')
    expect(html).not.toContain('<script>')
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).not.toMatch(/src="(https?|file|mesa):/)
  })

  it('lê o tamanho de PNG e JPEG pelo cabeçalho', () => {
    expect(imageSize(pngHeader(640, 480))).toEqual({ type: 'png', width: 640, height: 480 })
    const jpg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffc0001108012c019003012200021101031101', 'hex')
    expect(imageSize(jpg)).toEqual({ type: 'jpg', width: 400, height: 300 })
    expect(imageSize(Buffer.from('nada'))).toBeNull()
  })
})
