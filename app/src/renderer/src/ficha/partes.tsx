// Peças pequenas da ficha completa, no visual do app (tokens do theme.css).
import { Minus, Plus } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cx } from '@/ui'

export function Secao({ titulo, acoes, children, className }: { titulo: string; acoes?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cx('flex flex-col gap-2', className)}>
      <div className="flex min-h-7 items-center gap-2">
        <h3 id={id} className="type-label text-muted">
          {titulo}
        </h3>
        {acoes && <div className="ml-auto flex items-center gap-1">{acoes}</div>}
      </div>
      {children}
    </section>
  )
}

const campo = 'rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus'

/** Número com rótulo em cima. Campo vazio vale 0. */
export function Numero({ rotulo, valor, aoMudar, className, min }: { rotulo: string; valor: number; aoMudar: (v: number) => void; className?: string; min?: number }) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-muted">
        {rotulo}
      </label>
      <input
        id={id}
        type="number"
        value={valor}
        min={min}
        onFocus={(e) => e.target.select()}
        onChange={(e) => aoMudar(Number(e.target.value) || 0)}
        className={cx(campo, 'h-8 w-full text-center font-mono')}
      />
    </div>
  )
}

export function Texto({ rotulo, valor, aoMudar, placeholder, className }: { rotulo: string; valor: string; aoMudar: (v: string) => void; placeholder?: string; className?: string }) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-muted">
        {rotulo}
      </label>
      <input id={id} value={valor} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} className={cx(campo, 'h-8 w-full')} />
    </div>
  )
}

export function AreaTexto({ rotulo, valor, aoMudar, linhas = 3, placeholder }: { rotulo: string; valor: string; aoMudar: (v: string) => void; linhas?: number; placeholder?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {rotulo}
      </label>
      <textarea id={id} value={valor} rows={linhas} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} className={cx(campo, 'resize-y py-1.5 leading-relaxed')} />
    </div>
  )
}

/** Lista de opções; `livre` aceita também o que não está na lista (origem, trilha). */
export function Escolha({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  livre,
  className
}: {
  rotulo: string
  valor: string
  opcoes: (string | { valor: string; texto: string })[]
  aoMudar: (v: string) => void
  livre?: boolean
  className?: string
}) {
  const id = useId()
  const lista = opcoes.map((o) => (typeof o === 'string' ? { valor: o, texto: o || '—' } : o))
  if (livre)
    return (
      <div className={cx('flex flex-col gap-1', className)}>
        <label htmlFor={id} className="text-xs text-muted">
          {rotulo}
        </label>
        <input id={id} list={`${id}-l`} value={valor} onChange={(e) => aoMudar(e.target.value)} className={cx(campo, 'h-8 w-full')} />
        <datalist id={`${id}-l`}>
          {lista.map((o) => (
            <option key={o.valor} value={o.valor} />
          ))}
        </datalist>
      </div>
    )
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-muted">
        {rotulo}
      </label>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={cx(campo, 'h-8 w-full')}>
        {!lista.some((o) => o.valor === valor) && <option value={valor}>{valor || '—'}</option>}
        {lista.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  )
}

const COR = { pv: 'bg-danger', pe: 'bg-warning', san: 'bg-accent' } as const

/** Barra de PV, PE ou SAN com − e + e o valor atual editável. */
export function Rastreador({
  rotulo,
  cor,
  atual,
  max,
  temp,
  alerta,
  aoMudar
}: {
  rotulo: string
  cor: keyof typeof COR
  atual: number
  max: number
  temp: number
  alerta: string | null
  aoMudar: (v: number) => void
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0
  const botao = 'grid size-8 shrink-0 place-items-center rounded-md border border-border-input text-muted hover:bg-surface-raised hover:text-fg'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{rotulo}</span>
        {alerta && <span className="text-xs font-semibold text-danger">{alerta}</span>}
        <span className="ml-auto font-mono text-xs text-muted">
          {temp > 0 && <span className="text-warning">+{temp} temp. · </span>}
          máx. {max}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Tirar 1 de ${rotulo}`} className={botao} onClick={() => aoMudar(Math.max(0, atual - 1))}>
          <Minus className="size-4" aria-hidden />
        </button>
        <div className="relative h-8 flex-1 overflow-hidden rounded-md border border-border bg-bg">
          <div
            role="meter"
            aria-label={rotulo}
            aria-valuenow={atual}
            aria-valuemin={0}
            aria-valuemax={max}
            className={cx('h-full opacity-35', COR[cor])}
            style={{ width: `${pct}%` }}
          />
          <input
            type="number"
            aria-label={`${rotulo} atual`}
            value={atual}
            onFocus={(e) => e.target.select()}
            onChange={(e) => aoMudar(Math.max(0, Number(e.target.value) || 0))}
            className="absolute inset-0 w-full bg-transparent text-center font-mono text-base font-semibold text-fg focus:outline-none"
          />
        </div>
        <button type="button" aria-label={`Somar 1 a ${rotulo}`} className={botao} onClick={() => aoMudar(atual + 1)}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Abas com setas ← →; a selecionada fica destacada. */
export function Abas<T extends string>({ abas, atual, aoMudar, rotulo }: { abas: { id: T; texto: string }[]; atual: T; aoMudar: (id: T) => void; rotulo: string }) {
  const mover = (passo: number, el: HTMLElement) => {
    const i = (abas.findIndex((t) => t.id === atual) + passo + abas.length) % abas.length
    aoMudar(abas[i].id)
    el.querySelectorAll<HTMLButtonElement>('[role=tab]')[i]?.focus()
  }
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="flex shrink-0 flex-wrap gap-1 border-b border-border pb-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') mover(1, e.currentTarget)
        if (e.key === 'ArrowLeft') mover(-1, e.currentTarget)
      }}
    >
      {abas.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={atual === t.id}
          tabIndex={atual === t.id ? 0 : -1}
          onClick={() => aoMudar(t.id)}
          className="h-7 rounded-md px-3 text-sm font-semibold text-muted hover:bg-surface-raised hover:text-fg aria-selected:bg-accent aria-selected:text-on-accent"
        >
          {t.texto}
        </button>
      ))}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-subtle">{children}</p>
}
