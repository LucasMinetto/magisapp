// N03 Sessão: a tela que fica aberta durante o jogo. Cena atual, NPCs com PV/SAN à mão, pistas da cena e notas.
import { Clapperboard, Dices, ExternalLink, FileQuestion, MapPin, Minus, Plus, SearchCheck, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import type { Clue, Entity, GameSession, SceneSummary, StatValue } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { SceneEditor } from '@/editor/SceneEditor'
import { KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, Portrait, SaveIndicator } from '@/ui'
import { SceneMaterial } from './Material'
import { SceneNotes } from './SceneNotes'
import { GameClock } from './Timeline'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const sessionLabel = (s: GameSession) => `Sessão ${s.number}${s.playedOn ? ` · ${s.playedOn.slice(8)}/${s.playedOn.slice(5, 7)}` : ''}`

type Resource = { current: number; max: number }
const isResource = (v: StatValue | undefined): v is Resource => typeof v === 'object' && v !== null && !Array.isArray(v)
const QUICK = [
  ['pv', 'PV'],
  ['san', 'SAN'],
  ['pe', 'PE'],
  ['pd', 'PD']
] as const

/** A cena "de agora": a que contém a hora do relógio; senão a próxima planejada; senão a última. */
function currentScene(scenes: SceneSummary[], now: number): SceneSummary | undefined {
  const timed = scenes.filter((s) => s.gameMinuteStart !== null)
  return (
    timed.find((s) => s.gameMinuteStart! <= now && now <= (s.gameMinuteEnd ?? s.gameMinuteStart!)) ??
    timed.find((s) => s.status === 'planejada' && s.gameMinuteStart! >= now) ??
    timed.at(-1) ??
    scenes[0]
  )
}

// ------------------------------------------------------------ NPC com PV/SAN à mão

function QuickSheet({ id }: { id: string }) {
  const { changed } = useCampaign()
  const loaded = useLoad(() => window.api.entities.get(id), [id])
  const [entity, setEntity] = useState<Entity | null>(null)
  const autosave = useAutosave(async (e: Entity) => {
    await window.api.entities.save(e)
    changed()
  }, 400)
  useEffect(() => {
    if (loaded.data) setEntity(loaded.data)
  }, [loaded.data])
  if (!entity) return null

  const bump = (key: string, delta: number) => {
    const r = entity.stats[key]
    if (!isResource(r)) return
    const next = { ...entity, stats: { ...entity.stats, [key]: { ...r, current: Math.min(r.max, r.current + delta) } } }
    setEntity(next)
    autosave.schedule(next)
  }
  const defesa = entity.stats.defesa
  const extra = [entity.stats.vd && `VD ${entity.stats.vd}`, typeof defesa === 'number' && defesa > 0 && `Defesa ${defesa}`].filter(Boolean)

  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <Portrait name={entity.name} src={entity.portraitUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{entity.name}</div>
          <div className="truncate text-xs text-muted">
            {KIND_LABEL[entity.kind].one}
            {entity.isPlayer && ' · PJ'}
            {entity.role && ` · ${entity.role}`}
            {extra.length > 0 && ` · ${extra.join(' · ')}`}
          </div>
        </div>
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <Link to={`/ficha/${entity.id}`} aria-label={`Abrir a ficha ${entity.name}`} title="Abrir a ficha" className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-raised hover:text-fg">
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {QUICK.filter(([key]) => isResource(entity.stats[key]) && (entity.stats[key] as Resource).max > 0).map(([key, label]) => {
          const r = entity.stats[key] as Resource
          const low = r.current <= 0 ? 'text-danger' : r.current / r.max < 0.35 ? 'text-warning' : 'text-fg'
          return (
            <div key={key} className="flex items-center gap-1" role="group" aria-label={`${label} de ${entity.name}`}>
              <span className="type-label w-8 text-muted">{label}</span>
              <button type="button" aria-label={`Tirar 1 de ${label}`} onClick={() => bump(key, -1)} className="grid size-6 place-items-center rounded-md border border-border-input text-muted hover:text-fg">
                <Minus className="size-3" aria-hidden />
              </button>
              <span className={cx('w-14 text-center font-mono text-sm', low)} aria-live="polite">
                {r.current}/{r.max}
              </span>
              <button type="button" aria-label={`Somar 1 em ${label}`} onClick={() => bump(key, 1)} className="grid size-6 place-items-center rounded-md border border-border-input text-muted hover:text-fg">
                <Plus className="size-3" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </li>
  )
}

// ------------------------------------------------------------ pistas da cena

function ClueRow({ clue, sessionId }: { clue: Clue; sessionId: string | null }) {
  const campaign = useOpenCampaign()
  const { changed } = useCampaign()
  const [error, setError] = useState<string | null>(null)
  const save = async (found: boolean) => {
    try {
      await window.api.clues.save({
        id: clue.id,
        title: clue.title,
        description: clue.description,
        reveals: clue.reveals,
        status: found ? 'achada' : 'oculta',
        imageId: clue.image?.id ?? null,
        plannedSceneId: clue.plannedSceneId,
        locationId: clue.locationId,
        foundGameMinute: found ? campaign.currentGameMinute : null,
        foundSessionId: found ? sessionId : null,
        finderIds: found ? clue.finders.map((f) => f.id) : []
      })
      setError(null)
      changed()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-bg">
        {clue.image ? <img src={clue.image.url} alt={clue.title} className="size-full object-cover" /> : <FileQuestion className="size-5 text-subtle" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <Link to={`/pistas?pista=${clue.id}`} className="block truncate text-sm font-semibold hover:underline">
          {clue.title || 'Sem título'}
        </Link>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {clue.status === 'oculta' ? (
            <span>{clue.locationName ?? 'sem lugar'}</span>
          ) : (
            <>
              <Chip tone={clue.status === 'achada' ? 'found' : 'understood'}>{clue.status === 'achada' ? 'Achada' : 'Entendida'}</Chip>
              {clue.foundGameMinute !== null && <span className="font-mono">{formatGameTime(campaign.epochDate, clue.foundGameMinute)}</span>}
              {clue.foundSessionNumber !== null && <span>sessão {clue.foundSessionNumber}</span>}
            </>
          )}
        </span>
        {error && <span className="block text-xs text-danger">{error}</span>}
      </span>
      {clue.status === 'oculta' ? (
        <Button size="sm" variant="primary" icon={<SearchCheck className="size-4" />} onClick={() => void save(true)} aria-label={`Achada agora: ${clue.title}`}>
          Achada
        </Button>
      ) : (
        clue.status === 'achada' && (
          <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" />} onClick={() => void save(false)} aria-label={`Desfazer: ${clue.title} volta a oculta`} title="Desfazer: volta a oculta" />
        )
      )}
    </li>
  )
}

// ------------------------------------------------------------ notas da sessão

function Notes({ sessionId }: { sessionId: string }) {
  const { changed } = useCampaign()
  const loaded = useLoad(() => window.api.sessions.get(sessionId), [sessionId])
  const autosave = useAutosave(async (notes: string) => {
    await window.api.sessions.saveNotes({ id: sessionId, notes })
    changed()
  })
  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />
  if (!loaded.data) return null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="type-label text-muted">Notas da sessão {loaded.data.number}</h2>
        <SaveIndicator state={autosave.state} error={autosave.error} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface px-4 py-3 [&_.ProseMirror]:min-h-40 [&_.ProseMirror]:text-base">
        <SceneEditor
          key={sessionId}
          initial={loaded.data.notes}
          label={`Notas da sessão ${loaded.data.number}`}
          placeholder="O que aconteceu, decisões dos jogadores, ganchos para a próxima."
          onChange={(json) => autosave.schedule(json)}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------ tela

export function Session() {
  const campaign = useOpenCampaign()
  const { version, changed } = useCampaign()
  const [params, setParams] = useSearchParams()
  const timeline = useLoad(() => window.api.timeline.list(), [version])
  const sessions = useLoad(() => window.api.sessions.list(), [version])
  const clues = useLoad(() => window.api.clues.list(), [version])

  const sessionId = params.get('s') ?? sessions.data?.at(-1)?.id ?? null
  const scenes = timeline.data?.scenes ?? []
  const auto = currentScene(scenes, campaign.currentGameMinute)
  const sceneId = params.get('cena') ?? auto?.id ?? null
  const scene = useLoad(() => (sceneId ? window.api.scenes.get(sceneId) : Promise.resolve(null)), [sceneId, version])

  const set = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  const start = async () => {
    const s = await window.api.sessions.create({ playedOn: today() })
    changed()
    set('s', s.id)
  }
  const markPlayed = async () => {
    if (!scene.data) return
    const { mentions: _m, locationName: _l, sort: _s, summaryText: _t, attachments: _a, notes: _n, ...input } = scene.data
    await window.api.scenes.save({ ...input, status: 'jogada' })
    changed()
  }

  const people = (scene.data?.mentions ?? []).filter((m) => m.kind === 'personagem' || m.kind === 'criatura')
  const sceneClues = useMemo(
    () =>
      (clues.data ?? []).filter(
        (c) => scene.data && (c.plannedSceneId === scene.data.id || (scene.data.locationId !== null && c.locationId === scene.data.locationId))
      ),
    [clues.data, scene.data]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 py-5">
      <h1 className="sr-only">Sessão</h1>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="session-pick">
          Sessão
        </label>
        <select
          id="session-pick"
          value={sessionId ?? ''}
          onChange={(e) => set('s', e.target.value || null)}
          className="h-9 rounded-md border border-border-input bg-bg px-3 text-sm font-semibold text-fg focus:border-focus"
        >
          {!sessions.data?.length && <option value="">Nenhuma sessão</option>}
          {sessions.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {sessionLabel(s)}
            </option>
          ))}
        </select>
        <Button icon={<Dices className="size-4" />} onClick={() => void start()}>
          Começar sessão {(sessions.data?.length ?? 0) + 1} (hoje)
        </Button>
        <span className="ml-auto text-xs text-subtle">Ctrl+K acha qualquer coisa · Alt+→ avança 10 min</span>
      </div>
      {(timeline.error || sessions.error || clues.error) && <ErrorNote message={(timeline.error || sessions.error || clues.error)!} />}

      <GameClock scenes={scenes} events={timeline.data?.events ?? []} />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-5">
        <section aria-labelledby="now-scene-h" className="flex min-h-0 flex-col gap-3 overflow-auto pr-1">
          <div className="flex items-center gap-2">
            <h2 id="now-scene-h" className="type-label text-muted">
              Cena atual
            </h2>
            <select
              aria-label="Escolher a cena"
              value={sceneId ?? ''}
              onChange={(e) => set('cena', e.target.value || null)}
              className="ml-auto h-8 max-w-56 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus"
            >
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.gameMinuteStart === null ? '' : `${formatGameTime(campaign.epochDate, s.gameMinuteStart)} · `}
                  {s.title || 'Sem título'}
                  {s.id === auto?.id ? ' (agora)' : ''}
                </option>
              ))}
            </select>
          </div>
          {!scene.data && scenes.length === 0 && (
            <Card>
              <EmptyState icon={<Clapperboard />} title="Nenhuma cena" text="Crie as cenas da aventura com hora no jogo e elas aparecem aqui na ordem." />
            </Card>
          )}
          {scene.data && (
            <>
              <Card className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="type-lg truncate">{scene.data.title || 'Sem título'}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      {scene.data.gameMinuteStart !== null && <span className="font-mono">{formatGameTime(campaign.epochDate, scene.data.gameMinuteStart)}</span>}
                      {scene.data.locationName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {scene.data.locationName}
                        </span>
                      )}
                    </div>
                  </div>
                  {scene.data.status === 'jogada' ? (
                    <Chip tone="success">Jogada</Chip>
                  ) : (
                    <Button size="sm" onClick={() => void markPlayed()}>
                      Marcar como jogada
                    </Button>
                  )}
                  <Link to={`/cenas/${scene.data.id}`} className="text-xs text-subtle hover:text-fg hover:underline">
                    editar
                  </Link>
                </div>
                <div className="max-h-[45vh] overflow-auto">
                  <SceneEditor key={`${scene.data.id}:${version}`} readOnly initial={scene.data.body} label={`Texto da cena ${scene.data.title}`} onChange={() => {}} />
                </div>
              </Card>
              <SceneMaterial readOnly sceneId={scene.data.id} items={scene.data.attachments} onChange={scene.reload} />
              <SceneNotes readOnly sceneId={scene.data.id} notes={scene.data.notes} onChange={scene.reload} />
              <section aria-labelledby="people-h">
                <h2 id="people-h" className="type-label mb-2 text-muted">
                  Quem está na cena
                </h2>
                {people.length === 0 && <p className="text-sm text-subtle">Nenhum personagem ou criatura citado no texto desta cena.</p>}
                <ul className="flex flex-col gap-2">
                  {people.map((p) => (
                    <QuickSheet key={p.id} id={p.id} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </section>

        <section aria-labelledby="scene-clues-h" className="flex min-h-0 flex-col gap-2 overflow-auto">
          <h2 id="scene-clues-h" className="type-label text-muted">
            Pistas desta cena
          </h2>
          {scene.data && sceneClues.length === 0 && <p className="text-sm text-subtle">Nenhuma pista plantada nesta cena ou neste lugar.</p>}
          {!sessionId && sceneClues.some((c) => c.status === 'oculta') && (
            <p className="text-xs text-warning">Comece uma sessão para a pista achada guardar em qual sessão foi.</p>
          )}
          <ul className="flex flex-col gap-2" aria-label="Pistas desta cena">
            {sceneClues.map((c) => (
              <ClueRow key={c.id} clue={c} sessionId={sessionId} />
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col">
          {sessionId ? (
            <Notes key={sessionId} sessionId={sessionId} />
          ) : (
            <Card>
              <EmptyState
                icon={<Dices />}
                title="Nenhuma sessão ainda"
                text="Comece a sessão de hoje para guardar notas e saber em que sessão cada pista foi achada."
                action={
                  <Button variant="primary" icon={<Dices className="size-4" />} onClick={() => void start()}>
                    Começar sessão 1
                  </Button>
                }
              />
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
