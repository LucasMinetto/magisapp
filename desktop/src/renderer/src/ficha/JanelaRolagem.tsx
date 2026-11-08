// Janela de rolagem (T7). Duas formas: o Magistrado rola, ou o mestre digita o que saiu nos dados físicos.
// No teste digita-se só o d20 que ficou; no dano, uma soma por tipo (cada alvo resiste a um tipo).
import { useState, type FormEvent, type ReactNode } from 'react'
import { useCampaign } from '@/campaign'
import { Button, cx, Dialog } from '@/ui'
import type { RolagemInput } from '@shared/ordem/esquemas'
import { descreverExpressao, faixaSoma, lerExpressao, resolverDano, resolverTeste, rolarDados, rolarExpressao } from '@shared/ordem/regras'
import { sinal, type PedidoRolagem } from './contexto'

type Modo = 'app' | 'fisico'
type Registro = Omit<RolagemInput, 'entityId' | 'sessionId' | 'quem'> & { rotulo: string; total: number }

interface Feita {
  id: string
  rotulo: string
  total: number
  critico: boolean
  detalhe: string
  // Dano separado por tipo, para mostrar "Balístico 9 · Energia 7".
  partes?: { tipo: string; valor: number }[]
}

const NOME_TIPO: Record<PedidoRolagem['tipo'], string> = { teste: 'Teste', ataque: 'Ataque', dano: 'Dano', ritual: 'Ritual', livre: 'Rolagem livre' }

export function JanelaRolagem({
  pedido,
  entityId,
  fisicos,
  aoFechar,
  aoGastarPe,
  sessionId = null,
  aoTotal
}: {
  pedido: PedidoRolagem
  entityId: string
  /** Abre em "digitar" (a caixa "Rola dados físicos" do personagem). */
  fisicos: boolean
  aoFechar: () => void
  aoGastarPe: (custo: number) => void
  /** Sessão de jogo em que a rolagem aconteceu (na tela de Sessão). */
  sessionId?: string | null
  /** Recebe o total de cada rolagem feita (a iniciativa usa para preencher o valor). */
  aoTotal?: (total: number) => void
}) {
  const { changed } = useCampaign()
  const [modo, setModo] = useState<Modo>(fisicos ? 'fisico' : 'app')
  const [etapa, setEtapa] = useState<'teste' | 'dano' | 'conjurar' | 'fim'>(pedido.teste ? 'teste' : pedido.dano ? 'dano' : 'conjurar')
  const [critico, setCritico] = useState(false)
  const [gastarPe, setGastarPe] = useState(!!pedido.custoPe)
  const [peGasto, setPeGasto] = useState(false)
  const [feitas, setFeitas] = useState<Feita[]>([])
  const [erro, setErro] = useState<string | null>(null)

  async function registrar(r: Registro, partes?: Feita['partes']) {
    setErro(null)
    try {
      const salvo = await window.api.rolls.add({ ...r, entityId, sessionId })
      aoTotal?.(salvo.total)
      if (gastarPe && pedido.custoPe && !peGasto) {
        aoGastarPe(pedido.custoPe)
        setPeGasto(true)
      }
      setFeitas((l) => [...l, { id: salvo.id, rotulo: salvo.label, total: salvo.total, critico: salvo.critical, detalhe: salvo.detail, partes }])
      changed()
      return true
    } catch (e) {
      setErro((e as Error).message)
      return false
    }
  }

  async function desfazer(id: string) {
    try {
      await window.api.rolls.remove(id)
      setFeitas((l) => l.filter((f) => f.id !== id))
      changed()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const ultima = feitas.at(-1)
  return (
    <Dialog
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title={pedido.rotulo || 'Rolagem'}
      description={NOME_TIPO[pedido.tipo]}
      footer={
        <Button variant={etapa === 'fim' ? 'primary' : 'ghost'} onClick={aoFechar}>
          {etapa === 'fim' ? 'Pronto' : 'Fechar'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {etapa !== 'fim' && (
          <div role="group" aria-label="Forma de rolar" className="grid grid-cols-2 gap-1 rounded-md bg-surface p-1">
            {(
              [
                ['app', 'O Magistrado rola'],
                ['fisico', 'Digitar dados físicos']
              ] as const
            ).map(([m, texto]) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={cx('h-8 rounded text-sm', modo === m ? 'bg-accent font-semibold text-on-accent' : 'text-muted hover:text-fg')}
              >
                {texto}
              </button>
            ))}
          </div>
        )}

        {pedido.custoPe ? (
          <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input type="checkbox" checked={gastarPe} disabled={peGasto} onChange={(e) => setGastarPe(e.target.checked)} className="size-4 accent-(--color-accent)" />
            {peGasto ? `${pedido.custoPe} PE gastos` : `Gastar ${pedido.custoPe} PE ao registrar`}
          </label>
        ) : null}

        {feitas.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Registradas">
            {feitas.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted">{f.rotulo}</span>
                <b className={cx('font-serif text-lg', f.critico && 'text-success')}>{f.total}</b>
                <button type="button" onClick={() => void desfazer(f.id)} aria-label={`Desfazer ${f.rotulo}`} className="rounded px-1.5 text-xs text-muted hover:bg-surface-raised hover:text-fg">
                  Desfazer
                </button>
              </li>
            ))}
          </ul>
        )}

        {ultima && <Resultado feita={ultima} />}

        {etapa === 'teste' && pedido.teste && (
          <EtapaTeste
            pedido={pedido}
            modo={modo}
            aoRegistrar={async (r) => {
              if (!(await registrar(r))) return
              if (pedido.dano) {
                setCritico(r.critico ?? false)
                setEtapa('dano')
              } else setEtapa('fim')
            }}
          />
        )}

        {etapa === 'dano' && pedido.dano && (
          <EtapaDano
            pedido={pedido}
            modo={modo}
            critico={critico}
            aoRegistrar={async (r, partes) => {
              if (await registrar(r, partes)) setEtapa('fim')
            }}
          />
        )}

        {etapa === 'conjurar' && (
          <Button
            variant="primary"
            onClick={async () => {
              const custo = pedido.custoPe ?? 0
              if (await registrar({ rotulo: pedido.rotulo, tipo: 'ritual', total: custo, detalhe: custo ? `Conjurou gastando ${custo} PE` : 'Conjurou' })) setEtapa('fim')
            }}
          >
            Conjurar
          </Button>
        )}

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
      </div>
    </Dialog>
  )
}

