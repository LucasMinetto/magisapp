import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LibraryStore, threatForCampaign } from './library'
import { LIVROS, LIVROS_VERSAO } from './livros'
import { semelhanca } from './tokens'

// Os mesmos nomes da pasta de tokens do Lucas (Meu Drive/RPG/Ameaças), com erros de digitação e tudo.
const ARQUIVOS = [
  'Conhecimento/Anjo/ Anjo.png',
  'Conhecimento/Parasita de culpa/ parasita de culpa.png',
  'Conhecimento/bicho papão/ bicho papão.jfif',
  'Conhecimento/estrangeiro/ Estrangeiro.png',
  'Conhecimento/mascara do desespero/ mascara do desespero.jpg',
  'Degolificada/ Degolificada Conturbada.png',
  'Degolificada/degolificada.png',
  'Energia/Anarquico/ anarquico.jfif',
  'Energia/Anarquico descontrolado/ anarquico descontrolado.png',
  'Energia/Cibordue/ Ciborgue - Por Andrew.png',
  'Energia/Telopsita/ Telopsia com espirais.png',
  'Energia/anfitrião/anfitrião 2.png',
  'Energia/anfitrião/anfitrião.png',
  'Energia/pertubado de energia/ Perturbado de energia.png',
  'Morte/Deus da morte/ Deus da morte.jfif',
  'Morte/carniçal preto da morte/carniçal preto da morte.jpg',
  'Sangue/Diabo.png',
  'Sangue/kerberus.jpg',
  'Sangue/carente.png.png',
  'Sangue/dama de carnoe.png',
  'Sangue/zumbi de sangue bestial.png',
  'Sangue/zumbi de sangue.png'
]
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')

let dir: string
let lib: LibraryStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-tokens-'))
  mkdirSync(join(dir, 'bib'))
  lib = new LibraryStore(join(dir, 'bib', 'biblioteca.sqlite'), { dados: LIVROS, versao: LIVROS_VERSAO })
  ARQUIVOS.forEach((f, i) => {
    const p = join(dir, 'Ameaças', f)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, Buffer.concat([PNG, Buffer.from([i])])) // conteúdo diferente em cada um
  })
})
afterEach(() => {
  lib.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('tokens das ameaças', () => {
  it('nome parecido conta: artigo, acento, número da variante e erro de digitação', () => {
    expect(semelhanca('Diabo', 'O Diabo')).toBe(4)
    expect(semelhanca('bicho papão', 'Bicho-papão')).toBe(4)
    expect(semelhanca('Ciborgue - Por Andrew', 'Ciborgue')).toBe(3)
    expect(semelhanca('kerberus', 'Kerberos')).toBeGreaterThan(0)
    expect(semelhanca('dama de carnoe', 'Dama de Sangue')).toBe(0)
  })

  it('importar a pasta liga cada imagem à ameaça certa e guarda a cópia ao lado da biblioteca', () => {
    const r = lib.importTokens(join(dir, 'Ameaças'))
    const token = (nome: string) => lib.list('ameaca').find((a) => a.name === nome)?.data.token ?? ''
    for (const nome of ['Anjo', 'Parasita de Culpa', 'Bicho-papão', 'Estrangeiro', 'Máscara do Desespero', 'Degolificada', 'Anárquico', 'Anárquico Descontrolado', 'Ciborgue', 'Telopsia', 'Anfitrião', 'Perturbado de Energia', 'O Deus da Morte', 'Carniçal Preto da Morte', 'O Diabo', 'Kerberos', 'Carente', 'Zumbi de Sangue', 'Zumbi de Sangue Bestial'])
      expect(token(nome), nome).toMatch(/^[a-f0-9]{16}\.(png|jpg)$/)
    expect(token('Zumbi de Sangue')).not.toBe(token('Zumbi de Sangue Bestial'))
    // a variante "anfitrião 2" fica de fora; .jfif vira .jpg
    expect(r.sobras).toEqual(expect.arrayContaining([join('Energia', 'anfitrião', 'anfitrião 2.png'), join('Sangue', 'dama de carnoe.png')]))
    expect(token('Bicho-papão')).toMatch(/\.jpg$/)
    expect(lib.tokenFile(token('O Diabo'))).toContain('biblioteca-tokens')
    // importar de novo não troca o que já tem
    expect(lib.importTokens(join(dir, 'Ameaças')).ligados).toEqual([])
  })

  it('a cópia para a campanha leva o token; o backup da biblioteca também', () => {
    lib.importTokens(join(dir, 'Ameaças'))
    const diabo = lib.list('ameaca').find((a) => a.name === 'O Diabo')!
    expect(threatForCampaign(diabo).token).toBe(diabo.data.token)
    expect(threatForCampaign(diabo).sheetData).not.toHaveProperty('token')
    const backup = lib.backup(join(dir, 'backups'))
    rmSync(lib.tokensDir, { recursive: true, force: true })
    expect(lib.tokenFile(diabo.data.token)).toBeNull()
    lib.restore(backup)
    expect(lib.tokenFile(diabo.data.token)).not.toBeNull()
  })

  it('não aceita nome de token fora da pasta', () => {
    expect(lib.tokenFile('../biblioteca.sqlite')).toBeNull()
  })
})
