import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LibraryStore, threatForCampaign } from './library'
import { LIVROS, LIVROS_VERSAO } from './livros'

// As imagens dos livros que vêm com o app (tools/livros/tokens.py).
const TOKENS_LIVROS = join(__dirname, '..', '..', 'resources', 'livros-tokens')
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
const ameacas = LIVROS.flatMap((l) => l.ameacas) as unknown as { id: string; nome: string; token?: string; tokensExtras?: string[] }[]
const doLivro = (nome: string) => ameacas.find((a) => a.nome === nome)!

let dir: string
let lib: LibraryStore
const abrir = (versao = LIVROS_VERSAO) => new LibraryStore(join(dir, 'bib', 'biblioteca.sqlite'), { dados: LIVROS, versao, tokens: TOKENS_LIVROS })
const daBib = (nome: string) => lib.list('ameaca').find((a) => a.name === nome)!

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-tokens-'))
  mkdirSync(join(dir, 'bib'))
  lib = abrir()
})
afterEach(() => {
  lib.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('tokens dos livros', () => {
  it('as criaturas dos livros vêm com token, e cada imagem existe na pasta do app', () => {
    const com = ameacas.filter((a) => a.token)
    expect(com.length).toBeGreaterThanOrEqual(48)
    for (const a of com) for (const t of [a.token!, ...(a.tokensExtras ?? [])]) expect(existsSync(join(TOKENS_LIVROS, t)), `${a.nome}: ${t}`).toBe(true)
    expect(doLivro('Dama de Sangue').token).toMatch(/\.webp$/)
    expect(doLivro('Zumbi de Sangue').token).not.toBe(doLivro('Zumbi de Sangue Bestial').token)
  })

  it('variantes ficam como tokens extras da mesma ameaça', () => {
    expect(doLivro('Anfitrião').tokensExtras).toHaveLength(5)
    expect(doLivro('Degolificada').tokensExtras).toHaveLength(4)
    expect(daBib('Anfitrião').data.tokensExtras).toHaveLength(5)
  })

  it('a biblioteca acha o arquivo do token na pasta do app', () => {
    expect(lib.tokenFile(daBib('O Diabo').data.token)).toContain('livros-tokens')
  })

  it('biblioteca antiga, já semeada sem tokens, recebe os tokens; o que o mestre escolheu fica', () => {
    lib.close()
    rmSync(join(dir, 'bib'), { recursive: true, force: true })
    mkdirSync(join(dir, 'bib'))
    // a versão 1 dos dados não tinha tokens
    const semTokens = LIVROS.map((l) => ({ ...l, ameacas: l.ameacas.map(({ token: _t, tokensExtras: _e, ...a }) => a) })) as typeof LIVROS
    lib = new LibraryStore(join(dir, 'bib', 'biblioteca.sqlite'), { dados: semTokens, versao: 1, tokens: TOKENS_LIVROS })
    expect(daBib('O Diabo').data.token).toBe('')
    const meu = join(dir, 'meu.png')
    writeFileSync(meu, PNG)
    const escolhido = lib.setToken(daBib('Kerberos').id, meu).data.token
    lib.close()
    lib = abrir()
    expect(daBib('O Diabo').data.token).toBe(doLivro('O Diabo').token)
    expect(daBib('Kerberos').data.token).toBe(escolhido)
  })

  it('trocar o token guarda o anterior como variante', () => {
    const meu = join(dir, 'meu.png')
    writeFileSync(meu, PNG)
    const antes = daBib('O Diabo').data.token
    const depois = lib.setToken(daBib('O Diabo').id, meu)
    expect(depois.data.token).not.toBe(antes)
    expect(depois.data.tokensExtras).toContain(antes)
    expect(lib.tokenFile(depois.data.token)).toContain('biblioteca-tokens')
  })

  it('a cópia para a campanha leva o token principal, e não as variantes', () => {
    const t = threatForCampaign(daBib('Anfitrião'))
    expect(t.token).toBe(doLivro('Anfitrião').token)
    expect(t.sheetData).not.toHaveProperty('token')
    expect(t.sheetData).not.toHaveProperty('tokensExtras')
  })

  it('o pacote leva os tokens do mestre (os dos livros vêm com o app)', () => {
    const meu = join(dir, 'meu.png')
    writeFileSync(meu, PNG)
    const token = lib.setToken(daBib('O Diabo').id, meu).data.token
    const backup = lib.backup(join(dir, 'backups'))
    rmSync(lib.tokensDir, { recursive: true, force: true })
    expect(lib.tokenFile(token)).toBeNull()
    lib.importPackage(backup, { [lib.ownSourceId()]: 'atualizar' })
    expect(lib.tokenFile(token)).not.toBeNull()
    expect(lib.tokenFile(daBib('Anfitrião').data.token)).not.toBeNull()
  })

  it('não aceita nome de token fora da pasta', () => {
    expect(lib.tokenFile('../biblioteca.sqlite')).toBeNull()
  })
})