function Resultado({ feita }: { feita: Feita }) {
  const porTipo = feita.partes && feita.partes.length > 1
  return (
    <div role="status" aria-label="Resultado" className={cx('rounded-lg border-2 px-4 py-3 text-center', feita.critico ? 'border-success' : 'border-border')}>
      {porTipo ? (
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {feita.partes!.map((p, i) => (
            <div key={i}>
              <div className={cx('font-serif text-4xl font-bold', feita.critico && 'text-success')}>{p.valor}</div>
              <div className="text-xs text-muted">{p.tipo || 'Dano'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cx('font-serif text-5xl font-bold', feita.critico && 'text-success')}>{feita.total}</div>
      )}
      <div className="mt-1 text-xs text-muted">
        {porTipo && <>Total {feita.total} · </>}
        {feita.detalhe}
      </div>
      {feita.critico && <div className="mt-1 text-xs font-bold tracking-widest text-success uppercase">Crítico</div>}
    </div>
  )
}

// Campo de um número só (o d20 que ficou, ou a soma de um tipo de dano).
function CampoValor({ rotulo, ajuda, valor, aoMudar, invalido, foco }: { rotulo: string; ajuda: ReactNode; valor: string; aoMudar: (v: string) => void; invalido: boolean; foco?: boolean }) {
  return (
    <label className="flex items-center gap-3">
      <input
        autoFocus={foco}
        inputMode="numeric"
        value={valor}
        aria-label={rotulo}
        aria-invalid={invalido}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onFocus={(e) => e.target.select()}
        className={cx(
          'h-14 w-20 shrink-0 rounded-md border-2 bg-surface text-center font-serif text-3xl font-bold focus:outline-none',
          invalido ? 'border-danger text-danger' : 'border-border-input text-fg focus:border-accent'
        )}
      />
      <span className="text-sm">
        <span className="block font-semibold">{rotulo}</span>
        <span className={cx('block text-xs', invalido ? 'text-danger' : 'text-muted')}>{ajuda}</span>
      </span>
    </label>
  )
}

function EtapaTeste({ pedido, modo, aoRegistrar }: { pedido: PedidoRolagem; modo: Modo; aoRegistrar: (r: Registro) => Promise<void> }) {
  const t = pedido.teste!
  const margem = t.margem ?? 20
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const formula = `${t.quantidade}d20${t.bonus ? sinal(t.bonus) : ''}`
  const contas = (n: number) => `${n}${t.bonus ? ` ${t.bonus > 0 ? '+' : '−'} ${Math.abs(t.bonus)}` : ''}`
  const tipo = pedido.tipo === 'ataque' ? 'ataque' : pedido.tipo
  const n = Number(valor)
  const valido = valor !== '' && Number.isInteger(n) && n >= 1 && n <= 20
  const qual = t.quantidade > 1 ? (t.regra === 'maior' ? 'Maior d20' : 'Menor d20') : 'd20'

  async function enviar(r: Registro) {
    setSalvando(true)
    await aoRegistrar(r)
    setSalvando(false)
  }

  function digitado(e: FormEvent) {
    e.preventDefault()
    if (!valido || salvando) return
    const r = resolverTeste([n], 'maior', t.bonus, margem)
    void enviar({ rotulo: pedido.rotulo, tipo, formula, dados: [n], total: r.total, critico: r.critico, detalhe: `${qual} digitado: ${contas(n)}` })
  }

  function rolado() {
    const dados = rolarDados(t.quantidade, 20)
    const r = resolverTeste(dados, t.regra, t.bonus, margem)
    void enviar({ rotulo: pedido.rotulo, tipo, formula, dados, total: r.total, critico: r.critico, detalhe: `${t.regra} de [${dados.join(', ')}] = ${contas(r.escolhido)}` })
  }

  const regra = (
    <p className="text-sm text-muted">
      {t.quantidade}d20, vale o <b className="text-fg">{t.regra}</b>
      {t.bonus ? (
        <>
          {' '}
          e soma <b className="text-fg">{sinal(t.bonus)}</b>
        </>
      ) : null}
      .{margem < 20 && <> Crítico em {margem}+.</>}
    </p>
  )

  if (modo === 'app')
    return (
      <div className="flex flex-col gap-3">
        {regra}
        <Button variant="primary" disabled={salvando} onClick={rolado}>
          Rolar {formula}
        </Button>
      </div>
    )

  return (
    <form onSubmit={digitado} className="flex flex-col gap-3">
      {regra}
      <CampoValor
        foco
        rotulo={qual}
        ajuda={valor !== '' && !valido ? 'Digite um número de 1 a 20.' : t.quantidade > 1 ? `Role ${t.quantidade}d20 e digite só o ${t.regra}.` : 'Role 1d20 e digite o resultado.'}
        valor={valor}
        aoMudar={setValor}
        invalido={valor !== '' && !valido}
      />
      {valido && <p className="text-sm text-muted">Total: <b className="text-fg">{contas(n)} = {n + t.bonus}</b>{n >= margem && <b className="text-success"> · Crítico</b>}</p>}
      <Button type="submit" variant="primary" disabled={!valido || salvando}>
        Registrar
      </Button>
    </form>
  )
}

function EtapaDano({
  pedido,
  modo,
  critico,
  aoRegistrar
}: {
  pedido: PedidoRolagem
  modo: Modo
  critico: boolean
  aoRegistrar: (r: Registro, partes: Feita['partes']) => Promise<void>
}) {
  const dano = pedido.dano!
  const opcoes = dano.opcoes.filter((o) => o.partes.some((p) => p.expressao.trim()))
  const [opcao, setOpcao] = useState(0)
  const [usarCritico, setUsarCritico] = useState(critico)
  const multCritico = dano.mult ?? 2
  const mult = usarCritico ? multCritico : 1
  const escolhida = opcoes[opcao] ?? opcoes[0]

  return (
    <div className="flex flex-col gap-3">
      {dano.mult && (
        <div role="group" aria-label="Dano normal ou crítico" className="grid grid-cols-2 gap-2">
          <Button variant={usarCritico ? 'secondary' : 'primary'} aria-pressed={!usarCritico} onClick={() => setUsarCritico(false)}>
            Dano
          </Button>
          <Button variant={usarCritico ? 'primary' : 'secondary'} aria-pressed={usarCritico} onClick={() => setUsarCritico(true)}>
            Dano crítico ×{multCritico}
          </Button>
        </div>
      )}
      {opcoes.length > 1 && (
        <div role="group" aria-label="Forma" className="flex gap-2">
          {opcoes.map((o, i) => (
            <Button key={o.nome} size="sm" className="flex-1" variant={i === opcao ? 'primary' : 'secondary'} aria-pressed={i === opcao} onClick={() => setOpcao(i)}>
              {o.nome}
            </Button>
          ))}
        </div>
      )}
      {escolhida ? (
        <FormularioDano key={`${opcao}|${mult}|${modo}`} pedido={pedido} forma={opcoes.length > 1 ? escolhida.nome : undefined} partes={escolhida.partes} mult={mult} modo={modo} aoRegistrar={aoRegistrar} />
      ) : (
        <p className="text-sm text-muted">Sem dano para rolar.</p>
      )}
    </div>
  )
}

function FormularioDano({
  pedido,
  forma,
  partes: brutas,
  mult,
  modo,
  aoRegistrar
}: {
  pedido: PedidoRolagem
  forma?: string
  partes: { expressao: string; tipo: string }[]
  mult: number
  modo: Modo
  aoRegistrar: (r: Registro, partes: Feita['partes']) => Promise<void>
}) {
  // No crítico só a primeira parte (o dano da arma) multiplica; dados extras não.
  const partes = brutas
    .filter((p) => p.expressao.trim())
    .map((p, i) => {
      const expr = lerExpressao(p.expressao)
      const m = i === 0 ? mult : 1
      return { ...p, expr, m, faixa: faixaSoma(expr, m), temDados: expr.dados.length > 0 }
    })
  const [somas, setSomas] = useState<string[]>(partes.map(() => ''))
  const [salvando, setSalvando] = useState(false)
  const nums = somas.map(Number)
  const validos = partes.map((p, i) => !p.temDados || (somas[i] !== '' && Number.isInteger(nums[i]) && nums[i] >= p.faixa.min && nums[i] <= p.faixa.max))
  const pronto = validos.every(Boolean)

  const rotulo = forma ? `${pedido.rotulo} (${forma})` : `${pedido.rotulo}: ${mult > 1 ? 'dano crítico' : 'dano'}`
  const tipo = pedido.tipo === 'ritual' ? 'ritual' : 'dano'
  const formula = partes.map((p) => `${descreverExpressao(p.expr, p.m)}${p.tipo ? ` ${p.tipo}` : ''}`).join(' + ')

  async function enviar(valores: number[], dados: number[]) {
    setSalvando(true)
    const porTipo = partes.map((p, i) => ({ tipo: p.tipo, valor: valores[i] }))
    const total = valores.reduce((s, v) => s + v, 0)
    const detalhe = porTipo.map((p) => `${p.tipo || 'Dano'} ${p.valor}`).join(' + ')
    await aoRegistrar({ rotulo, tipo, formula, dados: dados.filter((d) => d >= 1 && d <= 1000), total, critico: mult > 1, detalhe }, porTipo)
    setSalvando(false)
  }

  function digitado(e: FormEvent) {
    e.preventDefault()
    if (!pronto || salvando) return
    void enviar(
      partes.map((p, i) => Math.max(0, (p.temDados ? nums[i] : 0) + p.expr.fixo)),
      partes.map((p, i) => (p.temDados ? nums[i] : 0))
    )
  }

  function rolado() {
    const grupos = partes.map((p) => rolarExpressao(p.expr, p.m))
    void enviar(
      partes.map((p, i) => resolverDano(p.expr, grupos[i], p.m)),
      grupos.flat(2)
    )
  }

  const lista = (
    <ul className="flex flex-col gap-1 text-sm text-muted">
      {partes.map((p, i) => (
        <li key={i}>
          <b className="font-mono text-fg">{descreverExpressao(p.expr, p.m)}</b> {p.tipo || 'sem tipo'}
          {i > 0 && mult > 1 && p.temDados && <span className="text-subtle"> (extra, não multiplica)</span>}
        </li>
      ))}
    </ul>
  )

  if (modo === 'app')
    return (
      <div className="flex flex-col gap-3">
        {lista}
        <Button variant="primary" disabled={salvando} onClick={rolado}>
          Rolar dano
        </Button>
      </div>
    )

  let primeiro = true
  return (
    <form onSubmit={digitado} className="flex flex-col gap-3">
      {partes.map((p, i) => {
        if (!p.temDados)
          return (
            <p key={i} className="text-sm text-muted">
              <b className="text-fg">{p.expr.fixo}</b> {p.tipo || 'de dano'}, sem dados.
            </p>
          )
        const dados = descreverExpressao({ dados: p.expr.dados, fixo: 0 }, p.m)
        const invalido = somas[i] !== '' && !validos[i]
        const foco = primeiro
        primeiro = false
        return (
          <CampoValor
            key={i}
            foco={foco}
            rotulo={`Soma de ${p.tipo || 'dano'}`}
            ajuda={invalido ? `A soma de ${dados} vai de ${p.faixa.min} a ${p.faixa.max}.` : `Role ${dados} e digite a soma${p.expr.fixo ? `; o app soma ${sinal(p.expr.fixo)}` : ''}.`}
            valor={somas[i]}
            aoMudar={(v) => setSomas((l) => l.map((x, j) => (j === i ? v : x)))}
            invalido={invalido}
          />
        )
      })}
      <Button type="submit" variant="primary" disabled={!pronto || salvando}>
        Registrar
      </Button>
    </form>
  )
}
