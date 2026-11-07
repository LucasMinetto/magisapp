// T11: a ficha completa, o bloco de ameaça, as rolagens e a iniciativa no backup, no cofre do Obsidian e no exportar.
import { unzipSync, zipSync } from 'fflate'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, restoreBackup } from './backup'
import { openDb } from './db'
import { buildExport, toText } from './exporter'
import { initCampaignRow, seedExample } from './seed'
import { CampaignStore } from './store'
import { buildVault } from './vault'
import { derivados } from '../shared/ordem/regras'
import type { BlocoAmeaca, FichaAgente } from '../shared/ordem/esquemas'
import { EXPORT_SECTIONS, type Entity } from '../shared/types'

let dir: string
let store: CampaignStore

const byName = (name: string) => store.getEntity(store.listEntities().find((e) => e.name === name)!.id)
const ficha = (e: Entity) => e.sheetData as FichaAgente
const bloco = (e: Entity) => e.sheetData as BlocoAmeaca

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'magistrado-t11-'))
  store = new CampaignStore(openDb(join(dir, 'campanha.sqlite'), (db) => initCampaignRow(db, 'Caso do Hospital', '2026-07-22')), dir)
  seedExample(store)
  const lia = byName('Lia Moraes')
  store.saveEntity({
    ...lia,
    sheetData: {
      ...ficha(lia),
      jogador: 'Bruna',
      classe: 'Ocultista',
      nex: 25,
      atributos: { agi: 2, for: 1, int: 3, pre: 3, vig: 1 },
      pericias: { Ocultismo: { treino: 10, extra: 2 } },
      ataques: [{ id: 'a1', nome: 'Faca', pericia: 'Luta', bonusAtaque: 0, dano: '1d4', tipoDano: 'Corte', danosExtras: [], arremesso: false, margemCritico: 19, multCritico: 2, alcance: '', notas: '' }],
      rituais: [
        { id: 'r1', nome: 'Amaldiçoar Arma', elemento: 'Sangue', circulo: 1, execucao: 'padrão', alcance: 'toque', alvo: '1 arma', duracao: 'cena', resistencia: '', efeito: 'A arma causa +1d6 de Sangue.', discente: '', verdadeiro: '', danoNormal: '', danoDiscente: '', danoVerdadeiro: '', tipoDano: '' }
      ],
      inventario: [
        { id: 'i1', nome: 'Colete leve', tipo: 'Proteção', categoria: 1, espacos: 2, defesa: 5, dano: '', tipoDano: '', critico: '', alcance: '', proficiencia: '', empunhadura: '', elemento: '', descricao: '', quantidade: 1, equipado: true }
      ],
      condicoes: ['Abalado']
    } satisfies FichaAgente
  })
  const vigia = byName('A Vigia')
  store.saveEntity({
    ...vigia,
    sheetData: { ...bloco(vigia), pv: 60, defesa: 18, resistencias: 'Balístico 5', acoes: [{ tipo: 'Padrão', nome: 'Garras', descricao: 'Teste 2d20+10, dano 2d6+5 Corte.' }], enigma: 'O que vigia sem olhos?' } satisfies BlocoAmeaca
  })
  const sessao = store.createSession('2026-11-07')
  store.addRoll({ entityId: lia.id, sessionId: sessao.id, rotulo: 'Ocultismo', tipo: 'teste', formula: '3d20+12', dados: [4, 17, 9], total: 29 })
  store.addRoll({ entityId: vigia.id, sessionId: sessao.id, rotulo: 'Garras', tipo: 'ataque', formula: '2d20+10', dados: [20, 3], total: 30, critico: true })
  store.saveInitiative(sessao.id, {
    rodada: 2,
    turno: 1,
    ordem: [
      { id: 'c1', entityId: lia.id, nome: 'Lia Moraes', valor: 18, pv: null, condicoes: [] },
      { id: 'c2', entityId: vigia.id, nome: 'A Vigia', valor: 12, pv: { atual: 41, max: 60 }, condicoes: ['Desprevenido'] }
    ],
    desafixadas: []
  })
})
afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('backup com os tipos novos', () => {
  it('restaurar recupera a ficha com os mesmos derivados, o bloco, as rolagens e a iniciativa', () => {
    const antes = ficha(byName('Lia Moraes'))
    const { file } = createBackup(store, join(dir, 'backups'))
    for (const fromJson of [false, true]) {
      // Sem o .sqlite no zip, monta do campanha.json: os dois caminhos têm de dar o mesmo.
      let path: string
      if (fromJson) {
        const z = unzipSync(readFileSync(file))
        delete z['campanha.sqlite']
        const semBanco = join(dir, 'sem-banco.magistrado-backup')
        writeFileSync(semBanco, zipSync(z))
        const r = restoreBackup(semBanco, dir)
        expect(r.fromJson).toBe(true)
        path = r.path
      } else path = restoreBackup(file, dir).path
      const back = new CampaignStore(openDb(join(path, 'campanha.sqlite')), path)
      try {
        const lia = back.getEntity(back.listEntities().find((e) => e.name === 'Lia Moraes')!.id)
        expect(ficha(lia)).toEqual(antes)
        expect(derivados(ficha(lia))).toEqual(derivados(antes))
        const vigia = back.getEntity(back.listEntities().find((e) => e.name === 'A Vigia')!.id)
        expect(bloco(vigia).acoes[0].nome).toBe('Garras')
        const sessao = back.listSessions().find((x) => x.playedOn === '2026-11-07')!
        expect(back.listRolls({ sessionId: sessao.id }).map((r) => r.label)).toEqual(['Garras', 'Ocultismo'])
        expect(back.getInitiative(sessao.id).ordem[1].pv).toEqual({ atual: 41, max: 60 })
      } finally {
        back.close()
      }
    }
  })
})

