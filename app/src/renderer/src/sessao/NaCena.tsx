// Quem está na cena, com PV/PE/SAN à mão e rolagem sem sair da tela de Sessão (T10).
// Ficha completa: os atuais ficam na ficha (sheet_data). Compacta: nos campos do modelo (stats). Ameaça: o bloco;
// o PV de cada ameaça no combate fica na iniciativa (duas cópias da mesma ficha têm PV separados).
import { Dices, ExternalLink, Minus, Plus, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { blocoDe, fichaCompleta, opcoesDeRolagem, rolaFisico } from './rolagens'

type Resource = { current: number; max: number }
const isResource = (v: StatValue | undefined): v is Resource => typeof v === 'object' && v !== null && !Array.isArray(v)
const COMPACTA = [
  ['pv', 'PV'],
  ['san', 'SAN'],
  ['pe', 'PE'],
  ['pd', 'PD']
] as const

interface Barra {
  chave: string
  rotulo: string
  atual: number
  max: number
  alerta?: string | null
}

function Contador({ b, nome, aoSomar }: { b: Barra; nome: string; aoSomar: (d: number) => void }) {
  const tom = b.atual <= 0 ? 'text-danger' : b.atual / b.max < 0.35 ? 'text-warning' : 'text-fg'
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`${b.rotulo} de ${nome}`}>
      <span className="type-label w-8 text-muted">{b.rotulo}</span>
      <button
        type="button"
        aria-label={`Tirar 1 de ${b.rotulo}`}
        onClick={() => aoSomar(-1)}
        className="grid size-6 place-items-center rounded-md border border-border-input text-muted hover:text-fg"
      >
        <Minus className="size-3" aria-hidden />
      </button>
      <span className={cx('w-14 text-center font-mono text-sm', tom)} aria-live="polite">
        {b.atual}/{b.max}
      </span>
      <button
        type="button"
        aria-label={`Somar 1 em ${b.rotulo}`}
        onClick={() => aoSomar(1)}
        className="grid size-6 place-items-center rounded-md border border-border-input text-muted hover:text-fg"
      >
        <Plus className="size-3" aria-hidden />
      </button>
      {b.alerta && <span className="text-xs text-danger">{b.alerta}</span>}
    </div>
  )
}

