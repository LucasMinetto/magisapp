import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  List,
  MapPin,
  Plus,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatDuration, toParts, weekdayName } from '@shared/gameTime'
import { buildTimeline, countByDay, monthGrid, type TimedItem } from '@shared/timeline'
import { EVENT_STATUSES, type EventStatus, type SceneSummary, type TimelineEvent, type TimelineEventInput } from '@shared/types'
import { useCampaign, useClock, useOpenCampaign } from '@/campaign'
import { createEvent, KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { GameDateTimeInput } from '@/ui/GameDateTimeInput'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, SaveIndicator, SelectField, TextArea } from '@/ui'

const EVENT_STATUS_LABEL: Record<EventStatus, string> = { planejado: 'Planejado', aconteceu: 'Aconteceu', evitado: 'Evitado' }
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

type Item = TimedItem & ({ type: 'scene'; scene: SceneSummary } | { type: 'event'; event: TimelineEvent })

const hour = (epochDate: string, minute: number) => toParts(epochDate, minute).time.replace(':', 'h')
const dayLabel = (date: string, weekday: number) => `${weekdayName(weekday, true)}, ${date.slice(8)}/${date.slice(5, 7)}`

// ------------------------------------------------------------ relógio grande

export function GameClock({ scenes, events }: { scenes: SceneSummary[]; events: TimelineEvent[] }) {
  const campaign = useOpenCampaign()
  const clock = useClock()
  const [setting, setSetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = campaign.currentGameMinute
  const p = toParts(campaign.epochDate, now)

  const nextScene = scenes.find((s) => s.status === 'planejada' && s.gameMinuteStart !== null && s.gameMinuteStart > now)
  const nextEvent = events.find((e) => e.status === 'planejado' && e.gameMinuteStart > now)
  const overdue = events.filter((e) => e.status === 'planejado' && e.gameMinuteStart <= now)

  const run = (job: Promise<void>) => job.then(() => setError(null)).catch((e: Error) => setError(e.message))

  return (
    <Card className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div aria-live="polite">
        <div className="type-label text-muted">Agora no jogo</div>
        <div className="mt-1 font-mono text-4xl leading-none tracking-tight">{hour(campaign.epochDate, now)}</div>
        <div className="mt-1.5 text-sm text-muted">
          {dayLabel(p.date, p.weekday)}/{p.date.slice(0, 4)}
          {now < 0 && <span className="ml-2"><Chip>antes do caso</Chip></span>}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Mudar a hora no jogo">
          <Button size="sm" variant="ghost" onClick={() => run(clock.advance(-10))} title="Alt+←">
            −10 min
          </Button>
          <Button size="sm" onClick={() => run(clock.advance(10))} title="Alt+→">
            +10 min
          </Button>
          <Button size="sm" onClick={() => run(clock.advance(60))} title="Alt+Shift+→">
            +1 h
          </Button>
          <Button
            size="sm"
            disabled={!nextScene}
            onClick={() => nextScene && run(clock.set(nextScene.gameMinuteStart!))}
            title={nextScene ? `Pula para ${nextScene.title || 'a próxima cena'}` : 'Nenhuma cena planejada à frente'}
          >
            Até a próxima cena
          </Button>
          <Button size="sm" variant="ghost" aria-expanded={setting} onClick={() => setSetting(!setting)}>
            Definir…
          </Button>
        </div>
        {setting && (
          <GameDateTimeInput label="Nova hora no jogo" epochDate={campaign.epochDate} value={now} onChange={(m) => m !== null && run(clock.set(m))} />
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {nextEvent ? (
            <>
              <span className="text-muted">Próximo evento:</span>
              <span className="truncate">{nextEvent.title || 'Sem título'}</span>
              <Chip tone={nextEvent.gameMinuteStart - now < 60 ? 'warning' : 'neutral'}>em {formatDuration(nextEvent.gameMinuteStart - now)}</Chip>
            </>
          ) : (
            <span className="text-muted">Nada marcado à frente.</span>
          )}
          {overdue.length > 0 && (
            <Chip tone="danger">
              {overdue.length === 1 ? '1 evento passou sem resolução' : `${overdue.length} eventos passaram sem resolução`}
            </Chip>
          )}
        </div>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------ lista

function TimelineList({ items, unscheduled, selected, onSelect, onCreateAt }: {
  items: Item[]
  unscheduled: SceneSummary[]
  selected: string | null
  onSelect: (id: string) => void
  onCreateAt: (minute: number) => void
}) {
  const campaign = useOpenCampaign()
  const now = campaign.currentGameMinute
  const rows = useMemo(() => buildTimeline(items, campaign.epochDate, now), [items, campaign.epochDate, now])

  return (
    <>
      <ol className="flex flex-col" aria-label="Linha do tempo">
        {rows.map((r) => {
          if (r.row === 'day')
            return (
              <li key={`d${r.date}`} id={`dia-${r.date}`} className="type-label scroll-mt-4 pt-5 pb-2 text-muted first:pt-0">
                {dayLabel(r.date, r.weekday)}
                {r.date === campaign.epochDate && <span className="ml-2 text-subtle normal-case">· dia do caso</span>}
              </li>
            )
          if (r.row === 'now')
            return (
              <li key="now" className="flex items-center gap-3 py-1.5" aria-label={`Agora no jogo: ${hour(campaign.epochDate, r.minute)}`}>
                <span className="w-24 shrink-0 font-mono text-xs font-semibold text-accent">{hour(campaign.epochDate, r.minute)}</span>
                <span className="h-0.5 flex-1 rounded-full bg-accent" aria-hidden />
                <span className="type-label text-accent">agora</span>
              </li>
            )
          if (r.row === 'gap')
            return (
              <li key={`g${r.from}`} className="flex items-center gap-3 py-1">
                <span className="w-24 shrink-0" aria-hidden />
                <div className="flex flex-1 items-center gap-3 rounded-md border border-dashed border-border-input px-3 py-2 text-sm text-muted">
                  <span className="flex-1">
                    {formatDuration(r.to - r.from)} sem nada marcado. O que eles fazem?
                  </span>
                  <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => onCreateAt(r.from)}>
                    Evento aqui
                  </Button>
                </div>
              </li>
            )
          const it = r.item
          const past = (it.end ?? it.start) < now
          const time = `${hour(campaign.epochDate, it.start)}${it.end !== null && it.end !== it.start ? `–${hour(campaign.epochDate, it.end)}` : ''}`
          return (
            <li key={`${it.type}${it.id}`} className="flex items-start gap-3 py-1">
              <span className={cx('w-24 shrink-0 pt-2.5 font-mono text-xs', past ? 'text-subtle' : 'text-muted')}>{time}</span>
              {it.type === 'scene' ? <SceneRow scene={it.scene} past={past} /> : (
                <EventRow event={it.event} past={past} now={now} selected={selected === it.id} onSelect={() => onSelect(it.id)} />
              )}
            </li>
          )
        })}
      </ol>

      {unscheduled.length > 0 && (
        <section aria-labelledby="no-time-h" className="mt-8">
          <h2 id="no-time-h" className="type-label mb-2 text-muted">
            Cenas sem hora
          </h2>
          <p className="mb-2 text-sm text-subtle">Dê uma hora a elas para entrarem na linha do tempo.</p>
          <ul className="flex flex-col gap-1">
            {unscheduled.map((s) => (
              <li key={s.id}>
                <SceneRow scene={s} past={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function SceneRow({ scene, past }: { scene: SceneSummary; past: boolean }) {
  return (
    <Link
      to={`/cenas/${scene.id}`}
      className={cx(
        'flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:border-border-input',
        past && 'text-muted'
      )}
    >
      <Clapperboard className="size-4 shrink-0 text-muted" aria-label="Cena" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{scene.title || 'Sem título'}</span>
      {scene.locationName && (
        <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3 shrink-0" aria-hidden />
          {scene.locationName}
        </span>
      )}
      {scene.status === 'jogada' && <Chip tone="success">Jogada</Chip>}
      {scene.status === 'pulada' && <Chip>Pulada</Chip>}
    </Link>
  )
}

function EventRow({ event, past, now, selected, onSelect }: { event: TimelineEvent; past: boolean; now: number; selected: boolean; onSelect: () => void }) {
  const overdue = event.status === 'planejado' && event.gameMinuteStart <= now
  const people = event.entities.filter((e) => e.id !== event.locationId) // o lugar já aparece com o alfinete
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'flex min-w-0 flex-1 flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors',
        selected ? 'border-accent bg-surface-raised' : 'border-border bg-surface hover:border-border-input',
        past && !overdue && 'text-muted'
      )}
    >
      <span className="flex w-full items-center gap-3">
        <Zap className={cx('size-4 shrink-0', overdue ? 'text-danger' : 'text-warning')} aria-label="Evento" />
        <span className={cx('min-w-0 flex-1 truncate text-sm font-semibold', event.status === 'evitado' && 'line-through')}>{event.title || 'Sem título'}</span>
        {event.locationName && (
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {event.locationName}
          </span>
        )}
        {overdue && <Chip tone="danger">passou sem resolução</Chip>}
        {event.status === 'aconteceu' && <Chip tone="success">Aconteceu</Chip>}
        {event.status === 'evitado' && <Chip>Evitado</Chip>}
      </span>
      {event.status === 'planejado' && event.ifIgnored && (
        <span className="pl-7 text-xs text-muted">Se ninguém agir: {event.ifIgnored}</span>
      )}
      {people.length > 0 && (
        <span className="flex flex-wrap gap-x-3 gap-y-1 pl-7">
          {people.map((e) => (
            <span key={e.id} className="text-xs text-subtle">
              {e.name}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

// ------------------------------------------------------------ calendário

function Calendar({ items, onPickDay }: { items: Item[]; onPickDay: (date: string) => void }) {
  const campaign = useOpenCampaign()
  const nowDate = toParts(campaign.epochDate, campaign.currentGameMinute).date
  const [ym, setYm] = useState(() => [Number(nowDate.slice(0, 4)), Number(nowDate.slice(5, 7))] as const)
  const [year, month] = ym
  const days = useMemo(() => countByDay(items, campaign.epochDate), [items, campaign.epochDate])
  const shift = (d: number) => {
    const m = month - 1 + d
    setYm([year + Math.floor(m / 12), ((m % 12) + 12) % 12 + 1])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} aria-label="Mês anterior" onClick={() => shift(-1)} />
        <h2 className="type-lg min-w-40 text-center" aria-live="polite">
          {MONTHS[month - 1]} de {year}
        </h2>
        <Button size="sm" variant="ghost" icon={<ChevronRight className="size-4" />} aria-label="Próximo mês" onClick={() => shift(1)} />
      </div>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {[0, 1, 2, 3, 4, 5, 6].map((w) => (
              <th key={w} scope="col" className="type-label pb-2 text-left font-normal text-subtle">
                {weekdayName(w)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(year, month).map((week, i) => (
            <tr key={i}>
              {week.map((date, j) => {
                if (!date) return <td key={j} className="border border-border bg-bg" />
                const d = days.get(date)
                const label = `${Number(date.slice(8))} de ${MONTHS[month - 1]}${d ? `: ${d.scenes} cenas, ${d.events} eventos` : ''}`
                return (
                  <td key={j} className="h-24 border border-border p-0 align-top">
                    <button
                      type="button"
                      aria-label={label}
                      disabled={!d}
                      onClick={() => onPickDay(date)}
                      className={cx(
                        'flex size-full flex-col gap-1 p-1.5 text-left transition-colors enabled:hover:bg-surface-raised',
                        date === nowDate && 'outline-2 -outline-offset-2 outline-accent',
                        d ? 'bg-surface' : 'bg-bg'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cx('font-mono text-xs', d ? 'text-fg' : 'text-subtle')}>{Number(date.slice(8))}</span>
                        {date === campaign.epochDate && <span className="truncate text-xs text-muted">dia do caso</span>}
                        {date === nowDate && date !== campaign.epochDate && <span className="truncate text-xs text-accent">agora</span>}
                      </span>
                      {d?.titles.slice(0, 2).map((t, k) => (
                        <span key={k} className="truncate text-xs text-muted">
                          {t || 'Sem título'}
                        </span>
                      ))}
                      {d && d.titles.length > 2 && <span className="text-xs text-subtle">+{d.titles.length - 2}</span>}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------ editor de evento

const toInput = (e: TimelineEvent): TimelineEventInput => ({
  id: e.id,
  title: e.title,
  description: e.description,
  ifIgnored: e.ifIgnored,
  status: e.status,
  gameMinuteStart: e.gameMinuteStart,
  gameMinuteEnd: e.gameMinuteEnd,
  sceneId: e.sceneId,
  locationId: e.locationId
})

function EventEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const campaign = useOpenCampaign()
  const { changed, version } = useCampaign()
  const loaded = useLoad(() => window.api.events.get(id), [id])
  const linked = useLoad(() => window.api.events.get(id).then((e) => e.entities), [id, version])
  const places = useLoad(() => window.api.entities.list({ kind: 'local' }), [version])
  const [draft, setDraft] = useState<TimelineEventInput | null>(null)
  const autosave = useAutosave(async (value: TimelineEventInput) => {
    await window.api.events.save(value)
    changed()
  })

  useEffect(() => {
    if (loaded.data) setDraft(toInput(loaded.data))
  }, [loaded.data])

  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />
  if (!draft) return null

  const timeError = draft.gameMinuteEnd !== null && draft.gameMinuteEnd < draft.gameMinuteStart ? 'O fim não pode ser antes do início.' : null
  const update = (patch: Partial<TimelineEventInput>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (!(next.gameMinuteEnd !== null && next.gameMinuteEnd < next.gameMinuteStart)) autosave.schedule(next)
  }
  const trash = async () => {
    await autosave.flush()
    await window.api.events.trash(id)
    changed()
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="type-label text-muted">Evento</span>
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <Button size="sm" variant="ghost" icon={<X className="size-4" />} aria-label="Fechar o evento" onClick={onClose} className="ml-auto" />
      </div>
      <label className="sr-only" htmlFor="event-title">
        Título do evento
      </label>
      <input
        id="event-title"
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="O que acontece?"
        autoFocus={!draft.title}
        maxLength={300}
        className="type-lg w-full rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-focus"
      />
      <GameDateTimeInput label="Quando" epochDate={campaign.epochDate} value={draft.gameMinuteStart} onChange={(m) => m !== null && update({ gameMinuteStart: m })} />
      <GameDateTimeInput label="Até (opcional)" epochDate={campaign.epochDate} value={draft.gameMinuteEnd} onChange={(m) => update({ gameMinuteEnd: m })} error={timeError} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Lugar"
          empty="Sem lugar"
          options={(places.data ?? []).map((p) => ({ value: p.id, label: p.name || 'Sem nome' }))}
          value={draft.locationId ?? ''}
          onChange={(e) => update({ locationId: e.target.value || null })}
        />
        <SelectField
          label="Situação"
          options={EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABEL[s] }))}
          value={draft.status}
          onChange={(e) => update({ status: e.target.value as EventStatus })}
        />
      </div>
      <TextArea label="O que acontece" value={draft.description} maxLength={20_000} onChange={(e) => update({ description: e.target.value })} />
      <TextArea
        label="Se ninguém agir"
        hint="A consequência se os jogadores não chegarem a tempo."
        value={draft.ifIgnored}
        maxLength={5_000}
        onChange={(e) => update({ ifIgnored: e.target.value })}
      />
      <section aria-labelledby="ev-linked-h">
        <h3 id="ev-linked-h" className="type-label mb-2 text-muted">
          Fichas neste evento
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

export function Timeline() {
  const campaign = useOpenCampaign()
  const { version, changed } = useCampaign()
  const [params, setParams] = useSearchParams()
  const selected = params.get('evento')
  const view = params.get('ver') === 'calendario' ? 'calendario' : 'lista'
  const data = useLoad(() => window.api.timeline.list(), [version])
  const [scrollTo, setScrollTo] = useState<string | null>(null)

  const setParam = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })

  const items = useMemo<Item[]>(() => {
    if (!data.data) return []
    const scenes: Item[] = data.data.scenes
      .filter((s) => s.gameMinuteStart !== null)
      .map((s) => ({ type: 'scene', id: s.id, title: s.title, start: s.gameMinuteStart!, end: s.gameMinuteEnd, scene: s }))
    const events: Item[] = data.data.events.map((e) => ({ type: 'event', id: e.id, title: e.title, start: e.gameMinuteStart, end: e.gameMinuteEnd, event: e }))
    return [...scenes, ...events]
  }, [data.data])

  useEffect(() => {
    if (view !== 'lista' || !scrollTo || !data.data) return
    document.getElementById(`dia-${scrollTo}`)?.scrollIntoView({ block: 'start' })
    setScrollTo(null)
  }, [view, scrollTo, data.data])

  const create = async (minute: number) => {
    const e = await createEvent(minute, campaign.currentGameMinute)
    changed()
    setParam('evento', e.id)
  }

  const empty = data.data && items.length === 0

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5">
          <h1 className="sr-only">Linha do tempo</h1>
          {data.error && <ErrorNote message={data.error} onRetry={data.reload} />}
          <GameClock scenes={data.data?.scenes ?? []} events={data.data?.events ?? []} />

          <div className="flex items-center gap-2">
            <div role="group" aria-label="Modo de ver" className="flex rounded-md border border-border p-0.5">
              <Button size="sm" variant="ghost" aria-pressed={view === 'lista'} icon={<List className="size-4" />} onClick={() => setParam('ver', null)} className="aria-pressed:bg-surface-raised aria-pressed:text-fg">
                Lista
              </Button>
              <Button size="sm" variant="ghost" aria-pressed={view === 'calendario'} icon={<CalendarDays className="size-4" />} onClick={() => setParam('ver', 'calendario')} className="aria-pressed:bg-surface-raised aria-pressed:text-fg">
                Calendário
              </Button>
            </div>
            <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => create(campaign.currentGameMinute)} className="ml-auto">
              Novo evento
            </Button>
          </div>

          {empty ? (
            <Card>
              <EmptyState
                icon={<CalendarClock />}
                title="Nada na linha do tempo"
                text="Dê uma hora às cenas ou crie eventos: o que acontece no mundo mesmo que os jogadores não apareçam."
                action={
                  <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => create(campaign.currentGameMinute)}>
                    Novo evento
                  </Button>
                }
              />
            </Card>
          ) : view === 'calendario' ? (
            <Calendar
              items={items}
              onPickDay={(date) => {
                setScrollTo(date)
                setParam('ver', null)
              }}
            />
          ) : (
            data.data && (
              <TimelineList
                items={items}
                unscheduled={data.data.scenes.filter((s) => s.gameMinuteStart === null)}
                selected={selected}
                onSelect={(id) => setParam('evento', id)}
                onCreateAt={create}
              />
            )
          )}
        </div>
      </section>

      {selected && (
        <aside aria-label="Evento" className="w-(--layout-editor-panel) shrink-0 overflow-auto border-l border-border px-5 py-5">
          <EventEditor key={selected} id={selected} onClose={() => setParam('evento', null)} />
        </aside>
      )}
    </div>
  )
}