describe('cofre do Obsidian', () => {
  const vault = () => new Map(buildVault(store).map((f) => [f.path, f.text]))

  it('agentes ganham pasta própria com a ficha calculada', () => {
    const v = vault()
    const lia = v.get('legivel/Agentes/Lia Moraes.md')!
    expect(lia).toContain('tipo: "Agente"')
    expect(lia).toContain('classe: "Ocultista"')
    expect(lia).toContain('- **Jogador:** Bruna')
    expect(lia).toContain(`- **Defesa:** ${derivados(ficha(byName('Lia Moraes'))).defesa.total}`)
    expect(lia).toContain('Ocultismo +12 (Veterano)')
    expect(lia).toContain('Faca (Luta) · dano 1d4 Corte')
    expect(lia).toContain('- **Condições:** Abalado')
    expect([...v.keys()].some((p) => p.startsWith('legivel/Personagens/Lia'))).toBe(false)
  })

  it('ameaça sai com o bloco, não com os campos antigos', () => {
    const vigia = vault().get('legivel/Ameaças/A Vigia.md')!
    expect(vigia).toContain('- **Resistências:** Balístico 5')
    expect(vigia).toContain('- Garras (Padrão): Teste 2d20+10')
    expect(vigia).toContain('## Enigma de medo')
  })

  it('rituais e itens das fichas viram notas com quem os tem', () => {
    const v = vault()
    const ritual = v.get('legivel/Rituais/Amaldiçoar Arma.md')!
    expect(ritual).toContain('- **Círculo:** 1º (1 PE)')
    expect(ritual).toContain('A arma causa +1d6 de Sangue.')
    expect(ritual).toContain('[[legivel/Agentes/Lia Moraes|Lia Moraes]]')
    expect(v.get('legivel/Itens/Colete leve.md')).toContain('- **Defesa:** +5')
  })

  it('a sessão traz a iniciativa e as rolagens em ordem', () => {
    const s = vault().get('legivel/Sessões/Sessão 2.md')!
    expect(s).toContain('## Combate (rodada 2)')
    expect(s).toContain('12 · A Vigia (PV 41/60), Desprevenido ← na vez')
    const rolagens = s.slice(s.indexOf('## Rolagens'))
    expect(rolagens.indexOf('Ocultismo')).toBeLessThan(rolagens.indexOf('Garras'))
    expect(rolagens).toContain('A Vigia: Garras (2d20+10: 20, 3) = 30, crítico')
  })
})

describe('exportar', () => {
  const texto = (gmOnly: boolean) => toText(buildExport(store, { sections: [...EXPORT_SECTIONS], gmOnly }))

  it('versão do mestre leva a ficha do agente, o bloco da ameaça, o combate e as rolagens', () => {
    const t = texto(true)
    expect(t).toContain('Bruna')
    expect(t).toContain('Balístico 5')
    expect(t).toContain('Combate (rodada 2)')
    expect(t).toContain('Garras (2d20+10: 20, 3) = 30, crítico')
  })

  it('versão dos jogadores leva a ficha deles, sem o bloco da ameaça nem as rolagens dela', () => {
    const t = texto(false)
    expect(t).toContain('Bruna')
    expect(t).toContain('Ocultismo (3d20+12: 4, 17, 9) = 29')
    expect(t).not.toContain('Balístico 5')
    expect(t).not.toContain('Garras')
    expect(t).not.toContain('Combate (rodada')
  })
})
