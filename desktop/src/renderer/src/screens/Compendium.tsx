// Biblioteca: ameaças (T8), rituais e itens (T9) que valem para todas as campanhas. Trazer para a campanha faz uma cópia.
import { ArrowLeft, BookMarked, Copy, Download, ImageUp, Package, Plus, Search, Skull, Sparkles, Trash2, Upload, UserPlus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useCampaign } from '@/campaign'
import { BlocoAmeaca } from '@/ameaca/BlocoAmeaca'
import { EditorAmeaca } from '@/ameaca/EditorAmeaca'
import { BlocoItem, CATEGORIAS, EditorItem, resumoItem } from '@/biblioteca/Item'
import { ImportarPacote, resultadoDaImportacao } from '@/biblioteca/Pacote'
import { BlocoRitual, EditorRitual, ROMANO } from '@/biblioteca/Ritual'
import { Abas, Texto } from '@/ficha/partes'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, Chip, Dialog, EmptyState, ErrorNote, IconButton, SaveIndicator, SelectField, TextField } from '@/ui'
import { ELEMENTOS, TIPOS_ITEM, type AmeacaBiblioteca } from '@shared/ordem/esquemas'
import { SOURCE_KINDS, type ImportPreview, type LibraryEntry, type LibraryKind, type LibrarySource, type SourceKind } from '@shared/types'

const KIND_SOURCE: Record<SourceKind, string> = { oficial: 'Livro oficial', propria: 'Criação própria', outro: 'Outro livro' }

