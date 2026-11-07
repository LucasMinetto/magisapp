// Modo combate da tela de Sessão (T10b, redesenhado na #18). Três colunas, tudo à vista ao mesmo tempo:
// - a ordem de iniciativa, enxuta;
// - as fichas das ameaças e NPCs, fixas (alfinete), com as cópias da mesma ameaça numa ficha só e o PV de cada cópia;
// - os cartões dos agentes dos jogadores, com PV/PE/SAN, Defesa, condições e o que usam no combate.
// Quem está na vez ganha destaque forte onde quer que esteja. Cada combatente leva `data-alvo` com o id dele: é o
// gancho da #13 (escolher o alvo de um ataque, dano ou ritual).
import { BookOpen, ChevronLeft, ChevronRight, Dices, ExternalLink, ListOrdered, Pin, PinOff, Plus, Sparkles, Swords, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Acao, FichaAgente, Item } from '@shared/ordem/esquemas'
import { CONDICOES, derivados } from '@shared/ordem/regras'
import { agrupar, alternarFixa, anterior, lerAcao, ordenar, proximo, remover, SEM_COMBATE, type Combatente, type Grupo } from '@shared/ordem/sessao'
import type { Entity, EntityKind, EntitySummary } from '@shared/types'
import type { PedidoRolagem } from '@/ficha/contexto'
import { rolagemDoRitual, rolagensDoAtaque } from '@/ficha/pedidos'
import { useLoad } from '@/lib/data'
import { Button, cx, Dialog, ErrorNote, Portrait, SaveIndicator } from '@/ui'
import type { Combate } from './Iniciativa'
import { BotaoRolar, Contador, passo, recursos, resumoDaFicha, resumoDoPedido, Rolagem, tomDe, useFichaViva } from './NaCena'
import { blocoDe, fichaCompleta, opcoesDeRolagem, pedidoDeIniciativa } from './rolagens'

type Pessoa = { id: string; name: string; kind: EntityKind }

const useFichasDaCampanha = () =>
  useLoad(async () => {
    const [p, a] = await Promise.all([window.api.entities.list({ kind: 'personagem' }), window.api.entities.list({ kind: 'ameaca' })])
    return [...p, ...a]
  }, [])

// ------------------------------------------------------------ começar

