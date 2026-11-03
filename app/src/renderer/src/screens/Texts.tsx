import { FileText, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { DocumentInput } from '@shared/types'
import { useCampaign } from '@/campaign'
import { SceneEditor } from '@/editor/SceneEditor'
import { KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, cx, EmptyState, ErrorNote, SaveIndicator } from '@/ui'

function TextDetail({ id }: { id: string }) {
  const { changed, version } = useCampaign()
  const navigate = useNavigate()
  const loaded = useLoad(() => window.api.documents.get(id), [id])
  const mentions = useLoad(() => window.api.documents.get(id).then((d) => d.mentions), [id, version])
  const [draft, setDraft] = useState<DocumentInput | null>(null)
  const autosave = useAutosave(async (value: DocumentInput) => {
    await window.api.documents.save(value)
    changed()
  })

  useEffect(() => {
    if (loaded.data) setDraft({ id: loaded.data.id, title: loaded.data.title, body: loaded.data.body })
  }, [loaded.data])

  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />
  if (!draft) return null

  const update = (patch: Partial<DocumentInput>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    autosave.schedule(next)
  }
  const trash = async () => {
    await autosave.flush()
    await window.api.documents.trash(id)
    changed()
    navigate('/textos')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={trash} className="ml-auto">
          Mover para a lixeira
        </Button>
      </div>
      <label className="sr-only" htmlFor="doc-title">
        Título do texto
      </label>
      <input
        id="doc-title"
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Título"
        autoFocus={!draft.title}
        maxLength={300}
        className="type-xl w-full rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-focus"
      />
      <div className="rounded-lg border border-border bg-surface px-8 py-7">
        <div className="mx-auto max-w-(--layout-reading-max)">
          <SceneEditor
            key={id}
            initial={draft.body}
            label={`Texto ${draft.title}`}
            placeholder="Introdução, regras da casa, a aventura no seu formato. Selecione um trecho para formatar."
            onChange={(body) => update({ body })}
          />
        </div>
      </div>
      <section aria-labelledby="in-doc-h">
        <h2 id="in-doc-h" className="type-label mb-2 text-muted">
          Fichas neste texto
        </h2>
        {mentions.data?.length === 0 && <p className="text-sm text-subtle">Escreva o nome de uma ficha no texto e ela aparece aqui.</p>}
        <ul className="flex flex-wrap gap-2">
          {mentions.data?.map((m) => (
            <li key={m.id}>
              <Link to={`/ficha/${m.id}`} className="inline-flex h-7 items-center gap-2 rounded-pill border border-border bg-surface px-3 text-xs hover:border-border-input">
                <span className="text-subtle">{KIND_LABEL[m.kind].one}</span>
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function Texts() {
  const { id } = useParams()
  const { version, changed } = useCampaign()
  const navigate = useNavigate()
  const list = useLoad(() => window.api.documents.list(), [version])

  const create = async () => {
    const d = await window.api.documents.save({ title: '', body: null })
    changed()
    navigate(`/textos/${d.id}`)
  }

  return (
    <div className="flex h-full min-h-0">
      <aside aria-label="Textos" className="flex w-(--layout-list-panel) shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="type-label text-muted">Textos</h1>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={create} aria-label="Novo texto">
            Novo
          </Button>
        </div>
        {list.error && <div className="px-3"><ErrorNote message={list.error} onRetry={list.reload} /></div>}
        <ul className="flex-1 overflow-auto px-2 pb-3">
          {list.data?.map((d) => (
            <li key={d.id}>
              <Link
                to={`/textos/${d.id}`}
                aria-current={d.id === id ? 'page' : undefined}
                className={cx('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', d.id === id ? 'bg-surface-raised' : 'hover:bg-surface')}
              >
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{d.title || 'Sem título'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="min-w-0 flex-1 overflow-auto px-6 py-5">
        {id ? (
          <TextDetail key={id} id={id} />
        ) : (
          <Card>
            <EmptyState
              icon={<FileText />}
              title={list.data?.length ? 'Escolha um texto' : 'Nenhum texto ainda'}
              text="Páginas livres: a introdução do caso, as regras da casa, a aventura pronta reescrita do seu jeito."
              action={
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
                  Novo texto
                </Button>
              }
            />
          </Card>
        )}
      </section>
    </div>
  )
}
