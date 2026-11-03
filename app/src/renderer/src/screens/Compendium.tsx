// Biblioteca: ameaças (T8), rituais e itens (T9) que valem para todas as campanhas. Trazer para a campanha faz uma cópia.
import { ArrowLeft, BookMarked, Copy, Plus, Search, Skull, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCampaign } from '@/campaign'
import { BlocoAmeaca } from '@/ameaca/BlocoAmeaca'
import { EditorAmeaca } from '@/ameaca/EditorAmeaca'
import { Abas, Texto } from '@/ficha/partes'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, Chip, Dialog, EmptyState, ErrorNote, IconButton, SaveIndicator, SelectField, TextField } from '@/ui'
import { ELEMENTOS, type AmeacaBiblioteca } from '@shared/ordem/esquemas'
import { SOURCE_KINDS, type LibraryEntry, type LibrarySource, type SourceKind } from '@shared/types'

const KIND_SOURCE: Record<SourceKind, string> = { oficial: 'Livro oficial', propria: 'Criação própria', outro: 'Outro livro' }

/** Livros e outras origens: criar e apagar (a "Criações próprias" vem com o app). */
function Sources({ open, onClose, sources, onChanged }: { open: boolean; onClose: () => void; sources: LibrarySource[]; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SourceKind>('oficial')
  const [abbreviation, setAbbreviation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const act = async (job: () => Promise<unknown>) => {
    setError(null)
    try {
      await job()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Origens"
      description="De onde vem cada registro: um livro, as suas criações ou outro material."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
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
      </div>
    </Dialog>
  )
}

export function Compendium() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [elemento, setElemento] = useState('')
  const [showSources, setShowSources] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sources = useLoad(() => window.api.library.sources(), [])
  const list = useLoad(() => window.api.library.list({ kind: 'ameaca', q, sourceId: sourceId || undefined }), [q, sourceId])
  const shown = (list.data ?? []).filter((a) => !elemento || a.data.elemento === elemento)

  const create = async () => {
    const own = sources.data?.find((s) => s.builtin) ?? sources.data?.[0]
    if (!own) return
    try {
      const e = await window.api.library.save({ kind: 'ameaca', sourceId: sourceId || own.id, data: { nome: 'Nova ameaça' } })
      navigate(`/biblioteca/ameaca/${e.id}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5 px-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="type-xl">Biblioteca</h1>
          <p className="text-sm text-muted">Vale para todas as campanhas. O que você traz para a campanha vira uma cópia.</p>
        </div>
        <Button icon={<BookMarked className="size-4" />} onClick={() => setShowSources(true)}>
          Origens…
        </Button>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void create()} disabled={!sources.data}>
          Nova ameaça
        </Button>
      </div>

      <Abas rotulo="Tipo de registro" abas={[{ id: 'ameaca', texto: 'Ameaças' }]} atual="ameaca" aoMudar={() => {}} />

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
        <SelectField label="Elemento" empty="Todos os elementos" value={elemento} onChange={(e) => setElemento(e.target.value)} options={ELEMENTOS.map((x) => ({ value: x, label: x }))} />
      </div>

      {(error || list.error || sources.error) && <ErrorNote message={(error || list.error || sources.error)!} onRetry={list.reload} />}

      {list.data && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={<Skull />}
            title={list.data.length === 0 && !q && !sourceId ? 'Nenhuma ameaça na biblioteca' : 'Nenhuma ameaça com esses filtros'}
            text="Cadastre a ameaça uma vez aqui e traga uma cópia para cada campanha que precisar dela."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void create()}>
                Nova ameaça
              </Button>
            }
          />
        </Card>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {shown.map((a) => (
          <li key={a.id}>
            <Link to={`/biblioteca/ameaca/${a.id}`} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 hover:border-border-input">
              <span className="flex items-start justify-between gap-2">
                <span className="type-lg min-w-0 truncate">{a.name}</span>
                <span className="shrink-0 font-mono text-sm font-semibold">VD {a.data.vd}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {a.data.elemento && <Chip>{a.data.elemento}</Chip>}
                PV {a.data.pv} · Defesa {a.data.defesa}
              </span>
              <span className="truncate text-xs text-subtle">{a.sourceName}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Sources open={showSources} onClose={() => setShowSources(false)} sources={sources.data ?? []} onChanged={sources.reload} />
    </div>
  )
}

/** Uma ameaça da biblioteca: editar, trazer para a campanha aberta, duplicar, apagar. */
export function CompendiumThreat() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { changed } = useCampaign()
  const loaded = useLoad(() => window.api.library.get({ kind: 'ameaca', id }), [id])
  const sources = useLoad(() => window.api.library.sources(), [])
  const [draft, setDraft] = useState<LibraryEntry<'ameaca'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autosave = useAutosave((e: LibraryEntry<'ameaca'>) => window.api.library.save({ kind: 'ameaca', id: e.id, sourceId: e.sourceId, data: e.data }))

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data)
  }, [loaded.data])

  if (loaded.error) return <div className="p-6"><ErrorNote message={loaded.error} onRetry={loaded.reload} /></div>
  if (!draft) return null

  const update = (patch: Partial<AmeacaBiblioteca>, sourceId = draft.sourceId) => {
    const next = { ...draft, sourceId, name: patch.nome ?? draft.name, data: { ...draft.data, ...patch } }
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

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/biblioteca" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Biblioteca
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={autosave.state} error={autosave.error} />
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
          <Button
            size="sm"
            icon={<Copy className="size-4" />}
            onClick={() =>
              void run(async () => {
                const own = sources.data?.find((s) => s.builtin)
                const e = await window.api.library.save({ kind: 'ameaca', sourceId: own?.id ?? draft.sourceId, data: { ...draft.data, nome: `${draft.data.nome} (cópia)` } })
                navigate(`/biblioteca/ameaca/${e.id}`)
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
                if (!window.confirm(`Apagar "${draft.data.nome}" da biblioteca? As cópias que já estão nas campanhas continuam lá.`)) return
                await window.api.library.remove({ kind: 'ameaca', id: draft.id })
                navigate('/biblioteca')
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
          {!draft.data.nome.trim() && <p className="text-sm text-danger">Dê um nome à ameaça: sem nome ela não é salva.</p>}
          <EditorAmeaca a={draft.data} aoMudar={(patch) => update(patch)} />
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <BlocoAmeaca a={draft.data} nome={draft.data.nome} />
          </Card>
        </div>
      </div>
    </div>
  )
}
