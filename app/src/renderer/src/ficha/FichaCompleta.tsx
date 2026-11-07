// Ficha completa de agente ou NPC vilão, em três colunas.
// A tela da ficha (EntitySheet) cuida de salvar, do retrato, do nome e das notas; aqui fica o que é de Ordem.
import { useState, type ReactNode } from 'react'
import type { FichaAgente } from '@shared/ordem/esquemas'
import { derivados } from '@shared/ordem/regras'
import { Combate } from './Combate'
import { Ficha, maximos, useFicha, type PedidoRolagem } from './contexto'
import { Habilidades } from './Habilidades'
import { Historico } from './Historico'
import { Identidade } from './Identidade'
import { Inventario } from './Inventario'
import { JanelaRolagem } from './JanelaRolagem'
import { AreaTexto, Abas } from './partes'
import { Pericias } from './Pericias'
import { Rituais } from './Rituais'

type Aba = 'combate' | 'habilidades' | 'rituais' | 'inventario' | 'historico' | 'notas'

const ABAS: { id: Aba; texto: string }[] = [
  { id: 'combate', texto: 'Combate' },
  { id: 'habilidades', texto: 'Habilidades' },
  { id: 'rituais', texto: 'Rituais' },
  { id: 'inventario', texto: 'Inventário' },
  { id: 'historico', texto: 'Histórico' },
  { id: 'notas', texto: 'Notas' }
]

export function FichaCompleta({
  entityId,
  ficha,
  aoMudar,
  topo,
  notas,
  jogador
}: {
  entityId: string
  ficha: FichaAgente
  aoMudar: (f: FichaAgente) => void
  /** Retrato, nome e papel: vêm da tela da ficha. */
  topo: ReactNode
  /** Apelidos, descrição, notas do mestre e "Aparece em". */
  notas: ReactNode
  /** Personagem de jogador: sem a caixa marcada ou desmarcada, a rolagem abre em "digitar". */
  jogador: boolean
}) {
  const [aba, setAba] = useState<Aba>('combate')
  const [pedido, setPedido] = useState<PedidoRolagem | null>(null)
  const dadosFisicos = ficha.dadosFisicos ?? jogador
  const [mod, setMod] = useState({ dados: 0, bonus: 0 })
  const d = derivados(ficha)
  const max = maximos(ficha, d)

  // Quando o máximo muda (classe, NEX, atributos…), o atual acompanha se estava cheio ou zerado.
  const alterar = (patch: Partial<FichaAgente>) => {
    const nova = { ...ficha, ...patch }
    const novoMax = maximos(nova, derivados(nova))
    for (const r of ['pv', 'pe', 'san'] as const) {
      const atual = `${r}Atual` as const
      if (patch[atual] === undefined && novoMax[r] !== max[r] && (ficha[atual] === max[r] || ficha[atual] === 0)) nova[atual] = novoMax[r]
    }
    aoMudar(nova)
  }

  const conteudo: Record<Aba, ReactNode> = {
    combate: <Combate />,
    habilidades: <Habilidades />,
    rituais: <Rituais />,
    inventario: <Inventario />,
    historico: <Historico entityId={entityId} />,
    notas: (
      <div className="flex flex-col gap-4">
        <Investigacao />
        {notas}
      </div>
    )
  }

  return (
    <Ficha.Provider value={{ entityId, a: ficha, alterar, d, max, rolar: setPedido, dadosFisicos, mod, setMod }}>
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(340px,400px)_minmax(0,1fr)]">
        <section aria-label="Identidade e recursos" className="flex flex-col gap-5">
          {topo}
          <Identidade />
        </section>
        <section aria-label="Perícias">
          <Pericias />
        </section>
        <section aria-label="Combate e mais" className="flex min-w-0 flex-col gap-3 lg:col-span-2 xl:col-span-1">
          <Abas rotulo="Partes da ficha" abas={ABAS} atual={aba} aoMudar={setAba} />
          <div role="tabpanel" aria-label={ABAS.find((t) => t.id === aba)?.texto}>
            {conteudo[aba]}
          </div>
        </section>
      </div>
      {pedido && (
        <JanelaRolagem
          pedido={pedido}
          entityId={entityId}
          fisicos={dadosFisicos}
          aoFechar={() => setPedido(null)}
          aoGastarPe={(custo) => alterar({ peAtual: Math.max(0, ficha.peAtual - custo) })}
        />
      )}
    </Ficha.Provider>
  )
}

// A aparência e a personalidade ficam nos campos gerais da ficha (descrição e personalidade), que valem para qualquer ficha.
function Investigacao() {
  const { a, alterar } = useFicha()
  const mudar = (k: 'historico' | 'objetivo' | 'anotacoes', v: string) => alterar({ investigacao: { ...a.investigacao, [k]: v } })
  return (
    <div className="flex flex-col gap-3">
      <AreaTexto rotulo="Histórico" valor={a.investigacao.historico} placeholder="De onde vem, o que viveu" aoMudar={(v) => mudar('historico', v)} />
      <AreaTexto rotulo="Objetivo" valor={a.investigacao.objetivo} linhas={2} placeholder="O que quer" aoMudar={(v) => mudar('objetivo', v)} />
      <AreaTexto rotulo="Anotações da investigação" valor={a.investigacao.anotacoes} placeholder="O que o personagem já descobriu" aoMudar={(v) => mudar('anotacoes', v)} />
    </div>
  )
}
