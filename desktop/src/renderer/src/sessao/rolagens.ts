// O que dá para rolar por uma ficha na tela de Sessão: perícias do agente, testes e ações da ameaça.
import type { BlocoAmeaca, FichaAgente } from '@shared/ordem/esquemas'
import { bonusPericia, dadosDoTeste, PERICIAS } from '@shared/ordem/regras'
import { lerAcao, testeDoTexto } from '@shared/ordem/sessao'
import type { Entity } from '@shared/types'
import type { PedidoRolagem } from '@/ficha/contexto'

export interface OpcaoRolagem {
  nome: string
  grupo: string
  pedido: PedidoRolagem
}

export const fichaCompleta = (e: Entity) => (e.kind === 'personagem' && e.sheet === 'completa' && e.sheetData ? (e.sheetData as FichaAgente) : null)
export const blocoDe = (e: Entity) => (e.kind === 'ameaca' && e.sheetData ? (e.sheetData as BlocoAmeaca) : null)

/** O mestre rola pelas ameaças; os agentes seguem a caixa "rola dados físicos" da ficha (sem ela, vale "é jogador"). */
export const rolaFisico = (e: Entity) => fichaCompleta(e)?.dadosFisicos ?? (e.kind === 'personagem' && e.isPlayer)

export function opcoesDeRolagem(e: Entity): OpcaoRolagem[] {
  const a = fichaCompleta(e)
  if (a)
    return PERICIAS.map((p) => ({
      nome: p.nome,
      grupo: 'Perícias',
      pedido: {
        rotulo: p.nome,
        tipo: 'teste',
        teste: {
          ...dadosDoTeste(a.atributos[p.atributo]),
          bonus: bonusPericia(a, p.nome)
        }
      }
    }))
  const b = blocoDe(e)
  if (!b) return []
  const testes: OpcaoRolagem[] = (
    [
      ['Iniciativa', b.iniciativa],
      ['Percepção', b.percepcao],
      ['Fortitude', b.fortitude],
      ['Reflexos', b.reflexos],
      ['Vontade', b.vontade]
    ] as const
  ).flatMap(([nome, texto]) => {
    const t = testeDoTexto(texto)
    return t
      ? [
          {
            nome,
            grupo: 'Testes',
            pedido: { rotulo: nome, tipo: 'teste' as const, teste: t }
          }
        ]
      : []
  })
  const acoes: OpcaoRolagem[] = [...b.acoes, ...b.habilidades].flatMap((acao) => {
    const { teste, dano } = lerAcao(acao.descricao)
    if (!teste && !dano) return []
    const pedido: PedidoRolagem = {
      rotulo: acao.nome || 'Ação',
      tipo: teste ? 'ataque' : 'dano',
      ...(teste && { teste }),
      ...(dano && { dano: { opcoes: [{ nome: 'Dano', partes: [dano] }] } })
    }
    return [{ nome: acao.nome || 'Ação', grupo: 'Ações', pedido }]
  })
  return [...testes, ...acoes]
}

/** O teste de iniciativa da ficha (agente: perícia Iniciativa; ameaça: o que está no bloco). */
export const pedidoDeIniciativa = (e: Entity) => opcoesDeRolagem(e).find((o) => o.nome === 'Iniciativa')?.pedido ?? null
