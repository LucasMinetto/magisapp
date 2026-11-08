import { Eye, EyeOff, FileQuestion, ImagePlus, MapPin, Plus, SearchCheck, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import { CLUE_STATUSES, type Attachment, type Clue, type ClueInput, type ClueStatus, type GameSession } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { createClue, KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { GameDateTimeInput } from '@/ui/GameDateTimeInput'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, Portrait, SaveIndicator, SelectField, TextArea } from '@/ui'

const STATUS_LABEL: Record<ClueStatus, string> = { oculta: 'Oculta', achada: 'Achada', entendida: 'Entendida' }
const STATUS_PLURAL: Record<ClueStatus, string> = { oculta: 'Ocultas', achada: 'Achadas', entendida: 'Entendidas' }
const STATUS_TONE = { oculta: 'hidden', achada: 'found', entendida: 'understood' } as const

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const sessionLabel = (s: GameSession) => `Sessão ${s.number}${s.playedOn ? ` · ${s.playedOn.slice(8)}/${s.playedOn.slice(5, 7)}` : ''}`

/** Primeira imagem de um arrastar-e-soltar, importada para anexos/. */
async function importDropped(e: DragEvent): Promise<Attachment | null> {
  const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
  if (!file) return null
  return window.api.attachments.importPath(window.api.pathForFile(file))
}

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')
const filterSelect = 'h-8 max-w-48 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus'

/** Área que aceita soltar imagem: realça enquanto o arquivo está em cima. */
function DropZone({ onImage, onError, className, children }: {
  onImage: (a: Attachment, fileName: string) => void
  onError: (msg: string) => void
  className?: string
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      className={cx(className, over && 'outline-2 -outline-offset-2 outline-accent')}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const name = e.dataTransfer.files[0]?.name ?? ''
        importDropped(e)
          .then((a) => (a ? onImage(a, name) : onError('Solte um arquivo de imagem (png, jpg, webp, gif).')))
          .catch((err: Error) => onError(err.message))
      }}
    >
      {children}
    </div>
  )
}

// ------------------------------------------------------------ cartão

