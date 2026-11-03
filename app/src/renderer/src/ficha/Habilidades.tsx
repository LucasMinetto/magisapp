// Aba Habilidades: poderes de classe, trilha, origem e paranormais. Portado do taberna (web/src/ficha/Habilidades.tsx).
import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Habilidade } from '@shared/ordem/esquemas'
import { Button } from '@/ui'
import { novoId, useFicha } from './contexto'
import { AreaTexto, Secao, Texto, Vazio } from './partes'

export function Habilidades() {
  const { a, alterar } = useFicha()
  const [aberta, setAberta] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const mudar = (id: string, patch: Partial<Habilidade>) => alterar({ habilidades: a.habilidades.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const nova = () => {
    const h: Habilidade = { id: novoId(), nome: 'Nova habilidade', fonte: '', custo: '', descricao: '' }
    alterar({ habilidades: [...a.habilidades, h] })
    setAberta(h.id)
  }
  const termo = busca.toLowerCase()
  const visiveis = a.habilidades.filter((h) => !termo || `${h.nome} ${h.fonte} ${h.descricao}`.toLowerCase().includes(termo))

  return (
    <Secao
      titulo="Habilidades e poderes"
      acoes={
        <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={nova}>
          Habilidade
        </Button>
      }
    >
      {a.habilidades.length > 4 && (
        <input
          value={busca}
          aria-label="Buscar habilidade"
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar habilidade"
          className="h-8 rounded-md border border-border-input bg-bg px-2.5 text-sm focus:border-focus"
        />
      )}
      {a.habilidades.length === 0 && <Vazio>Nenhuma habilidade. Adicione os poderes de classe, trilha e origem.</Vazio>}
      <ul className="flex flex-col gap-2">
        {visiveis.map((h) => (
          <li key={h.id} className="rounded-md border border-border bg-surface">
            <button type="button" aria-expanded={aberta === h.id} className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setAberta(aberta === h.id ? null : h.id)}>
              <span className="min-w-0 flex-1 truncate font-semibold">{h.nome || 'Sem nome'}</span>
              {h.custo && <span className="text-xs text-warning">{h.custo}</span>}
              {h.fonte && <span className="text-[11px] tracking-wider text-subtle uppercase">{h.fonte}</span>}
              <ChevronDown className={`size-4 text-subtle transition-transform ${aberta === h.id ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {aberta === h.id ? (
              <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                <Texto rotulo="Nome" valor={h.nome} aoMudar={(nome) => mudar(h.id, { nome })} />
                <div className="grid grid-cols-2 gap-2">
                  <Texto rotulo="Fonte" valor={h.fonte} placeholder="Classe, trilha, origem…" aoMudar={(fonte) => mudar(h.id, { fonte })} />
                  <Texto rotulo="Custo" valor={h.custo} placeholder="2 PE" aoMudar={(custo) => mudar(h.id, { custo })} />
                </div>
                <AreaTexto rotulo="Descrição" valor={h.descricao} placeholder="O que ela faz" aoMudar={(descricao) => mudar(h.id, { descricao })} />
                <Button
                  size="sm"
                  variant="danger"
                  className="self-end"
                  onClick={() => {
                    if (window.confirm(`Remover ${h.nome}?`)) alterar({ habilidades: a.habilidades.filter((x) => x.id !== h.id) })
                  }}
                >
                  Remover
                </Button>
              </div>
            ) : (
              h.descricao && <p className="line-clamp-2 px-3 pb-2 text-xs text-muted">{h.descricao}</p>
            )}
          </li>
        ))}
      </ul>
    </Secao>
  )
}
