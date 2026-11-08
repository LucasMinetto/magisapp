// Peças da tela de Sessão que trabalham sobre uma ficha da campanha: carregar e salvar (useFichaViva), PV/PE/SAN
// (recursos + Contador), escolher o que rolar (BotaoRolar) e o cartão de quem está na cena (NaCena, aba NPCs).
// Ficha completa: os atuais ficam na ficha (sheet_data). Compacta: nos campos do modelo (stats). Ameaça: o bloco;
// o PV de cada ameaça no combate fica no combatente (duas cópias da mesma ficha têm PV separados).
import { Dices, ExternalLink, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { FichaAgente } from '@shared/ordem/esquemas'
import { derivados } from '@shared/ordem/regras'
import type { Entity, StatValue } from '@shared/types'
import { useCampaign } from '@/campaign'
import { BlocoAmeaca } from '@/ameaca/BlocoAmeaca'
import { maximos, sinal, type PedidoRolagem } from '@/ficha/contexto'
import { JanelaRolagem } from '@/ficha/JanelaRolagem'
import { KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { toInput } from '@/screens/EntitySheet'
import { Button, cx, Dialog, Portrait, SaveIndicator, TextField } from '@/ui'
import { blocoDe, fichaCompleta, opcoesDeRolagem, rolaFisico, type OpcaoRolagem } from './rolagens'

// ------------------------------------------------------------ ficha carregada e salva sozinha

// Recarrega quando a campanha muda (a mesma ficha pode estar na faixa do grupo e no combate), mas não por cima
// de uma mudança que ainda espera para salvar.
export function useFichaViva(id: string) {
  const { version, changed } = useCampaign()
  const loaded = useLoad(() => window.api.entities.get(id), [id, version])
  const [entity, setEntity] = useState<Entity | null>(null)
  const editando = useRef(false)
  const autosave = useAutosave(async (e: Entity) => {
    await window.api.entities.save(toInput(e))
    editando.current = false
    changed()
  }, 400)
  useEffect(() => {
    if (loaded.data && !editando.current) setEntity(loaded.data)
  }, [loaded.data])
  const salvar = (next: Entity) => {
    editando.current = true
    setEntity(next)
    autosave.schedule(next)
  }
  return { entity, salvar, autosave, error: loaded.error }
}

// ------------------------------------------------------------ PV, PE, SAN

type Resource = { current: number; max: number }
const isResource = (v: StatValue | undefined): v is Resource => typeof v === 'object' && v !== null && !Array.isArray(v)
const COMPACTA = [
  ['pv', 'PV'],
  ['san', 'SAN'],
  ['pe', 'PE'],
  ['pd', 'PD']
] as const

export interface Barra {
  chave: string
  rotulo: string
  atual: number
  max: number
  alerta?: string | null
}

/** Os recursos que a ficha marca e como somar neles. Ameaça não tem: o PV dela fica no combatente. */
export function recursos(entity: Entity, salvar: (e: Entity) => void): { barras: Barra[]; somar: (chave: string, d: number) => void } {
  const a = fichaCompleta(entity)
  if (a) {
    const max = maximos(a, derivados(a))
    const teto: Record<string, number> = { pvAtual: max.pv, peAtual: max.pe, sanAtual: max.san }
    return {
      barras: [
        { chave: 'pvAtual', rotulo: 'PV', atual: a.pvAtual, max: max.pv, alerta: max.pv > 0 && a.pvAtual <= 0 ? 'Morrendo' : null },
        { chave: 'peAtual', rotulo: 'PE', atual: a.peAtual, max: max.pe },
        { chave: 'sanAtual', rotulo: 'SAN', atual: a.sanAtual, max: max.san, alerta: max.san > 0 && a.sanAtual <= 0 ? 'Enlouquecendo' : null }
      ].filter((b) => b.max > 0),
      somar: (chave, delta) => {
        const k = chave as 'pvAtual' | 'peAtual' | 'sanAtual'
        salvar({ ...entity, sheetData: { ...a, [k]: Math.max(0, Math.min(teto[k], a[k] + delta)) } satisfies FichaAgente })
      }
    }
  }
  if (blocoDe(entity)) return { barras: [], somar: () => {} }
  return {
    barras: COMPACTA.flatMap(([chave, rotulo]) => {
      const r = entity.stats[chave]
      return isResource(r) && r.max > 0 ? [{ chave, rotulo, atual: r.current, max: r.max }] : []
    }),
    somar: (chave, delta) => {
      const r = entity.stats[chave]
      if (!isResource(r)) return
      salvar({ ...entity, stats: { ...entity.stats, [chave]: { ...r, current: Math.min(r.max, r.current + delta) } } })
    }
  }
}

export const tomDe = (atual: number, max: number) => (atual <= 0 ? 'text-danger' : max > 0 && atual / max < 0.35 ? 'text-warning' : 'text-fg')

export const passo = 'grid h-6 min-w-6 place-items-center rounded-md border border-border-input px-1 text-xs text-muted hover:text-fg'

/** Um recurso com − e +. `grande` mostra também −5 e +5 (dano e cura no combate). */
export function Contador({ b, nome, aoSomar, grande }: { b: Barra; nome: string; aoSomar: (d: number) => void; grande?: boolean }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`${b.rotulo} de ${nome}`}>
      <span className="type-label w-8 text-muted">{b.rotulo}</span>
      {grande && (
        <button type="button" aria-label={`Tirar 5 de ${b.rotulo}`} onClick={() => aoSomar(-5)} className={passo}>
          −5
        </button>
      )}
      <button type="button" aria-label={`Tirar 1 de ${b.rotulo}`} onClick={() => aoSomar(-1)} className={passo}>
        <Minus className="size-3" aria-hidden />
      </button>
      <span className={cx('text-center font-mono', grande ? 'w-16 text-base' : 'w-14 text-sm', tomDe(b.atual, b.max))} aria-live="polite">
        {b.atual}/{b.max}
      </span>
      <button type="button" aria-label={`Somar 1 em ${b.rotulo}`} onClick={() => aoSomar(1)} className={passo}>
        <Plus className="size-3" aria-hidden />
      </button>
      {grande && (
        <button type="button" aria-label={`Somar 5 em ${b.rotulo}`} onClick={() => aoSomar(5)} className={passo}>
          +5
        </button>
      )}
      {b.alerta && <span className="text-xs text-danger">{b.alerta}</span>}
    </div>
  )
}