function ClueCard({ clue, selected, onSelect, onImage, onError }: {
  clue: Clue
  selected: boolean
  onSelect: () => void
  onImage: (a: Attachment) => void
  onError: (msg: string) => void
}) {
  const campaign = useOpenCampaign()
  return (
    <DropZone onImage={onImage} onError={onError} className="rounded-lg">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          'flex w-full flex-col overflow-hidden rounded-lg border bg-surface text-left transition-colors',
          selected ? 'border-accent' : 'border-border hover:border-border-input'
        )}
      >
        <span className="grid aspect-[4/3] w-full place-items-center overflow-hidden border-b border-border bg-bg">
          {clue.image ? (
            <img src={clue.image.url} alt={clue.title || 'Pista sem título'} className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-subtle">
              <FileQuestion className="size-8" aria-hidden />
              <span className="text-xs">sem imagem</span>
            </span>
          )}
        </span>
        <span className="flex flex-col gap-1.5 p-3">
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{clue.title || 'Sem título'}</span>
            <Chip tone={STATUS_TONE[clue.status]}>{STATUS_LABEL[clue.status]}</Chip>
          </span>
          {clue.locationName && (
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
              <MapPin className="size-3 shrink-0" aria-hidden />
              {clue.locationName}
            </span>
          )}
          {clue.status !== 'oculta' && (
            <span className="flex items-center gap-2">
              <span className="flex min-w-0 flex-1 flex-col text-xs text-muted">
                {clue.foundGameMinute !== null && <span className="truncate font-mono">{formatGameTime(campaign.epochDate, clue.foundGameMinute)}</span>}
                {clue.foundSessionNumber !== null && <span className="truncate">Sessão {clue.foundSessionNumber}</span>}
              </span>
              {clue.finders.length > 0 && (
                <span className="flex -space-x-1.5" title={`Achada por ${clue.finders.map((f) => f.name).join(', ')}`}>
                  {clue.finders.map((f) => (
                    <Portrait key={f.id} name={f.name} size={24} />
                  ))}
                  <span className="sr-only">Achada por {clue.finders.map((f) => f.name).join(', ')}</span>
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </DropZone>
  )
}

// ------------------------------------------------------------ editor

const toInput = (c: Clue): ClueInput => ({
  id: c.id,
  title: c.title,
  description: c.description,
  reveals: c.reveals,
  status: c.status,
  imageId: c.image?.id ?? null,
  plannedSceneId: c.plannedSceneId,
  locationId: c.locationId,
  foundGameMinute: c.foundGameMinute,
  foundSessionId: c.foundSessionId,
  finderIds: c.finders.map((f) => f.id)
})

function ClueEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const campaign = useOpenCampaign()
  const { changed, version } = useCampaign()
  const loaded = useLoad(() => window.api.clues.get(id), [id])
  const linked = useLoad(() => window.api.clues.get(id).then((c) => c.links), [id, version])
  const places = useLoad(() => window.api.entities.list({ kind: 'local' }), [version])
  const people = useLoad(() => window.api.entities.list({ kind: 'personagem' }).then((l) => l.filter((e) => e.isPlayer)), [version])
  const scenes = useLoad(() => window.api.scenes.list(), [version])
  const sessions = useLoad(() => window.api.sessions.list(), [version])
  const [draft, setDraft] = useState<ClueInput | null>(null)
  const [image, setImage] = useState<Attachment | null>(null)
  const [showReveals, setShowReveals] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autosave = useAutosave(async (value: ClueInput) => {
    await window.api.clues.save(value)
    changed()
  })

  useEffect(() => {
    if (!loaded.data) return
    setDraft(toInput(loaded.data))
    setImage(loaded.data.image)
  }, [loaded.data])

  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />
  if (!draft) return null

  const update = (patch: Partial<ClueInput>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    autosave.schedule(next)
  }
  const setPicture = (a: Attachment | null) => {
    setImage(a)
    setError(null)
    update({ imageId: a?.id ?? null })
  }
  const pick = () =>
    window.api.attachments
      .pickImage()
      .then((a) => a && setPicture(a))
      .catch((e: Error) => setError(e.message))
  const lastSession = sessions.data?.at(-1)
  const foundNow = () =>
    update({ status: 'achada', foundGameMinute: campaign.currentGameMinute, foundSessionId: draft.foundSessionId ?? lastSession?.id ?? null })
  const pickSession = async (value: string) => {
    if (value !== '__new') return update({ foundSessionId: value || null })
    const s = await window.api.sessions.create({ playedOn: today() })
    changed()
    update({ foundSessionId: s.id })
  }
  const toggleFinder = (finder: string) =>
    update({ finderIds: draft.finderIds.includes(finder) ? draft.finderIds.filter((f) => f !== finder) : [...draft.finderIds, finder] })
  const trash = async () => {
    await autosave.flush()
    await window.api.clues.trash(id)
    changed()
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="type-label text-muted">Pista</span>
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <Button size="sm" variant="ghost" icon={<X className="size-4" />} aria-label="Fechar a pista" onClick={onClose} className="ml-auto" />
      </div>

      <DropZone onImage={(a) => setPicture(a)} onError={setError} className="rounded-lg">
        {image ? (
          <figure className="flex flex-col gap-2">
            <img src={image.url} alt={draft.title || 'Pista sem título'} className="max-h-64 w-full rounded-lg border border-border bg-bg object-contain" />
            <figcaption className="flex items-center gap-2 text-xs text-subtle">
              <span className="min-w-0 flex-1 truncate" title={image.relPath}>
                {image.fileName}
              </span>
              <Button size="sm" variant="ghost" onClick={pick}>
                Trocar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPicture(null)}>
                Tirar
              </Button>
            </figcaption>
          </figure>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-input px-4 py-6 text-center">
            <ImagePlus className="size-6 text-subtle" aria-hidden />
            <p className="text-sm text-muted">Solte a imagem da pista aqui</p>
            <Button size="sm" onClick={pick}>
              Escolher imagem
            </Button>
          </div>
        )}
      </DropZone>
      {error && <p className="text-xs text-danger">{error}</p>}

      <label className="sr-only" htmlFor="clue-title">
        Título da pista
      </label>
      <input
        id="clue-title"
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Nome da pista"
        autoFocus={!draft.title}
        maxLength={300}
        className="type-lg w-full rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-focus"
      />

      <div className="flex items-end gap-3">
        <SelectField
          label="Situação"
          className="flex-1"
          options={CLUE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          value={draft.status}
          onChange={(e) => {
            const status = e.target.value as ClueStatus
            if (status !== 'oculta' && draft.status === 'oculta') update({ status, foundGameMinute: campaign.currentGameMinute, foundSessionId: lastSession?.id ?? null })
            else update({ status })
          }}
        />
        {draft.status === 'oculta' && (
          <Button variant="primary" icon={<SearchCheck className="size-4" />} onClick={foundNow}>
            Achada agora
          </Button>
        )}
      </div>

      <TextArea label="Descrição" hint="O que os jogadores veem." value={draft.description} maxLength={20_000} onChange={(e) => update({ description: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Onde está"
          empty="Sem lugar"
          options={(places.data ?? []).map((p) => ({ value: p.id, label: p.name || 'Sem nome' }))}
          value={draft.locationId ?? ''}
          onChange={(e) => update({ locationId: e.target.value || null })}
        />
        <SelectField
          label="Cena planejada"
          empty="Nenhuma"
          options={(scenes.data ?? []).map((s) => ({ value: s.id, label: s.title || 'Sem título' }))}
          value={draft.plannedSceneId ?? ''}
          onChange={(e) => update({ plannedSceneId: e.target.value || null })}
        />
      </div>

      {draft.status !== 'oculta' && (
        <Card className="flex flex-col gap-4">
          <GameDateTimeInput label="Achada em" epochDate={campaign.epochDate} value={draft.foundGameMinute} onChange={(m) => update({ foundGameMinute: m })} />
          <SelectField
            label="Sessão"
            empty="Sem sessão"
            options={[
              ...(sessions.data ?? []).map((s) => ({ value: s.id, label: sessionLabel(s) })),
              { value: '__new', label: `Nova sessão (${(sessions.data?.length ?? 0) + 1}, hoje)` }
            ]}
            value={draft.foundSessionId ?? ''}
            onChange={(e) => void pickSession(e.target.value)}
          />
          <fieldset>
            <legend className="type-label mb-2 text-muted">Quem achou</legend>
            {people.data?.length === 0 && <p className="text-sm text-subtle">Marque fichas como personagem de jogador para aparecerem aqui.</p>}
            <div className="flex flex-wrap gap-2">
              {people.data?.map((p) => (
                <label
                  key={p.id}
                  className="inline-flex h-7 cursor-pointer items-center gap-2 rounded-pill border border-border px-3 text-xs has-checked:border-accent has-checked:bg-surface-raised"
                >
                  <input type="checkbox" className="accent-accent" checked={draft.finderIds.includes(p.id)} onChange={() => toggleFinder(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showReveals}
          aria-controls="clue-reveals"
          icon={showReveals ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          onClick={() => setShowReveals(!showReveals)}
          className="self-start"
        >
          {showReveals ? 'Esconder o que revela' : 'O que ela revela (só você)'}
        </Button>
        {showReveals && (
          <div id="clue-reveals">
            <TextArea label="O que revela" hint="Escondido por padrão, para a tela poder ficar à vista na mesa." value={draft.reveals} maxLength={20_000} onChange={(e) => update({ reveals: e.target.value })} />
          </div>
        )}
      </section>

      <section aria-labelledby="clue-linked-h">
        <h3 id="clue-linked-h" className="type-label mb-2 text-muted">
          Fichas nesta pista
        </h3>
        {linked.data?.length === 0 && <p className="text-sm text-subtle">Escreva o nome de uma ficha no texto e ela aparece aqui.</p>}
        <ul className="flex flex-wrap gap-2">
          {linked.data?.map((m) => (
            <li key={m.id}>
              <Link to={`/ficha/${m.id}`} className="inline-flex h-7 items-center gap-2 rounded-pill border border-border bg-surface px-3 text-xs hover:border-border-input">
                <span className="text-subtle">{KIND_LABEL[m.kind].one}</span>
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={trash} className="self-start">
        Mover para a lixeira
      </Button>
    </div>
  )
}

// ------------------------------------------------------------ tela

export function Clues() {
  const { version, changed } = useCampaign()
  const [params, setParams] = useSearchParams()
  const selected = params.get('pista')
  const list = useLoad(() => window.api.clues.list(), [version])
  const sessions = useLoad(() => window.api.sessions.list(), [version])
  const [status, setStatus] = useState<ClueStatus | null>(null)
  const [place, setPlace] = useState('')
  const [session, setSession] = useState('')
  const [error, setError] = useState<string | null>(null)

  const select = (id: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('pista', id)
      else next.delete('pista')
      return next
    })

  const clues = list.data ?? []
  const places = useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of clues) if (c.locationId && c.locationName) seen.set(c.locationId, c.locationName)
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [clues])
  const shown = clues.filter(
    (c) => (!status || c.status === status) && (!place || c.locationId === place) && (!session || c.foundSessionId === session)
  )
  const count = (s: ClueStatus) => clues.filter((c) => c.status === s).length

  const create = async (title = '', imageId: string | null = null) => {
    const c = await createClue(title, imageId)
    changed()
    select(c.id)
  }
  const setImage = async (clue: Clue, a: Attachment) => {
    await window.api.clues.save({ ...toInput(clue), imageId: a.id })
    changed()
  }
  // Soltar imagem fora de um cartão cria uma pista nova com ela, com o nome do arquivo.
  const fromFile = (a: Attachment, fileName: string) => void create(fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), a.id)

  const filterBtn = (value: ClueStatus | null, label: string, n: number) => (
    <Button
      key={label}
      size="sm"
      variant="ghost"
      aria-pressed={status === value}
      onClick={() => setStatus(value)}
      className="aria-pressed:bg-surface-raised aria-pressed:text-fg"
    >
      {label} <span className="font-mono text-xs text-subtle">{n}</span>
    </Button>
  )

  return (
    <div className="flex h-full min-h-0">
      <DropZone onImage={fromFile} onError={setError} className="min-w-0 flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5">
          <h1 className="sr-only">Pistas</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filtrar por situação" className="flex rounded-md border border-border p-0.5">
              {filterBtn(null, 'Todas', clues.length)}
              {CLUE_STATUSES.map((s) => filterBtn(s, STATUS_PLURAL[s], count(s)))}
            </div>
            <select aria-label="Filtrar por lugar" value={place} onChange={(e) => setPlace(e.target.value)} className={filterSelect}>
              <option value="">Todos os lugares</option>
              {places.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select aria-label="Filtrar por sessão" value={session} onChange={(e) => setSession(e.target.value)} className={filterSelect}>
              <option value="">Todas as sessões</option>
              {sessions.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => create()} className="ml-auto">
              Nova pista
            </Button>
          </div>
          {error && <ErrorNote message={error} />}
          {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}

          {list.data && clues.length === 0 && (
            <Card>
              <EmptyState
                icon={<SearchCheck />}
                title="Nenhuma pista ainda"
                text="Crie as pistas da aventura, ou solte as imagens aqui: cada uma vira uma pista."
                action={
                  <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => create()}>
                    Nova pista
                  </Button>
                }
              />
            </Card>
          )}
          {clues.length > 0 && shown.length === 0 && <p className="text-sm text-muted">Nenhuma pista com esses filtros.</p>}

          <ul className="grid grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] gap-4" aria-label="Pistas">
            {shown.map((c) => (
              <li key={c.id}>
                <ClueCard clue={c} selected={selected === c.id} onSelect={() => select(c.id)} onImage={(a) => void setImage(c, a)} onError={setError} />
              </li>
            ))}
          </ul>
          {clues.length > 0 && <p className="text-xs text-subtle">Solte imagens aqui para criar pistas; solte num cartão para trocar a imagem dele.</p>}
        </div>
      </DropZone>

      {selected && (
        <aside aria-label="Pista" className="w-(--layout-editor-panel) shrink-0 overflow-auto border-l border-border px-5 py-5">
          <ClueEditor key={selected} id={selected} onClose={() => select(null)} />
        </aside>
      )}
    </div>
  )
}
