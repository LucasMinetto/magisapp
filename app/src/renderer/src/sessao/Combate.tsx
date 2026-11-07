// T10b: modo combate da tela de Sessão. À esquerda a ordem de iniciativa, enxuta; à direita o cartão de um
// combatente com tudo dele (PV, rolagens, condições, bloco). O cartão mostra quem está na vez; clicar numa linha
// da ordem mostra outro sem passar a vez. Base: PainelIniciativa e CartaoInstancia do taberna.
import { BookOpen, ChevronLeft, ChevronRight, Dices, ExternalLink, ListOrdered, Plus, Swords, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CONDICOES } from '@shared/ordem/regras'
import { anterior, ordenar, proximo, remover, SEM_COMBATE, type Combatente } from '@shared/ordem/sessao'
import type { Entity, EntityKind } from '@shared/types'
import { BlocoAmeaca } from '@/ameaca/BlocoAmeaca'
import type { PedidoRolagem } from '@/ficha/contexto'
import { useLoad } from '@/lib/data'
import { Button, Chip, cx, Dialog, ErrorNote, Portrait, SaveIndicator } from '@/ui'
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

export function ModoCombate({ combate, sessionId, aoVerCena }: { combate: Combate; sessionId: string | null; aoVerCena: () => void }) {
  const { ini, alterar, mudar, adicionar, autosave } = combate
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [extra, setExtra] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const fichas = useFichasDaCampanha()
  // Passou a vez: o cartão volta a mostrar quem joga agora.
  useEffect(() => setEscolhido(null), [ini.turno, ini.rodada])

  const vez = ini.ordem[ini.turno]
  const mostrado = ini.ordem.find((c) => c.id === escolhido) ?? vez

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2">
        <Swords className="size-4 text-accent" aria-hidden />
        <h2 className="type-lg">Combate · Rodada {ini.rodada}</h2>
        {vez && <span className="text-sm text-muted">vez de {vez.nome}</span>}
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} onClick={() => (setEscolhido(null), alterar(anterior(ini)))}>
          Voltar a vez
        </Button>
        <Button size="sm" variant="primary" icon={<ChevronRight className="size-4" />} onClick={() => (setEscolhido(null), alterar(proximo(ini)))}>
          Próximo
        </Button>
        <Button size="sm" variant="ghost" icon={<BookOpen className="size-4" />} onClick={aoVerCena}>
          Ver a cena
        </Button>
        <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => alterar(SEM_COMBATE)}>
          Encerrar combate
        </Button>
      </div>
      {(erro || combate.error) && <ErrorNote message={(erro || combate.error)!} />}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)] gap-4">
        <section aria-label="Ordem de iniciativa" className="flex min-h-0 flex-col gap-2 overflow-auto">
          <div className="flex items-center justify-between">
            <span className="type-label text-muted">Iniciativa</span>
            <Button size="sm" variant="ghost" icon={<ListOrdered className="size-4" />} onClick={() => (setEscolhido(null), alterar(ordenar(ini)))}>
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
                    'flex items-center gap-2 rounded-md border px-2 py-1.5',
                    naVez ? 'border-accent bg-surface-raised' : 'border-border bg-surface',
                    mostrado?.id === c.id && !naVez && 'border-border-input',
                    caiu && 'opacity-60'
                  )}
                >
                  <input
                    type="number"
                    aria-label={`Iniciativa de ${c.nome}`}
                    value={c.valor}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => mudar(c.id, { valor: Number(e.target.value) || 0 })}
                    className={cx(
                      'h-7 w-12 rounded-md border border-border-input bg-bg px-1 text-center font-mono text-sm font-semibold',
                      naVez && 'text-accent'
                    )}
                  />
                  <button
                    type="button"
                    aria-pressed={mostrado?.id === c.id}
                    aria-label={`Ver ${c.nome}`}
                    onClick={() => setEscolhido(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 text-left hover:bg-surface-raised"
                  >
                    <span className={cx('min-w-0 flex-1 truncate text-sm', naVez && 'font-semibold text-accent')}>{c.nome}</span>
                    {c.condicoes.length > 0 && <span className="size-1.5 rounded-full bg-warning" title={c.condicoes.join(', ')} aria-hidden />}
                    {c.pv && <span className={cx('font-mono text-xs', tomDe(c.pv.atual, c.pv.max))}>{caiu ? 'caiu' : `${c.pv.atual}/${c.pv.max}`}</span>}
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
              {(fichas.data ?? []).map((f) => (
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
        </section>

        <section aria-label="Combatente" className="min-h-0 overflow-auto">
          {mostrado ? (
            <CartaoCombatente key={mostrado.id} c={mostrado} naVez={mostrado.id === vez?.id} combate={combate} sessionId={sessionId} />
          ) : (
            <p className="text-sm text-subtle">Ninguém na ordem.</p>
          )}
        </section>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ cartão do combatente

function CartaoCombatente({ c, naVez, combate, sessionId }: { c: Combatente; naVez: boolean; combate: Combate; sessionId: string | null }) {
  return (
    <div className={cx('flex flex-col gap-4 rounded-lg border bg-surface p-4', naVez ? 'border-accent' : 'border-border')} aria-label={`Cartão de ${c.nome}`}>
      {c.entityId ? (
        <ComFicha c={c} naVez={naVez} combate={combate} sessionId={sessionId} id={c.entityId} />
      ) : (
        <Cabecalho nome={c.nome} naVez={naVez} resumo="Sem ficha" />
      )}
      {!c.entityId && <PvDoCombatente c={c} combate={combate} />}
      {!c.entityId && <Condicoes nome={c.nome} ativas={c.condicoes} aoMudar={(condicoes) => combate.mudar(c.id, { condicoes })} />}
    </div>
  )
}

function Cabecalho({ nome, naVez, resumo, entity }: { nome: string; naVez: boolean; resumo: string; entity?: Entity }) {
  return (
    <div className="flex items-center gap-3">
      <Portrait name={nome} src={entity?.portraitUrl} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="type-lg truncate">{nome}</h3>
          {naVez && <Chip tone="success">na vez</Chip>}
        </div>
        <div className="truncate text-sm text-muted">{resumo}</div>
      </div>
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

function ComFicha({ c, naVez, combate, sessionId, id }: { c: Combatente; naVez: boolean; combate: Combate; sessionId: string | null; id: string }) {
  const { entity, salvar, autosave } = useFichaViva(id)
  const [pedido, setPedido] = useState<{ p: PedidoRolagem; iniciativa?: boolean } | null>(null)
  if (!entity) return null
  const a = fichaCompleta(entity)
  const bloco = blocoDe(entity)
  const { barras, somar } = recursos(entity, salvar)
  const testeIni = pedidoDeIniciativa(entity)
  const opcoes = opcoesDeRolagem(entity)

  return (
    <>
      <Cabecalho nome={c.nome} naVez={naVez} resumo={resumoDaFicha(entity)} entity={entity} />
      <div className="flex flex-col gap-2">
        {c.pv && <PvDoCombatente c={c} combate={combate} machucado={bloco?.pvMachucado ?? 0} />}
        {barras.map((b) => (
          <Contador key={b.chave} b={b} nome={c.nome} grande={b.rotulo === 'PV'} aoSomar={(d) => somar(b.chave, d)} />
        ))}
        <SaveIndicator state={autosave.state} error={autosave.error} />
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="type-label text-muted">Rolar</h4>
        <div className="flex flex-wrap gap-1">
          {testeIni && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Dices className="size-4" />}
              onClick={() => setPedido({ p: { ...testeIni, rotulo: `Iniciativa de ${c.nome}` }, iniciativa: true })}
            >
              Iniciativa <span className="ml-1 font-mono text-xs text-subtle">{resumoDoPedido(testeIni)}</span>
            </Button>
          )}
          {/* A ameaça tem poucas rolagens: ficam à mostra. O agente tem as perícias todas: abre a lista. */}
          {bloco &&
            opcoes
              .filter((o) => o.nome !== 'Iniciativa')
              .map((o) => (
                <Button
                  key={`${o.grupo}:${o.nome}`}
                  size="sm"
                  variant="ghost"
                  aria-label={`Rolar ${o.nome} de ${c.nome}`}
                  onClick={() => setPedido({ p: o.pedido })}
                >
                  {o.nome} <span className="ml-1 font-mono text-xs text-subtle">{resumoDoPedido(o.pedido)}</span>
                </Button>
              ))}
          {a && (
            <BotaoRolar entity={entity} sessionId={sessionId} salvar={salvar}>
              Perícia…
            </BotaoRolar>
          )}
          {!opcoes.length && <span className="text-sm text-subtle">A ficha não tem testes para rolar daqui.</span>}
        </div>
      </div>

      <Condicoes
        nome={c.nome}
        ativas={a ? a.condicoes : c.condicoes}
        aoMudar={(condicoes) => (a ? salvar({ ...entity, sheetData: { ...a, condicoes } }) : combate.mudar(c.id, { condicoes }))}
      />

      {bloco && (
        <details className="rounded-md border border-border bg-bg px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted hover:text-fg">Bloco completo de {entity.name}</summary>
          <div className="mt-2">
            <BlocoAmeaca a={bloco} nome={entity.name} compacto />
          </div>
        </details>
      )}

      {pedido && (
        <Rolagem
          entity={entity}
          sessionId={sessionId}
          salvar={salvar}
          pedido={pedido.p}
          aoFechar={() => setPedido(null)}
          aoTotal={pedido.iniciativa ? (valor) => combate.mudar(c.id, { valor }) : undefined}
        />
      )}
    </>
  )
}

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

function Condicoes({ nome, ativas, aoMudar }: { nome: string; ativas: string[]; aoMudar: (c: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="type-label text-muted">Condições</h4>
      <div className="flex flex-wrap items-center gap-1">
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
    </div>
  )
}
