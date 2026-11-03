import { Clapperboard, LayoutGrid, List, MapPin, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import { SCENE_STATUSES, type Scene, type SceneInput, type SceneStatus } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { SceneEditor } from '@/editor/SceneEditor'
import { Corkboard } from './Corkboard'
import { SceneMaterial } from './Material'
import { SceneNotes } from './SceneNotes'
import { StructureMenu } from './StructureMenu'
import { createScene, KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { GameDateTimeInput } from '@/ui/GameDateTimeInput'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, IconButton, SaveIndicator, SelectField } from '@/ui'

const STATUS_LABEL: Record<SceneStatus, string> = { planejada: 'Planejada', jogada: 'Jogada', pulada: 'Pulada' }

const toInput = (s: Scene): SceneInput => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
  body: s.body,
  status: s.status,
  locationId: s.locationId,
  gameMinuteStart: s.gameMinuteStart,
  gameMinuteEnd: s.gameMinuteEnd
})

function SceneDetail({ id }: { id: string }) {
  const campaign = useOpenCampaign()
  const { changed, version } = useCampaign()
  const navigate = useNavigate()
  const loaded = useLoad(() => window.api.scenes.get(id), [id])
  const mentions = useLoad(() => window.api.scenes.get(id).then((s) => s.mentions), [id, version])
  const material = useLoad(() => window.api.scenes.get(id).then((s) => s.attachments), [id, version])
  const notes = useLoad(() => window.api.scenes.get(id).then((s) => s.notes), [id, version])
  const places = useLoad(() => window.api.entities.list({ kind: 'local' }), [version])
  const [draft, setDraft] = useState<SceneInput | null>(null)
  const autosave = useAutosave(async (value: SceneInput) => {
    await window.api.scenes.save(value)
    changed()
  })

  useEffect(() => {
    if (loaded.data) setDraft(toInput(loaded.data))
  }, [loaded.data])

  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />
  if (!draft) return null

  const timeError =
    draft.gameMinuteEnd !== null && draft.gameMinuteStart !== null && draft.gameMinuteEnd < draft.gameMinuteStart
      ? 'O fim não pode ser antes do início.'
      : null

  const update = (patch: Partial<SceneInput>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    const badTime = next.gameMinuteEnd !== null && next.gameMinuteStart !== null && next.gameMinuteEnd < next.gameMinuteStart
    if (!badTime) autosave.schedule(next)
  }

  const trash = async () => {
    await autosave.flush()
    await window.api.scenes.trash(id)
    changed()
    navigate('/cenas')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={trash} className="ml-auto">
          Mover para a lixeira
        </Button>
      </div>

      <label className="sr-only" htmlFor="scene-title">
        Título da cena
      </label>
      <input
        id="scene-title"
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Título da cena"
        autoFocus={!draft.title}
        maxLength={300}
        className="type-xl w-full rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-focus"
      />

      <Card className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <GameDateTimeInput label="Começa" epochDate={campaign.epochDate} value={draft.gameMinuteStart} onChange={(m) => update({ gameMinuteStart: m })} />
        <GameDateTimeInput
          label="Termina"
          epochDate={campaign.epochDate}
          value={draft.gameMinuteEnd}
          onChange={(m) => update({ gameMinuteEnd: m })}
          error={timeError}
        />
        <SelectField
          label="Lugar"
          className="min-w-48"
          empty="Sem lugar"
          options={(places.data ?? []).map((p) => ({ value: p.id, label: p.name || 'Sem nome' }))}
          value={draft.locationId ?? ''}
          onChange={(e) => update({ locationId: e.target.value || null })}
        />
        <SelectField
          label="Situação"
          options={SCENE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          value={draft.status}
          onChange={(e) => update({ status: e.target.value as SceneStatus })}
        />
      </Card>

      <div className="rounded-lg border border-border bg-surface px-8 py-7">
        <div className="mx-auto max-w-(--layout-reading-max)">
          <SceneEditor key={id} initial={draft.body} label={`Texto da cena ${draft.title}`} onChange={(body) => update({ body })} />
        </div>
      </div>

      <section aria-labelledby="in-scene-h">
        <h2 id="in-scene-h" className="type-label mb-2 text-muted">
          Fichas nesta cena
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

      <SceneNotes sceneId={id} notes={notes.data ?? []} onChange={notes.reload} />

      <SceneMaterial sceneId={id} items={material.data ?? []} onChange={material.reload} />
    </div>
  )
}

export function Scenes() {
  const { id } = useParams()
  const campaign = useOpenCampaign()
  const { version, changed } = useCampaign()
  const navigate = useNavigate()
  const list = useLoad(() => window.api.scenes.list(), [version])
  const [params] = useSearchParams()
  const board = !id && params.get('ver') === 'corkboard'

  const create = async () => {
    const newId = await createScene()
    changed()
    navigate(`/cenas/${newId}`)
  }

  if (board)
    return (
      <div className="h-full overflow-auto px-6 py-5">
        <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="type-xl mr-auto">Cenas</h1>
            <div role="group" aria-label="Modo de ver" className="flex rounded-md border border-border p-0.5">
              <Button size="sm" variant="ghost" icon={<List className="size-4" />} onClick={() => navigate('/cenas')}>
                Lista
              </Button>
              <Button size="sm" variant="ghost" aria-pressed icon={<LayoutGrid className="size-4" />} className="aria-pressed:bg-surface-raised aria-pressed:text-fg">
                Corkboard
              </Button>
            </div>
            <StructureMenu />
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
              Nova cena
            </Button>
          </div>
          {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
          {list.data && list.data.length === 0 ? (
            <Card>
              <EmptyState icon={<Clapperboard />} title="Nenhuma cena ainda" text="Crie as cenas ou aplique um modelo de investigação para começar com o esqueleto pronto." />
            </Card>
          ) : (
            <Corkboard scenes={list.data ?? []} />
          )}
        </div>
      </div>
    )

  return (
    <div className="flex h-full min-h-0">
      <aside aria-label="Cenas" className="flex w-(--layout-list-panel) shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between gap-1 px-4 py-3">
          <h1 className="type-label mr-auto text-muted" title="Em ordem de hora no jogo">
            Cenas
          </h1>
          <IconButton label="Ver como corkboard" onClick={() => navigate('/cenas?ver=corkboard')}>
            <LayoutGrid className="size-4" />
          </IconButton>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={create} aria-label="Nova cena">
            Nova
          </Button>
        </div>
        {list.error && <div className="px-3"><ErrorNote message={list.error} onRetry={list.reload} /></div>}
        <ol className="flex-1 overflow-auto px-2 pb-3">
          {list.data?.map((s) => (
            <li key={s.id}>
              <Link
                to={`/cenas/${s.id}`}
                aria-current={s.id === id ? 'page' : undefined}
                className={cx(
                  'block rounded-md px-3 py-2 transition-colors',
                  s.id === id ? 'bg-surface-raised' : 'hover:bg-surface'
                )}
              >
                <span className="block font-mono text-xs text-subtle">
                  {s.gameMinuteStart === null ? 'sem hora' : formatGameTime(campaign.epochDate, s.gameMinuteStart)}
                </span>
                <span className={cx('block truncate text-sm', s.status === 'jogada' && 'text-muted')}>{s.title || 'Sem título'}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  {s.locationName && (
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      {s.locationName}
                    </span>
                  )}
                  {s.status !== 'planejada' && <Chip tone={s.status === 'jogada' ? 'success' : 'neutral'}>{STATUS_LABEL[s.status]}</Chip>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto px-6 py-5">
        {id ? (
          <SceneDetail key={id} id={id} />
        ) : (
          <Card>
            <EmptyState
              icon={<Clapperboard />}
              title={list.data?.length ? 'Escolha uma cena' : 'Nenhuma cena ainda'}
              text="Cada cena tem hora no jogo, lugar e o texto que você vai usar na mesa."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
                    Nova cena
                  </Button>
                  <StructureMenu />
                </div>
              }
            />
          </Card>
        )}
      </section>
    </div>
  )
}
