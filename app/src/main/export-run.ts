// Parte do exportar que precisa do Electron: janela de salvar e PDF (imprime o HTML numa janela escondida).
import { BrowserWindow, dialog } from 'electron'
import { strToU8 } from 'fflate'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ExportFormat, ExportOptions } from '../shared/types'
import { buildExport, exportFileName, toDocx, toHtml, toText } from './exporter'
import type { CampaignStore } from './store'
import { buildVault, README, safeFileName } from './vault'

const FILTERS: Record<Exclude<ExportFormat, 'obsidian'>, { name: string; ext: string }> = {
  pdf: { name: 'PDF', ext: 'pdf' },
  docx: { name: 'Word', ext: 'docx' },
  txt: { name: 'Texto', ext: 'txt' }
}

/** HTML -> PDF numa janela que nunca aparece, sem script e sem acesso a nada além do próprio HTML. */
async function htmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html).toString('base64')}`)
    return await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    win.destroy()
  }
}

/** Escreve o cofre do Obsidian (o mesmo do backup) numa pasta nova "<campanha> (Obsidian)". */
function writeObsidian(store: CampaignStore, parent: string): string {
  const base = `${safeFileName(store.campaign().name, 'Campanha')} (Obsidian)`
  let dir = join(parent, base)
  for (let i = 2; existsSync(dir); i++) dir = join(parent, `${base} ${i}`)
  const write = (rel: string, data: Uint8Array | string) => {
    const target = join(dir, rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, typeof data === 'string' ? strToU8(data) : data)
  }
  write('LEIA-ME.md', README.replace('# Backup do Mesa', '# Campanha exportada do Mesa'))
  for (const f of buildVault(store)) write(f.path, f.text)
  for (const a of store.db.prepare('select id, rel_path from attachments where deleted_at is null').all() as { id: string; rel_path: string }[]) {
    const src = store.attachmentFile(a.id)
    if (src && existsSync(src.file)) {
      mkdirSync(join(dir, 'anexos'), { recursive: true })
      copyFileSync(src.file, join(dir, a.rel_path))
    }
  }
  return dir
}

export async function exportCampaign(
  store: CampaignStore,
  input: ExportOptions & { format: ExportFormat },
  win: BrowserWindow,
  onDone: (path: string) => void
): Promise<string | null> {
  const name = store.campaign().name
  if (input.format === 'obsidian') {
    const res = await dialog.showOpenDialog(win, { title: 'Onde criar a pasta do Obsidian', properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    const dir = writeObsidian(store, res.filePaths[0])
    onDone(dir)
    return dir
  }
  const f = FILTERS[input.format]
  const suffix = input.gmOnly ? '' : ' (jogadores)'
  const res = await dialog.showSaveDialog(win, {
    title: `Exportar ${f.name}`,
    defaultPath: exportFileName(`${name}${suffix}`, f.ext),
    filters: [{ name: f.name, extensions: [f.ext] }]
  })
  if (res.canceled || !res.filePath) return null
  const blocks = buildExport(store, input)
  const data =
    input.format === 'txt' ? Buffer.from(toText(blocks), 'utf8') : input.format === 'docx' ? await toDocx(blocks, name) : await htmlToPdf(toHtml(blocks, name))
  writeFileSync(res.filePath, data)
  onDone(res.filePath)
  return res.filePath
}
