// Aba Inventário: itens, limite por patente e categoria, e carga. Portado do taberna (web/src/ficha/Inventario.tsx).
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { TIPOS_ITEM, itemSchema, type Item } from '@shared/ordem/esquemas'
import { PATENTES } from '@shared/ordem/regras'
import { Button, cx } from '@/ui'
import { novoId, useFicha } from './contexto'
import { BotaoDaBiblioteca } from './DaBiblioteca'
import { AreaTexto, Escolha, Numero, Secao, Texto, Vazio } from './partes'

const ROMANOS = ['0', 'I', 'II', 'III', 'IV']

export function Inventario() {
  const { a, alterar, d } = useFicha()
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const mudar = (id: string, patch: Partial<Item>) => alterar({ inventario: a.inventario.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const novo = () => {
    const i: Item = itemSchema.parse({ id: novoId(), nome: 'Novo item', tipo: filtro || 'Equipamento' })
    alterar({ inventario: [...a.inventario, i] })
    setEditando(i.id)
  }
  const visiveis = a.inventario.filter((i) => !filtro || i.tipo === filtro)
  const caixa = (estourou: boolean) => cx('rounded-md px-1 py-1 text-center', estourou ? 'bg-danger/15 text-danger' : 'bg-surface-raised')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="type-label text-muted">Patente</div>
            <div className="font-serif text-xl font-semibold">{d.patente.nome}</div>
          </div>
          <Numero rotulo="Prestígio" valor={a.prestigio} aoMudar={(prestigio) => alterar({ prestigio })} className="w-24" />
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {d.itensPorCategoria.map((c, i) => (
            <div key={i} className={caixa(c.usados > c.limite)}>
              <div className="text-[10px] font-semibold text-muted">Cat. {ROMANOS[i + 1]}</div>
              <div className="text-sm font-semibold">
                {c.usados}/{c.limite}
              </div>
            </div>
          ))}
          <div className={caixa(d.sobrecarregado)} title="Espaços usados / capacidade (5 × FOR)">
            <div className="text-[10px] font-semibold text-muted">Carga</div>
            <div className="text-sm font-semibold">
              {d.carga}/{d.cargaMax}
            </div>
          </div>
        </div>
        {d.sobrecarregado && <p className="text-xs text-danger">Sobrecarregado: mais espaços do que a Força permite.</p>}
        <p className="text-[11px] text-subtle">Prestígio mínimo: {PATENTES.map((p) => `${p.nome} ${p.prestigio}`).join(' · ')}</p>
      </div>

      <Secao
        titulo="Itens"
        acoes={
          <div className="flex gap-1">
            <BotaoDaBiblioteca tipo="item" />
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={novo}>
              Item
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por tipo">
          {['', ...TIPOS_ITEM].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={filtro === t}
              onClick={() => setFiltro(t)}
              className="h-6 rounded-pill border border-border px-2.5 text-xs text-muted hover:text-fg aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
            >
              {t || 'Todos'}
            </button>
          ))}
        </div>
        {visiveis.length === 0 && <Vazio>Nenhum item aqui.</Vazio>}
        <ul className="flex flex-col gap-2">
          {visiveis.map((i) =>
            editando === i.id ? (
              <li key={i.id} className="flex flex-col gap-3 rounded-md border border-border-input bg-surface p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Texto rotulo="Nome" valor={i.nome} aoMudar={(nome) => mudar(i.id, { nome })} className="col-span-2" />
                  <Escolha rotulo="Tipo" valor={i.tipo} opcoes={[...TIPOS_ITEM]} aoMudar={(tipo) => mudar(i.id, { tipo })} />
                  <Escolha rotulo="Categoria" valor={String(i.categoria)} opcoes={ROMANOS.map((r, n) => ({ valor: String(n), texto: r }))} aoMudar={(c) => mudar(i.id, { categoria: Number(c) })} />
                  <Numero rotulo="Espaços" valor={i.espacos} aoMudar={(espacos) => mudar(i.id, { espacos })} />
                  <Numero rotulo="Quantidade" min={0} valor={i.quantidade} aoMudar={(q) => mudar(i.id, { quantidade: Math.max(0, q) })} />
                  {i.tipo === 'Proteção' && <Numero rotulo="Defesa" valor={i.defesa} aoMudar={(defesa) => mudar(i.id, { defesa })} />}
                  {i.tipo === 'Arma' && (
                    <>
                      <Texto rotulo="Dano" valor={i.dano} placeholder="1d8" aoMudar={(dano) => mudar(i.id, { dano })} />
                      <Texto rotulo="Crítico" valor={i.critico} placeholder="19/x3" aoMudar={(critico) => mudar(i.id, { critico })} />
                      <Texto rotulo="Alcance" valor={i.alcance} placeholder="curto" aoMudar={(alcance) => mudar(i.id, { alcance })} />
                      <Texto rotulo="Tipo de dano" valor={i.tipoDano} placeholder="Corte" aoMudar={(tipoDano) => mudar(i.id, { tipoDano })} />
                    </>
                  )}
                </div>
                <AreaTexto rotulo="Descrição" valor={i.descricao} linhas={2} aoMudar={(descricao) => mudar(i.id, { descricao })} />
                <div className="flex justify-between">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Remover ${i.nome}?`)) alterar({ inventario: a.inventario.filter((x) => x.id !== i.id) })
                    }}
                  >
                    Remover
                  </Button>
                  <Button size="sm" onClick={() => setEditando(null)}>
                    Pronto
                  </Button>
                </div>
              </li>
            ) : (
              <li key={i.id} className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {i.nome}
                    {i.quantidade > 1 && <span className="font-normal text-muted"> ×{i.quantidade}</span>}
                  </div>
                  <div className="text-xs text-subtle">
                    {i.tipo} · Cat. {ROMANOS[i.categoria]} · {i.espacos} espaço{i.espacos === 1 ? '' : 's'}
                    {i.tipo === 'Proteção' && i.defesa ? ` · Defesa +${i.defesa}` : ''}
                    {i.dano && ` · ${i.dano}${i.critico ? ` ${i.critico}` : ''}${i.alcance ? ` · ${i.alcance}` : ''}`}
                    {i.origem && ` · ${i.origem.sourceName}`}
                  </div>
                  {i.descricao && <div className="mt-1 line-clamp-2 text-xs text-muted">{i.descricao}</div>}
                </div>
                {i.tipo === 'Proteção' && (
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" checked={i.equipado} onChange={(e) => mudar(i.id, { equipado: e.target.checked })} className="size-4 accent-(--color-accent)" />
                    Vestindo
                  </label>
                )}
                {i.tipo === 'Munição' && (
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Gastar 1 ${i.nome}`} className="grid size-7 place-items-center rounded-md bg-surface-raised" onClick={() => mudar(i.id, { quantidade: Math.max(0, i.quantidade - 1) })}>
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <button type="button" aria-label={`Somar 1 ${i.nome}`} className="grid size-7 place-items-center rounded-md bg-surface-raised" onClick={() => mudar(i.id, { quantidade: i.quantidade + 1 })}>
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditando(i.id)}>
                  Editar
                </Button>
              </li>
            )
          )}
        </ul>
      </Secao>
    </div>
  )
}