/** "Personagem · PJ · Ocultista NEX 10% · Defesa 12" ou "Ameaça · VD 40 · Defesa 20 · PV 60". */
export function resumoDaFicha(entity: Entity): string {
  const a = fichaCompleta(entity)
  const bloco = blocoDe(entity)
  const defesa = a ? derivados(a).defesa.total : bloco ? bloco.defesa : entity.stats.defesa
  return [
    KIND_LABEL[entity.kind].one,
    entity.isPlayer && 'PJ',
    entity.role,
    a && a.classe && `${a.classe} NEX ${a.nex}%`,
    bloco?.vd && `VD ${bloco.vd}`,
    typeof defesa === 'number' && defesa > 0 && `Defesa ${defesa}`,
    bloco && bloco.pv > 0 && `PV ${bloco.pv}`
  ]
    .filter(Boolean)
    .join(' · ')
}

// ------------------------------------------------------------ rolar

export function resumoDoPedido(p: PedidoRolagem) {
  const t = p.teste
  return t ? `${t.quantidade}d20${t.regra === 'menor' ? ' (menor)' : ''}${t.bonus ? sinal(t.bonus) : ''}` : (p.dano?.opcoes[0]?.partes[0]?.expressao ?? '')
}

/** A janela de rolagem já ligada à ficha e à sessão (gasta PE do agente quando o ritual pede). */
export function Rolagem({
  entity,
  sessionId,
  salvar,
  pedido,
  aoFechar,
  aoTotal
}: {
  entity: Entity
  sessionId: string | null
  salvar: (e: Entity) => void
  pedido: PedidoRolagem
  aoFechar: () => void
  aoTotal?: (total: number) => void
}) {
  const a = fichaCompleta(entity)
  return (
    <JanelaRolagem
      pedido={pedido}
      entityId={entity.id}
      sessionId={sessionId}
      fisicos={rolaFisico(entity)}
      aoFechar={aoFechar}
      aoTotal={aoTotal}
      aoGastarPe={(custo) => a && salvar({ ...entity, sheetData: { ...a, peAtual: Math.max(0, a.peAtual - custo) } })}
    />
  )
}

