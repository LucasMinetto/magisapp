import { app } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { EstadoAtualizacao } from '../shared/types'
import { decidirAtualizacao, lerVersaoPublicada } from '../shared/versao'

// Atualização sem instalador: o Magistrado roda de uma cópia do repositório git.
// Ele busca origin/main, lê o versao.json publicado e, se houver versão nova, avisa.
// "Atualizar agora" faz git pull, reinstala as dependências se o package-lock mudou e reabre pelo npm run start
// (que compila de novo). Os dados ficam fora do repositório (campanhas e userData), então nada se perde.

const RAMO = 'main'
const UM_DIA = 24 * 60 * 60 * 1000

const pastaApp = () => app.getAppPath()
const raizRepo = () => resolve(pastaApp(), '..')
const arquivoEstado = () => join(app.getPath('userData'), 'atualizacao.json')

function git(args: string[], timeout = 60_000): Promise<string> {
  return new Promise((ok, falha) => {
    execFile('git', args, { cwd: raizRepo(), timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) falha(new Error((stderr || err.message).trim()))
      else ok(stdout.trim())
    })
  })
}

function npm(args: string[], timeout = 10 * 60_000): Promise<void> {
  return new Promise((ok, falha) => {
    execFile('npm.cmd', args, { cwd: pastaApp(), timeout, windowsHide: true, shell: true, maxBuffer: 16 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) falha(new Error(`npm ${args[0]} falhou: ${(stderr || err.message).trim().slice(-400)}`))
      else ok()
    })
  })
}

interface Guardado {
  adiadoAte: string | null
}

function lerGuardado(): Guardado {
  try {
    return { adiadoAte: null, ...(JSON.parse(readFileSync(arquivoEstado(), 'utf8')) as Partial<Guardado>) }
  } catch {
    return { adiadoAte: null }
  }
}

function guardar(g: Guardado): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(arquivoEstado(), JSON.stringify(g, null, 2))
}

let estado: EstadoAtualizacao = {
  instalada: '0.0.0',
  disponivel: false,
  verificando: false,
  atualizando: false,
  nova: null,
  obrigatoria: false,
  notas: [],
  publicadaEm: null,
  verificadoEm: null,
  adiadoAte: null,
  erro: null
}
let avisar: (e: EstadoAtualizacao) => void = () => {}

function mudar(patch: Partial<EstadoAtualizacao>): EstadoAtualizacao {
  estado = { ...estado, ...patch }
  avisar(estado)
  return estado
}

export function estadoAtualizacao(): EstadoAtualizacao {
  return estado
}

/** Busca a versão publicada em origin/main. Nunca lança: o erro vai para o estado. */
export async function verificarAtualizacao(): Promise<EstadoAtualizacao> {
  if (!estado.disponivel || estado.verificando || estado.atualizando) return estado
  mudar({ verificando: true, erro: null })
  try {
    await git(['fetch', '--quiet', 'origin', RAMO])
    const publicada = lerVersaoPublicada(await git(['show', `origin/${RAMO}:versao.json`]))
    const d = decidirAtualizacao(estado.instalada, publicada)
    return mudar({
      verificando: false,
      verificadoEm: new Date().toISOString(),
      nova: d.nova,
      obrigatoria: d.obrigatoria,
      notas: d.nova ? publicada.notas : [],
      publicadaEm: d.nova ? publicada.publicada_em : null
    })
  } catch (e) {
    return mudar({ verificando: false, verificadoEm: new Date().toISOString(), erro: `Não deu para verificar: ${(e as Error).message}` })
  }
}

/** "Depois": some por 24 h. Versão obrigatória não pode ser adiada. */
export function adiarAtualizacao(): EstadoAtualizacao {
  if (estado.obrigatoria) return estado
  const adiadoAte = new Date(Date.now() + UM_DIA).toISOString()
  guardar({ adiadoAte })
  return mudar({ adiadoAte })
}

/** Baixa a versão nova e reabre o app nela. Devolve uma mensagem se não reabrir sozinho. */
export async function aplicarAtualizacao(): Promise<string | null> {
  if (!estado.disponivel) throw new Error('Este Magistrado não roda de uma cópia do git; não dá para atualizar sozinho.')
  if (estado.atualizando) throw new Error('A atualização já está em andamento.')
  mudar({ atualizando: true, erro: null })
  try {
    const ramo = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
    if (ramo !== RAMO) throw new Error(`A cópia está no ramo "${ramo}", não em "${RAMO}". Volte para ${RAMO} e tente de novo.`)
    const mudancas = await git(['status', '--porcelain', '--untracked-files=no'])
    if (mudancas) throw new Error('Há alterações no código desta cópia que ainda não foram salvas no git. Salve (commit) ou descarte antes de atualizar.')
    const lockAntes = await git(['rev-parse', 'HEAD:app/package-lock.json']).catch(() => '')
    await git(['pull', '--ff-only', '--quiet', 'origin', RAMO], 5 * 60_000)
    const lockDepois = await git(['rev-parse', 'HEAD:app/package-lock.json']).catch(() => '')
    if (lockAntes !== lockDepois) await npm(['install', '--no-audit', '--no-fund'])
  } catch (e) {
    mudar({ atualizando: false, erro: (e as Error).message })
    throw e
  }
  guardar({ adiadoAte: null })
  // Em desenvolvimento (npm run dev) quem reinicia é o electron-vite; não abre uma segunda cópia.
  if (process.env.ELECTRON_RENDERER_URL) {
    mudar({ atualizando: false })
    return 'Código atualizado. Reinicie o npm run dev para ver a versão nova.'
  }
  // Abre o Magistrado de novo pelo mesmo caminho do atalho (tools/abrir-magistrado.vbs: compila e abre, sem janela de
  // terminal) e fecha este. Sem o lançador, roda o npm direto com a janela escondida.
  const lancador = join(raizRepo(), 'tools', 'abrir-magistrado.vbs')
  if (existsSync(lancador)) spawn('wscript.exe', [lancador], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  else spawn('cmd.exe', ['/c', 'npm.cmd', 'run', 'start'], { cwd: pastaApp(), detached: true, stdio: 'ignore', windowsHide: true }).unref()
  setTimeout(() => app.quit(), 300)
  return null
}

/** Liga a verificação: ao abrir (depois de alguns segundos) e a cada 24 h. */
export function iniciarAtualizacao(onChange: (e: EstadoAtualizacao) => void): void {
  avisar = onChange
  const disponivel = existsSync(join(raizRepo(), '.git'))
  estado = { ...estado, instalada: app.getVersion(), disponivel, adiadoAte: lerGuardado().adiadoAte }
  // Testes automáticos (e2e) não buscam nada na internet.
  if (!disponivel || process.env.MAGISTRADO_USER_DATA) return
  setTimeout(() => void verificarAtualizacao(), 8_000)
  setInterval(() => void verificarAtualizacao(), UM_DIA)
}