export function NaCena({ id, sessionId, aoEntrar }: { id: string; sessionId: string | null; aoEntrar?: (e: Entity) => void }) {
  const { changed } = useCampaign()
  const loaded = useLoad(() => window.api.entities.get(id), [id])
  const [entity, setEntity] = useState<Entity | null>(null)
  const [escolher, setEscolher] = useState(false)
  const [pedido, setPedido] = useState<PedidoRolagem | null>(null)
  const autosave = useAutosave(async (e: Entity) => {
    await window.api.entities.save(toInput(e))
    changed()
  }, 400)
  useEffect(() => {
    if (loaded.data) setEntity(loaded.data)
  }, [loaded.data])
  if (!entity) return null

  const salvar = (next: Entity) => {
    setEntity(next)
    autosave.schedule(next)
  }
  const a = fichaCompleta(entity)
  const bloco = blocoDe(entity)
  const opcoes = opcoesDeRolagem(entity)

  let barras: Barra[] = []
  let somar: (chave: string, d: number) => void = () => {}
  if (a) {
    const d = derivados(a)
    const max = maximos(a, d)
    barras = [
      {
        chave: 'pvAtual',
        rotulo: 'PV',
        atual: a.pvAtual,
        max: max.pv,
        alerta: max.pv > 0 && a.pvAtual <= 0 ? 'Morrendo' : null
      },
      { chave: 'peAtual', rotulo: 'PE', atual: a.peAtual, max: max.pe },
      {
        chave: 'sanAtual',
        rotulo: 'SAN',
        atual: a.sanAtual,
        max: max.san,
        alerta: max.san > 0 && a.sanAtual <= 0 ? 'Enlouquecendo' : null
      }
    ].filter((b) => b.max > 0)
    const teto: Record<string, number> = {
      pvAtual: max.pv,
      peAtual: max.pe,
      sanAtual: max.san
    }
    somar = (chave, delta) => {
      const k = chave as 'pvAtual' | 'peAtual' | 'sanAtual'
      salvar({
        ...entity,
        sheetData: {
          ...a,
          [k]: Math.max(0, Math.min(teto[k], a[k] + delta))
        } satisfies FichaAgente
      })
    }
  } else if (!bloco) {
    barras = COMPACTA.flatMap(([chave, rotulo]) => {
      const r = entity.stats[chave]
      return isResource(r) && r.max > 0 ? [{ chave, rotulo, atual: r.current, max: r.max }] : []
    })
    somar = (chave, delta) => {
      const r = entity.stats[chave]
      if (!isResource(r)) return
      salvar({
        ...entity,
        stats: {
          ...entity.stats,
          [chave]: { ...r, current: Math.min(r.max, r.current + delta) }
        }
      })
    }
  }

  const defesa = a ? derivados(a).defesa.total : bloco ? bloco.defesa : entity.stats.defesa
  const extra = [
    a && a.classe && `${a.classe} NEX ${a.nex}%`,
    bloco?.vd && `VD ${bloco.vd}`,
    typeof defesa === 'number' && defesa > 0 && `Defesa ${defesa}`,
    bloco && bloco.pv > 0 && `PV ${bloco.pv}`
  ].filter(Boolean)
  const grupos = [...new Set(opcoes.map((o) => o.grupo))]

  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <Portrait name={entity.name} src={entity.portraitUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{entity.name}</div>
          <div className="truncate text-xs text-muted">
            {KIND_LABEL[entity.kind].one}
            {entity.isPlayer && ' · PJ'}
            {entity.role && ` · ${entity.role}`}
            {extra.length > 0 && ` · ${extra.join(' · ')}`}
          </div>
        </div>
        <SaveIndicator state={autosave.state} error={autosave.error} />
        {opcoes.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Dices className="size-4" />}
            aria-label={`Rolar por ${entity.name}`}
            title="Rolar"
            onClick={() => setEscolher(true)}
          />
        )}
        {aoEntrar && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Swords className="size-4" />}
            aria-label={`Pôr ${entity.name} na iniciativa`}
            title="Pôr na iniciativa"
            disabled={!sessionId}
            onClick={() => aoEntrar(entity)}
          />
        )}
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
      {escolher && (
        <EscolherRolagem
          nome={entity.name}
          grupos={grupos.map((g) => ({
            grupo: g,
            opcoes: opcoes.filter((o) => o.grupo === g)
          }))}
          aoFechar={() => setEscolher(false)}
          aoEscolher={(p) => {
            setEscolher(false)
            setPedido(p)
          }}
        />
      )}
      {pedido && (
        <JanelaRolagem
          pedido={pedido}
          entityId={entity.id}
          sessionId={sessionId}
          fisicos={rolaFisico(entity)}
          aoFechar={() => setPedido(null)}
          aoGastarPe={(custo) =>
            a &&
            salvar({
              ...entity,
              sheetData: { ...a, peAtual: Math.max(0, a.peAtual - custo) }
            })
          }
        />
      )}
    </li>
  )
}

function EscolherRolagem({
  nome,
  grupos,
  aoFechar,
  aoEscolher
}: {
  nome: string
  grupos: { grupo: string; opcoes: ReturnType<typeof opcoesDeRolagem> }[]
  aoFechar: () => void
  aoEscolher: (p: PedidoRolagem) => void
}) {
  const [q, setQ] = useState('')
  const filtro = q.trim().toLowerCase()
  return (
    <Dialog open onOpenChange={(o) => !o && aoFechar()} title={`Rolar por ${nome}`} footer={<Button onClick={aoFechar}>Fechar</Button>}>
      <div className="flex flex-col gap-3">
        <TextField label="Buscar" placeholder="Luta, Reflexos, Agredir…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
          {grupos.map(({ grupo, opcoes }) => {
            const lista = opcoes.filter((o) => o.nome.toLowerCase().includes(filtro))
            if (!lista.length) return null
            return (
              <section key={grupo} aria-label={grupo}>
                <h3 className="type-label mb-1 text-muted">{grupo}</h3>
                <div className="flex flex-wrap gap-1">
                  {lista.map((o) => {
                    const t = o.pedido.teste
                    const resumo = t
                      ? `${t.quantidade}d20${t.regra === 'menor' ? ' (menor)' : ''}${t.bonus ? sinal(t.bonus) : ''}`
                      : o.pedido.dano?.opcoes[0]?.partes[0]?.expressao
                    return (
                      <Button key={`${grupo}:${o.nome}`} size="sm" variant="ghost" aria-label={`Rolar ${o.nome}`} onClick={() => aoEscolher(o.pedido)}>
                        {o.nome}
                        {resumo && <span className="ml-1 font-mono text-xs text-subtle">{resumo}</span>}
                      </Button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