/** Botão "Rolar" que abre a lista do que rolar e depois a janela de rolagem. */
export function BotaoRolar({
  entity,
  sessionId,
  salvar,
  children
}: {
  entity: Entity
  sessionId: string | null
  salvar: (e: Entity) => void
  children?: ReactNode
}) {
  const [escolher, setEscolher] = useState(false)
  const [pedido, setPedido] = useState<PedidoRolagem | null>(null)
  const opcoes = opcoesDeRolagem(entity)
  if (!opcoes.length) return null
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={<Dices className="size-4" />}
        aria-label={children ? undefined : `Rolar por ${entity.name}`}
        title="Rolar"
        onClick={() => setEscolher(true)}
      >
        {children}
      </Button>
      {escolher && (
        <EscolherRolagem
          nome={entity.name}
          opcoes={opcoes}
          aoFechar={() => setEscolher(false)}
          aoEscolher={(p) => {
            setEscolher(false)
            setPedido(p)
          }}
        />
      )}
      {pedido && <Rolagem entity={entity} sessionId={sessionId} salvar={salvar} pedido={pedido} aoFechar={() => setPedido(null)} />}
    </>
  )
}

function EscolherRolagem({
  nome,
  opcoes,
  aoFechar,
  aoEscolher
}: {
  nome: string
  opcoes: OpcaoRolagem[]
  aoFechar: () => void
  aoEscolher: (p: PedidoRolagem) => void
}) {
  const [q, setQ] = useState('')
  const filtro = q.trim().toLowerCase()
  const grupos = [...new Set(opcoes.map((o) => o.grupo))]
  return (
    <Dialog open onOpenChange={(o) => !o && aoFechar()} title={`Rolar por ${nome}`} footer={<Button onClick={aoFechar}>Fechar</Button>}>
      <div className="flex flex-col gap-3">
        <TextField label="Buscar" placeholder="Luta, Reflexos, Agredir…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
          {grupos.map((grupo) => {
            const lista = opcoes.filter((o) => o.grupo === grupo && o.nome.toLowerCase().includes(filtro))
            if (!lista.length) return null
            return (
              <section key={grupo} aria-label={grupo}>
                <h3 className="type-label mb-1 text-muted">{grupo}</h3>
                <div className="flex flex-wrap gap-1">
                  {lista.map((o) => (
                    <Button key={`${grupo}:${o.nome}`} size="sm" variant="ghost" aria-label={`Rolar ${o.nome}`} onClick={() => aoEscolher(o.pedido)}>
                      {o.nome}
                      <span className="ml-1 font-mono text-xs text-subtle">{resumoDoPedido(o.pedido)}</span>
                    </Button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}

// ------------------------------------------------------------ cartão de quem está na cena (aba NPCs)

export function NaCena({ id, sessionId }: { id: string; sessionId: string | null }) {
  const { entity, salvar, autosave } = useFichaViva(id)
  if (!entity) return null
  const { barras, somar } = recursos(entity, salvar)
  const a = fichaCompleta(entity)
  const bloco = blocoDe(entity)

  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <Portrait name={entity.name} src={entity.portraitUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{entity.name}</div>
          <div className="truncate text-xs text-muted">{resumoDaFicha(entity)}</div>
        </div>
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <BotaoRolar entity={entity} sessionId={sessionId} salvar={salvar} />
        <Link
          to={`/ficha/${entity.id}`}
          aria-label={`Abrir a ficha ${entity.name}`}
          title="Abrir a ficha"
          className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-raised hover:text-fg"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
      {barras.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {barras.map((b) => (
            <Contador key={b.chave} b={b} nome={entity.name} aoSomar={(d) => somar(b.chave, d)} />
          ))}
        </div>
      )}
      {a && a.condicoes.length > 0 && <div className="mt-1 text-xs text-warning">{a.condicoes.join(' · ')}</div>}
      {bloco && (
        <details className="mt-2 rounded-md border border-border bg-bg px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted hover:text-fg">Bloco de {entity.name}</summary>
          <div className="mt-2">
            <BlocoAmeaca a={bloco} nome={entity.name} compacto />
          </div>
        </details>
      )}
    </li>
  )
}
