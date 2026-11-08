// Regras (P1): as regras mecânicas dos livros, com sumário por livro e capítulo, busca e a página do livro.
// Cada ritual, item e ameaça vive na Biblioteca; aqui fica a regra geral, com link para lá.
import { BookOpen, Search } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { blocos, buscar, carregarRegras, NA_BIBLIOTECA, type SecaoRegra } from '@/regras/dados'
import { Card, cx, EmptyState, ErrorNote } from '@/ui'

/** **negrito** e *itálico* do texto, com o termo buscado destacado. */
function Inline({ texto, destaque }: { texto: string; destaque?: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return (
    <>
      {partes.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{marcar(p.slice(2, -2), destaque)}</strong>
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{marcar(p.slice(1, -1), destaque)}</em>
        return <Fragment key={i}>{marcar(p, destaque)}</Fragment>
      })}
    </>
  )
}

function marcar(t: string, q?: string): ReactNode {
  if (!q || q.trim().length < 2) return t
  const dob = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const alvo = dob(q.trim())
  const fonte = dob(t)
  const out: ReactNode[] = []
  let i = 0
  for (let j = fonte.indexOf(alvo); j >= 0; j = fonte.indexOf(alvo, j + alvo.length)) {
    out.push(t.slice(i, j), <mark key={j} className="rounded-xs bg-warning/30 text-fg">{t.slice(j, j + alvo.length)}</mark>)
    i = j + alvo.length
  }
  out.push(t.slice(i))
  return out
}

function Trecho({ texto }: { texto: string }) {
  const [a, b = '', c = ''] = texto.split(/\[|\]/)
  return (
    <>
      {a}
      <mark className="bg-transparent font-semibold text-fg underline underline-offset-2">{b}</mark>
      {c}
    </>
  )
}

function Secao({ s, destaque }: { s: SecaoRegra; destaque?: string }) {
  const bs = useMemo(() => blocos(s), [s])
  const subtitulos = bs.filter((b) => b.tipo === 'h2' || b.tipo === 'h3')
  const bib = NA_BIBLIOTECA[s.titulo]
  return (
    <article className="flex flex-col gap-4" aria-labelledby="regra-titulo">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <span className="text-xs text-subtle">
          {s.livro} · {s.capitulo}
        </span>
        <h1 id="regra-titulo" className="type-xl">
          {s.titulo}
        </h1>
        <span className="text-xs text-muted">Página {s.pagina} do livro</span>
      </header>
      {bib && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted">{bib.texto}</span>
          <Link to={`/biblioteca?tipo=${bib.tipo}`} className="font-medium text-accent hover:underline">
            Abrir a Biblioteca
          </Link>
        </Card>
      )}
      {subtitulos.length > 2 && (
        <nav aria-label="Nesta seção" className="flex flex-wrap gap-1.5">
          {subtitulos.map((b) => (
            <a key={b.ancora} href={`#${b.ancora}`} className="rounded-pill border border-border px-2.5 py-0.5 text-xs text-muted hover:border-border-input hover:text-fg">
              {b.texto.length > 40 ? `${b.texto.slice(0, 40)}…` : b.texto}
            </a>
          ))}
        </nav>
      )}
      <div className="flex max-w-[72ch] flex-col gap-3 font-serif text-[15px] leading-relaxed">
        {bs.map((b, i) => {
          if (b.tipo === 'pagina')
            return i === 0 ? null : (
              <div key={i} className="flex items-center gap-2 font-sans text-[11px] text-subtle" aria-label={`Página ${b.pagina}`}>
                <span className="h-px flex-1 bg-border" /> p. {b.pagina}
              </div>
            )
          if (b.tipo === 'h2')
            return (
              <h2 key={i} id={b.ancora} className="type-lg mt-3 scroll-mt-4 font-sans">
                {marcar(b.texto, destaque)}
              </h2>
            )
          if (b.tipo === 'h3')
            return (
              <h3 key={i} id={b.ancora} className="mt-2 scroll-mt-4 font-sans text-sm font-semibold tracking-wide text-muted uppercase">
                {marcar(b.texto, destaque)}
              </h3>
            )
          if (b.tipo === 'quadro')
            return (
              <div key={i} className="rounded-md border border-border bg-surface px-3 py-2 font-sans text-[13px] leading-snug">
                {(b.linhas ?? []).map((l, j) => (
                  <div key={j}>{marcar(l, destaque)}</div>
                ))}
              </div>
            )
          return (
            <p key={i}>
              <Inline texto={b.texto} destaque={destaque} />
            </p>
          )
        })}
      </div>
    </article>
  )
}