/** Livros e outras origens: criar e apagar (a "Criações próprias" vem com o app). */
function Sources({ open, onClose, sources, onChanged, onImport }: { open: boolean; onClose: () => void; sources: LibrarySource[]; onChanged: () => void; onImport: (p: ImportPreview) => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SourceKind>('oficial')
  const [abbreviation, setAbbreviation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const act = async (job: () => Promise<unknown>) => {
    setError(null)
    setAviso(null)
    try {
      await job()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const exportar = (sourceIds?: string[]) =>
    void act(async () => {
      const file = await window.api.library.exportPackage({ sourceIds })
      if (file) setAviso(`Pacote salvo em ${file}`)
    })
  const importar = () =>
    void act(async () => {
      const preview = await window.api.library.pickPackage()
      if (preview) onImport(preview)
    })
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Origens"
      description="De onde vem cada registro: um livro, as suas criações ou outro material. Exporte uma origem para levar a outro computador ou mandar a outro mestre."
      footer={
        <>
          <Button icon={<Upload className="size-4" />} onClick={importar} className="mr-auto">
            Importar…
          </Button>
          <Button icon={<Download className="size-4" />} onClick={() => exportar()}>
            Exportar tudo
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {s.name}
                {s.abbreviation && <span className="text-subtle"> ({s.abbreviation})</span>}
              </span>
              <span className="text-xs text-subtle">
                {KIND_SOURCE[s.kind]} · {s.count} {s.count === 1 ? 'registro' : 'registros'}
              </span>
              <IconButton label={`Exportar a origem ${s.name}`} onClick={() => exportar([s.id])} disabled={s.count === 0}>
                <Download className="size-4" />
              </IconButton>
              {!s.builtin && (
                <IconButton label={`Apagar a origem ${s.name}`} onClick={() => void act(() => window.api.library.deleteSource(s.id))}>
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            void act(async () => {
              await window.api.library.saveSource({ name: name.trim(), kind, abbreviation: abbreviation.trim() })
              setName('')
              setAbbreviation('')
            })
          }}
        >
          <TextField label="Nome da origem" value={name} onChange={(e) => setName(e.target.value)} placeholder="Livro de Regras" maxLength={200} className="min-w-48 flex-1" />
          <TextField label="Sigla" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} placeholder="OPRPG" maxLength={20} className="w-24" />
          <SelectField label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)} options={SOURCE_KINDS.map((k) => ({ value: k, label: KIND_SOURCE[k] }))} />
          <Button type="submit" icon={<Plus className="size-4" />} disabled={!name.trim()}>
            Criar origem
          </Button>
        </form>
        {error && <ErrorNote message={error} />}
        {aviso && (
          <p role="status" className="text-sm break-all text-muted">
            {aviso}
          </p>
        )}
      </div>
    </Dialog>
  )
}

const TABS: { id: LibraryKind; texto: string; novo: string; vazio: string }[] = [
  { id: 'ameaca', texto: 'Ameaças', novo: 'Nova ameaça', vazio: 'Nenhuma ameaça' },
  { id: 'ritual', texto: 'Rituais', novo: 'Novo ritual', vazio: 'Nenhum ritual' },
  { id: 'item', texto: 'Itens', novo: 'Novo item', vazio: 'Nenhum item' }
]
const ICON: Record<LibraryKind, ReactNode> = { ameaca: <Skull />, ritual: <Sparkles />, item: <Package /> }
const isKind = (v: string | null | undefined): v is LibraryKind => v === 'ameaca' || v === 'ritual' || v === 'item'
const tokenUrl = (t: string) => `magistrado://token/${t}`

function Token({ token, nome, tamanho = 40 }: { token: string; nome: string; tamanho?: number }) {
  if (!token) return null
  return <img src={tokenUrl(token)} alt={`Token de ${nome}`} width={tamanho} height={tamanho} className="shrink-0 rounded-full border border-border bg-surface-raised object-cover" style={{ width: tamanho, height: tamanho }} />
}

export function Compendium() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tipo = params.get('tipo')
  const kind: LibraryKind = isKind(tipo) ? tipo : 'ameaca'
  const tab = TABS.find((t) => t.id === kind)!
  const [q, setQ] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [elemento, setElemento] = useState('')
  const [circulo, setCirculo] = useState('')
  const [tipoItem, setTipoItem] = useState('')
  const [categoria, setCategoria] = useState('')
  const [showSources, setShowSources] = useState(false)
  const [importing, setImporting] = useState<ImportPreview | null>(null)
  const [imported, setImported] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sources = useLoad(() => window.api.library.sources(), [])
  const editados = useLoad(() => window.api.library.livrosEditados(), [])
  const list = useLoad(() => window.api.library.list({ kind, q, sourceId: sourceId || undefined }), [kind, q, sourceId])
  const all = (list.data ?? []) as LibraryEntry[]
  const shown = all.filter((e) => {
    if (e.kind === 'ameaca') return !elemento || e.data.elemento === elemento
    if (e.kind === 'ritual') {
      const r = (e as LibraryEntry<'ritual'>).data
      return (!elemento || r.elemento === elemento) && (!circulo || String(r.circulo) === circulo)
    }
    const i = (e as LibraryEntry<'item'>).data
    return (!tipoItem || i.tipo === tipoItem) && (!categoria || String(i.categoria) === categoria)
  })
  const filtered = Boolean(q || sourceId || elemento || circulo || tipoItem || categoria)

  const create = async () => {
    const own = sources.data?.find((s) => s.builtin) ?? sources.data?.[0]
    if (!own) return
    try {
      const e = await window.api.library.save({ kind, sourceId: sourceId || own.id, data: { nome: tab.novo } })
      navigate(`/biblioteca/${kind}/${e.id}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5 px-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="type-xl">Biblioteca</h1>
          <p className="text-sm text-muted">Vale para todas as campanhas. O que você traz para a campanha ou coloca numa ficha vira uma cópia.</p>
        </div>
        <Button icon={<BookMarked className="size-4" />} onClick={() => setShowSources(true)}>
          Origens…
        </Button>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void create()} disabled={!sources.data}>
          {tab.novo}
        </Button>
      </div>

      {(editados.data?.length ?? 0) > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
          <span className="min-w-0 flex-1">
            Os livros foram conferidos e corrigidos, mas {editados.data!.length === 1 ? 'este registro, que você editou, ficou' : 'estes registros, que você editou, ficaram'} como
            estavam: {editados.data!.join(', ')}. Compare com o livro e ajuste se quiser.
          </span>
          <Button size="sm" variant="ghost" onClick={() => void window.api.library.dispensarLivrosEditados().then(editados.reload)}>
            Entendi
          </Button>
        </div>
      )}

      {imported && (
        <p role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
          {imported}
        </p>
      )}

      <Abas rotulo="Tipo de registro" abas={TABS} atual={kind} aoMudar={(id) => setParams({ tipo: id }, { replace: true })} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative block w-72">
          <span className="sr-only">Buscar na biblioteca</span>
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome"
            className="h-9 w-full rounded-md border border-border-input bg-bg pr-3 pl-8.5 text-sm text-fg focus:border-focus"
          />
        </label>
        <SelectField label="Origem" empty="Todas as origens" value={sourceId} onChange={(e) => setSourceId(e.target.value)} options={(sources.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
        {kind !== 'item' && (
          <SelectField label="Elemento" empty="Todos os elementos" value={elemento} onChange={(e) => setElemento(e.target.value)} options={ELEMENTOS.map((x) => ({ value: x, label: x }))} />
        )}
        {kind === 'ritual' && (
          <SelectField label="Círculo" empty="Todos os círculos" value={circulo} onChange={(e) => setCirculo(e.target.value)} options={[1, 2, 3, 4].map((c) => ({ value: String(c), label: `${c}º círculo` }))} />
        )}
        {kind === 'item' && (
          <>
            <SelectField label="Tipo" empty="Todos os tipos" value={tipoItem} onChange={(e) => setTipoItem(e.target.value)} options={TIPOS_ITEM.map((x) => ({ value: x, label: x }))} />
            <SelectField label="Categoria" empty="Todas" value={categoria} onChange={(e) => setCategoria(e.target.value)} options={CATEGORIAS.map((c, n) => ({ value: String(n), label: c }))} />
          </>
        )}
        {list.data && (
          <span className="pb-2 text-xs text-subtle">
            {shown.length} {shown.length === 1 ? 'registro' : 'registros'}
          </span>
        )}
      </div>

      {(error || list.error || sources.error) && <ErrorNote message={(error || list.error || sources.error)!} onRetry={list.reload} />}

      {list.data && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={ICON[kind]}
            title={filtered ? `${tab.vazio} com esses filtros` : `${tab.vazio} na biblioteca`}
            text="Cadastre uma vez aqui e use uma cópia em cada campanha que precisar."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void create()}>
                {tab.novo}
              </Button>
            }
          />
        </Card>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {shown.map((e) => (
          <li key={e.id}>
            <Link to={`/biblioteca/${e.kind}/${e.id}`} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 hover:border-border-input">
              <EntryCard e={e} />
              <span className="truncate text-xs text-subtle">
                {e.sourceName}
                {e.data.pagina > 0 && `, p. ${e.data.pagina}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Sources
        open={showSources}
        onClose={() => setShowSources(false)}
        sources={sources.data ?? []}
        onChanged={sources.reload}
        onImport={(p) => {
          setShowSources(false)
          setImporting(p)
        }}
      />
      {importing && (
        <ImportarPacote
          preview={importing}
          onClose={() => setImporting(null)}
          onDone={(r) => {
            setImporting(null)
            setImported(resultadoDaImportacao(r))
            sources.reload()
            list.reload()
          }}
        />
      )}
    </div>
  )
}

function EntryCard({ e }: { e: LibraryEntry }) {
  if (e.kind === 'ameaca') {
    const a = (e as LibraryEntry<'ameaca'>).data
    return (
      <>
        <span className="flex items-start justify-between gap-2">
          <Token token={a.token} nome={e.name} />
          <span className="type-lg min-w-0 flex-1 truncate">{e.name}</span>
          <span className="shrink-0 font-mono text-sm font-semibold">VD {a.vd}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {a.elemento && <Chip>{a.elemento}</Chip>}
          PV {a.pv} · Defesa {a.defesa}
        </span>
      </>
    )
  }
  if (e.kind === 'ritual') {
    const r = (e as LibraryEntry<'ritual'>).data
    return (
      <>
        <span className="flex items-start justify-between gap-2">
          <span className="type-lg min-w-0 truncate">{e.name}</span>
          <span className="shrink-0 font-serif text-sm font-semibold text-subtle" title={`${r.circulo}º círculo`}>
            {ROMANO[r.circulo]}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {r.elemento && <Chip>{r.elemento}</Chip>}
          {[r.execucao, r.alcance].filter(Boolean).join(' · ')}
        </span>
      </>
    )
  }
  const i = (e as LibraryEntry<'item'>).data
  return (
    <>
      <span className="type-lg min-w-0 truncate">{e.name}</span>
      <span className="truncate text-xs text-muted">{resumoItem(i)}</span>
    </>
  )
}

/** Escolher a ficha completa (agente ou vilão) que recebe o item ou o ritual. */
function PlaceOnSheet({ entry, onClose }: { entry: LibraryEntry<'item' | 'ritual'>; onClose: () => void }) {
  const { changed } = useCampaign()
  const fichas = useLoad(() => window.api.entities.list({ kind: 'personagem' }), [])
  const [entityId, setEntityId] = useState('')
  const [done, setDone] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const completas = (fichas.data ?? []).filter((f) => f.sheet === 'completa')
  const what = entry.kind === 'item' ? 'o item' : 'o ritual'
  const place = () => {
    setBusy(true)
    setError(null)
    window.api.library
      .copyToCampaign({ kind: entry.kind, id: entry.id, entityId })
      .then((e) => {
        changed()
        setDone({ id: e.id, name: e.name })
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Colocar ${entry.name} numa ficha`}
      description={`A ficha recebe uma cópia: ${what} continua nela mesmo se for apagado da biblioteca.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="primary" disabled={!entityId || busy} onClick={place}>
            Colocar na ficha
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {fichas.data && completas.length === 0 && <p className="text-sm text-muted">Nenhuma ficha completa nesta campanha. Itens e rituais entram na ficha de agentes e vilões.</p>}
        {completas.length > 0 && (
          <SelectField
            label="Ficha"
            empty="Escolha a ficha"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value)
              setDone(null)
            }}
            options={completas.map((f) => ({ value: f.id, label: f.isPlayer ? `${f.name} (agente)` : f.name }))}
          />
        )}
        {done && (
          <p className="text-sm text-success" role="status">
            Pronto: {entry.name} está na ficha de{' '}
            <Link to={`/ficha/${done.id}`} className="underline">
              {done.name}
            </Link>
            .
          </p>
        )}
        {(error || fichas.error) && <ErrorNote message={(error || fichas.error)!} />}
      </div>
    </Dialog>
  )
}

/** Token da ameaça e as variantes: clicar numa variante faz dela o token principal (o retrato ao trazer para a campanha). */
function CartaoToken({ a, aoMudar, aoEscolher, aoTirar }: { a: AmeacaBiblioteca; aoMudar: (p: Partial<AmeacaBiblioteca>) => void; aoEscolher: () => void; aoTirar: () => void }) {
  const usar = (t: string) => aoMudar({ token: t, tokensExtras: [a.token, ...a.tokensExtras].filter((x) => x && x !== t) })
  return (
    <Card className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        {a.token ? (
          <Token token={a.token} nome={a.nome} tamanho={64} />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-full border border-dashed border-border text-subtle">
            <Skull className="size-6" aria-hidden />
          </span>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs text-muted">Token: vira o retrato da ficha quando a ameaça vem para a campanha.</span>
          <div className="flex gap-2">
            <Button size="sm" icon={<ImageUp className="size-4" />} onClick={aoEscolher}>
              {a.token ? 'Trocar token…' : 'Escolher token…'}
            </Button>
            {a.token && (
              <Button size="sm" variant="ghost" onClick={aoTirar}>
                Tirar
              </Button>
            )}
          </div>
        </div>
      </div>
      {a.tokensExtras.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Variantes: clique para usar como token principal.</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Variantes do token">
            {a.tokensExtras.map((t, n) => (
              <button key={t} type="button" aria-label={`Usar a variante ${n + 1}`} className="rounded-full hover:outline-2 hover:outline-accent focus-visible:outline-2 focus-visible:outline-accent" onClick={() => usar(t)}>
                <Token token={t} nome={`${a.nome}, variante ${n + 1}`} tamanho={44} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Um registro da biblioteca: editar, levar para a campanha (ameaça) ou para uma ficha (item, ritual), duplicar, apagar. */
export function CompendiumEntry() {
  const params = useParams()
  const kind: LibraryKind = isKind(params.kind) ? params.kind : 'ameaca'
  const id = params.id ?? ''
  const navigate = useNavigate()
  const { changed } = useCampaign()
  const loaded = useLoad(() => window.api.library.get({ kind, id }), [kind, id])
  const sources = useLoad(() => window.api.library.sources(), [])
  const [draft, setDraft] = useState<LibraryEntry | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autosave = useAutosave((e: LibraryEntry) => window.api.library.save({ kind: e.kind, id: e.id, sourceId: e.sourceId, data: e.data }))

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data as LibraryEntry)
  }, [loaded.data])

  if (loaded.error) return <div className="p-6"><ErrorNote message={loaded.error} onRetry={loaded.reload} /></div>
  if (!draft || draft.id !== id) return null

  const back = `/biblioteca?tipo=${kind}`
  const update = (patch: Record<string, unknown>, sourceId = draft.sourceId) => {
    const data = { ...draft.data, ...patch } as LibraryEntry['data']
    const next = { ...draft, sourceId, name: data.nome, data } as LibraryEntry
    setDraft(next)
    autosave.schedule(next)
  }
  const run = async (job: () => Promise<void>) => {
    setError(null)
    try {
      await autosave.flush()
      await job()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const sourceName = sources.data?.find((s) => s.id === draft.sourceId)?.name ?? draft.sourceName

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={back} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Biblioteca
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={autosave.state} error={autosave.error} />
          {kind === 'ameaca' ? (
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus className="size-4" />}
              onClick={() =>
                void run(async () => {
                  const e = await window.api.library.copyToCampaign({ kind: 'ameaca', id: draft.id })
                  changed()
                  navigate(`/ficha/${e.id}`)
                })
              }
            >
              Trazer para a campanha
            </Button>
          ) : (
            <Button variant="primary" size="sm" icon={<UserPlus className="size-4" />} onClick={() => void run(async () => setPlacing(true))}>
              Colocar na ficha
            </Button>
          )}
          <Button
            size="sm"
            icon={<Copy className="size-4" />}
            onClick={() =>
              void run(async () => {
                const own = sources.data?.find((s) => s.builtin)
                const e = await window.api.library.save({ kind, sourceId: own?.id ?? draft.sourceId, data: { ...draft.data, nome: `${draft.data.nome} (cópia)` } })
                navigate(`/biblioteca/${kind}/${e.id}`)
              })
            }
          >
            Duplicar
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="size-4" />}
            onClick={() =>
              void run(async () => {
                if (!window.confirm(`Apagar "${draft.data.nome}" da biblioteca? As cópias que já estão nas campanhas e nas fichas continuam lá.`)) return
                await window.api.library.remove({ kind, id: draft.id })
                navigate(back)
              })
            }
          >
            Apagar
          </Button>
        </div>
      </div>
      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Texto rotulo="Nome" valor={draft.data.nome} aoMudar={(nome) => update({ nome })} />
            <SelectField
              label="Origem"
              value={draft.sourceId}
              onChange={(e) => update({}, e.target.value)}
              options={(sources.data ?? [{ id: draft.sourceId, name: draft.sourceName }]).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          {!draft.data.nome.trim() && <p className="text-sm text-danger">Dê um nome: sem nome o registro não é salvo.</p>}
          {draft.kind === 'ameaca' && <EditorAmeaca a={(draft as LibraryEntry<'ameaca'>).data} aoMudar={(patch) => update(patch)} />}
          {draft.kind === 'ritual' && <EditorRitual r={(draft as LibraryEntry<'ritual'>).data} aoMudar={(patch) => update(patch)} />}
          {draft.kind === 'item' && <EditorItem i={(draft as LibraryEntry<'item'>).data} aoMudar={(patch) => update(patch)} />}
        </div>
        <div className="flex flex-col gap-3 xl:sticky xl:top-6 xl:self-start">
          {draft.kind === 'ameaca' && (
            <CartaoToken
              a={(draft as LibraryEntry<'ameaca'>).data}
              aoMudar={(patch) => update(patch)}
              aoEscolher={() =>
                void run(async () => {
                  const e = await window.api.library.pickToken(draft.id)
                  if (e) setDraft(e as LibraryEntry)
                })
              }
              aoTirar={() => void run(async () => setDraft((await window.api.library.clearToken(draft.id)) as LibraryEntry))}
            />
          )}
          <Card>
            {draft.kind === 'ameaca' && <BlocoAmeaca a={(draft as LibraryEntry<'ameaca'>).data} nome={draft.data.nome} />}
            {draft.kind === 'ritual' && <BlocoRitual r={(draft as LibraryEntry<'ritual'>).data} fonte={sourceName} />}
            {draft.kind === 'item' && <BlocoItem i={(draft as LibraryEntry<'item'>).data} fonte={sourceName} />}
          </Card>
        </div>
      </div>
      {placing && draft.kind !== 'ameaca' && <PlaceOnSheet entry={draft as LibraryEntry<'item' | 'ritual'>} onClose={() => setPlacing(false)} />}
    </div>
  )
}
