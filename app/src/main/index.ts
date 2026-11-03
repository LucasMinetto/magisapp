import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { recentCoverFile } from './campaigns'
import { autoBackupTick, closeCurrent, currentStore, registerIpc } from './ipc'

// Testes isolam as configurações (campanhas recentes) numa pasta temporária.
if (process.env.MAGISTRADO_USER_DATA) app.setPath('userData', process.env.MAGISTRADO_USER_DATA)

// Anexos da campanha chegam à tela só por magistrado://anexo/<id>, nunca por file:// solto.
protocol.registerSchemesAsPrivileged([{ scheme: 'magistrado', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

function serveAttachments(): void {
  protocol.handle('magistrado', async (req) => {
    const url = new URL(req.url)
    const file =
      url.host === 'anexo'
        ? currentStore()?.attachmentFile(url.pathname.slice(1))?.file
        : url.host === 'capa'
          ? recentCoverFile(decodeURIComponent(url.pathname.slice(1)))
          : null
    if (!file) return new Response('Anexo não encontrado', { status: 404 })
    const res = await net.fetch(pathToFileURL(file).toString())
    if (url.host !== 'anexo') return res
    // Tipo explícito (o leitor de PDF só entra com application/pdf) e o nome original, que vira o título no leitor.
    const id = url.pathname.slice(1)
    const mime = currentStore()?.attachmentFile(id)?.mime ?? 'application/octet-stream'
    const name = currentStore()?.getAttachment(id).fileName ?? 'arquivo'
    return new Response(res.body, {
      status: res.status,
      headers: { 'content-type': mime, 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}` }
    })
  })
}

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b0b0a',
    title: 'Magistrado',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      // Leitor de PDF do Chromium: abre o PDF da aventura dentro do app, na página certa.
      plugins: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })
  win.webContents.session.setSpellCheckerLanguages(['pt-BR'])
  win.once('ready-to-show', () => win?.show())
  // Links externos abrem no navegador do sistema, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'file://')) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  registerIpc(() => win)
  serveAttachments()
  setInterval(autoBackupTick, 60_000)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeCurrent()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => closeCurrent())