export function Rules() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [secoes, setSecoes] = useState<SecaoRegra[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const principal = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarRegras()
      .then(setSecoes)
      .catch((e: Error) => setError(e.message))
  }, [])

  const atual = secoes?.find((s) => s.id === id) ?? (secoes && !q ? secoes[0] : undefined)
  const achados = useMemo(() => (secoes && q.trim().length >= 2 ? buscar(secoes, q) : []), [secoes, q])
  const livros = useMemo(() => {
    const m = new Map<string, Map<string, SecaoRegra[]>>()
    for (const s of secoes ?? []) {
      const caps = m.get(s.livro) ?? new Map<string, SecaoRegra[]>()
      caps.set(s.capitulo, [...(caps.get(s.capitulo) ?? []), s])
      m.set(s.livro, caps)
    }
    return m
  }, [secoes])

  // Abriu uma seção vinda da busca: rola até o subtítulo e volta ao topo quando troca de seção.
  useEffect(() => {
    const ancora = window.location.hash.slice(1)
    if (ancora) document.getElementById(ancora)?.scrollIntoView({ block: 'start' })
    else principal.current?.scrollTo({ top: 0 })
  }, [atual?.id])

  const setQ = (v: string) => setParams(v ? { q: v } : {}, { replace: true })

  if (error) return <div className="p-6"><ErrorNote message={error} /></div>

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border" aria-label="Sumário das regras">
        <div className="border-b border-border p-3">
          <label className="relative block">
            <span className="sr-only">Buscar nas regras</span>
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-subtle" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nas regras"
              className="h-9 w-full rounded-md border border-border-input bg-bg pr-3 pl-8.5 text-sm text-fg focus:border-focus"
            />
          </label>
        </div>
        <nav className="min-h-0 flex-1 overflow-auto p-2 text-sm">
          {[...livros].map(([livro, caps]) => (
            <div key={livro} className="mb-3">
              <div className="type-label px-2 py-1 text-subtle">{livro}</div>
              {[...caps].map(([cap, ss]) => (
                <div key={cap} className="mb-1">
                  <div className="px-2 pt-1 text-xs font-semibold text-muted">{cap}</div>
                  <ul>
                    {ss.map((s) => (
                      <li key={s.id}>
                        <NavLink
                          to={`/regras/${s.id}${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                          className={({ isActive }) =>
                            cx('block truncate rounded-md px-2 py-1 text-[13px] hover:bg-surface', isActive || (!id && atual?.id === s.id) ? 'bg-accent/10 font-medium text-fg' : 'text-muted')
                          }
                        >
                          {s.titulo}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div ref={principal} className="min-w-0 flex-1 overflow-auto px-8 py-6">
        {!secoes && <p className="text-sm text-muted">Carregando as regras…</p>}
        {secoes && q.trim().length >= 2 && !id && (
          <section aria-label="Resultados da busca" className="flex max-w-3xl flex-col gap-2">
            <h1 className="type-xl">Busca: {q}</h1>
            {achados.length === 0 && (
              <Card>
                <EmptyState icon={<BookOpen />} title="Nada nas regras com esse termo" text="Tente outra palavra, ou procure a ameaça, o ritual ou o item na Biblioteca." />
              </Card>
            )}
            <ul className="flex flex-col gap-1.5">
              {achados.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => navigate(`/regras/${a.secao.id}?q=${encodeURIComponent(q)}${a.ancora ? `#${a.ancora}` : ''}`)}
                    className="flex w-full flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2 text-left hover:border-border-input"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{a.rotulo}</span>
                      <span className="shrink-0 text-xs text-subtle">p. {a.pagina}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted">
                      <Trecho texto={a.trecho} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {atual && (id || q.trim().length < 2) && <Secao s={atual} destaque={q} />}
      </div>
    </div>
  )
}