/** Escolher quem entra no combate: quem está na cena já vem marcado; ameaça pode entrar em várias cópias. */
export function ComecarCombate({ naCena, aoComecar, aoFechar }: { naCena: Pessoa[]; aoComecar: (lista: Entity[]) => void; aoFechar: () => void }) {
  const fichas = useFichasDaCampanha()
  const [pessoas, setPessoas] = useState<Pessoa[]>(naCena)
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(naCena.map((p) => [p.id, 1])))
  const [extra, setExtra] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const escolhidos = pessoas.filter((p) => (qtd[p.id] ?? 0) > 0)

  const comecar = async () => {
    if (!escolhidos.length) return setErro('Escolha pelo menos um combatente.')
    try {
      const fichasCompletas = await Promise.all(escolhidos.map((p) => window.api.entities.get(p.id)))
      aoComecar(fichasCompletas.flatMap((e) => Array.from({ length: e.kind === 'ameaca' ? qtd[e.id] : 1 }, () => e)))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && aoFechar()}
      title="Começar combate"
      description="Quem está na cena já vem marcado. Ameaças podem entrar em mais de uma cópia, cada uma com o próprio PV."
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<Swords className="size-4" />} onClick={() => void comecar()}>
            Começar com {escolhidos.reduce((s, p) => s + (p.kind === 'ameaca' ? qtd[p.id] : 1), 0)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {pessoas.length === 0 && <p className="text-sm text-subtle">Ninguém citado na cena. Escolha as fichas abaixo.</p>}
        <ul className="flex flex-col gap-1" aria-label="Quem entra no combate">
          {pessoas.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
              <input
                type="checkbox"
                id={`entra-${p.id}`}
                checked={(qtd[p.id] ?? 0) > 0}
                onChange={(e) => setQtd({ ...qtd, [p.id]: e.target.checked ? 1 : 0 })}
              />
              <label htmlFor={`entra-${p.id}`} className="min-w-0 flex-1 truncate text-sm">
                {p.name}
                <span className="text-xs text-subtle">{p.kind === 'ameaca' ? ' · ameaça' : ''}</span>
              </label>
              {p.kind === 'ameaca' && (qtd[p.id] ?? 0) > 0 && (
                <label className="flex items-center gap-1 text-xs text-muted">
                  Cópias
                  <input
                    type="number"
                    min={1}
                    max={20}
                    aria-label={`Cópias de ${p.name}`}
                    value={qtd[p.id]}
                    onChange={(e) => setQtd({ ...qtd, [p.id]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                    className="h-7 w-12 rounded-md border border-border-input bg-bg px-1 text-center font-mono text-sm"
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <label className="sr-only" htmlFor="combate-extra">
            Outra ficha para o combate
          </label>
          <select
            id="combate-extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus"
          >
            <option value="">Outra ficha…</option>
            {(fichas.data ?? [])
              .filter((f) => !pessoas.some((p) => p.id === f.id))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.kind === 'ameaca' ? ' (ameaça)' : ''}
                </option>
              ))}
          </select>
          <Button
            size="sm"
            icon={<Plus className="size-4" />}
            onClick={() => {
              const f = fichas.data?.find((x) => x.id === extra)
              if (!f) return
              setPessoas([...pessoas, { id: f.id, name: f.name, kind: f.kind }])
              setQtd({ ...qtd, [f.id]: 1 })
              setExtra('')
            }}
          >
            Pôr na lista
          </Button>
        </div>
        {erro && <ErrorNote message={erro} />}
      </div>
    </Dialog>
  )
}

// ------------------------------------------------------------ modo combate

/** Agente de jogador vai para a coluna dos agentes; o resto (ameaças, vilões, NPCs, sem ficha) para a das ameaças. */
const ehAgente = (c: Combatente, fichas: EntitySummary[]) => {
  const f = c.entityId ? fichas.find((x) => x.id === c.entityId) : null
  return !!f && f.kind === 'personagem' && f.isPlayer
}

export function ModoCombate({ combate, sessionId, aoVerCena }: { combate: Combate; sessionId: string | null; aoVerCena: () => void }) {
  const { ini, alterar, autosave } = combate
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const fichas = useFichasDaCampanha()
  // Passou a vez: some o destaque de quem foi escolhido na ordem.
  useEffect(() => setEscolhido(null), [ini.turno, ini.rodada])

  const vez = ini.ordem[ini.turno]
  const lista = fichas.data ?? []
  const agentes = ini.ordem.filter((c) => ehAgente(c, lista))
  const grupos = agrupar(ini.ordem.filter((c) => !ehAgente(c, lista)))
  const tem = (g: Grupo, id: string | null | undefined) => !!id && g.combatentes.some((c) => c.id === id)
  // Ficha desafixada aparece enquanto é a vez dela ou quando o mestre a escolhe na ordem.
  const fixa = (g: Grupo) => !ini.desafixadas.includes(g.chave)
  const visiveis = grupos.filter((g) => fixa(g) || tem(g, vez?.id) || tem(g, escolhido))
  const guardadas = grupos.filter((g) => !visiveis.includes(g))
  const passar = (next: typeof ini) => (setEscolhido(null), alterar(next))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2">
        <Swords className="size-4 text-accent" aria-hidden />
        <h2 className="type-lg">Combate · Rodada {ini.rodada}</h2>
        {vez && (
          <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-on-accent" aria-live="polite">
            Vez de {vez.nome}
          </span>
        )}
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} onClick={() => passar(anterior(ini))}>
          Voltar a vez
        </Button>
        <Button size="sm" variant="primary" icon={<ChevronRight className="size-4" />} onClick={() => passar(proximo(ini))}>
          Próximo
        </Button>
        <Button size="sm" variant="ghost" icon={<BookOpen className="size-4" />} onClick={aoVerCena}>
          Ver a cena
        </Button>
        <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => alterar(SEM_COMBATE)}>
          Encerrar combate
        </Button>
      </div>
      {combate.error && <ErrorNote message={combate.error} />}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,0.6fr)_minmax(0,1.3fr)_minmax(300px,1fr)] gap-4">
        <OrdemDeIniciativa combate={combate} fichas={lista} escolhido={escolhido} aoEscolher={setEscolhido} />

        <section aria-labelledby="combate-ameacas-h" className="flex min-h-0 flex-col gap-3 overflow-auto pr-1">
          <h3 id="combate-ameacas-h" className="type-label text-muted">
            Ameaças e NPCs
          </h3>
          {grupos.length === 0 && <p className="text-sm text-subtle">Nenhuma ameaça no combate. Ponha uma pela ordem de iniciativa.</p>}
          {visiveis.map((g) => (
            <FichaDoGrupo
              key={g.chave}
              g={g}
              fixa={fixa(g)}
              vezId={vez?.id}
              escolhido={escolhido}
              combate={combate}
              sessionId={sessionId}
              aoAlfinete={() => alterar(alternarFixa(ini, g.chave))}
            />
          ))}
          {guardadas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-dashed border-border px-3 py-2">
              <span className="text-xs text-subtle">Desafixadas:</span>
              {guardadas.map((g) => (
                <Button key={g.chave} size="sm" variant="ghost" icon={<Pin className="size-3.5" />} aria-label={`Fixar ${nomeDoGrupo(g)}`} onClick={() => alterar(alternarFixa(ini, g.chave))}>
                  {nomeDoGrupo(g)}
                </Button>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="combate-agentes-h" className="flex min-h-0 flex-col gap-3 overflow-auto pr-1">
          <h3 id="combate-agentes-h" className="type-label text-muted">
            Agentes
          </h3>
          {agentes.length === 0 && <p className="text-sm text-subtle">Nenhum agente no combate.</p>}
          {agentes.map((c) => (
            <CartaoAgente key={c.id} c={c} naVez={c.id === vez?.id} escolhido={c.id === escolhido} combate={combate} sessionId={sessionId} />
          ))}
        </section>
      </div>
    </div>
  )
}

/** "Zumbi de Sangue ×3" para o grupo das cópias; o nome do combatente quando é um só. */
const nomeDoGrupo = (g: Grupo) =>
  g.combatentes.length > 1 ? `${g.combatentes[0].nome.replace(/ \d+$/, '')} ×${g.combatentes.length}` : g.combatentes[0].nome

/** Rola até o cartão quando é a vez dele ou quando foi escolhido na ordem. */
function useAparecer<T extends HTMLElement>(ativo: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (ativo) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [ativo])
  return ref
}

/** Selo de quem está na vez. */
const NaVez = () => <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">Na vez</span>

/** Contorno de quem está na vez (forte) ou de quem foi escolhido na ordem (leve). */
const destaque = (naVez: boolean, escolhido: boolean) =>
  naVez ? 'border-accent ring-2 ring-accent shadow-[inset_4px_0_0_var(--color-accent)]' : escolhido ? 'border-focus ring-1 ring-focus' : 'border-border'

// ------------------------------------------------------------ ordem de iniciativa

function OrdemDeIniciativa({
  combate,
  fichas,
  escolhido,
  aoEscolher
}: {
  combate: Combate
  fichas: EntitySummary[]
  escolhido: string | null
  aoEscolher: (id: string) => void
}) {
  const { ini, alterar, mudar, adicionar } = combate
  const [extra, setExtra] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const por = async () => {
    if (!extra) return
    setErro(null)
    try {
      adicionar([await window.api.entities.get(extra)])
      setExtra('')
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <section aria-label="Iniciativa" className="flex min-h-0 flex-col gap-2 overflow-auto">
      <div className="flex items-center justify-between">
        <h3 className="type-label text-muted">Iniciativa</h3>
        <Button size="sm" variant="ghost" icon={<ListOrdered className="size-4" />} onClick={() => alterar(ordenar(ini))}>
          Ordenar
        </Button>
      </div>
      <ol className="flex flex-col gap-1" aria-label="Ordem de iniciativa">
        {ini.ordem.map((c, n) => {
          const naVez = n === ini.turno
          const caiu = c.pv !== null && c.pv.max > 0 && c.pv.atual <= 0
          return (
            <li
              key={c.id}
              aria-current={naVez ? 'step' : undefined}
              className={cx(
                'flex items-center gap-1.5 rounded-md border px-1.5 py-1',
                naVez ? 'border-accent bg-accent/15' : escolhido === c.id ? 'border-focus bg-surface' : 'border-border bg-surface',
                caiu && 'opacity-60'
              )}
            >
              <input
                type="number"
                aria-label={`Iniciativa de ${c.nome}`}
                value={c.valor}
                onFocus={(e) => e.target.select()}
                onChange={(e) => mudar(c.id, { valor: Number(e.target.value) || 0 })}
                className={cx('h-7 w-11 shrink-0 rounded-md border border-border-input bg-bg px-1 text-center font-mono text-sm font-semibold', naVez && 'text-accent')}
              />
              <button
                type="button"
                aria-label={`Ver ${c.nome}`}
                onClick={() => aoEscolher(c.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left hover:bg-surface-raised"
              >
                <span className={cx('min-w-0 flex-1 truncate text-sm', naVez && 'font-semibold text-accent')}>{c.nome}</span>
                {c.condicoes.length > 0 && <span className="size-1.5 shrink-0 rounded-full bg-warning" title={c.condicoes.join(', ')} aria-hidden />}
                {c.pv && <span className={cx('shrink-0 font-mono text-xs', tomDe(c.pv.atual, c.pv.max))}>{caiu ? 'caiu' : `${c.pv.atual}/${c.pv.max}`}</span>}
              </button>
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
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="ini-add">
          Ficha para pôr na iniciativa
        </label>
        <select
          id="ini-add"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus"
        >
          <option value="">Pôr na iniciativa…</option>
          {fichas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.kind === 'ameaca' ? ' (ameaça)' : ''}
            </option>
          ))}
        </select>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => void por()}>
          Pôr
        </Button>
      </div>
      {erro && <ErrorNote message={erro} />}
    </section>
  )
}

// ------------------------------------------------------------ ficha fixa das ameaças e NPCs

type PedidoDoCombate = { p: PedidoRolagem; iniciativaDe?: string }
type Rolar = (p: PedidoRolagem, iniciativaDe?: string) => void

interface PropsGrupo {
  g: Grupo
  fixa: boolean
  vezId: string | undefined
  escolhido: string | null
  combate: Combate
  sessionId: string | null
  aoAlfinete: () => void
}

function FichaDoGrupo(props: PropsGrupo) {
  const { g, fixa, vezId, escolhido, combate, aoAlfinete } = props
  const naVez = g.combatentes.some((c) => c.id === vezId)
  const ref = useAparecer<HTMLElement>(naVez || g.combatentes.some((c) => c.id === escolhido))
  const nome = nomeDoGrupo(g)
  return (
    <article ref={ref} aria-label={`Ficha de ${nome}`} className={cx('flex flex-col gap-3 rounded-lg border bg-surface p-4', destaque(naVez, false))}>
      {g.entityId ? (
        <GrupoComFicha {...props} id={g.entityId} />
      ) : (
        <>
          <Topo nome={nome} resumo="Sem ficha" fixa={fixa} aoAlfinete={aoAlfinete} />
          <Copias g={g} vezId={vezId} escolhido={escolhido} combate={combate} />
        </>
      )}
    </article>
  )
}

function Topo({ nome, resumo, entity, fixa, aoAlfinete, extra }: { nome: string; resumo: string; entity?: Entity; fixa: boolean; aoAlfinete: () => void; extra?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Portrait name={nome} src={entity?.portraitUrl} size={64} />
      <div className="min-w-0 flex-1">
        <h4 className="type-lg truncate">{nome}</h4>
        <div className="truncate text-sm text-muted">{resumo}</div>
        {extra}
      </div>
      <button
        type="button"
        aria-pressed={fixa}
        aria-label={fixa ? `Desafixar ${nome}` : `Fixar ${nome}`}
        title={fixa ? 'Desafixar: a ficha só aparece na vez dela' : 'Fixar na tela'}
        onClick={aoAlfinete}
        className={cx('grid size-8 place-items-center rounded-md hover:bg-surface-raised', fixa ? 'text-accent' : 'text-subtle')}
      >
        {fixa ? <Pin className="size-4" aria-hidden /> : <PinOff className="size-4" aria-hidden />}
      </button>
      {entity && (
        <Link
          to={`/ficha/${entity.id}`}
          aria-label={`Abrir a ficha ${entity.name}`}
          title="Abrir a ficha"
          className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-raised hover:text-fg"
        >
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  )
}

function GrupoComFicha({ g, id, fixa, vezId, escolhido, combate, sessionId, aoAlfinete }: PropsGrupo & { id: string }) {
  const { entity, salvar, autosave } = useFichaViva(id)
  const [pedido, setPedido] = useState<PedidoDoCombate | null>(null)
  if (!entity) return null
  const bloco = blocoDe(entity)
  const a = fichaCompleta(entity)
  const nome = g.combatentes.length > 1 ? entity.name : g.combatentes[0].nome
  const rolar: Rolar = (p, iniciativaDe) => setPedido({ p, iniciativaDe })

  return (
    <>
      <Topo nome={nome} resumo={resumoDaFicha(entity)} entity={entity} fixa={fixa} aoAlfinete={aoAlfinete} extra={<SaveIndicator state={autosave.state} error={autosave.error} />} />
      {bloco ? (
        <>
          <Defesas
            itens={[
              ['Defesa', bloco.defesa ? String(bloco.defesa) : ''],
              ['Resistências', bloco.resistencias],
              ['Vulnerabilidades', bloco.vulnerabilidades],
              ['Imunidades', bloco.imunidades],
              ['Deslocamento', bloco.deslocamento],
              ['Presença perturbadora', bloco.presencaDt ? `DT ${bloco.presencaDt}${bloco.presencaDano ? `, ${bloco.presencaDano}` : ''}` : '']
            ]}
          />
          <Copias g={g} vezId={vezId} escolhido={escolhido} combate={combate} machucado={bloco.pvMachucado} iniciativa={pedidoDeIniciativa(entity)} aoRolar={rolar} />
          <TestesDoBloco entity={entity} aoRolar={rolar} />
          <AcoesDoBloco titulo="Ações" lista={bloco.acoes} nome={nome} aoRolar={rolar} />
          <AcoesDoBloco titulo="Habilidades" lista={bloco.habilidades} nome={nome} aoRolar={rolar} />
          {bloco.enigma && (
            <p className="text-sm text-muted">
              <b className="text-fg">Enigma de Medo:</b> {bloco.enigma}
            </p>
          )}
        </>
      ) : (
        // Vilão ou NPC: um combatente só, com a ficha dele.
        g.combatentes.map((c) => (
          <div key={c.id} data-alvo={c.id} aria-label={`Cartão de ${c.nome}`} className="flex flex-col gap-3">
            {a ? (
              <CorpoAgente c={c} entity={entity} a={a} salvar={salvar} combate={combate} sessionId={sessionId} aoRolar={rolar} />
            ) : (
              <CorpoCompacto c={c} entity={entity} salvar={salvar} combate={combate} sessionId={sessionId} aoRolar={rolar} />
            )}
          </div>
        ))
      )}
      {pedido && (
        <Rolagem
          entity={entity}
          sessionId={sessionId}
          salvar={salvar}
          pedido={pedido.p}
          aoFechar={() => setPedido(null)}
          aoTotal={pedido.iniciativaDe ? (valor) => combate.mudar(pedido.iniciativaDe!, { valor }) : undefined}
        />
      )}
    </>
  )
}

/** Defesa, resistências e o que mais o mestre consulta a cada golpe. Só mostra o que a ficha tem. */
function Defesas({ itens }: { itens: [string, string][] }) {
  const cheios = itens.filter(([, v]) => v.trim())
  if (!cheios.length) return null
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-surface-raised px-3 py-2 text-sm">
      {cheios.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className={cx(k === 'Defesa' && 'font-mono text-base font-semibold')}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** As cópias da ameaça na mesma ficha, cada uma com o próprio PV, condições e iniciativa. */
function Copias({
  g,
  vezId,
  escolhido,
  combate,
  machucado = 0,
  iniciativa,
  aoRolar
}: {
  g: Grupo
  vezId: string | undefined
  escolhido: string | null
  combate: Combate
  machucado?: number
  iniciativa?: PedidoRolagem | null
  aoRolar?: Rolar
}) {
  return (
    <ul aria-label={`Cópias de ${nomeDoGrupo(g)}`} className="flex flex-col gap-2">
      {g.combatentes.map((c) => {
        const naVez = c.id === vezId
        return (
          <li
            key={c.id}
            data-alvo={c.id}
            aria-label={`Cartão de ${c.nome}`}
            className={cx(
              'flex flex-col gap-2 rounded-md border px-3 py-2',
              // A ficha inteira já tem o contorno forte; a cópia na vez só ganha o fundo.
              naVez ? 'border-accent bg-accent/10' : c.id === escolhido ? 'border-focus bg-bg' : 'border-border bg-bg'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cx('min-w-0 flex-1 truncate text-sm font-semibold', naVez && 'text-accent')}>{c.nome}</span>
              {naVez && <NaVez />}
              {iniciativa && aoRolar && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Dices className="size-4" />}
                  aria-label={`Rolar iniciativa de ${c.nome}`}
                  onClick={() => aoRolar({ ...iniciativa, rotulo: `Iniciativa de ${c.nome}` }, c.id)}
                >
                  Iniciativa <span className="ml-1 font-mono text-xs text-subtle">{resumoDoPedido(iniciativa)}</span>
                </Button>
              )}
            </div>
            <PvDoCombatente c={c} combate={combate} machucado={machucado} />
            <Condicoes nome={c.nome} ativas={c.condicoes} aoMudar={(condicoes) => combate.mudar(c.id, { condicoes })} />
          </li>
        )
      })}
    </ul>
  )
}

function TestesDoBloco({ entity, aoRolar }: { entity: Entity; aoRolar: Rolar }) {
  const testes = opcoesDeRolagem(entity).filter((o) => o.grupo === 'Testes' && o.nome !== 'Iniciativa')
  if (!testes.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="type-label mr-1 text-muted">Testes</span>
      {testes.map((o) => (
        <Button key={o.nome} size="sm" variant="ghost" aria-label={`Rolar ${o.nome} de ${entity.name}`} onClick={() => aoRolar(o.pedido)}>
          {o.nome} <span className="ml-1 font-mono text-xs text-subtle">{resumoDoPedido(o.pedido)}</span>
        </Button>
      ))}
    </div>
  )
}

/** Ações e habilidades do bloco com o texto inteiro à vista e o botão de rolar quando há teste ou dano. */
function AcoesDoBloco({ titulo, lista, nome, aoRolar }: { titulo: string; lista: Acao[]; nome: string; aoRolar: Rolar }) {
  if (!lista.length) return null
  return (
    <section aria-label={`${titulo} de ${nome}`} className="flex flex-col gap-1.5">
      <h5 className="type-label text-muted">{titulo}</h5>
      <ul className="flex flex-col gap-1.5">
        {lista.map((acao, i) => {
          const { teste, dano } = lerAcao(acao.descricao)
          const pedido: PedidoRolagem | null =
            teste || dano
              ? {
                  rotulo: acao.nome || 'Ação',
                  tipo: teste ? 'ataque' : 'dano',
                  ...(teste && { teste }),
                  ...(dano && { dano: { opcoes: [{ nome: 'Dano', partes: [dano] }] } })
                }
              : null
          return (
            <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-semibold">
                  {acao.nome || 'Ação'}
                  {acao.tipo && <span className="ml-1 text-xs font-normal text-subtle">({acao.tipo})</span>}
                </span>
                <SlotAlvo />
                {pedido && (
                  <Button size="sm" variant="ghost" icon={<Dices className="size-4" />} aria-label={`Rolar ${acao.nome || 'ação'} de ${nome}`} onClick={() => aoRolar(pedido)}>
                    <span className="font-mono text-xs">{resumoDoPedido(pedido)}</span>
                  </Button>
                )}
              </div>
              {acao.descricao && <p className="mt-0.5 whitespace-pre-line text-muted">{acao.descricao}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Lugar reservado para escolher o alvo de um ataque, dano ou ritual. Vazio até a #13: ela põe aqui a escolha entre
 * `alvosDoCombate(ini)` (cada combatente pelo `data-alvo`) e desconta as resistências. Fica no mesmo lugar em todas
 * as ações para o layout não mudar quando ela chegar.
 */
function SlotAlvo() {
  return null
}

// ------------------------------------------------------------ cartões dos agentes

function CartaoAgente({ c, naVez, escolhido, combate, sessionId }: { c: Combatente; naVez: boolean; escolhido: boolean; combate: Combate; sessionId: string | null }) {
  const ref = useAparecer<HTMLElement>(naVez || escolhido)
  const { entity, salvar, autosave } = useFichaViva(c.entityId!)
  const [pedido, setPedido] = useState<PedidoDoCombate | null>(null)
  if (!entity) return null
  const a = fichaCompleta(entity)
  const rolar: Rolar = (p, iniciativaDe) => setPedido({ p, iniciativaDe })
  return (
    <article ref={ref} data-alvo={c.id} aria-label={`Cartão de ${c.nome}`} className={cx('flex flex-col gap-2.5 rounded-lg border bg-surface p-3', destaque(naVez, escolhido))}>
      <div className="flex items-center gap-2.5">
        <Portrait name={entity.name} src={entity.portraitUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className={cx('truncate font-semibold', naVez && 'text-accent')}>{entity.name}</h4>
            {naVez && <NaVez />}
          </div>
          <div className="truncate text-xs text-muted">{[a?.jogador, a?.classe && `${a.classe} NEX ${a.nex}%`].filter(Boolean).join(' · ') || resumoDaFicha(entity)}</div>
        </div>
        {a && (
          <div className="text-center" title="Defesa">
            <div className="font-mono text-lg leading-none font-semibold">{derivados(a).defesa.total}</div>
            <div className="text-[11px] text-muted">Defesa</div>
          </div>
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
      <SaveIndicator state={autosave.state} error={autosave.error} />
      {a ? (
        <CorpoAgente c={c} entity={entity} a={a} salvar={salvar} combate={combate} sessionId={sessionId} aoRolar={rolar} semDefesa />
      ) : (
        <CorpoCompacto c={c} entity={entity} salvar={salvar} combate={combate} sessionId={sessionId} aoRolar={rolar} />
      )}
      {pedido && (
        <Rolagem
          entity={entity}
          sessionId={sessionId}
          salvar={salvar}
          pedido={pedido.p}
          aoFechar={() => setPedido(null)}
          aoTotal={pedido.iniciativaDe ? (valor) => combate.mudar(pedido.iniciativaDe!, { valor }) : undefined}
        />
      )}
    </article>
  )
}

interface Corpo {
  c: Combatente
  entity: Entity
  salvar: (e: Entity) => void
  combate: Combate
  sessionId: string | null
  aoRolar: Rolar
}

const TIPOS_DE_COMBATE = ['Arma', 'Proteção', 'Munição', 'Amaldiçoado']
const ehComponente = (i: Item) => /componente/i.test(i.nome)
/** Do inventário, o que conta no combate: armas, proteção, munição, amaldiçoados, componentes e o que está equipado. */
const itensDeCombate = (inv: Item[]) => inv.filter((i) => i.equipado || TIPOS_DE_COMBATE.includes(i.tipo) || ehComponente(i))

const pilula = 'rounded-md border border-border-input bg-surface-raised px-2 py-0.5 font-mono text-xs hover:border-accent hover:text-fg'

/** Status e arsenal de quem tem ficha completa (agente ou vilão). */
function CorpoAgente({ c, entity, a, salvar, sessionId, aoRolar, semDefesa }: Corpo & { a: FichaAgente; semDefesa?: boolean }) {
  const { barras, somar } = recursos(entity, salvar)
  const testeIni = pedidoDeIniciativa(entity)
  const itens = itensDeCombate(a.inventario)
  return (
    <>
      {!semDefesa && <Defesas itens={[['Defesa', String(derivados(a).defesa.total)]]} />}
      <div className="flex flex-col gap-1.5">
        {barras.map((b) => (
          <Contador key={b.chave} b={b} nome={c.nome} grande={b.rotulo === 'PV'} aoSomar={(d) => somar(b.chave, d)} />
        ))}
      </div>
      <Condicoes nome={c.nome} ativas={a.condicoes} aoMudar={(condicoes) => salvar({ ...entity, sheetData: { ...a, condicoes } })} />

      {a.ataques.length > 0 && (
        <Arsenal titulo="Ataques" nome={c.nome}>
          {a.ataques.map((at) => {
            const r = rolagensDoAtaque(a, at)
            return (
              <li key={at.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-sm" title={[at.pericia, at.alcance, r.tipos].filter(Boolean).join(', ')}>
                  {at.nome}
                  {r.tipos && <span className="ml-1 text-xs text-subtle">{r.tipos}</span>}
                </span>
                <SlotAlvo />
                <button type="button" className={pilula} aria-label={`Rolar ataque de ${at.nome}`} onClick={() => aoRolar(r.ataque.pedido)}>
                  {r.ataque.texto}
                </button>
                <button type="button" className={pilula} aria-label={`Rolar dano de ${at.nome}`} onClick={() => aoRolar(r.dano.pedido)}>
                  {r.dano.texto || 'Dano'}
                </button>
                <span className="font-mono text-xs text-subtle" title="Crítico">
                  {r.critico}
                </span>
              </li>
            )
          })}
        </Arsenal>
      )}

      {a.rituais.length > 0 && (
        <Arsenal titulo="Rituais" nome={c.nome}>
          {a.rituais.map((ritual) => {
            const { custo, pedido } = rolagemDoRitual(ritual)
            return (
              <li key={ritual.id} className="flex items-center gap-2">
                <Sparkles className="size-3.5 shrink-0 text-subtle" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm" title={ritual.efeito}>
                  {ritual.nome}
                  <span className="ml-1 text-xs text-subtle">
                    {ritual.circulo}º{ritual.elemento ? `, ${ritual.elemento}` : ''}
                  </span>
                </span>
                <SlotAlvo />
                <span className={cx('font-mono text-xs', a.peAtual < custo ? 'text-danger' : 'text-warning')}>{custo} PE</span>
                <button type="button" className={pilula} aria-label={`Conjurar ${ritual.nome}`} onClick={() => aoRolar(pedido)}>
                  Conjurar
                </button>
              </li>
            )
          })}
        </Arsenal>
      )}

      {itens.length > 0 && (
        <Arsenal titulo="Itens" nome={c.nome}>
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={i.descricao}>
                {i.nome}
                {i.quantidade > 1 && <span className="ml-1 font-mono text-xs text-muted">×{i.quantidade}</span>}
              </span>
              <span className={cx('text-xs', ehComponente(i) ? 'text-accent' : 'text-subtle')}>
                {ehComponente(i) ? 'componente' : [i.tipo, i.equipado && 'equipado'].filter(Boolean).join(', ')}
              </span>
            </li>
          ))}
        </Arsenal>
      )}

      <div className="flex flex-wrap gap-1">
        {testeIni && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Dices className="size-4" />}
            aria-label={`Rolar iniciativa de ${c.nome}`}
            onClick={() => aoRolar({ ...testeIni, rotulo: `Iniciativa de ${c.nome}` }, c.id)}
          >
            Iniciativa <span className="ml-1 font-mono text-xs text-subtle">{resumoDoPedido(testeIni)}</span>
          </Button>
        )}
        <BotaoRolar entity={entity} sessionId={sessionId} salvar={salvar}>
          Perícia…
        </BotaoRolar>
      </div>
    </>
  )
}

/** Ficha compacta (NPC comum ou agente sem ficha completa): os recursos marcados, condições e rolar. */
function CorpoCompacto({ c, entity, salvar, combate, sessionId }: Corpo) {
  const { barras, somar } = recursos(entity, salvar)
  return (
    <>
      <div className="flex flex-col gap-1.5">
        {barras.map((b) => (
          <Contador key={b.chave} b={b} nome={c.nome} grande={b.rotulo === 'PV'} aoSomar={(d) => somar(b.chave, d)} />
        ))}
        {!barras.length && <PvDoCombatente c={c} combate={combate} />}
      </div>
      <Condicoes nome={c.nome} ativas={c.condicoes} aoMudar={(condicoes) => combate.mudar(c.id, { condicoes })} />
      <BotaoRolar entity={entity} sessionId={sessionId} salvar={salvar}>
        Rolar…
      </BotaoRolar>
    </>
  )
}

function Arsenal({ titulo, nome, children }: { titulo: string; nome: string; children: ReactNode }) {
  return (
    <section aria-label={`${titulo} de ${nome}`} className="flex flex-col gap-1">
      <h5 className="type-label text-muted">{titulo}</h5>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  )
}

// ------------------------------------------------------------ PV e condições do combatente

/** PV de uma cópia de ameaça: −5/−1/+1/+5 e um campo para dano ou cura de qualquer tamanho. */
function PvDoCombatente({ c, combate, machucado = 0 }: { c: Combatente; combate: Combate; machucado?: number }) {
  const [quanto, setQuanto] = useState('')
  if (!c.pv) return null
  const pv = c.pv
  const somar = (d: number) => combate.mudar(c.id, { pv: { ...pv, atual: Math.min(pv.max, pv.atual + d) } })
  const alerta = pv.max > 0 && pv.atual <= 0 ? 'Caiu' : machucado > 0 && pv.atual <= machucado ? 'Machucado' : null
  const n = Math.abs(Number(quanto) || 0)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Contador b={{ chave: 'pv', rotulo: 'PV', atual: pv.atual, max: pv.max, alerta }} nome={c.nome} grande aoSomar={somar} />
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          aria-label={`Quanto de PV para ${c.nome}`}
          placeholder="23"
          value={quanto}
          onChange={(e) => setQuanto(e.target.value)}
          className="h-6 w-14 rounded-md border border-border-input bg-bg px-1 text-center font-mono text-xs"
        />
        <button type="button" className={passo} disabled={!n} onClick={() => (somar(-n), setQuanto(''))}>
          Dano
        </button>
        <button type="button" className={passo} disabled={!n} onClick={() => (somar(n), setQuanto(''))}>
          Cura
        </button>
      </div>
    </div>
  )
}

/** Condições escritas por extenso; clicar numa tira. */
function Condicoes({ nome, ativas, aoMudar }: { nome: string; ativas: string[]; aoMudar: (c: string[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Condições de ${nome}`}>
      {ativas.map((x) => (
        <button
          key={x}
          type="button"
          aria-label={`Tirar a condição ${x} de ${nome}`}
          onClick={() => aoMudar(ativas.filter((y) => y !== x))}
          className="flex items-center gap-1 rounded-full border border-warning px-2 py-0.5 text-xs text-warning hover:bg-surface-raised"
        >
          {x} <X className="size-3" aria-hidden />
        </button>
      ))}
      <select
        aria-label={`Pôr condição em ${nome}`}
        value=""
        onChange={(e) => e.target.value && aoMudar([...ativas, e.target.value])}
        className="h-7 rounded-md border border-border-input bg-bg px-2 text-xs text-muted focus:border-focus"
      >
        <option value="">+ condição</option>
        {CONDICOES.filter((x) => !ativas.includes(x)).map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  )
}
