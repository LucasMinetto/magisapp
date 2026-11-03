import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDb } from './db'
import { buildExport, toText } from './exporter'
import { initCampaignRow, seedExample } from './seed'
import { CampaignStore } from './store'
import { buildVault } from './vault'

let dir: string
let store: CampaignStore
const file = (name: string, content: string) => {
  const p = join(dir, name)
  writeFileSync(p, content)
  return p
}
const PDF = '%PDF-1.4\n%fake\n'
const PNG = '\x89PNG\r\n\x1a\n'

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mesa-imp-'))
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso do Hospital', '2026-07-22')), dir)
  seedExample(store)
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('importar aventura', () => {
  it('vários arquivos de uma vez: PDF, tokens, mapas; repetido é reaproveitado; erro não para o resto', () => {
    const r = store.importFiles([
      file('O Segredo na Ilha.pdf', PDF),
      file('token-cultista.png', `${PNG}a`),
      file('Mapa do porão.jpg', `${PNG}b`),
      file('retrato.png', `${PNG}c`),
      file('notas.txt', 'x'),
      file('copia do pdf.pdf', PDF)
    ])
    expect(r.imported.map((a) => [a.fileName, a.kind])).toEqual([
      ['O Segredo na Ilha.pdf', 'pdf'],
      ['token-cultista.png', 'token'],
      ['Mapa do porão.jpg', 'mapa'],
      ['retrato.png', 'imagem']
    ])
    expect(r.reused.map((a) => a.fileName)).toEqual(['O Segredo na Ilha.pdf'])
    expect(r.errors).toEqual([{ file: 'notas.txt', message: expect.stringMatching(/Formato não aceito/) }])
    expect(store.importFiles([file('x.pdf', '%PDF-2')]).imported[0].relPath).toMatch(/^anexos\/x-[0-9a-f]{6}\.pdf$/)
  })

  it('a imagem da pista e o retrato continuam aceitando só imagem', () => {
    expect(() => store.importImage(file('aventura.pdf', PDF))).toThrow(/Formato não aceito/)
  })

  it('PDF ligado à cena na página certa; ligar de novo troca a página; desligar tira', () => {
    const pdf = store.importFiles([file('Aventura.pdf', PDF)]).imported[0]
    const ala = store.listScenes().find((s) => s.title === 'Ala fechada')!
    expect(store.attachToScene(ala.id, pdf.id, 12).attachments).toEqual([{ attachment: expect.objectContaining({ id: pdf.id }), pdfPage: 12 }])
    expect(store.attachToScene(ala.id, pdf.id, 14).attachments[0].pdfPage).toBe(14)
    expect(store.getAttachmentDetail(pdf.id).usedIn).toEqual([{ type: 'scene', id: ala.id, title: 'Ala fechada', pdfPage: 14 }])
    expect(store.detachFromScene(ala.id, pdf.id).attachments).toEqual([])
  })

  it('"usado em" mostra retrato, pista e cena; tipo pode ser trocado', () => {
    const token = store.importFiles([file('vigia.png', `${PNG}v`)]).imported[0]
    const vigia = store.getEntity(store.listEntities().find((e) => e.name === 'A Vigia')!.id)
    store.saveEntity({ ...vigia, portraitId: token.id })
    const ala = store.listScenes().find((s) => s.title === 'Ala fechada')!
    store.attachToScene(ala.id, token.id, null)
    expect(store.getAttachmentDetail(token.id).usedIn.map((u) => [u.type, u.title])).toEqual([
      ['scene', 'Ala fechada'],
      ['entity', 'A Vigia']
    ])
    expect(store.setAttachmentKind(token.id, 'token').kind).toBe('token')
  })

  it('o material da cena vai para o Obsidian (PDF na página) e para o exportar', () => {
    const pdf = store.importFiles([file('Aventura.pdf', PDF)]).imported[0]
    const ala = store.listScenes().find((s) => s.title === 'Ala fechada')!
    store.attachToScene(ala.id, pdf.id, 12)
    const md = buildVault(store).find((f) => f.path === 'legivel/Cenas/02 - Ala fechada.md')!.text
    expect(md).toContain(`![[${pdf.relPath}#page=12]]`)
    expect(toText(buildExport(store, { sections: ['cenas'], gmOnly: true }))).toContain('Material: Aventura.pdf (p. 12)')
  })
})
