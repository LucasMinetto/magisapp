// T10: painel de iniciativa da tela de Sessão. Fica salvo na sessão de jogo (fecha e reabre a campanha e continua).
// Base: PainelIniciativa do taberna (web/src/paginas/SessaoPagina.tsx). Cada ameaça no combate tem PV próprio.
import { ChevronLeft, ChevronRight, Dices, ListOrdered, Minus, Plus, Swords, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Iniciativa } from '@shared/ordem/esquemas'
import { anterior, nomeDaCopia, ordenar, proximo, remover, SEM_COMBATE, type Combatente } from '@shared/ordem/sessao'
import type { Entity } from '@shared/types'
import { useCampaign } from '@/campaign'
import { JanelaRolagem } from '@/ficha/JanelaRolagem'
import type { PedidoRolagem } from '@/ficha/contexto'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, cx, ErrorNote, SaveIndicator } from '@/ui'
import { blocoDe, pedidoDeIniciativa, rolaFisico } from './rolagens'

const novoId = () => crypto.randomUUID()

/** O estado do combate da sessão, com salvamento automático. */
export function useIniciativa(sessionId: string | null) {
  const { version, changed } = useCampaign()
  const loaded = useLoad(() => (sessionId ? window.api.sessions.initiative(sessionId) : Promise.resolve(SEM_COMBATE)), [sessionId, version])
  const [ini, setIni] = useState<Iniciativa>(SEM_COMBATE)
  const editando = useRef(false)
  // O valor mais novo, para quem chega depois de um await (pôr fichas que ainda estavam carregando).
  const atual = useRef(ini)
  atual.current = ini
  const autosave = useAutosave(async (v: { id: string; initiative: Iniciativa }) => {
    await window.api.sessions.saveInitiative(v)
    editando.current = false
    changed()
  }, 300)
  // O que veio do banco só entra quando não há mudança esperando para salvar (senão apagaria o que o mestre digitou).
  useEffect(() => {
    if (loaded.data && !editando.current) setIni(loaded.data)
  }, [loaded.data])

  const alterar = (next: Iniciativa) => {
    if (!sessionId) return
    editando.current = true
    atual.current = next
    setIni(next)
    autosave.schedule({ id: sessionId, initiative: next })
  }

  /** Põe uma ficha na ordem. Agente entra uma vez; cada ameaça entra de novo como cópia, com PV cheio. */
  const adicionar = (lista: Entity[]) => {
    const agora = atual.current
    let ordem = agora.ordem
    for (const e of lista) {
      const bloco = blocoDe(e)
      if (e.kind === 'ameaca') {
        const pv = bloco?.pv ?? 0
        ordem = [
          ...ordem,
          {
            id: novoId(),
            entityId: e.id,
            nome: nomeDaCopia(ordem, e.name),
            valor: 0,
            pv: { atual: pv, max: pv }
          }
        ]
      } else if (!ordem.some((c) => c.entityId === e.id)) {
        ordem = [...ordem, { id: novoId(), entityId: e.id, nome: e.name, valor: 0, pv: null }]
      }
    }
    alterar({ ...agora, ordem })
  }

  return { ini, alterar, adicionar, autosave, error: loaded.error }
}

type Combate = ReturnType<typeof useIniciativa>

export function PainelIniciativa({ combate, sessionId, naCena }: { combate: Combate; sessionId: string | null; naCena: { id: string; name: string }[] }) {
  const { ini, alterar, adicionar, autosave } = combate
  const [escolha, setEscolha] = useState('')
  const [rolando, setRolando] = useState<{
    c: Combatente
    e: Entity
    pedido: PedidoRolagem
  } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const fichas = useLoad(async () => {
    const [p, a] = await Promise.all([window.api.entities.list({ kind: 'personagem' }), window.api.entities.list({ kind: 'ameaca' })])
    return [...p, ...a]
  }, [])

  if (!sessionId)
    return (
      <section aria-labelledby="ini-h" className="flex flex-col gap-2">
        <h2 id="ini-h" className="type-label text-muted">
          Iniciativa
        </h2>
        <p className="text-sm text-subtle">Comece uma sessão para montar a ordem de turno.</p>
      </section>
    )

  const carregar = async (ids: string[]) => {
    setErro(null)
    try {
      adicionar(await Promise.all(ids.map((id) => window.api.entities.get(id))))
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const mudar = (id: string, patch: Partial<Combatente>) =>
    alterar({
      ...ini,
      ordem: ini.ordem.map((c) => (c.id === id ? { ...c, ...patch } : c))
    })
  const rolar = async (c: Combatente) => {
    if (!c.entityId) return
    setErro(null)
    try {
      const e = await window.api.entities.get(c.entityId)
      const pedido = pedidoDeIniciativa(e)
      if (!pedido) setErro(`A ficha de ${e.name} não tem teste de iniciativa. Digite o valor.`)
      else
        setRolando({
          c,
          e,
          pedido: { ...pedido, rotulo: `Iniciativa de ${c.nome}` }
        })
    } catch (err) {
      setErro((err as Error).message)
    }
  }
  const foraDaOrdem = naCena.filter((p) => !ini.ordem.some((c) => c.entityId === p.id))
  const vez = ini.ordem[ini.turno]

  return (
    <section aria-labelledby="ini-h" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 id="ini-h" className="type-label text-muted">
          Iniciativa · Rodada {ini.rodada}
        </h2>
        <SaveIndicator state={autosave.state} error={autosave.error} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" icon={<Users className="size-4" />} disabled={foraDaOrdem.length === 0} onClick={() => void carregar(foraDaOrdem.map((p) => p.id))}>
          Todos da cena
        </Button>
        <Button size="sm" icon={<ListOrdered className="size-4" />} disabled={ini.ordem.length < 2} onClick={() => alterar(ordenar(ini))}>
          Ordenar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<ChevronLeft className="size-4" />}
          aria-label="Voltar a vez"
          title="Voltar a vez"
          disabled={!ini.ordem.length}
          onClick={() => alterar(anterior(ini))}
        />
        <Button size="sm" variant="primary" icon={<ChevronRight className="size-4" />} disabled={!ini.ordem.length} onClick={() => alterar(proximo(ini))}>
          Próximo
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="ini-add">
          Ficha para pôr na iniciativa
        </label>
        <select
          id="ini-add"
          value={escolha}
          onChange={(e) => setEscolha(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus"
        >
          <option value="">Pôr na iniciativa…</option>
          {(fichas.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.kind === 'ameaca' ? ' (ameaça)' : ''}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          icon={<Plus className="size-4" />}
          disabled={!escolha}
          onClick={() => {
            void carregar([escolha])
            setEscolha('')
          }}
        >
          Pôr
        </Button>
      </div>
      {(erro || combate.error) && <ErrorNote message={(erro || combate.error)!} />}
      {ini.ordem.length === 0 ? (
        <p className="text-sm text-subtle">Ninguém na ordem. Use "Todos da cena" ou escolha uma ficha.</p>
      ) : (
        <ol className="flex flex-col gap-1" aria-label="Ordem de iniciativa">
          {ini.ordem.map((c, n) => {
            const atual = n === ini.turno
            const caiu = c.pv !== null && c.pv.max > 0 && c.pv.atual <= 0
            return (
              <li
                key={c.id}
                aria-current={atual ? 'step' : undefined}
                className={cx(
                  'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1',
                  atual ? 'border-accent bg-surface-raised' : 'border-border bg-surface',
                  caiu && 'opacity-60'
                )}
              >
                <span className="w-3 text-center text-xs text-accent" aria-hidden>
                  {atual ? '▶' : ''}
                </span>
                <input
                  type="number"
                  aria-label={`Iniciativa de ${c.nome}`}
                  value={c.valor}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => mudar(c.id, { valor: Number(e.target.value) || 0 })}
                  className="h-7 w-14 rounded-md border border-border-input bg-bg px-1 text-center font-mono text-sm font-semibold"
                />
                {c.entityId && (
                  <button
                    type="button"
                    aria-label={`Rolar a iniciativa de ${c.nome}`}
                    title="Rolar a iniciativa"
                    onClick={() => void rolar(c)}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-surface-raised hover:text-fg"
                  >
                    <Dices className="size-3.5" aria-hidden />
                  </button>
                )}
                <span className="min-w-32 flex-1 truncate text-sm">
                  {c.entityId ? (
                    <Link to={`/ficha/${c.entityId}`} className={cx('hover:underline', c.pv === null && 'text-accent')}>
                      {c.nome}
                    </Link>
                  ) : (
                    c.nome
                  )}
                  {caiu && <span className="ml-1 text-xs text-danger">caiu</span>}
                </span>
                {c.pv && (
                  <span className="ml-auto flex items-center gap-0.5" role="group" aria-label={`PV de ${c.nome}`}>
                    <button
                      type="button"
                      aria-label={`Tirar 1 de PV de ${c.nome}`}
                      onClick={() =>
                        mudar(c.id, {
                          pv: { ...c.pv!, atual: c.pv!.atual - 1 }
                        })
                      }
                      className="grid size-5 place-items-center rounded border border-border-input text-muted hover:text-fg"
                    >
                      <Minus className="size-3" aria-hidden />
                    </button>
                    <input
                      type="number"
                      aria-label={`PV atual de ${c.nome}`}
                      value={c.pv.atual}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        mudar(c.id, {
                          pv: { ...c.pv!, atual: Number(e.target.value) || 0 }
                        })
                      }
                      className={cx('h-6 w-11 rounded border border-border-input bg-bg text-center font-mono text-xs', caiu && 'text-danger')}
                    />
                    <span className="font-mono text-xs text-subtle">/{c.pv.max}</span>
                    <button
                      type="button"
                      aria-label={`Somar 1 em PV de ${c.nome}`}
                      onClick={() =>
                        mudar(c.id, {
                          pv: {
                            ...c.pv!,
                            atual: Math.min(c.pv!.max, c.pv!.atual + 1)
                          }
                        })
                      }
                      className="grid size-5 place-items-center rounded border border-border-input text-muted hover:text-fg"
                    >
                      <Plus className="size-3" aria-hidden />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Tirar ${c.nome} da iniciativa`}
                  title="Tirar da iniciativa"
                  onClick={() => alterar(remover(ini, c.id))}
                  className="grid size-6 shrink-0 place-items-center rounded text-subtle hover:text-danger"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {ini.ordem.length > 0 && (
        <div className="flex items-center justify-between text-xs text-subtle">
          <span aria-live="polite">{vez && `Vez de ${vez.nome}`}</span>
          <button type="button" className="flex items-center gap-1 hover:text-fg" onClick={() => alterar(SEM_COMBATE)}>
            <Swords className="size-3.5" aria-hidden /> Encerrar combate
          </button>
        </div>
      )}
      {rolando && (
        <JanelaRolagem
          pedido={rolando.pedido}
          entityId={rolando.e.id}
          sessionId={sessionId}
          fisicos={rolaFisico(rolando.e)}
          aoFechar={() => setRolando(null)}
          aoGastarPe={() => {}}
          aoTotal={(total) => mudar(rolando.c.id, { valor: total })}
        />
      )}
    </section>
  )
}
